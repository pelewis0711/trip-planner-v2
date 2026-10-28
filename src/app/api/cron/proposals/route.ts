import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  createServiceClient,
  hasServiceCredentials,
} from "@/lib/supabase/service";

// Vercel cron has no user session. Authenticate with the same fail-closed
// CRON_SECRET boundary as storage cleanup; no client can call the sweep RPC.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !hasServiceCredentials()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!matches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await createServiceClient().rpc(
    "resolve_due_trip_proposals",
  );
  if (error) {
    console.error("Proposal sweep failed", error.code);
    return NextResponse.json(
      { error: "Could not resolve proposals" },
      { status: 500 },
    );
  }
  return NextResponse.json({ resolvedTrips: data });
}

function matches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
