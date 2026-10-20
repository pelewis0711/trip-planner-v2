import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { freeWeekends,overlaps,MAX_FREE_WEEKENDS } from '../friends';
import type { Plan } from '@/lib/store/plan';
const base={id:'p',name:'Test',home:'Prague',bag:'cabin',budget:null,created:0,updated:0,placements:{},semester:{start:'2026-12-01',end:'2027-02-01',breaks:[]},slots:[{id:'dec',kind:'weekend',label:'December',date:'',s:[12,26],e:[12,27]},{id:'jan',kind:'weekend',label:'January',date:'',s:[1,2],e:[1,3]}]} as Plan;
describe('free weekend publication',()=>{
  it('keeps the synchronization cap consistent with SQL',()=>{
    expect(Number(readFileSync('supabase/migrations/0015_friends.sql','utf8').match(/jsonb_array_length\(p_weekends\)>(\d+)/)?.[1])).toBe(MAX_FREE_WEEKENDS);
  });
  it('anchors dates to the actual semester across New Year',()=>{
    expect(freeWeekends(base)).toEqual([{start_date:'2026-12-26',end_date:'2026-12-27'},{start_date:'2027-01-02',end_date:'2027-01-03'}]);
  });
  it('does not publish an unconfigured plan or booked weekends',()=>{
    expect(freeWeekends({...base,semester:undefined})).toEqual([]);
    const occupied={...base,placements:{jan:{stops:[{id:'rome'}]}}} as unknown as Plan;
    expect(freeWeekends(occupied)).toHaveLength(1);
    expect(Object.keys(freeWeekends(occupied)[0])).toEqual(['start_date','end_date']);
  });
  it('treats an overlapping occupied break as busy, even if the weekend slot is empty',()=>{
    const plan={...base,slots:[...base.slots!,{id:'break',kind:'break',label:'Break',date:'',s:[12,25],e:[1,4]}],placements:{break:{stops:[{id:'rome'}]}}} as unknown as Plan;
    expect(freeWeekends(plan)).toEqual([]);
  });
  it('matches partial overlaps, rejects adjacent weekends',()=>{
    expect(overlaps({start_date:'2027-01-02',end_date:'2027-01-03'},{start_date:'2027-01-03',end_date:'2027-01-04'})).toBe(true);
    expect(overlaps({start_date:'2027-01-02',end_date:'2027-01-03'},{start_date:'2027-01-04',end_date:'2027-01-05'})).toBe(false);
  });
});
