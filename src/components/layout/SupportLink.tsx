"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { isNativeApp } from "@/lib/native/platform";

function useWebVisibility() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(!isNativeApp());
  }, []);
  return visible;
}

export function WebOnly({ children }: { children: ReactNode }) {
  const visible = useWebVisibility();
  return visible ? <>{children}</> : null;
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
