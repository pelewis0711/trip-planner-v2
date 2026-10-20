import type { SupabaseClient } from '@supabase/supabase-js';
import type { Person, Connection, SocialContext, BlockedPerson, PeopleFilters, FreeWeekend } from '@/lib/social/friends';
import { socialError } from '@/lib/social/friends';

export async function socialRpc<T>(client: SupabaseClient,name: string,args?: Record<string,unknown>): Promise<T> {
  const {data,error}=await client.rpc(name,args);
  if (error) throw new Error(socialError(error.message));
  return data as T;
}
export const searchPeople=(c:SupabaseClient,query:string,filters:PeopleFilters,page=0)=>socialRpc<Person[]>(c,'search_people',{p_query:query,p_filters:filters,p_page:page});
export const suggestPeople=(c:SupabaseClient)=>socialRpc<Person[]>(c,'suggest_people');
export const listFriendships=(c:SupabaseClient)=>socialRpc<Connection[]>(c,'list_friendships');
export const profileContext=(c:SupabaseClient,id:string)=>socialRpc<SocialContext|null>(c,'social_profile_context',{p_target:id});
export const listBlocked=(c:SupabaseClient)=>socialRpc<BlockedPerson[]>(c,'list_blocked_people');
export const friendAction=(c:SupabaseClient,id:string,action:string)=> action==='request'
  ? socialRpc<void>(c,'request_friend',{p_target:id})
  : action==='block' || action==='unblock'
    ? socialRpc<void>(c,`${action}_person`,{p_target:id})
    : socialRpc<void>(c,'respond_friend',{p_target:id,p_action:action});
export const syncFreeWeekends=(c:SupabaseClient,id:string,weekends:FreeWeekend[])=>socialRpc<void>(c,'sync_free_weekends',{p_weekends:weekends,p_user_id:id});
export async function friendsFreeWeekends(c:SupabaseClient) {
  const {data,error}=await c.from('free_weekends').select('user_id,start_date,end_date');
  if(error) throw new Error('Could not load shared free weekends.');
  return (data??[]) as (FreeWeekend & {user_id:string})[];
}
