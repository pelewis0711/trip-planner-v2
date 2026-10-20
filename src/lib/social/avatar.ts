// Phase 26: shrink a chosen photo to a 512px square in the browser before it's
// uploaded. Keeps uploads far under the bucket's 2 MB cap, strips the photo's
// metadata (EXIF location included) as a side effect of redrawing it, and
// means every avatar downloads fast on a phone abroad.

export const AVATAR_SIZE = 512;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

export class AvatarError extends Error {}

export async function resizeAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new AvatarError("That file isn't an image.");
  if (file.size > MAX_INPUT_BYTES) throw new AvatarError("That photo is too large (20 MB max).");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarError("Couldn't read that photo. Try a JPG or PNG.");
  }

  // Center square crop.
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  const out = Math.min(AVATAR_SIZE, side);

  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("Your browser can't process photos.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();

  // WebP where the browser can encode it, JPEG otherwise (older Safari
  // silently hands back PNG when asked for WebP).
  const webp = await toBlob(canvas, "image/webp", 0.85);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (jpeg) return jpeg;
  throw new AvatarError("Couldn't process that photo.");
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
