import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAP_SERVER_URL ?? "http://10.0.2.2:3000";

// Every `cap sync`/`cap copy` loads this file, so the bundled offline page's
// Retry button always targets the server URL being synced.
const webDir = join(__dirname, "mobile", "www");
writeFileSync(
  join(webDir, "offline.html"),
  readFileSync(join(webDir, "offline.template.html"), "utf8").replaceAll(
    '"__CAP_SERVER_URL__"',
    JSON.stringify(serverUrl),
  ),
);

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
      style: "LIGHT",
      overlaysWebView: false,
    },
  },
};

export default config;
