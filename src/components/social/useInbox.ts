'use client';
import { useEffect,useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { listChats } from '@/lib/supabase/messaging';
import { useAuthStore } from '@/lib/store/auth';
import type { ChatSummary } from '@/lib/social/messaging';
export function useInbox() {
 const id=useAuthStore(s=>s.user?.id);const [state,setState]=useState<{userId?:string;chats:ChatSummary[];error:string;loaded:boolean}>({chats:[],error:'',loaded:false});
 useEffect(()=>{if(!id)return;const c=createClient();let live=true;let seq=0;
 const load=async()=>{const n=++seq;try{const chats=await listChats(c);if(live&&n===seq)setState({userId:id,chats,error:'',loaded:true});}catch(e){if(live&&n===seq)setState(s=>({userId:id,chats:s.userId===id?s.chats:[],error:e instanceof Error?e.message:'Could not load inbox.',loaded:true}));}};
 void load();const channel=c.channel(`inbox:${id}:${crypto.randomUUID()}`).on('postgres_changes',{event:'*',schema:'public',table:'conversations'},load).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},load).subscribe();
 const refresh=()=>{void load();};window.addEventListener('focus',refresh);window.addEventListener('chat-inbox-changed',refresh);const timer=setInterval(refresh,15000);
 return()=>{live=false;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('chat-inbox-changed',refresh);void c.removeChannel(channel);};
 },[id]);
 return state.userId===id?state:{chats:[],error:'',loaded:false};
}
