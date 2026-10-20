import Link from 'next/link';
import Avatar from './Avatar';
import VerifiedBadge from './VerifiedBadge';
import FriendActions from './FriendActions';
import type { Person } from '@/lib/social/friends';
import { schoolLine } from '@/lib/social/friends';
import { interestLabel } from '@/data/interests';

export default function PersonRow({person,onChange}:{person:Person;onChange:()=>void}) {
  const interests=[...(person.travel_interests??[]),...(person.personal_interests??[])].slice(0,2).map(interestLabel);
  return <article className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4">
    <Link href={`/u/${person.username}`} className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar path={person.avatar_path} name={person.display_name} size={48}/>
      <div className="min-w-0"><div className="flex items-center gap-1.5"><span className="font-bold">{person.display_name}</span>{person.verified && <VerifiedBadge/>}</div>
      <p className="truncate text-xs text-muted">@{person.username}{schoolLine(person) && ` · ${schoolLine(person)}`}</p>
      <p className="text-xs text-muted">{[person.mutual_count!=null?`${person.mutual_count} mutual friends`:null,...interests].filter(Boolean).join(' · ')}</p></div>
    </Link>
    <FriendActions id={person.id} status={person.friendship_status} onChange={onChange}/>
  </article>;
}
