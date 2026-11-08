export const BROWSER_COOKIE = "hc_browser";

const botUserAgentPattern =
  /bot|crawl|spider|slurp|curl|wget|python|httpclient|http-client|go-http|java\/|okhttp|headless|scrapy|axios|node-fetch|undici|libwww|facebookexternalhit|preview|monitor|scan/i;

export function isLikelyBot(userAgent: string | null | undefined): boolean {
  return !userAgent?.trim() || botUserAgentPattern.test(userAgent);
}

export function allowProviderSearch(headers: Headers): boolean {
  const hasBrowserCookie =
    headers
      .get("cookie")
      ?.split(";")
      .some((cookie) => {
        const separator = cookie.indexOf("=");
        return (
          separator >= 0 &&
          cookie.slice(0, separator).trim() === BROWSER_COOKIE &&
          cookie.slice(separator + 1).trim() === "1"
        );
      }) ?? false;

  return hasBrowserCookie && !isLikelyBot(headers.get("user-agent"));
}
