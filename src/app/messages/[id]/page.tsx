'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { useParams,useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { getChat,loadMessages,loadMessageExtras,sendMessage,uploadChatPhoto,chatRpc } from '@/lib/supabase/messaging';
import { chatTitle,groupedBubble,resizeChatPhoto,MAX_MESSAGE_LENGTH,type ChatSummary,type ChatMessage,type Reaction,type PollVote } from '@/lib/social/messaging';
import { useAuthStore } from '@/lib/store/auth';
import { useActivePlan } from '@/lib/store/plan';
import { inputClass } from '@/components/social/controls';
import RequestActions from '@/components/social/RequestActions';
import MessageBubble from '@/components/social/MessageBubble';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export default function ConversationPage(){const {id}=useParams<{id:string}>();const account=useAuthStore(s=>s.user?.id);return <Chat key={`${id}:${account}`} id={id}/>;}
function Chat({id}:{id:string}){
 const userId=useAuthStore(s=>s.user?.id);const router=useRouter();const plan=useActivePlan();
 const [chat,setChat]=useState<ChatSummary|null>(null);const [messages,setMessages]=useState<ChatMessage[]>([]);const [extras,setExtras]=useState<{reactions:Reaction[];votes:PollVote[]}>({reactions:[],votes:[]});
 const [loaded,setLoaded]=useState(false);const [error,setError]=useState('');const [body,setBody]=useState('');const [busy,setBusy]=useState(false);const [mode,setMode]=useState<'text'|'poll'|'trip_card'>('text');const [options,setOptions]=useState('');const [slotId,setSlotId]=useState('');const [version,setVersion]=useState(0);const [hasOlder,setHasOlder]=useState(false);const [loadingOlder,setLoadingOlder]=useState(false);
 const bottom=useRef<HTMLDivElement>(null);const fileInput=useRef<HTMLInputElement>(null);const liveMessages=useRef<ChatMessage[]>([]);const refresh=useCallback(()=>setVersion(v=>v+1),[]);
 useEffect(()=>{if(!userId||!UUID.test(id)){return;}let live=true;let seq=0;const c=createClient();
 const load=async()=>{const n=++seq;try{const knownIds=liveMessages.current.map(m=>m.id);const [info,rows,history]=await Promise.all([getChat(c,id),loadMessages(c,id),knownIds.length>50?c.from('messages').select('*').eq('conversation_id',id).in('id',knownIds):Promise.resolve({data:[],error:null})]);if(history.error)throw new Error('Could not refresh earlier messages.');const next=Array.from(new Map([...(history.data as ChatMessage[]),...rows].map(m=>[m.id,m])).values()).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));const detail=await loadMessageExtras(c,next.map(m=>m.id));if(!live||n!==seq)return;setChat(info);setLoaded(true);setError('');liveMessages.current=next;setMessages(next);setHasOlder(rows.length===50);setExtras(detail);
 if(info&&document.visibilityState==='visible'){await chatRpc(c,'mark_chat_read',{p_chat:id});window.dispatchEvent(new Event('chat-inbox-changed'));}
 }catch(e){if(live&&n===seq){setError(e instanceof Error?e.message:'Could not load chat.');setLoaded(true);}}};
 void load();const channel=c.channel(`chat:${id}:${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'messages',filter:`conversation_id=eq.${id}`},load).on('postgres_changes',{event:'*',schema:'public',table:'message_reactions'},load).on('postgres_changes',{event:'*',schema:'public',table:'poll_votes'},load).subscribe();
 const focus=()=>{if(document.visibilityState==='visible'){void load();void chatRpc(c,'chat_heartbeat').catch(()=>{});}};focus();const timer=setInterval(focus,15000);window.addEventListener('focus',focus);document.addEventListener('visibilitychange',focus);
 return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',focus);document.removeEventListener('visibilitychange',focus);void c.removeChannel(channel);};
 },[id,userId,version]);
 const latestMessageId=messages.at(-1)?.id;
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'end'});},[latestMessageId]);
 async function older(){if(!messages[0])return;setLoadingOlder(true);try{const rows=await loadMessages(createClient(),id,messages[0]);const merged=[...rows,...messages];liveMessages.current=merged;setMessages(merged);setHasOlder(rows.length===50);setExtras(await loadMessageExtras(createClient(),merged.map(m=>m.id)));}catch(e){setError(e instanceof Error?e.message:'Could not load older messages.');}finally{setLoadingOlder(false);}}
 async function send(photo?:File){if(busy||!chat?.accepted||!userId)return;setBusy(true);setError('');const c=createClient();let path:string|undefined;
 try{if(photo){path=await uploadChatPhoto(c,id,await resizeChatPhoto(photo));await sendMessage(c,id,'photo','',{path},userId);}
 else if(mode==='poll')await sendMessage(c,id,'poll',body,{options:options.split('\n').map(s=>s.trim()).filter(Boolean)},userId);
 else if(mode==='trip_card'){const slot=plan.slots?.find(s=>s.id===slotId);if(!slot||!plan.shareViewToken)throw new Error('Choose a slot from a plan with view sharing enabled.');await sendMessage(c,id,'trip_card','',{share_token:plan.shareViewToken,slot_id:slotId,title:`${plan.name} · ${slot.label}`.slice(0,120)},userId);}
 else await sendMessage(c,id,'text',body,{},userId);
 setBody('');setMode('text');setOptions('');refresh();window.dispatchEvent(new Event('chat-inbox-changed'));
 }catch(e){if(path)await c.storage.from('chat-photos').remove([path]);setError(e instanceof Error?e.message:'Could not send.');}finally{setBusy(false);if(fileInput.current)fileInput.current.value='';}}
 if(!UUID.test(id))return <p className="p-6 text-muted">Conversation unavailable.</p>;
 if(!loaded&&!error)return <p role="status" className="p-6 text-muted">Loading messages…</p>;
 if(!chat)return <div className="p-6"><Link href="/messages" className="btn btn-ghost btn-md">Back to messages</Link><p role="alert">{error||'Conversation unavailable.'}</p></div>;
 const lastMine=[...messages].reverse().find(m=>m.sender_id===userId&&!m.deleted_at);
 return <div className="mx-auto max-w-2xl px-4 py-4"><header className="flex items-center gap-3 border-b border-border pb-3"><Link href="/messages" aria-label="Back to inbox" className="btn btn-ghost btn-md">←</Link><div className="min-w-0 flex-1"><h1 className="truncate font-heading text-xl">{chatTitle(chat)}</h1><p className="text-xs text-muted">{chat.active_now?'Active now':chat.person?`@${chat.person.username}`:'Only details shared with you are shown.'}</p></div><details><summary className="btn btn-ghost btn-md cursor-pointer" aria-label="Conversation information">ⓘ</summary><div className="rounded-card border border-border bg-surface p-3 text-sm"><p>Members: You, {chatTitle(chat)}</p><button className="btn btn-secondary btn-md" onClick={async()=>{try{await chatRpc(createClient(),'mute_chat',{p_chat:id,p_muted:!chat.muted});refresh();}catch(e){setError(e instanceof Error?e.message:'Could not save.');}}}>{chat.muted?'Unmute':'Mute'}</button></div></details></header>
 {!chat.accepted&&<section className="my-4 rounded-card bg-primary-soft p-4 text-sm"><p>They won&apos;t see that you&apos;ve read it unless you accept.</p><RequestActions id={id} onChange={a=>{if(a==='accept')refresh();else router.replace('/messages');}}/></section>}
 <div aria-live="polite" aria-label="Messages" className="min-h-48 pb-4">{hasOlder&&<button disabled={loadingOlder} className="btn btn-ghost btn-md" onClick={older}>{loadingOlder?'Loading…':'Earlier messages'}</button>}{messages.map((m,i)=><MessageBubble key={m.id} message={m} mine={m.sender_id===userId} grouped={groupedBubble(messages[i-1],m)} userId={userId??''} name={chat.person?.display_name??'Private profile'} avatar={chat.person?.avatar_path} reactions={extras.reactions.filter(r=>r.message_id===m.id)} votes={extras.votes.filter(v=>v.message_id===m.id)} canSend={chat.accepted} onChange={refresh}/>)}
 {lastMine&&chat.seen_at&&new Date(chat.seen_at)>=new Date(lastMine.created_at)&&<p className="text-right text-xs text-muted">Seen</p>}<div ref={bottom}/></div>
 {error&&<p role="alert" className="my-2 text-sm text-danger">{error}<button className="btn btn-ghost btn-md" onClick={refresh}>Retry</button></p>}
 {chat.accepted&&<form onSubmit={e=>{e.preventDefault();void send();}} className="sticky bottom-[calc(76px+env(safe-area-inset-bottom))] rounded-card border border-border bg-surface p-3 xl:bottom-3"><div className="mb-2 flex flex-wrap gap-2"><details><summary className="btn btn-secondary btn-md cursor-pointer" aria-label="Attach to message">＋</summary><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} className="btn btn-ghost btn-md" onClick={()=>fileInput.current?.click()}>Photo</button><button type="button" className="btn btn-ghost btn-md" onClick={()=>setMode('poll')}>Poll</button><button type="button" className="btn btn-ghost btn-md" onClick={()=>setMode('trip_card')}>Trip card</button></div></details>{mode!=='text'&&<button type="button" className="btn btn-ghost btn-md" onClick={()=>setMode('text')}>Cancel {mode==='poll'?'poll':'trip card'}</button>}</div>
 <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e=>{const file=e.target.files?.[0];if(file)void send(file);}}/>
 {mode==='poll'&&<label className="block text-xs font-semibold">Options (2–6, one per line)<textarea className={inputClass} value={options} maxLength={606} onChange={e=>setOptions(e.target.value)}/></label>}
 {mode==='trip_card'?<label className="block text-xs font-semibold">A slot from your active shared plan<select value={slotId} className={inputClass} onChange={e=>setSlotId(e.target.value)}><option value="">Choose a trip</option>{plan.slots?.filter(s=>plan.placements[s.id]?.stops.length).map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>{!plan.shareViewToken&&<span className="text-muted">Enable a view link for this plan in Plans first. Sending a card shares that existing link.</span>}</label>:<label className="sr-only" htmlFor="chat-body">{mode==='poll'?'Poll question':'Message'}</label>}
 <div className="mt-2 flex items-end gap-2">{mode!=='trip_card'&&<textarea id="chat-body" maxLength={MAX_MESSAGE_LENGTH} className={`${inputClass} flex-1`} rows={2} placeholder={mode==='poll'?'Ask a question':'Message…'} value={body} onChange={e=>setBody(e.target.value)}/>}<button disabled={busy||(mode==='trip_card'?(!slotId||!plan.shareViewToken):!body.trim())} className="btn btn-primary btn-md">{busy?'Sending…':'Send'}</button></div></form>}
 </div>;
}
