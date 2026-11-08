"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { isNativeApp } from "@/lib/native/platform";

function usePlatform() {
  const [platform, setPlatform] = useState<"web" | "native" | null>(null);
  useEffect(() => {
    setPlatform(isNativeApp() ? "native" : "web");
  }, []);
  return platform;
}

function useWebVisibility() {
  return usePlatform() === "web";
}

export function WebOnly({ children }: { children: ReactNode }) {
  const visible = useWebVisibility();
  return visible ? <>{children}</> : null;
}

export function WebOnlyPage({ children }: { children: ReactNode }) {
  const platform = usePlatform();
  const router = useRouter();
  useEffect(() => {
    if (platform === "native") router.replace("/");
  }, [platform, router]);
  return platform === "web" ? <>{children}</> : null;
}

export function SupportLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const visible = useWebVisibility();
  if (!visible) return null;
  const external = /^https?:\/\//i.test(href);
  return (
    <a
      className={className}
      href={href}
      rel={external ? "noopener noreferrer" : undefined}
      target={external ? "_blank" : undefined}
    >
      {children}
    </a>
  );
}
