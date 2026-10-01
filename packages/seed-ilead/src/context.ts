import type { Context } from "@gk/schema";
import { SPONSOR_ID } from "./ids";

/** Config Spec "iLead default" column for Organisation, Product and Scenario. */
export const context: Context = {
  organisation: {
    mode: "fictional",
    name: "Secure Capital Bank",
    industry: "Banking",
    subIndustry: "Retail lending",
    size: "small",
    structure: "Growth stage",
    region: "Singapore",
    city: "Singapore City",
    officeType: "Branch",
    values: [{ name: "Trusted client relationships" }],
    competitors: ["Beta Bank", "Hert Capital"],
    businessSituation: "turnaround",
    situationNote: "Turnaround after a weak manager",
    glossary: [
      { term: "CASA", meaning: "Current and savings accounts" },
      { term: "Conversion", meaning: "A lead that becomes a signed loan" },
    ],
    policies: [],
  },
  product: {
    lines: [
      { id: "casa", name: "CASA", description: "Current and savings accounts" },
      { id: "loans", name: "Loans", description: "Personal and business loans" },
      { id: "cards", name: "Cards", description: "Credit cards" },
    ],
    focusLineId: "loans",
    valueProposition: "Low risk, attractive rate",
    weaknesses: "Features not innovative",
    segments: [
      { id: "individuals", name: "Individuals" },
      { id: "companies", name: "Companies" },
    ],
    unitOfValue: "revenue",
    currency: "USD",
    numberLocale: "en-US",
  },
  scenario: {
    participantRoleTitle: "Sales Director",
    level: "mid",
    span: 10,
    backstory:
      "Your predecessor left the team in shatters. Results have slipped, morale is low and a few people are already looking elsewhere.",
    sponsorNpcId: SPONSOR_ID,
    sponsorStyle: "demanding",
    welcomeMessage:
      "Welcome to Secure Capital Bank, Singapore City Branch.\n\nYou are taking over a sales team of 10 that has had a hard year. Over the next 8 weeks I need you to rebuild the team and grow our Loans business. Our target is $240,000 in new loan revenue, which is 8 conversions at $30,000 each.\n\nGet to know your people first. Each of them needs something different from you.\n\nRoger Kent, CEO",
    tone: "formal",
    realism: "grounded",
  },
};
