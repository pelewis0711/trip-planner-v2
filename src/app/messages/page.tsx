'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useInbox } from '@/components/social/useInbox';
import Avatar from '@/components/social/Avatar';
import { chatTitle,messagePreview,messageTime } from '@/lib/social/messaging';
import { inputClass } from '@/components/social/controls';
import RequestActions from '@/components/social/RequestActions';
export default function MessagesPage(){const {chats,error,loaded}=useInbox();const [requests,setRequests]=useState(false);const [query,setQuery]=useState('');const count=chats.filter(c=>!c.accepted).length;const shown=chats.filter(c=>c.accepted!==requests&&chatTitle(c).toLowerCase().includes(query.toLowerCase()));
 return <div className="mx-auto max-w-2xl space-y-4 px-4 py-6"><h1 className="font-heading text-3xl">Messages</h1><label className="block text-sm font-semibold">Search your inbox<input className={inputClass} placeholder="Search messages by person" value={query} onChange={e=>setQuery(e.target.value)}/></label><div className="flex gap-2" role="group" aria-label="Inbox"><button className={`btn btn-md ${!requests?'btn-primary':'btn-secondary'}`} aria-pressed={!requests} onClick={()=>setRequests(false)}>Primary</button><button className={`btn btn-md ${requests?'btn-primary':'btn-secondary'}`} aria-pressed={requests} onClick={()=>setRequests(true)}>Requests ({count})</button></div>
 {requests&&<p className="rounded-card bg-primary-soft p-4 text-sm">They won&apos;t see that you&apos;ve read it unless you accept.</p>}
 {error&&<p role="alert" className="text-danger">{error}</p>}{!loaded&&<p role="status">Loading…</p>}{loaded&&!shown.length&&!error&&<p className="text-sm text-muted">{requests?'No message requests.':'No conversations yet. Open a friend’s profile and tap Message.'}</p>}
 {shown.map(c=><article key={c.id} className="rounded-card border border-border bg-surface p-4"><Link href={`/messages/${c.id}`} className="flex items-center gap-3"><Avatar path={c.person?.avatar_path} name={chatTitle(c)} size={48}/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><h2 className="truncate font-bold">{chatTitle(c)}</h2><time className="shrink-0 text-xs text-muted">{c.last_message_at?messageTime(c.last_message_at):''}</time></div><p className="truncate text-sm text-muted">{messagePreview(c)}</p></div>{c.unread_count>0&&<span className="h-2.5 w-2.5 rounded-full bg-primary" aria-label="Unread messages"/>}</Link>{!c.accepted&&<RequestActions id={c.id}/>}</article>)}
 </div>;
}
