import { describe, expect, it } from "vitest";
import {
  allowProviderSearch,
  BROWSER_COOKIE,
  isLikelyBot,
} from "@/lib/http/browser-gate";

const chromeUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36";
const safariIPhoneUserAgent =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1";

describe("isLikelyBot", () => {
  it.each([
    "Googlebot/2.1",
    "GPTBot/1.0",
    "curl/8.4.0",
    "",
    undefined,
  ])("recognizes bot user agent %s", (userAgent) => {
    expect(isLikelyBot(userAgent)).toBe(true);
  });

  it.each([chromeUserAgent, safariIPhoneUserAgent])(
    "allows browser user agent %s",
    (userAgent) => {
      expect(isLikelyBot(userAgent)).toBe(false);
    },
  );
});

describe("allowProviderSearch", () => {
  it("allows a browser with the exact browser cookie", () => {
    expect(
      allowProviderSearch(
        new Headers({
          cookie: `other=value; ${BROWSER_COOKIE}=1`,
          "user-agent": chromeUserAgent,
        }),
      ),
    ).toBe(true);
  });

  it("rejects a browser without the cookie", () => {
    expect(
      allowProviderSearch(new Headers({ "user-agent": chromeUserAgent })),
    ).toBe(false);
  });

  it("rejects a bot even when the cookie is present", () => {
    expect(
      allowProviderSearch(
        new Headers({
          cookie: `${BROWSER_COOKIE}=1`,
          "user-agent": "Googlebot/2.1",
        }),
      ),
    ).toBe(false);
  });

  it("does not match a cookie with a similar name", () => {
    expect(
      allowProviderSearch(
        new Headers({
          cookie: `x${BROWSER_COOKIE}=1`,
          "user-agent": chromeUserAgent,
        }),
      ),
    ).toBe(false);
  });
});
