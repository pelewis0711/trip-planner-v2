import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  configured: vi.fn(() => true),
}));
vi.mock("@/lib/supabase/service", () => ({
  hasServiceCredentials: mocks.configured,
  createServiceClient: () => ({ rpc: mocks.rpc }),
}));
import { GET } from "../route";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe("proposal cron authentication", () => {
  it("fails closed if CRON_SECRET is missing", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(
      new NextRequest("https://example.com/api/cron/proposals"),
    );
    expect(response.status).toBe(503);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects missing and wrong bearer values before calling the database", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    for (const authorization of ["", "Bearer wrong"]) {
      const response = await GET(
        new NextRequest("https://example.com/api/cron/proposals", {
          headers: { authorization },
        }),
      );
      expect(response.status).toBe(401);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("resolves overdue proposals for an authorized scheduler", async () => {
    vi.stubEnv("CRON_SECRET", "test-only-secret");
    mocks.rpc.mockResolvedValue({ data: 3, error: null });
    const response = await GET(
      new NextRequest("https://example.com/api/cron/proposals", {
        headers: { authorization: "Bearer test-only-secret" },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resolvedTrips: 3 });
    expect(mocks.rpc).toHaveBeenCalledWith("resolve_due_trip_proposals");
  });
});
