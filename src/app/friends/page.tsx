'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { listFriendships,friendsFreeWeekends } from '@/lib/supabase/friends';
import { useAuthStore } from '@/lib/store/auth';
import { useActivePlan } from '@/lib/store/plan';
import { freeWeekends,overlaps,weekendLabel,schoolLine,type Connection,type FreeWeekend } from '@/lib/social/friends';
import Avatar from '@/components/social/Avatar';
import CreateWeekend from '@/components/groups/CreateWeekend';
import MessageButton from '@/components/social/MessageButton';
import FriendActions from '@/components/social/FriendActions';
import { Chip,cardClass } from '@/components/social/controls';

export default function FriendsPage() {
  const user=useAuthStore(s=>s.user);const plan=useActivePlan();
  const [rows,setRows]=useState<Connection[]>([]);const [dates,setDates]=useState<(FreeWeekend & {user_id:string})[]>([]);
  const [planning,setPlanning]=useState(false);
  const [tab,setTab]=useState('friends');const [selected,setSelected]=useState(0);
  const [error,setError]=useState('');const [loaded,setLoaded]=useState(false);const [version,setVersion]=useState(0);
  useEffect(()=>{if(!user)return;let live=true;(async()=>{
    try{const [people,free]=await Promise.all([listFriendships(createClient()),friendsFreeWeekends(createClient())]);if(live){setRows(people);setDates(free);setError('');setLoaded(true);}}
    catch(e){if(live)setError(e instanceof Error?e.message:'Could not load friends.');}
  })();return()=>{live=false;};},[user,version]);
  const friends=rows.filter(r=>r.friendship_status==='friends');const requests=rows.filter(r=>r.friendship_status==='incoming');
  const sent=rows.filter(r=>r.friendship_status==='requested');
  const today=new Date().toLocaleDateString('en-CA');
  const weekends=freeWeekends(plan).filter(w=>w.end_date>=today).slice(0,3);const weekend=weekends[selected]??weekends[0];
  const available=friends.filter(f=>weekend&&dates.some(d=>d.user_id===f.id&&overlaps(d,weekend)));
  const refresh=()=>setVersion(v=>v+1);
  return <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
    <div className="flex items-center justify-between"><h1 className="font-heading text-3xl">Friends</h1><Link href="/people" className="btn btn-primary btn-md">Find people</Link></div>
    <section className={cardClass}><h2 className="font-heading text-xl">Who&apos;s free</h2>
      <p className="my-2 text-sm text-muted">Friends sharing time off that overlaps your empty weekends.</p>
      <div className="flex flex-wrap gap-2">{weekends.map((w,i)=><Chip key={w.start_date} selected={i===selected} onClick={()=>setSelected(i)}>{weekendLabel(w)}</Chip>)}</div>
      {!weekends.length?<p className="text-sm text-muted">Add weekend slots to your calendar to find shared free time.</p>:<>
        <div className="my-4 flex -space-x-2">{available.map(f=><Link key={f.id} href={f.profile?`/u/${f.profile.username}`:'/people'} aria-label={f.profile?.display_name??'Friend'} className="rounded-full border-2 border-surface"><Avatar path={f.profile?.avatar_path} name={f.profile?.display_name??'Friend'} size={40}/></Link>)}</div>
        <p className="mb-3 text-sm text-muted">{available.length?available.map(f=>f.profile?.display_name??'Friend').join(', '):'No friends sharing this weekend yet.'}</p>
        {!!available.length&&<button className="btn btn-primary btn-md" onClick={()=>setPlanning(v=>!v)}>Plan this weekend with them</button>}
      </>}
    </section>
    {planning&&weekend&&<CreateWeekend key={weekend.start_date} start={weekend.start_date} end={weekend.end_date} friends={available.map(f=>({id:f.id,name:f.profile?.display_name??'Friend'}))} onCancel={()=>setPlanning(false)}/>}
    <div role="tablist" aria-label="Friend lists" className="flex gap-2">{[['friends',`Friends (${friends.length})`],['requests',`Requests (${requests.length})`]].map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={`btn btn-md ${tab===id?'btn-primary':'btn-secondary'}`} onClick={()=>setTab(id)}>{label}</button>)}</div>
    {error&&<p role="alert" className="text-danger">{error}<button onClick={refresh} className="btn btn-ghost btn-md">Retry</button></p>}
    {!loaded&&!error&&<p role="status">Loading…</p>}
    {loaded&&(tab==='friends'?friends:requests).length===0&&<p className="text-sm text-muted">{tab==='friends'?'Your friends will appear here. Find people to send your first request.':'No incoming requests.'}</p>}
    {(tab==='friends'?friends:[...requests,...sent]).map(r=><article key={r.id} className={`${cardClass} flex flex-wrap items-center gap-3`}>
      <Avatar path={r.profile?.avatar_path} name={r.profile?.display_name??'Private profile'} size={48}/>
      <div className="flex-1"><Link className="font-bold" href={r.profile?`/u/${r.profile.username}`:'/people'}>{r.profile?.display_name??'Private profile'}</Link><p className="text-xs text-muted">{r.profile?schoolLine(r.profile):'Identity stays private until you become friends.'}</p></div>
      {r.friendship_status==='friends'&&r.profile&&<MessageButton id={r.id} compact/>}
      <FriendActions id={r.id} status={r.friendship_status} onChange={refresh}/>
    </article>)}
  </div>;
}
