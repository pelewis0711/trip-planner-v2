'use client';
import { useEffect,useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { listBlocked,friendAction } from '@/lib/supabase/friends';
import type { BlockedPerson } from '@/lib/social/friends';
import { cardClass } from './controls';
export default function BlockedPeople() {
  const [people,setPeople]=useState<BlockedPerson[]>([]);const [error,setError]=useState('');const [version,setVersion]=useState(0);const [busy,setBusy]=useState<string|null>(null);
  useEffect(()=>{let live=true;listBlocked(createClient()).then(p=>{if(live)setPeople(p);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;};},[version]);
  async function unblock(id:string){setBusy(id);setError('');try{await friendAction(createClient(),id,'unblock');setVersion(v=>v+1);}catch(e){setError(e instanceof Error?e.message:'Could not unblock.');}finally{setBusy(null);}}
  return <section className={cardClass}><h2 className="font-bold">Blocked people</h2><p className="mt-1 text-xs text-muted">Blocked profiles stay hidden here too. Unblocking does not restore a friendship.</p>
    {people.length===0&&!error&&<p className="mt-3 text-sm text-muted">No blocked people.</p>}
    {people.map((p,i)=><div key={p.id} className="flex items-center justify-between gap-3 py-2"><div><p className="text-sm">Blocked person {i+1}</p><p className="text-xs text-muted">Blocked {new Date(p.created_at).toLocaleDateString()} · …{p.id.slice(-6)}</p></div><button disabled={busy!==null} onClick={()=>unblock(p.id)} className="btn btn-secondary btn-md">{busy===p.id?'Unblocking…':'Unblock'}</button></div>)}
    {error&&<p role="alert" className="text-sm text-danger">{error}</p>}
  </section>;
}
