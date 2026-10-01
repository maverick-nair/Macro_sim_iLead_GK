import { z } from "zod";
import { AssetRef, HexColour, Text, obj } from "../primitives";

const Palette = obj({
  primary: HexColour,
  secondary: HexColour,
  accent: HexColour,
  background: HexColour,
  text: HexColour,
  success: HexColour,
  warning: HexColour,
  danger: HexColour,
  info: HexColour,
});

const FontRef = obj({
  source: z.enum(["builtin", "upload", "web"]),
  family: Text.min(1),
  assetId: z.string().min(1).optional(),
});

/** Learner screens that can carry their own background. */
export const SCREEN_KEYS = ["welcome", "main", "live_interaction", "weekly_report", "end"] as const;

const Scene = z.enum([
  "office",
  "branch",
  "store_floor",
  "warehouse",
  "plant",
  "hospital",
  "field",
  "virtual",
  "meeting_room",
]);

/** Config Spec: "Branding, images and media" (19 settings). */
export const BrandingSchema = obj({
  ownership: z.enum(["knolskape", "client", "both"]),
  logos: obj({ main: AssetRef, light: AssetRef, icon: AssetRef }),
  colours: obj({ light: Palette, dark: Palette }),
  fonts: obj({ heading: FontRef, body: FontRef }),
  title: Text.min(1),
  subtitle: Text.optional(),
  loadingArt: AssetRef,
  endArt: AssetRef,
  artStyle: z.enum(["photographic", "illustrated_flat", "illustrated_3d", "line_art"]),
  backgrounds: obj({
    welcome: Scene,
    main: Scene,
    live_interaction: Scene,
    weekly_report: Scene,
    end: Scene,
  }),
  props: z.array(Text.min(1)).max(20),
  portraitDefaultSource: z.enum(["upload", "stock", "generated"]),
  expressionSetDefault: z.enum(["single", "five"]),
  eventIllustrations: z.enum(["none", "per_event"]),
  iconSet: Text.min(1),
  /** Image safety checks are locked on (Config Spec, locked engine guardrails). */
  imageSafety: obj({
    brandCheck: z.literal(true),
    offensiveCheck: z.literal(true),
    likenessCheck: z.literal(true),
  }),
  media: obj({
    sponsorWelcomeVideo: z.enum(["none", "avatar", "upload"]),
    introVideo: obj({
      mode: z.enum(["none", "hud_link", "upload", "generated"]),
      asset: AssetRef.optional(),
    }),
    ambientSound: z.enum(["off", "office", "store", "warehouse"]),
    uiSounds: z.enum(["off", "subtle", "game_like"]),
    music: z.enum(["off", "calm", "upbeat"]),
  }),
});
export type Branding = z.infer<typeof BrandingSchema>;
