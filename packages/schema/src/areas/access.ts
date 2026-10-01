import { z } from "zod";
import { Text, obj } from "../primitives";

const FromRegionOr = z.union([z.literal("from_region"), Text.min(1)]);

/** Config Spec: "Language, accessibility, delivery" (9 settings). UI label "Language and access". */
export const AccessSchema = obj({
  languages: obj({
    default: z.string().min(2).max(20),
    available: z
      .array(obj({ code: z.string().min(2).max(20), status: z.enum(["source", "machine", "reviewed"]) }))
      .min(1)
      .max(20),
    learnerPicks: z.boolean(),
  }),
  mixedLanguagePlay: z.boolean(),
  localeFormats: obj({
    dates: FromRegionOr,
    numbers: FromRegionOr,
    currency: FromRegionOr,
    nameOrder: FromRegionOr,
  }),
  accessibility: obj({
    captions: z.boolean(),
    transcripts: z.boolean(),
    keyboardOnly: z.boolean(),
    screenReaderLabels: z.boolean(),
    reducedMotion: z.boolean(),
    highContrast: z.boolean(),
    textSize: z.boolean(),
  }),
  /** "Always available" in the Config Spec. */
  typedFallback: z.literal(true),
  devices: z
    .array(z.enum(["desktop", "tablet", "mobile"]))
    .min(1)
    .max(3),
  lowBandwidth: z.enum(["auto", "on", "off"]),
  integrations: obj({
    lms: z.union([
      z.literal("platform_default"),
      z.array(z.enum(["scorm12", "scorm2004", "xapi", "lti", "api"])).max(5),
    ]),
    sso: z.boolean(),
  }),
  dataConsent: obj({
    audioConsentScreen: z.boolean(),
    retention: z.union([z.literal("client_set"), z.int().min(1).max(3650)]),
    transcriptStorage: z.boolean(),
    storageRegion: z.union([z.literal("client_set"), Text.min(1)]),
  }),
});
export type Access = z.infer<typeof AccessSchema>;
