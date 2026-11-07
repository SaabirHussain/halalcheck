export function supportUrl(): string | null {
  const value = process.env.NEXT_PUBLIC_SUPPORT_URL?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname ? value : null;
  } catch {
    return null;
  }
}
