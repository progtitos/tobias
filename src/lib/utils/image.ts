/**
 * Client-side photo compression for the receipt-upload flow.
 *
 * Phone camera photos routinely come in at 3-10MB, which blows past both
 * Next.js's Server Action body limit and Vercel's hard, non-configurable
 * 4.5MB request body cap for serverless functions — especially once you
 * allow up to 5 photos in one submission. Gemini's OCR doesn't need full
 * sensor resolution to read a receipt, so we downscale and re-encode as
 * JPEG in the browser before the file ever leaves the device.
 */
export async function compressImageFile(
  file: File,
  { maxDimension = 1600, quality = 0.75 }: { maxDimension?: number; quality?: number } = {}
): Promise<File> {
  // Non-image files (shouldn't happen given the <input accept="image/*">,
  // but a misbehaving OS share sheet could hand us something else) pass
  // through untouched rather than failing the whole upload.
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) return file;

    // If compression somehow produced something larger (tiny/simple source
    // images sometimes do, since JPEG re-encoding isn't free), keep the
    // original rather than making things worse.
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^./]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    // createImageBitmap/canvas can fail on exotic formats (HEIC without
    // browser support, corrupt files, etc.) — fall back to the original so
    // the user isn't blocked by a compression bug, even though the upload
    // may then hit the size limit and surface a clearer error.
    return file;
  }
}
