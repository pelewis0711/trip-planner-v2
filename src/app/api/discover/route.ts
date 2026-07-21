import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { TRIPS } from "@/data/trips";
import { DISCOVERY_JSON_SCHEMA, validateAndConvertTrip, type RejectedTrip } from "@/lib/discover/schema";
import type { Trip } from "@/data/trips";

// Discovery calls can involve real thinking + a few thousand output tokens;
// give it real headroom rather than risk the platform timing out mid-call.
export const maxDuration = 60;

interface DiscoverRequestBody {
  home: string;
  filterSummary: string;
  remainingSlots: { label: string; date: string }[];
  remainingBudget: number | null;
  remainingSchengenDays: number;
  existingCustomTrips: Trip[];
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Trip discovery isn't configured yet" }, { status: 503 });
  }

  let body: DiscoverRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { home, filterSummary, remainingSlots, remainingBudget, remainingSchengenDays, existingCustomTrips } = body;

  const existingIds = new Set([...TRIPS.map((t) => t.id), ...existingCustomTrips.map((t) => t.id)]);
  const existingNameCountry = new Set(
    [...TRIPS, ...existingCustomTrips].map((t) => `${t.n.toLowerCase()}|${t.c.toLowerCase()}`)
  );
  const existingRegions = [...new Set(TRIPS.map((t) => t.reg))].sort();
  const catalogList = [...TRIPS, ...existingCustomTrips].map((t) => `${t.n}, ${t.c}`).join("; ");

  const slotsDesc = remainingSlots.length
    ? remainingSlots.map((s) => `${s.label} (${s.date})`).join("; ")
    : "none — every weekend is already booked";

  const prompt = `You are helping a study-abroad student in ${home} find NEW trip ideas for their semester travel planner.

CRITICAL: every trip you propose must be a real place that is NOT already in this list (${TRIPS.length + existingCustomTrips.length} existing entries) — do not propose any of these, or an alternate spelling of one of these:
${catalogList}

Existing region groupings already in use (reuse one of these if it genuinely fits; only invent a new region name if none fit): ${existingRegions.join(", ")}.

Student's current context:
- Home base: ${home}
- Active catalog filters right now: ${filterSummary || "none set"}
- Remaining open weekend/break slots: ${slotsDesc}
- Remaining travel budget: ${remainingBudget !== null ? `$${remainingBudget} USD (per person, total)` : "no budget cap set"}
- Remaining Schengen days available (of the 90-in-180 limit): ${remainingSchengenDays}

Propose 5 to 10 real, specific destinations (actual cities or well-defined places, not vague regions) that are NOT in the existing list above, that fit this student's filters, remaining slots, budget, and Schengen situation as well as possible. Prefer trips a budget-conscious college student studying in Europe would realistically consider. Use realistic per-person USD prices for activities and food based on genuine knowledge of typical costs in that place.`;

  const client = new Anthropic({ apiKey });

  let raw: unknown;
  let usage: { inputTokens: number; outputTokens: number };
  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: {
        format: { type: "json_schema", schema: DISCOVERY_JSON_SCHEMA },
      },
      messages: [{ role: "user", content: prompt }],
    });
    const message = await stream.finalMessage();
    usage = { inputTokens: message.usage.input_tokens, outputTokens: message.usage.output_tokens };

    if (message.stop_reason === "refusal") {
      return NextResponse.json({ error: "The model declined this request — try adjusting your filters" }, { status: 422 });
    }

    const textBlock = message.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) {
      return NextResponse.json({ error: "No response content from the model" }, { status: 502 });
    }
    raw = JSON.parse(textBlock.text);
  } catch (err) {
    console.error("Discovery request to Claude failed", err);
    return NextResponse.json({ error: "The discovery request failed — try again in a moment" }, { status: 502 });
  }

  const rawTrips = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>).trips : undefined;
  if (!Array.isArray(rawTrips)) {
    return NextResponse.json({ error: "Malformed response from the model" }, { status: 502 });
  }

  const accepted: Trip[] = [];
  const rejected: RejectedTrip[] = [];
  const seenThisRun = new Set(existingIds);

  for (const item of rawTrips) {
    const result = validateAndConvertTrip(item, seenThisRun, existingNameCountry);
    if ("trip" in result) {
      seenThisRun.add(result.trip.id);
      accepted.push(result.trip);
    } else {
      rejected.push(result.error);
    }
  }

  // Opus 4.8 pricing: $5/1M input tokens, $25/1M output tokens (incl. thinking tokens)
  const costUsd = (usage.inputTokens / 1_000_000) * 5 + (usage.outputTokens / 1_000_000) * 25;

  return NextResponse.json({ accepted, rejected, usage: { ...usage, costUsd } });
}
