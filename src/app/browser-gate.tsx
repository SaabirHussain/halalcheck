"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BROWSER_COOKIE } from "@/lib/http/browser-gate";

function hasBrowserCookie(cookie: string) {
  return cookie.split(";").some((part) => {
    const separator = part.indexOf("=");
    return (
      separator >= 0 &&
      part.slice(0, separator).trim() === BROWSER_COOKIE &&
      part.slice(separator + 1).trim() === "1"
    );
  });
}

export function BrowserGate() {
  const router = useRouter();

  useEffect(() => {
    if (hasBrowserCookie(document.cookie)) return;
    const secure = location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${BROWSER_COOKIE}=1; path=/; max-age=31536000; samesite=lax${secure}`;
    if (hasBrowserCookie(document.cookie)) router.refresh();
  }, [router]);

  return null;
}
