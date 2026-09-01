import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

// Shared local-disk storage for small "profile photo" style images (student
// photos, teacher photos, school logos) - separate from documents/
// StorageService because those files stay behind an authenticated download
// endpoint, while photos need to be read directly, in-process, by any PDF
// generator (ID cards, fee receipts, result cards) without an HTTP round
// trip. Uses the same UPLOADS_DIR root so it shares a volume in production.
const ROOT = process.env.UPLOADS_DIR ? join(process.env.UPLOADS_DIR) : join(process.cwd(), 'uploads');

function resolveSafe(fileKey: string): string {
  // Strips ".." segments so a malformed/tampered fileKey can never escape
  // the uploads root (same protection as documents/storage.service.ts).
  const safeKey = fileKey
    .split(/[/\\]/)
    .filter((segment) => segment && segment !== '..')
    .join('/');
  return join(ROOT, safeKey);
}

// Saves a photo under `<root>/<relativeDir>/<fileName>` and returns the
// relative fileKey to store on the profile (e.g. photoUrl). Re-uploading
// with the same fileName (we use the profile's own id) overwrites the old
// photo automatically, so no orphaned files pile up.
export function savePersonPhoto(relativeDir: string, fileName: string, buffer: Buffer): string {
  const absDir = join(ROOT, relativeDir);
  if (!existsSync(absDir)) mkdirSync(absDir, { recursive: true });
  writeFileSync(join(absDir, fileName), buffer);
  return `${relativeDir}/${fileName}`;
}

// Reads a photo for embedding into a server-generated PDF. Accepts either:
//  - a full http(s) URL (legacy/external photoUrl values, e.g. migrated data
//    that still points at an old system's image host), fetched over network
//  - a relative fileKey saved by savePersonPhoto() above, read straight off
//    disk (no network hop needed - PDF generation runs in this same process)
// Never throws - a missing/broken photo should just fall back to whatever
// placeholder the caller draws instead, never break the PDF.
export async function fetchPersonPhoto(value: string | null | undefined): Promise<Buffer | null> {
  if (!value) return null;
  try {
    if (/^https?:\/\//i.test(value)) {
      const res = await fetch(value);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    }
    const path = resolveSafe(value);
    if (!existsSync(path)) return null;
    return readFileSync(path);
  } catch {
    return null;
  }
}
