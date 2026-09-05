import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "tv.odiin.streaming",
  appName: "ODIIN STREAMING",
  webDir: "../dist/client",
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
