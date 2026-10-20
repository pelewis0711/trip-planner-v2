'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { requestAction } from '@/lib/supabase/messaging';
export default function RequestActions({id,onChange}:{id:string;onChange?:(action:string)=>void}){const [busy,setBusy]=useState(false);const [error,setError]=useState('');async function act(action:string){if(action==='block'&&!window.confirm('Block this person and remove this request?'))return;setBusy(true);setError('');try{await requestAction(createClient(),id,action);window.dispatchEvent(new Event('chat-inbox-changed'));onChange?.(action);}catch(e){setError(e instanceof Error?e.message:'Could not update request.');}finally{setBusy(false);}}
 return <div className="mt-3 flex flex-wrap gap-2">{['accept','delete','block'].map(a=><button key={a} disabled={busy} className={`btn btn-md ${a==='accept'?'btn-primary':'btn-secondary'}`} onClick={()=>act(a)}>{a[0].toUpperCase()+a.slice(1)}</button>)}{error&&<p role="alert" className="w-full text-sm text-danger">{error}</p>}</div>;
}
