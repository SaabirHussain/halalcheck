"use client";

import { useEffect, useState } from "react";
import { BROWSER_COOKIE } from "@/lib/http/browser-gate";

export function GooglePlacePhoto({
  authorName,
  authorUri,
  fallbackSrc,
  googleMapsUri,
  name,
}: {
  authorName: string | null;
  authorUri: string | null;
  fallbackSrc: string;
  googleMapsUri: string | null;
  name: string;
}) {
  const [browserReady, setBrowserReady] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const photoSrc = `/api/place-photo?name=${encodeURIComponent(name)}`;
  const src = browserReady && !failed ? photoSrc : fallbackSrc;

  useEffect(() => {
    const hasBrowserCookie = () =>
      document.cookie
        .split(";")
        .some((cookie) => cookie.trim() === `${BROWSER_COOKIE}=1`);
    if (!hasBrowserCookie()) {
      const secure = location.protocol === "https:" ? "; secure" : "";
      document.cookie = `${BROWSER_COOKIE}=1; path=/; max-age=31536000; samesite=lax${secure}`;
    }
    if (hasBrowserCookie()) setBrowserReady(true);
  }, []);

  return (
    <div className="absolute inset-0">
      <img
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={() => {
          if (browserReady && !failed) setFailed(true);
        }}
        onLoad={() => setLoadedSrc(src)}
        src={src}
      />
      {browserReady && loadedSrc === photoSrc && !failed ? (
        <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-lg bg-black/70 px-3 py-2 text-xs text-white">
          {authorName ? (
            authorUri ? (
              <a
                href={authorUri}
                rel="noopener noreferrer"
                target="_blank"
              >
                Photo: {authorName}
              </a>
            ) : (
              <span>Photo: {authorName}</span>
            )
          ) : null}
          {googleMapsUri ? (
            <a
              href={googleMapsUri}
              rel="noopener noreferrer"
              target="_blank"
            >
              View on Google Maps
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
