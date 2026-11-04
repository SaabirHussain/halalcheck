export function hasValidBrowserOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expected = process.env.APP_URL ? new URL(process.env.APP_URL).origin : new URL(request.url).origin;
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}
