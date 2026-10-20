'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { friendAction } from '@/lib/supabase/friends';
import type { FriendStatus } from '@/lib/social/friends';

export default function FriendActions({id,status,onChange,menu=false}:{id:string;status:FriendStatus;onChange:()=>void;menu?:boolean}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function act(action:string) {
    if ((action==='block'||action==='unfriend') && !window.confirm(action==='block'?'Block this person? You will no longer see each other, and your friendship will be removed.':'Remove this friendship?')) return;
    setBusy(true); setError('');
    try { await friendAction(createClient(),id,action); onChange(); }
    catch(e) { setError(e instanceof Error?e.message:'Could not save.'); }
    finally { setBusy(false); }
  }
  return <div className="flex flex-wrap items-center gap-2">
    {status==='none' && <button disabled={busy} className="btn btn-primary btn-md" onClick={()=>act('request')}>Add friend</button>}
    {status==='requested' && <button disabled={busy} className="btn btn-secondary btn-md" onClick={()=>act('cancel')} aria-label="Requested — cancel friend request">Requested · Cancel</button>}
    {status==='friends' && <details><summary className="btn btn-secondary btn-md cursor-pointer">Friends</summary><button disabled={busy} className="btn btn-ghost btn-md" onClick={()=>act('unfriend')}>Unfriend</button></details>}
    {status==='incoming' && <><button disabled={busy} className="btn btn-primary btn-md" onClick={()=>act('accept')}>Accept</button><button disabled={busy} className="btn btn-secondary btn-md" onClick={()=>act('decline')}>Decline</button></>}
    {menu && status!=='blocked' && <details><summary aria-label="More profile actions" className="btn btn-ghost btn-md cursor-pointer">•••</summary><button disabled={busy} className="btn btn-ghost btn-md text-danger" onClick={()=>act('block')}>Block</button></details>}
    {error && <p role="alert" className="w-full text-sm text-danger">{error}</p>}
  </div>;
}
