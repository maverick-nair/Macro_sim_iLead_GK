import type { Line } from "../types";

export const TRANSCRIPT: Line[] = [
  {
    speaker: "Margaret Hale",
    time: "0:12",
    text: "Thanks for coming in. I'll be direct. We like the platform, but I have a mandate to cut spend this year and I can't renew at the current rate.",
  },
  {
    speaker: "You",
    time: "0:34",
    text: "I appreciate you being upfront, Margaret. Before we get into numbers, can you tell me what a successful renewal looks like from your CFO's side?",
  },
  {
    speaker: "Margaret Hale",
    time: "1:02",
    text: "Lower cost, plain and simple. And frankly, I have a quote from Freightwise that comes in 22% under yours. If you can't match it by Friday, we're moving.",
  },
  {
    speaker: "You",
    time: "1:28",
    text: "I understand. Our pricing reflects the uptime and support you've had over three years, and I'd hate to see that put at risk over a headline number.",
  },
  {
    speaker: "Margaret Hale",
    time: "2:05",
    text: "Uptime is expected. I need something I can take upstairs. So what can you actually do on price?",
  },
];

export const FULL_TRANSCRIPT: Line[] = [
  { ...TRANSCRIPT[0] },
  { ...TRANSCRIPT[1], tag: "strength" },
  { ...TRANSCRIPT[2] },
  { ...TRANSCRIPT[3], tag: "gap" },
  { ...TRANSCRIPT[4] },
  {
    speaker: "You",
    time: "2:40",
    text: "It sounds like you're being asked to show real savings this year, and I want to help you do that. Can I share what the platform has actually saved you so far?",
    tag: "strength",
  },
  { speaker: "Margaret Hale", time: "2:58", text: "Go ahead, but keep it short." },
  {
    speaker: "You",
    time: "3:15",
    text: "Since go-live your late deliveries are down 14%. On your volumes that's roughly $310K a year in avoided penalties.",
    tag: "strength",
  },
  {
    speaker: "Margaret Hale",
    time: "3:52",
    text: "That's helpful. But my CFO sees an invoice that's 22% higher than the alternative. Savings are harder to see than costs.",
  },
  {
    speaker: "You",
    time: "4:52",
    text: "Moving 40 depots mid-season is a real cost. Has that been priced into the Freightwise number?",
    tag: "strength",
  },
  {
    speaker: "Margaret Hale",
    time: "5:30",
    text: "They've offered free onboarding. I'll admit the migration worries my operations team.",
  },
  {
    speaker: "You",
    time: "6:40",
    text: "I could probably look at around 10% off if that helps.",
    tag: "gap",
  },
  { speaker: "Margaret Hale", time: "7:05", text: "Ten is a start. It doesn't close the gap, though." },
  {
    speaker: "Margaret Hale",
    time: "7:55",
    text: "I'm not against a longer term, but I'd need price protection and a real reason to commit.",
  },
  {
    speaker: "You",
    time: "8:20",
    text: "Understood. On support, we can also extend your coverage hours to include weekends.",
    tag: "gap",
  },
  {
    speaker: "Margaret Hale",
    time: "9:40",
    text: "Weekend support is nice, but it's not what moves the number.",
  },
  {
    speaker: "You",
    time: "10:55",
    text: "What if we looked at a three-year term with pricing locked, and I include the dedicated migration team at no cost if you add the two new depots?",
  },
  {
    speaker: "Margaret Hale",
    time: "11:48",
    text: "Now that's something I can take to my CFO. Send me the numbers in writing.",
  },
  {
    speaker: "You",
    time: "12:30",
    text: "I'll have a proposal to you by Wednesday. Can we set a call for Thursday to walk your CFO through it together?",
  },
  { speaker: "Margaret Hale", time: "13:20", text: "Thursday works. Don't make me regret it." },
];
