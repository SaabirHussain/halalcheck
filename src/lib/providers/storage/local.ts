import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const maxBytes = Number(process.env.MAX_UPLOAD_BYTES ?? 5_242_880);
const storageRoot = path.resolve(process.env.STORAGE_DIR ?? "./storage");

const fileTypes = [
  { mime: "application/pdf", extension: "pdf", prefix: [0x25, 0x50, 0x44, 0x46] },
  { mime: "image/png", extension: "png", prefix: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/jpeg", extension: "jpg", prefix: [0xff, 0xd8, 0xff] },
  { mime: "image/webp", extension: "webp", prefix: [0x52, 0x49, 0x46, 0x46] },
];

export function detectEvidenceMime(bytes: Uint8Array) {
  return fileTypes.find((type) => type.prefix.every((byte, index) => bytes[index] === byte))?.mime;
}

export async function storeEvidenceUpload(
  bytes: Uint8Array,
  declaredMime: string,
  originalFilename = "evidence",
) {
  if (bytes.byteLength > maxBytes) throw new Error("Upload exceeds MAX_UPLOAD_BYTES.");
  const mime = detectEvidenceMime(bytes);
  if (!mime || mime !== declaredMime) throw new Error("Upload type does not match its file signature.");
  if (mime === "image/webp" && Buffer.from(bytes.slice(8, 12)).toString() !== "WEBP") {
    throw new Error("Invalid WebP file signature.");
  }
  await mkdir(storageRoot, { recursive: true, mode: 0o700 });
  const key = `${randomUUID()}.${fileTypes.find((type) => type.mime === mime)!.extension}`;
  await writeFile(path.join(storageRoot, key), bytes, { mode: 0o600, flag: "wx" });
  return {
    storageKey: key,
    originalFilename: path.basename(originalFilename).replace(/[\r\n"]/g, "_").slice(0, 120) || "evidence",
    mime,
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function readEvidence(storageKey: string) {
  if (!/^[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.test(storageKey)) {
    throw new Error("Invalid evidence storage key.");
  }
  const resolved = path.resolve(storageRoot, storageKey);
  if (!resolved.startsWith(`${storageRoot}${path.sep}`)) throw new Error("Invalid storage path.");
  return readFile(resolved);
}
