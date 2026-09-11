import { describe, expect, it } from "vitest";
import { usePlanStore } from "@/lib/store/plan";

// mergeRemote returns the ids AuthSync uploads after sign-in. A friend's plan
// added to Compare from a share link is read-only and never ours: uploading it
// fails server-side, and it used to sit in the sync queue forever ("Syncing 1
// change…" that never finished). Sign-in is now required, which routes every
// share-link visitor who clicks "Add to my Compare" through exactly this merge.

describe("mergeRemote", () => {
  it("never offers a read-only shared plan for upload", () => {
    const store = usePlanStore.getState();
    const mineId = store.newPlan("Mine");
    const mine = usePlanStore.getState().plans[mineId];
    usePlanStore.getState().addSharedPlan({ ...mine, id: "friends-plan", name: "Friend's plan", ownerId: "someone-else" });

    const toUpload = usePlanStore.getState().mergeRemote([]);

    expect(toUpload).toContain(mineId); // local-only and ours: still uploaded
    expect(toUpload).not.toContain("friends-plan");
    expect(usePlanStore.getState().plans["friends-plan"]?.readOnly).toBe(true); // still in Compare
  });
});
