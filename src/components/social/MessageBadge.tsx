'use client';
import Link from 'next/link';
import { useInbox } from './useInbox';
export default function MessageBadge(){const {chats}=useInbox();const count=chats.reduce((n,c)=>n+Number(c.unread_count),0);return <Link href="/messages" aria-label={`Messages${count?`, ${count} unread`:''}`} className="btn btn-ghost btn-md relative shrink-0"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H6l-4 3V11a9 9 0 0 1 19 0Z"/></svg>{count>0&&<span className="absolute -top-1 -right-1 rounded-full bg-primary px-1.5 text-[10px] text-white">{count>99?'99+':count}</span>}</Link>;}
