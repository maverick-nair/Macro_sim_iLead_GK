import type { Branding } from "@gk/schema";
import { builtin } from "./ids";

const palette = {
  primary: "#1F6FD1",
  secondary: "#F2A33A",
  accent: "#43D6E8",
  background: "#FFFFFF",
  text: "#14213D",
  success: "#00A878",
  warning: "#F2A33A",
  danger: "#D64545",
  info: "#1F6FD1",
};

/** Config Spec "iLead default" column for Brand and theme, Images, Video and audio. */
export const branding: Branding = {
  ownership: "knolskape",
  logos: {
    main: builtin("ilead-logo", "iLead logo"),
    light: builtin("ilead-logo-light", "iLead logo, light version"),
    icon: builtin("knolskape-icon", "KNOLSKAPE icon"),
  },
  colours: {
    light: palette,
    dark: { ...palette, background: "#0A081B", text: "#DEE9FF", primary: "#4B9BFF" },
  },
  fonts: {
    heading: { source: "builtin", family: "iLead default" },
    body: { source: "builtin", family: "iLead default" },
  },
  title: "iLead",
  subtitle: "DEMO",
  loadingArt: builtin("office-background", "Office background"),
  endArt: builtin("office-background", "Office background"),
  artStyle: "photographic",
  backgrounds: {
    welcome: "meeting_room",
    main: "meeting_room",
    live_interaction: "meeting_room",
    weekly_report: "meeting_room",
    end: "meeting_room",
  },
  props: [],
  portraitDefaultSource: "stock",
  expressionSetDefault: "single",
  eventIllustrations: "none",
  iconSet: "ilead",
  imageSafety: { brandCheck: true, offensiveCheck: true, likenessCheck: true },
  media: {
    sponsorWelcomeVideo: "none",
    introVideo: { mode: "hud_link", asset: builtin("ilead-intro-video", "iLead introduction video") },
    ambientSound: "off",
    uiSounds: "subtle",
    music: "off",
  },
};
