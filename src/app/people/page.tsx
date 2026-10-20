'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fetchOwnProfile } from '@/lib/supabase/social';
import { searchPeople,suggestPeople } from '@/lib/supabase/friends';
import { useAuthStore } from '@/lib/store/auth';
import type { PeopleFilters,Person } from '@/lib/social/friends';
import { TRAVEL_INTERESTS,PERSONAL_INTERESTS } from '@/data/interests';
import { Chip,inputClass,labelClass } from '@/components/social/controls';
import PersonRow from '@/components/social/PersonRow';

const FILTERS=[['host_city','Host city'],['host_university','Host university'],['home_university','Home university'],['interests','Interests'],['free_weekend',"Who's free"]] as const;
export default function PeoplePage() {
  const user=useAuthStore(s=>s.user);
  const [query,setQuery]=useState(''); const [filters,setFilters]=useState<PeopleFilters>({});
  const [open,setOpen]=useState<string|null>(null); const [people,setPeople]=useState<Person[]>([]);
  const [page,setPage]=useState(0); const [more,setMore]=useState(false); const [loading,setLoading]=useState(true);
  const [error,setError]=useState(''); const [city,setCity]=useState('your host city'); const [version,setVersion]=useState(0);
  useEffect(()=>{if(!user)return;let live=true;fetchOwnProfile(createClient(),user.id).then(p=>{if(live&&p?.host_city)setCity(p.host_city);});return()=>{live=false;};},[user]);
  const browsing=!query.trim() && Object.keys(filters).length===0;
  useEffect(()=>{
    if(!user)return; let live=true;
    const timer=setTimeout(async()=>{
      setLoading(true);setError('');
      try {const rows=browsing?await suggestPeople(createClient()):await searchPeople(createClient(),query,filters,page);
        if(live){setPeople(prev=>page>0?[...prev,...rows]:rows);setMore(!browsing&&rows.length===20);}}
      catch(e){if(live)setError(e instanceof Error?e.message:'Could not load people.');}
      finally{if(live)setLoading(false);}
    },250);
    return()=>{live=false;clearTimeout(timer);};
  },[user,query,filters,page,browsing,version]);
  function filter(key:string,value:string) {setPage(0);setFilters(prev=>{const next={...prev};delete next[key as keyof PeopleFilters];if(value.trim())Object.assign(next,{[key]:key==='interests'?[value]:value.trim()});return next;});}
  function refresh(){setPage(0);setVersion(v=>v+1);}
  return <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
    <div className="flex items-center justify-between"><h1 className="font-heading text-3xl">Find your people</h1><Link className="btn btn-ghost btn-md" href="/friends">Friends</Link></div>
    <label className={labelClass}>Search people<input className={inputClass} value={query} maxLength={60} placeholder="Search by name or @username" onChange={e=>{setPage(0);setQuery(e.target.value);}}/></label>
    <div className="flex gap-2 overflow-x-auto pb-2">{FILTERS.map(([key,label])=><Chip key={key} selected={open===key||!!filters[key]} onClick={()=>setOpen(open===key?null:key)}>{label}</Chip>)}</div>
    {FILTERS.filter(([key])=>key===open).map(([key,label])=><label key={key} className={labelClass}>{label}
      {key==='interests'?<select multiple aria-label="Match any of these interests" className={inputClass} value={filters.interests??[]} onChange={e=>{const interests=Array.from(e.target.selectedOptions,o=>o.value);setPage(0);setFilters(prev=>{const next={...prev};if(interests.length)next.interests=interests;else delete next.interests;return next;});}}>{Array.from(new Map([...TRAVEL_INTERESTS,...PERSONAL_INTERESTS].map(i=>[i.slug,i])).values()).map(i=><option key={i.slug} value={i.slug}>{i.label}</option>)}</select>
      :<input className={inputClass} type={key==='free_weekend'?'date':'text'} value={filters[key]??''} maxLength={120} onChange={e=>filter(key,e.target.value)} placeholder={label}/>}
      {key==='free_weekend'&&<span className="text-xs text-muted">Friends who chose to share their free weekends.</span>}
    </label>)}
    {Object.keys(filters).length>0&&<button className="btn btn-ghost btn-md" onClick={()=>{setFilters({});setPage(0);}}>Clear filters</button>}
    <h2 className="font-heading text-xl">{browsing?`People in ${city} this spring`:'Search results'}</h2>
    <p className="text-xs text-muted">Only details people have chosen to share with you can match a filter.</p>
    {error&&<p role="alert" className="text-sm text-danger">{error}<button className="btn btn-ghost btn-md" onClick={refresh}>Retry</button></p>}
    {!loading&&!error&&!people.length&&<p className="rounded-card bg-surface p-6 text-sm text-muted">No people to show yet. Try a name, username, or fewer filters.</p>}
    {people.map(p=><PersonRow key={p.id} person={p} onChange={refresh}/>)}
    {loading&&<p role="status" className="text-sm text-muted">Loading…</p>}
    {more&&!loading&&<button className="btn btn-secondary btn-md" onClick={()=>setPage(p=>p+1)}>Show more</button>}
  </div>;
}
