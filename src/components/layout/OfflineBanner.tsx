"use client";

import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateStatus = () => setOffline(!navigator.onLine);
    updateStatus();
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      className="border-b border-warn/20 bg-warn-soft px-4 py-3 text-center text-sm text-warn"
      role="status"
    >
      You’re offline. Showing saved research; changes will wait until you
      reconnect.
    </div>
  );
}
