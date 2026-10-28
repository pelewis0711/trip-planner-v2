'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useInbox } from '@/components/social/useInbox';
import Avatar from '@/components/social/Avatar';
import { chatTitle,messagePreview,messageTime,type ChatSummary } from '@/lib/social/messaging';
import { inputClass } from '@/components/social/controls';
import RequestActions from '@/components/social/RequestActions';
export default function MessagesPage(){
 const {chats,error,loaded}=useInbox();const [requests,setRequests]=useState(false);const [query,setQuery]=useState('');const count=chats.filter(c=>!c.accepted).length;
 const shown=chats.filter(c=>c.accepted!==requests&&`${chatTitle(c)} ${c.group_name??''}`.toLowerCase().includes(query.toLowerCase()));
 const groups=Array.from(new Set(shown.map(c=>c.group_id).filter((id):id is string=>!!id)));
 return <div className="mx-auto max-w-2xl space-y-4 px-4 py-6"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="font-heading text-3xl">Messages</h1><Link href="/groups" className="btn btn-secondary btn-md">Groups & weekends</Link></div><label className="block text-sm font-semibold">Search your inbox<input className={inputClass} placeholder="Search people, groups or weekends" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="flex gap-2" role="group" aria-label="Inbox"><button className={`btn btn-md ${!requests?'btn-primary':'btn-secondary'}`} aria-pressed={!requests} onClick={()=>setRequests(false)}>Primary</button><button className={`btn btn-md ${requests?'btn-primary':'btn-secondary'}`} aria-pressed={requests} onClick={()=>setRequests(true)}>Requests ({count})</button></div>
 {requests&&<p className="rounded-card bg-primary-soft p-4 text-sm">They won&apos;t see that you&apos;ve read it unless you accept.</p>}
 {error&&<p role="alert" className="text-danger">{error}</p>}{!loaded&&<p role="status">Loading…</p>}{loaded&&!shown.length&&!error&&<p className="text-sm text-muted">{requests?'No message requests.':'No conversations yet. Message a friend or create a group.'}</p>}
 {groups.map(id=>{const rows=shown.filter(c=>c.group_id===id);const unread=rows.reduce((n,c)=>n+c.unread_count,0);return <details key={id} className="rounded-card border border-border bg-surface p-4" open={query?true:undefined}><summary className="min-h-11 cursor-pointer font-bold">{rows[0].group_name??'Group'}{unread>0?` · ${unread} unread`:''}</summary><Link href={`/groups/${id}`} className="btn btn-ghost btn-md">Group settings</Link><div className="space-y-2">{rows.map(c=><ChatRow key={c.id} chat={c}/>)}</div></details>;})}
 {shown.filter(c=>!c.group_id).map(c=><ChatRow key={c.id} chat={c}/>)}
 </div>;
}
function ChatRow({chat:c}:{chat:ChatSummary}){return <article className="rounded-card border border-border bg-surface p-4"><Link href={`/messages/${c.id}`} className="flex min-h-11 items-center gap-3"><Avatar path={c.person?.avatar_path} name={chatTitle(c)} size={48}/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h2 className="truncate font-bold">{chatTitle(c)}</h2><time className="shrink-0 text-xs text-muted">{c.last_message_at?messageTime(c.last_message_at):''}</time></div><p className="truncate text-sm text-muted">{messagePreview(c)}</p></div>{c.unread_count>0&&<span className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Unread messages"/>}</Link>{!c.accepted&&<RequestActions id={c.id}/>}</article>;}
