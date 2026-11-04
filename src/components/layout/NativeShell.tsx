"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect } from "react";
import { isNativeApp } from "@/lib/native/platform";

export function NativeShell({
  userId,
  pushEnabled,
}: {
  userId: string | null;
  pushEnabled: boolean;
}) {
  useEffect(() => {
    if (!isNativeApp()) return;

    void StatusBar.setStyle({ style: Style.Light }).catch(() => {});
    void StatusBar.setBackgroundColor({ color: "#faf6ef" }).catch(() => {});
    void StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    void SplashScreen.hide().catch(() => {});

    let removeBackButtonListener: (() => void) | undefined;
    let removeNotificationActionListener: (() => void) | undefined;
    let disposed = false;
    void PushNotifications.addListener(
      "pushNotificationActionPerformed",
      ({ notification }) => {
        const link = notification.data?.link;
        if (
          typeof link !== "string" ||
          !link.startsWith("/") ||
          link.startsWith("//")
        )
          return;
        try {
          const target = new URL(link, window.location.origin);
          if (target.origin === window.location.origin)
            window.location.assign(target.href);
        } catch {}
      },
    )
      .then((listener) => {
        if (disposed) {
          void listener.remove();
          return;
        }
        removeNotificationActionListener = () => void listener.remove();
      })
      .catch(() => {});

    if (Capacitor.getPlatform() === "android") {
      void App.addListener("backButton", ({ canGoBack }) => {
        if (canGoBack && window.history.length > 1) window.history.back();
        else void App.exitApp();
      })
        .then((listener) => {
          removeBackButtonListener = () => void listener.remove();
        })
        .catch(() => {});
    }

    const openExternalLinks = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const anchor = event.target.closest("a");
      if (!anchor?.href) return;
      const url = new URL(anchor.href, window.location.href);
      if (
        (anchor.target === "_blank" || url.origin !== window.location.origin) &&
        (url.protocol === "http:" || url.protocol === "https:")
      ) {
        event.preventDefault();
        void Browser.open({ url: url.toString() }).catch(() => {});
      }
    };
    document.addEventListener("click", openExternalLinks);
    return () => {
      disposed = true;
      document.removeEventListener("click", openExternalLinks);
      removeBackButtonListener?.();
      removeNotificationActionListener?.();
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp() || !pushEnabled || !userId) return;
    let cancelled = false;
    let removeRegistrationListener: (() => void) | undefined;
    let removeErrorListener: (() => void) | undefined;
    const register = async () => {
      const errorListener = await PushNotifications.addListener(
        "registrationError",
        () => {},
      );
      removeErrorListener = () => void errorListener.remove();
      const registrationListener = await PushNotifications.addListener(
        "registration",
        async ({ value: token }) => {
          if (cancelled) return;
          const platform = Capacitor.getPlatform();
          if (platform !== "android" && platform !== "ios") return;
          try {
            await fetch("/api/me/push-devices", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ platform, token }),
            });
          } catch {}
        },
      );
      removeRegistrationListener = () => void registrationListener.remove();
      const permission = await PushNotifications.requestPermissions();
      if (permission.receive === "granted") await PushNotifications.register();
    };
    void register().catch(() => {});
    return () => {
      cancelled = true;
      removeRegistrationListener?.();
      removeErrorListener?.();
    };
  }, [pushEnabled, userId]);

  return null;
}
