import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CHAT_REACTIONS,MAX_MESSAGE_LENGTH,CHAT_PHOTO_BYTES,groupedBubble,messageTime,type ChatMessage } from '../messaging';
const message=(overrides:Partial<ChatMessage>={})=>({id:'one',conversation_id:'chat',sender_id:'user',kind:'text',body:'hello',payload:{},created_at:'2027-02-01T12:00:00Z',edited_at:null,deleted_at:null,...overrides} as ChatMessage);
describe('message presentation',()=>{
 it('keeps message and upload limits aligned with SQL',()=>{const sql=readFileSync('supabase/migrations/0016_messaging.sql','utf8');expect(Number(sql.match(/char_length\(body\)<=(\d+)/)?.[1])).toBe(MAX_MESSAGE_LENGTH);expect(Number(sql.match(/false,(\d+),array\['image\/jpeg'/)?.[1])).toBe(CHAT_PHOTO_BYTES);});
 it('groups only consecutive messages from the same person within five minutes',()=>{expect(groupedBubble(message(),message({created_at:'2027-02-01T12:04:59Z'}))).toBe(true);expect(groupedBubble(message(),message({created_at:'2027-02-01T12:05:00Z'}))).toBe(false);expect(groupedBubble(message(),message({sender_id:'someone'}))).toBe(false);expect(groupedBubble(undefined,message())).toBe(false);expect(groupedBubble(message({deleted_at:'now'}),message())).toBe(false);expect(groupedBubble(message(),message({kind:'system'}))).toBe(false);});
 it('formats today as time and older years with a year, rejecting invalid dates',()=>{expect(messageTime('bad')).toBe('');expect(messageTime('2025-02-01T12:00:00Z',new Date('2027-02-01T13:00:00Z'))).toContain('2025');expect(messageTime('2027-02-01T12:00:00Z',new Date('2027-02-01T13:00:00Z'))).toMatch(/AM|PM/);});
 it('keeps the six SQL and UI reaction choices aligned',()=>{const sql=readFileSync('supabase/migrations/0016_messaging.sql','utf8');const list=sql.match(/emoji in \(([^)]+)\)/)?.[1].match(/'([^']+)'/g)?.map(s=>s.slice(1,-1));expect(list).toEqual([...CHAT_REACTIONS]);});
});
