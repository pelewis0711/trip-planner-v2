import type { ProfileView } from './profile';
export const CHAT_REACTIONS=['👍','❤️','😂','😮','😢','🎉'] as const;
export const CHAT_PHOTO_MAX=1600;
export const MAX_MESSAGE_LENGTH=2000;
export const CHAT_PHOTO_BYTES=5*1024*1024;
export interface ChatSummary {id:string;kind:'dm'|'group'|'weekend';title:string;group_id?:string|null;group_name?:string|null;trip_id?:string|null;person:ProfileView|null;accepted:boolean;muted:boolean;last_message_at:string|null;last_message:{kind:string;body:string}|null;unread_count:number;seen_at:string|null;active_now:boolean}
export interface ChatMessage {id:string;conversation_id:string;sender_id:string|null;kind:'text'|'photo'|'trip_card'|'poll'|'system';body:string;payload:{path?:string;options?:string[];share_token?:string;slot_id?:string;title?:string};created_at:string;edited_at:string|null;deleted_at:string|null}
export interface Reaction {message_id:string;user_id:string;emoji:string;active:boolean}
export interface PollVote {message_id:string;user_id:string;option_index:number}
export function groupedBubble(previous:ChatMessage|undefined,current:ChatMessage) {return !!previous && !previous.deleted_at && !current.deleted_at && previous.sender_id===current.sender_id && current.kind!=='system' && previous.kind!=='system' && new Date(current.created_at).getTime()-new Date(previous.created_at).getTime()>=0 && new Date(current.created_at).getTime()-new Date(previous.created_at).getTime()<300000;}
export function messageTime(iso:string,now=new Date()) {const d=new Date(iso);if(!Number.isFinite(d.getTime()))return '';return d.toDateString()===now.toDateString()?d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):d.toLocaleDateString('en-US',{month:'short',day:'numeric',...(d.getFullYear()!==now.getFullYear()?{year:'numeric' as const}:{})});}
export function chatTitle(c:ChatSummary) {return c.title||c.person?.display_name||'Private profile';}
export function messagePreview(c:ChatSummary) {const m=c.last_message;if(!m)return 'Start a conversation';return m.body||({photo:'Photo',poll:'Poll',trip_card:'Trip card',system:'Update'}[m.kind]??'Message');}
/** Re-encoding strips metadata; preserve aspect ratio rather than crop. */
export async function resizeChatPhoto(file:File):Promise<Blob> {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw new Error('Choose a JPG, PNG or WebP photo under 20 MB.');
 let bitmap:ImageBitmap;try{bitmap=await createImageBitmap(file);}catch{throw new Error('Could not read that photo.');}
 const ratio=Math.min(1,CHAT_PHOTO_MAX/Math.max(bitmap.width,bitmap.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
 const ctx=canvas.getContext('2d');if(!ctx){bitmap.close();throw new Error('Could not process the photo.');}ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
 const encode=(mime:string)=>new Promise<Blob|null>(r=>canvas.toBlob(r,mime,.85));
 let blob=await encode('image/webp');if(blob?.type!=='image/webp')blob=await encode('image/jpeg');
 if(!blob||blob.size>CHAT_PHOTO_BYTES)throw new Error('That photo is too large after resizing.');return blob;
}
