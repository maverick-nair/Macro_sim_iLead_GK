import type { Access } from "@gk/schema";

/** Config Spec defaults for "Language, accessibility, delivery". */
export const access: Access = {
  languages: { default: "en", available: [{ code: "en", status: "source" }], learnerPicks: false },
  mixedLanguagePlay: false,
  localeFormats: {
    dates: "from_region",
    numbers: "from_region",
    currency: "from_region",
    nameOrder: "from_region",
  },
  accessibility: {
    captions: true,
    transcripts: true,
    keyboardOnly: true,
    screenReaderLabels: true,
    reducedMotion: true,
    highContrast: true,
    textSize: true,
  },
  typedFallback: true,
  devices: ["desktop", "tablet"],
  lowBandwidth: "auto",
  integrations: { lms: "platform_default", sso: false },
  dataConsent: {
    audioConsentScreen: true,
    retention: "client_set",
    transcriptStorage: true,
    storageRegion: "client_set",
  },
};
