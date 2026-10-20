import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatMessage,ChatSummary,Reaction,PollVote } from '@/lib/social/messaging';
export async function chatRpc<T>(c:SupabaseClient,name:string,args?:Record<string,unknown>):Promise<T> {
 const {data,error}=await c.rpc(name,args);if(error)throw new Error(error.message.includes('WN_MESSAGE_RATE_LIMIT')?'You can send 30 messages a minute. Please wait a moment.':error.message.includes('WN_MESSAGE_REQUESTS_OFF')?'This person has message requests turned off.':error.message.includes('WN_')?'This action is unavailable. Refresh and try again.':'Could not connect. Please try again.');return data as T;
}
export const startDm=(c:SupabaseClient,id:string)=>chatRpc<string>(c,'start_dm',{p_other:id});
export const getChat=(c:SupabaseClient,id:string)=>chatRpc<ChatSummary|null>(c,'get_chat',{p_chat:id});
export const listChats=(c:SupabaseClient)=>chatRpc<ChatSummary[]>(c,'list_chats');
export const sendMessage=(c:SupabaseClient,id:string,kind:string,body:string,payload:Record<string,unknown>={},expectedUser?:string)=>chatRpc<string>(c,'send_message',{p_chat:id,p_kind:kind,p_body:body,p_payload:payload,p_expected_user:expectedUser});
export const requestAction=(c:SupabaseClient,id:string,action:string)=>chatRpc<void>(c,'chat_request',{p_chat:id,p_action:action});
export async function loadMessages(c:SupabaseClient,id:string,before?:ChatMessage) {
 let q=c.from('messages').select('*').eq('conversation_id',id).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(50);
 if(before)q=q.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
 const {data,error}=await q;if(error)throw new Error('Could not load messages.');return (data as ChatMessage[]).reverse();
}
export async function loadMessageExtras(c:SupabaseClient,ids:string[]) {
 if(!ids.length)return {reactions:[] as Reaction[],votes:[] as PollVote[]};
 const [r,v]=await Promise.all([c.from('message_reactions').select('*').in('message_id',ids).eq('active',true),c.from('poll_votes').select('*').in('message_id',ids)]);
 if(r.error||v.error)throw new Error('Could not load reactions or votes.');return {reactions:r.data as Reaction[],votes:v.data as PollVote[]};
}
export async function uploadChatPhoto(c:SupabaseClient,id:string,blob:Blob) {
 const path=`${id}/${crypto.randomUUID()}.${blob.type==='image/webp'?'webp':'jpg'}`;
 const {error}=await c.storage.from('chat-photos').upload(path,blob,{contentType:blob.type});if(error)throw new Error('Could not upload photo.');return path;
}
