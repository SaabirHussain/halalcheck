import { afterEach, describe, expect, it } from "vitest";
import { hasValidBrowserOrigin } from "@/lib/http/origin";

const originalAppUrl = process.env.APP_URL;
const originalAllowedOrigins = process.env.APP_ALLOWED_ORIGINS;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }
  if (originalAllowedOrigins === undefined) {
    delete process.env.APP_ALLOWED_ORIGINS;
  } else {
    process.env.APP_ALLOWED_ORIGINS = originalAllowedOrigins;
  }
});

describe("hasValidBrowserOrigin", () => {
  it("accepts the APP_URL origin", () => {
    process.env.APP_URL = "https://app.example.test/path";
    delete process.env.APP_ALLOWED_ORIGINS;

    expect(
      hasValidBrowserOrigin(
        new Request("https://request.example.test/api", {
          headers: { origin: "https://app.example.test" },
        }),
      ),
    ).toBe(true);
  });

  it("uses the request URL origin when APP_URL is unset", () => {
    delete process.env.APP_URL;
    delete process.env.APP_ALLOWED_ORIGINS;

    expect(
      hasValidBrowserOrigin(
        new Request("https://request.example.test/api", {
          headers: { origin: "https://request.example.test" },
        }),
      ),
    ).toBe(true);
  });

  it("accepts an allowed origin with whitespace and a path", () => {
    process.env.APP_URL = "https://app.example.test";
    process.env.APP_ALLOWED_ORIGINS = "  , https://custom.example.test/path/  ";

    expect(
      hasValidBrowserOrigin(
        new Request("https://request.example.test/api", {
          headers: { origin: "https://custom.example.test" },
        }),
      ),
    ).toBe(true);
  });

  it("rejects an origin not in the allowlist", () => {
    process.env.APP_URL = "https://app.example.test";
    process.env.APP_ALLOWED_ORIGINS = "https://custom.example.test";

    expect(
      hasValidBrowserOrigin(
        new Request("https://request.example.test/api", {
          headers: { origin: "https://unlisted.example.test" },
        }),
      ),
    ).toBe(false);
  });

  it("accepts requests without an Origin header", () => {
    process.env.APP_URL = "https://app.example.test";
    process.env.APP_ALLOWED_ORIGINS = "";

    expect(
      hasValidBrowserOrigin(new Request("https://request.example.test/api")),
    ).toBe(true);
  });

  it("rejects an unparsable Origin", () => {
    process.env.APP_URL = "https://app.example.test";
    process.env.APP_ALLOWED_ORIGINS = "https://custom.example.test";

    expect(
      hasValidBrowserOrigin(
        new Request("https://request.example.test/api", {
          headers: { origin: "not a URL" },
        }),
      ),
    ).toBe(false);
  });

  it("ignores invalid entries in APP_ALLOWED_ORIGINS", () => {
    process.env.APP_URL = "https://app.example.test";
    process.env.APP_ALLOWED_ORIGINS =
      "not a URL, , https://custom.example.test/path";

    expect(
      hasValidBrowserOrigin(
        new Request("https://request.example.test/api", {
          headers: { origin: "https://custom.example.test" },
        }),
      ),
    ).toBe(true);
  });
});
