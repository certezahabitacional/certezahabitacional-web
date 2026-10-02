import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.certezahabitacional.app",
  appName: "Certeza Habitacional",
  webDir: "mobile-shell",
  server: {
    url: "https://www.certezahabitacional.com",
    cleartext: false,
    allowNavigation: [
      "www.certezahabitacional.com",
      "certezahabitacional.com",
    ],
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
  },
};

export default config;
