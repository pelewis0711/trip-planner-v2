'use client';
import { useEffect,useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ChatPhoto({path}:{path:string}) {
  const [photo,setPhoto]=useState<{path:string;url:string}|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{
    let live=true;
    let made:string|undefined;
    createClient().storage.from('chat-photos').download(path).then(({data,error})=>{
      if(!live)return;
      if(error||!data){setFailed(true);return;}
      made=URL.createObjectURL(data);
      setPhoto({path,url:made});
    });
    return()=>{live=false;if(made)URL.revokeObjectURL(made);};
  },[path]);
  if(photo?.path!==path)return <p className="text-sm">{failed?'Photo unavailable':'Loading photo…'}</p>;
  return <a href={photo.url} target="_blank" rel="noreferrer">
    {/* Private session-authenticated blob: next/image cannot fetch it. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={photo.url} alt="Shared chat photo" className="max-h-96 w-full rounded-xl object-contain"/>
  </a>;
}
