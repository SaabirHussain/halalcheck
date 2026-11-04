import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAP_SERVER_URL ?? "http://10.0.2.2:3000";

const config: CapacitorConfig = {
  appId: "com.halalcheck.app",
  appName: "HalalCheck",
  webDir: "mobile/www",
  server: {
    url: serverUrl,
    cleartext: new URL(serverUrl).protocol === "http:",
    errorPath: "offline.html",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
    },
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#faf6ef",
      showSpinner: false,
    },
    StatusBar: {
      backgroundColor: "#faf6ef",
      style: "DARK",
      overlaysWebView: false,
    },
  },
};

export default config;
