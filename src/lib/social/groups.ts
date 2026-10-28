import type { Stop } from "@/lib/calc/types";
import type { Plan } from "@/lib/store/plan";
import type { ProfileView } from "./profile";
import { overlaps, type FreeWeekend } from "./friends";
import { lodgingTiers } from "@/lib/calc/cost";
import { airbnbUrl, bookingComUrl, hostelworldUrl } from "@/lib/calc/booking";
export const GROUP_LIMIT = 10;
export const VOTE_WINDOWS = ["12h", "24h", "48h", "3d"] as const;
export const ROOM_SIZES = [2, 3, 4] as const;
export type VoteWindow = (typeof VOTE_WINDOWS)[number];
export type Rsvp = "going" | "maybe" | "out";
export interface GroupMember {
  user_id: string;
  role: "admin" | "member";
  profile: ProfileView | null;
}
export interface Group {
  id: string;
  name: string;
  vote_window: VoteWindow;
  muted: boolean;
  members: GroupMember[];
  chats: { id: string; title: string; kind: string; trip_id: string | null }[];
}
export interface RoomSetup {
  max_per_room: 2 | 3 | 4;
  couples_share_bed: boolean;
  mixed_rooms: boolean;
}
export interface TripSummary extends FreeWeekend, RoomSetup {
  id: string;
  group_id: string | null;
  title: string;
  stops: Stop[];
  conversation_id: string;
  my_status?: Rsvp;
}
export interface TripChange {
  start_date?: string;
  end_date?: string;
  stops?: Stop[];
  max_per_room?: 2 | 3 | 4;
  couples_share_bed?: boolean;
  mixed_rooms?: boolean;
}
export interface Proposal {
  id: string;
  change: TripChange;
  status: "open" | "passed" | "failed";
  closes_at: string;
  approvals: number;
  rejections: number;
  my_vote: boolean | null;
}
export interface GroupTrip extends TripSummary {
  members: { user_id: string; status: Rsvp; profile: ProfileView | null }[];
  proposals: Proposal[];
  shortlist: {
    id: string;
    url: string;
    title: string;
    nightly_price: number | null;
    thumbnail_path: string | null;
    currency: string;
    votes: number;
    my_vote: boolean;
  }[];
}
export interface ChatContext {
  group_id: string | null;
  group_name: string | null;
  trip_id: string | null;
  members: { user_id: string; profile: ProfileView | null }[];
}
export function voteOutcome(
  going: number,
  approvals: number,
  closesAt: string,
  now = Date.now(),
) {
  if (new Date(closesAt).getTime() <= now) return "failed";
  return going > 0 && approvals * 2 > going ? "passed" : "open";
}
export function voteTimeLeft(closesAt: string, now = Date.now()) {
  const ms = new Date(closesAt).getTime() - now;
  return ms <= 0
    ? "Voting closed"
    : ms < 3600000
      ? `${Math.max(1, Math.ceil(ms / 60000))}m left`
      : `${Math.ceil(ms / 3600000)}h left`;
}
export function groupLodging(
  ci: number,
  n: number,
  maxPerRoom: 2 | 3 | 4,
  city: string,
  start: string,
  end: string,
  nights: number,
) {
  if (!Number.isInteger(n) || n < 1 || n > GROUP_LIMIT)
    throw new Error("Choose 1–10 people.");
  const tiers = lodgingTiers(ci, n);
  const hotelRooms = Math.ceil(n / Math.min(maxPerRoom, 3));
  // Preserve Phase 8's rounded per-person apartment estimate. For hotel room
  // capacity, reuse its one-room rate and size the number of rooms explicitly.
  const hotelTotal = lodgingTiers(ci, 1)[2][1] * hotelRooms * nights;
  return [
    {
      label: "Hostel",
      units: n,
      unitLabel: "beds",
      perPerson: tiers[0][1] * nights,
      total: tiers[0][1] * n * nights,
      url: hostelworldUrl(city, start, end, n),
    },
    {
      label: "Apartment",
      units: Math.ceil(n / maxPerRoom),
      unitLabel: "bedrooms · 1 apartment",
      perPerson: tiers[1][1] * nights,
      total: tiers[1][1] * n * nights,
      url: airbnbUrl(city, start, end, n),
    },
    {
      label: "Hotel",
      units: hotelRooms,
      unitLabel: "rooms",
      perPerson: hotelTotal / n,
      total: hotelTotal,
      url: bookingComUrl(city, start, end, n, hotelRooms),
    },
  ];
}
export function tripConflicts(plan: Plan, trip: FreeWeekend) {
  if (!plan.semester) return [];
  const y = Number(plan.semester.start.slice(0, 4)),
    m = Number(plan.semester.start.slice(5, 7));
  const iso = (year: number, month: number, day: number) =>
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return (plan.slots ?? []).filter((s) => {
    if (!plan.placements[s.id]?.stops.length) return false;
    const year = y + (s.s[0] < m ? 1 : 0);
    return overlaps(trip, {
      start_date: iso(year, ...s.s),
      end_date: iso(year + (s.e[0] < s.s[0] ? 1 : 0), ...s.e),
    });
  });
}
export function safeListingUrl(raw: string) {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.href
      : null;
  } catch {
    return null;
  }
}
