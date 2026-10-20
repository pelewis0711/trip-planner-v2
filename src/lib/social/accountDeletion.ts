// Shared by /settings/delete-account and POST /api/account/delete.

/** What the person types to confirm. */
export const DELETE_CONFIRM_WORD = "DELETE";

/** This browser's saved copies (Zustand persist keys in src/lib/store/). The
 * account is gone server-side; these would otherwise be merged into the next
 * account that signs in on this device. */
export const LOCAL_STORAGE_KEYS = ["activePlan", "customHomes"];
