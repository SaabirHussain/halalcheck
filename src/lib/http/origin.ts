export function hasValidBrowserOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const expected = process.env.APP_URL
      ? new URL(process.env.APP_URL).origin
      : new URL(request.url).origin;
    const requestOrigin = new URL(origin).origin;
    const allowedOrigins = (process.env.APP_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .flatMap((value) => {
        try {
          return [new URL(value).origin];
        } catch {
          return [];
        }
      });
    return requestOrigin === expected || allowedOrigins.includes(requestOrigin);
  } catch {
    return false;
  }
}
