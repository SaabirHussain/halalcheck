import { describe, expect, it } from "vitest";
import { isThirdPartyListingUrl } from "@/lib/domain/contact-classification";

describe("isThirdPartyListingUrl", () => {
  it.each([
    { url: "https://order.online/store/x?y=1", expected: true },
    { url: "https://www.doordash.com/store/x", expected: true },
    { url: "https://m.facebook.com/x", expected: true },
    { url: "https://www.karahiboys.com/", expected: false },
    { url: "https://notdoordash.com/", expected: false },
    { url: "not a url", expected: false },
  ])("$url returns $expected", ({ url, expected }) => {
    expect(isThirdPartyListingUrl(url)).toBe(expected);
  });
});
