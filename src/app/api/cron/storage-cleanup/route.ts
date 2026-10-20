import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createServiceClient, hasServiceCredentials } from "@/lib/supabase/service";
import { processCleanupQueue } from "../../_shared/storageCleanup";

// Daily sweep (vercel.json "crons") that removes Storage files the database
// queued for deletion -- profile photos of deleted accounts (however they were
// deleted, including from the Supabase dashboard) and replaced photos.
//
// /api/cron is on the sign-in gate's public list because Vercel's scheduler has
// no user session. THIS ROUTE IS ITS OWN LOCK: it only runs when the request
// carries `Authorization: Bearer <CRON_SECRET>`, which Vercel adds to its cron
// calls automatically once CRON_SECRET is set in the project's environment.
// No CRON_SECRET configured = the route refuses everything (503), never opens.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !hasServiceCredentials()) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }
  if (!matches(request.headers.get("authorization"), `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processCleanupQueue(createServiceClient());
  return NextResponse.json(result, { status: result.error ? 500 : 200 });
}

function matches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
