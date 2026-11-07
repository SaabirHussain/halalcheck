import { afterEach, describe, expect, it } from "vitest";
import { supportUrl } from "@/lib/support";

const originalSupportUrl = process.env.NEXT_PUBLIC_SUPPORT_URL;

afterEach(() => {
  if (originalSupportUrl === undefined) {
    delete process.env.NEXT_PUBLIC_SUPPORT_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPPORT_URL = originalSupportUrl;
  }
});

describe("supportUrl", () => {
  it("returns null when unset", () => {
    delete process.env.NEXT_PUBLIC_SUPPORT_URL;
    expect(supportUrl()).toBeNull();
  });

  it("rejects non-https URLs", () => {
    process.env.NEXT_PUBLIC_SUPPORT_URL = "http://ko-fi.com/saabirhussain";
    expect(supportUrl()).toBeNull();
  });

  it("rejects invalid values", () => {
    process.env.NEXT_PUBLIC_SUPPORT_URL = "not a URL";
    expect(supportUrl()).toBeNull();
  });

  it("returns valid https URLs unchanged", () => {
    const value = "https://ko-fi.com/saabirhussain";
    process.env.NEXT_PUBLIC_SUPPORT_URL = value;
    expect(supportUrl()).toBe(value);
  });
});
