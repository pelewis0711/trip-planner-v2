/** Accepts either a pasted full share URL (".../shared/<token>") or a bare
 * token and returns just the token, or null if it doesn't look like either. */
export function extractShareToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/\/shared\/([A-Za-z0-9_-]+)\/?$/);
  if (match) return match[1];

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}
