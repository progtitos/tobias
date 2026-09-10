import "server-only";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createId } from "@paralleldrive/cuid2";

// ============================================================================
// StorageService — where uploaded receipt/document photos actually live.
// ----------------------------------------------------------------------------
// Two backends, chosen automatically by which env vars are present:
//   - Supabase Storage (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set): a
//     plain REST PUT to the "receipts" bucket — no SDK dependency needed for
//     something this small. This is what production on Vercel should use,
//     since Vercel's filesystem is read-only/ephemeral per invocation.
//   - Local disk (fallback): writes under /public/uploads, servable
//     immediately by Next's static file handling. Works for local dev and
//     any traditional persistent host, but NOT on Vercel — receipt OCR
//     extraction still works either way (it only needs the bytes in-memory
//     for the Gemini call), only the "view the original photo later"
//     feature degrades without a real bucket configured.
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "receipts";

export function isCloudStorageConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function extensionFor(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "application/pdf") return "pdf";
  return "jpg";
}

async function saveToSupabase(objectPath: string, buffer: Buffer, mimeType: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY!,
      "Content-Type": mimeType,
      "x-upsert": "true",
    },
    body: new Blob([new Uint8Array(buffer)], { type: mimeType }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase Storage upload failed (${res.status}): ${text}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}`;
}

async function saveToLocalDisk(objectPath: string, buffer: Buffer): Promise<string> {
  const fullDir = path.join(process.cwd(), "public", "uploads", path.dirname(objectPath));
  await mkdir(fullDir, { recursive: true });
  const fullPath = path.join(process.cwd(), "public", "uploads", objectPath);
  await writeFile(fullPath, buffer);
  return `/uploads/${objectPath}`;
}

export async function saveReceiptImage(userId: string, buffer: Buffer, mimeType: string): Promise<string> {
  const objectPath = `${userId}/${createId()}.${extensionFor(mimeType)}`;
  if (isCloudStorageConfigured()) {
    return saveToSupabase(objectPath, buffer, mimeType);
  }
  return saveToLocalDisk(objectPath, buffer);
}
