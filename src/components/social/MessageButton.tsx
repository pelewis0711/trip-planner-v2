'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { startDm } from '@/lib/supabase/messaging';
export default function MessageButton({id,compact=false}:{id:string;compact?:boolean}) {
 const router=useRouter();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function open(){setBusy(true);setError('');try{const cid=await startDm(createClient(),id);window.dispatchEvent(new Event('chat-inbox-changed'));router.push(`/messages/${cid}`);}catch(e){setError(e instanceof Error?e.message:'Could not open chat.');}finally{setBusy(false);}}
 return <div><button disabled={busy} className="btn btn-secondary btn-md" aria-label="Message this person" onClick={open}>{busy?'Opening…':compact?'✉':'Message'}</button>{error&&<p role="alert" className="text-xs text-danger">{error}</p>}</div>;
}
