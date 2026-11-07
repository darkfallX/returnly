import { NoWriteError } from "@agent-native/core/action";
import type { PrivateBlobHandle } from "@agent-native/core/private-blob";

const PREFIX = "private-blob:";
const MAX_BYTES = 4 * 1024 * 1024;
const TYPES = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "video/mp4", "video/webm"]);

export async function storeEvidence(dataUrl: string, ownerEmail: string, filename: string, declaredType?: string) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || !TYPES.has(match[1]!) || (declaredType && declaredType !== match[1])) {
    throw new NoWriteError("Choose a PNG, JPEG, WebP, PDF, MP4 or WebM file.", { errorCode: "invalid_evidence_type", statusCode: 400 });
  }
  if (dataUrl.length > Math.ceil(MAX_BYTES * 4 / 3) + 128) throw new NoWriteError("Choose a file under 4 MB.", { errorCode: "evidence_too_large", statusCode: 400 });
  const data = Buffer.from(match[2]!, "base64");
  if (!data.length || data.length > MAX_BYTES) throw new NoWriteError("Choose a file under 4 MB.", { errorCode: "evidence_too_large", statusCode: 400 });
  const { putPrivateBlob } = await import("@agent-native/core/private-blob");
  const handle = await putPrivateBlob({ data, ownerEmail, filename, mimeType: match[1]!, metadata: { purpose: "returnly-evidence" } });
  if (!handle) throw new NoWriteError("Private file storage is Not connected. Add a written note or connect private storage in settings.", { errorCode: "private_storage_not_connected", statusCode: 503 });
  return { storageKey: PREFIX + JSON.stringify(handle), size: data.length, mimeType: match[1]!, dataUrl: null };
}

// Call only after proving ownership or buyer disclosure on the parent claim.
export async function readEvidence(attachment: { storageKey: string; dataUrl: string | null; mimeType: string }) {
  if (!attachment.storageKey.startsWith(PREFIX)) {
    // Retain readable existing uploads while new writes store only blob references in SQL.
    return attachment.dataUrl && TYPES.has(attachment.mimeType) ? attachment.dataUrl : null;
  }
  const handle = JSON.parse(attachment.storageKey.slice(PREFIX.length)) as PrivateBlobHandle;
  const { readPrivateBlob } = await import("@agent-native/core/private-blob");
  const blob = await readPrivateBlob(handle);
  return `data:${attachment.mimeType};base64,${Buffer.from(blob.data).toString("base64")}`;
}

export function isStoredEvidence(storageKey: string) {
  return storageKey.startsWith(PREFIX) || storageKey.startsWith("upload://");
}
