import type { Time } from "@gk/schema";

/** Config Spec "iLead default" column (C-05: these follow the Config Spec over the iLead 2.0 Design). */
export const time: Time = {
  playMode: "full",
  weeks: 8,
  daysPerWeek: 5,
  timeUnitLabel: "Week",
  liveCap: { perWeek: 2, excludeSponsorBriefings: true },
  realTimeLimit: { kind: "total", minutes: 20 },
  clockPauses: [],
  saveResume: { enabled: false },
  sittings: { count: 1, breakAfterWeeks: [] },
  delivery: "self_paced",
  facilitatorControls: [],
  practiceWeek: "guided_tour",
};
