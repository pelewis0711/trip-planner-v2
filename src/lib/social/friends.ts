import type { Plan } from '@/lib/store/plan';
import type { ProfileView } from './profile';

export const MAX_FREE_WEEKENDS = 156;

export interface FreeWeekend { start_date: string; end_date: string }
export type FriendStatus = 'none' | 'requested' | 'incoming' | 'friends' | 'blocked';
export interface Person extends ProfileView { mutual_count?: number | null; friendship_status: FriendStatus }
export interface Connection { id: string; profile: ProfileView | null; friendship_status: FriendStatus }
export interface SocialContext { friendship_status: FriendStatus; mutual_count: number | null; free_weekends: FreeWeekend[] }
export interface BlockedPerson { id: string; created_at: string }
export type PeopleFilters = Partial<Record<'host_city' | 'host_university' | 'home_university' | 'free_weekend', string>> & { interests?: string[] };

export const overlaps = (a: FreeWeekend,b: FreeWeekend) => a.start_date<=b.end_date && b.start_date<=a.end_date;

/** Slots store month/day. Anchor them to the actual semester, including a
 * December-to-January crossing. Never guess a year for an unconfigured plan. */
export function freeWeekends(plan: Plan | undefined): FreeWeekend[] {
  if (!plan?.semester) return [];
  const startYear=Number(plan.semester.start.slice(0,4));
  const startMonth=Number(plan.semester.start.slice(5,7));
  const dates=(slot: NonNullable<Plan['slots']>[number]): FreeWeekend => {
    const year=startYear+(slot.s[0]<startMonth?1:0);
    const iso=(y:number,m:number,d:number)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    return {start_date:iso(year,...slot.s),end_date:iso(year+(slot.e[0]<slot.s[0]?1:0),...slot.e)};
  };
  const occupied=(plan.slots??[]).filter(s=>(plan.placements[s.id]?.stops.length??0)>0).map(dates);
  return (plan.slots??[]).filter(s=>s.kind==='weekend').map(dates)
    .filter(w=>w.start_date>=plan.semester!.start && w.end_date<=plan.semester!.end && !occupied.some(o=>overlaps(w,o)))
    .sort((a,b)=>a.start_date.localeCompare(b.start_date)).slice(0, MAX_FREE_WEEKENDS);
}
export function weekendLabel(w: FreeWeekend) {
  const fmt=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
  return `${fmt(w.start_date)}–${fmt(w.end_date)}`;
}
export function schoolLine(p: ProfileView) { return [p.host_university,p.home_university].filter(Boolean).join(' · '); }
export function socialError(message: string): string {
  if (message.includes('WN_REQUEST_EXISTS')) return 'A request or friendship already exists. Refresh to see its status.';
  if (message.includes('WN_PERSON_UNAVAILABLE')) return 'This person is not available.';
  if (message.includes('WN_')) return 'That action is no longer available. Refresh and try again.';
  return 'Could not save. Please try again.';
}
