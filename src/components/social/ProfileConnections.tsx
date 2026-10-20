'use client';
import { useEffect,useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { profileContext } from '@/lib/supabase/friends';
import { useActivePlan } from '@/lib/store/plan';
import { freeWeekends,overlaps,weekendLabel,type SocialContext } from '@/lib/social/friends';
import FriendActions from './FriendActions';
import { cardClass } from './controls';

export default function ProfileConnections({id,onBlocked,onRefresh}:{id:string;onBlocked:()=>void;onRefresh:()=>void}) {
  const [context,setContext]=useState<SocialContext|null>(null);const [version,setVersion]=useState(0);const [error,setError]=useState('');
  const plan=useActivePlan();
  useEffect(()=>{let live=true;profileContext(createClient(),id).then(c=>{if(live){setContext(c);setError('');if(!c)onBlocked();}}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Could not load friendship.');});return()=>{live=false;};},[id,version,onBlocked]);
  const shared=context?.friendship_status==='friends'?freeWeekends(plan).filter(w=>context.free_weekends.some(d=>overlaps(w,d))):[];
  return <section className="mt-4 space-y-3">
    {context&&<><FriendActions id={id} status={context.friendship_status} menu onChange={()=>{setVersion(v=>v+1);onRefresh();}}/>
    {context.mutual_count!=null&&<p className="text-sm text-muted">{context.mutual_count} mutual friends</p>}
    {shared.length>0&&<div className={cardClass}><h2 className="font-bold">Free weekends you share</h2><div className="mt-2 flex flex-wrap gap-2">{shared.map(w=><span key={w.start_date} className="rounded-full bg-primary-soft px-3 py-2 text-xs font-semibold text-primary">{weekendLabel(w)}</span>)}</div></div>}</>}
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
  </section>;
}
