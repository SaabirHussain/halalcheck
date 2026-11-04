"use client";

import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect } from "react";
import { isNativeApp } from "@/lib/native/platform";

const savedTokenKey = "halalcheck-push-token";

export function NativeShell({ userId }: { userId: string | null }) {
  useEffect(() => {
    if (!isNativeApp()) return;

    void StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
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
    const cleanUpPushToken = (event: SubmitEvent) => {
      const form = event.target;
      if (
        !(form instanceof HTMLFormElement) ||
        form.dataset.nativeSignOut !== "true" ||
        form.dataset.nativeSignoutPending === "true"
      )
        return;
      event.preventDefault();
      form.dataset.nativeSignoutPending = "true";
      void (async () => {
        const token = window.localStorage.getItem(savedTokenKey);
        if (token) {
          await fetch("/api/me/push-devices", {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token }),
          }).catch(() => {});
        }
        window.localStorage.removeItem(savedTokenKey);
        form.requestSubmit();
      })();
    };
    document.addEventListener("click", openExternalLinks);
    document.addEventListener("submit", cleanUpPushToken, true);
    return () => {
      disposed = true;
      document.removeEventListener("click", openExternalLinks);
      document.removeEventListener("submit", cleanUpPushToken, true);
      removeBackButtonListener?.();
      removeNotificationActionListener?.();
    };
  }, []);

  useEffect(() => {
    if (!isNativeApp() || !userId) return;
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
            const response = await fetch("/api/me/push-devices", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ platform, token }),
            });
            if (response.ok) window.localStorage.setItem(savedTokenKey, token);
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
  }, [userId]);

  return null;
}
