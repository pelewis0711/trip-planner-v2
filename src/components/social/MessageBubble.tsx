'use client';
import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { chatRpc } from '@/lib/supabase/messaging';
import { CHAT_REACTIONS,MAX_MESSAGE_LENGTH,messageTime,type ChatMessage,type Reaction,type PollVote } from '@/lib/social/messaging';
import Avatar from './Avatar';
import ChatPhoto from './ChatPhoto';
export default function MessageBubble({message:m,mine,grouped,userId,name,avatar,reactions,votes,canSend,onChange}:{message:ChatMessage;mine:boolean;grouped:boolean;userId:string;name:string;avatar?:string|null;reactions:Reaction[];votes:PollVote[];canSend:boolean;onChange:()=>void}){
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [editing,setEditing]=useState(false);const [draft,setDraft]=useState(m.body);
 async function action(rpc:string,args:Record<string,unknown>){setBusy(true);setError('');try{await chatRpc(createClient(),rpc,{p_message:m.id,...args});setEditing(false);onChange();}catch(e){setError(e instanceof Error?e.message:'Could not save.');}finally{setBusy(false);}}
 if(m.kind==='system')return <p className="my-4 rounded-xl bg-primary-soft px-4 py-3 text-center text-sm text-muted">{m.body}</p>;
 const options=m.payload.options??[];const total=votes.length;
 return <div className={`flex gap-2 ${mine?'justify-end':'justify-start'} ${grouped?'mt-1':'mt-4'}`}>
 {!mine&&<div className="w-8 shrink-0">{!grouped&&<Avatar path={avatar} name={name} size={32}/>}</div>}
 <div className="min-w-0 max-w-[85%] sm:max-w-[75%]">
 {!mine&&!grouped&&<p className="mb-1 text-xs text-muted">{name}</p>}
 <div className={`break-words rounded-2xl px-4 py-3 ${mine?'bg-primary text-white':'border border-border bg-surface text-ink'}`}>
 {m.deleted_at?<p className="text-sm italic opacity-70">Message deleted</p>:<>
 {m.kind==='photo'&&m.payload.path&&<ChatPhoto path={m.payload.path}/>}
 {m.kind==='trip_card'&&<Link className="block rounded-xl border border-current/25 p-3" href={`/shared/${encodeURIComponent(m.payload.share_token??'')}#slot-${encodeURIComponent(m.payload.slot_id??'')}`}><span className="text-xs uppercase">Shared trip</span><p className="font-bold">{m.payload.title}</p><span className="text-xs">Open this plan slot →</span></Link>}
 {m.kind==='poll'?<div><h3 className="mb-2 font-bold">{m.body}</h3>{options.map((o,i)=>{const count=votes.filter(v=>v.option_index===i).length;const selected=votes.some(v=>v.user_id===userId&&v.option_index===i);return <button key={i} disabled={!canSend||busy} aria-pressed={selected} className="relative my-1 block min-h-11 w-full overflow-hidden rounded-lg border border-current/30 px-3 py-2 text-left text-sm" onClick={()=>action('vote_message_poll',{p_option:i})}><span className="absolute inset-y-0 left-0 bg-current opacity-15" style={{width:`${total?count/total*100:0}%`}}/><span className="relative">{selected?'✓ ':''}{o} · {count}</span></button>})}<p className="mt-1 text-xs opacity-75">{total} votes · tap to change yours</p></div>:m.body&&<p className="whitespace-pre-wrap text-sm">{m.body}</p>}
 </>}
 </div>
 <div className={`mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted ${mine?'justify-end':''}`}><time dateTime={m.created_at}>{messageTime(m.created_at)}</time>{m.edited_at&&!m.deleted_at&&<span>Edited</span>}
 {!m.deleted_at&&canSend&&<details><summary className="flex min-h-11 cursor-pointer items-center px-2" aria-label="React to message">React</summary><div className="flex flex-wrap gap-1">{CHAT_REACTIONS.map(emoji=><button key={emoji} disabled={busy} className="min-h-11 min-w-11 rounded-lg bg-surface text-lg" onClick={()=>action('react_to_message',{p_emoji:emoji})}>{emoji}</button>)}</div></details>}
 {mine&&!m.deleted_at&&canSend&&<details><summary className="flex min-h-11 cursor-pointer items-center px-2" aria-label="Message actions">•••</summary>{m.kind==='text'&&<button className="btn btn-ghost btn-md" onClick={()=>setEditing(true)}>Edit</button>}<button disabled={busy} className="btn btn-ghost btn-md text-danger" onClick={()=>action('delete_message',{})}>Delete message</button></details>}
 </div>
 {!m.deleted_at&&<div className="flex flex-wrap gap-1">{CHAT_REACTIONS.map(emoji=>{const rs=reactions.filter(r=>r.emoji===emoji);return rs.length>0&&<button key={emoji} disabled={!canSend||busy} aria-pressed={rs.some(r=>r.user_id===userId)} className="min-h-11 rounded-full border border-border bg-surface px-3 text-sm" onClick={()=>action('react_to_message',{p_emoji:emoji})}>{emoji} {rs.length}</button>;})}</div>}
 {editing&&<form onSubmit={e=>{e.preventDefault();void action('edit_message',{p_body:draft});}} className="mt-2 flex flex-wrap gap-2"><input aria-label="Edit message" className="min-h-11 min-w-0 flex-1 rounded-lg border border-border px-3" value={draft} maxLength={MAX_MESSAGE_LENGTH} onChange={e=>setDraft(e.target.value)}/><button disabled={busy||!draft.trim()} className="btn btn-primary btn-md">Save</button><button type="button" className="btn btn-ghost btn-md" onClick={()=>setEditing(false)}>Cancel</button></form>}
 {error&&<p role="alert" className="text-xs text-danger">{error}</p>}
 </div></div>;
}
