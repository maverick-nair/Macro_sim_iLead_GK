import type { Process } from "@gk/schema";
import { STAGES } from "./ids";

/** Config Spec "Team structure, process, targets and KPIs"; throughput values derived (A-25). */
export const processArea: Process = {
  type: "sales_funnel",
  stages: [
    {
      id: STAGES.salesLead,
      name: "Sales lead",
      icon: "lead",
      tooltip: "Finds new leads and books first meetings.",
      idealPerWeek: 3,
      maxMembers: 2,
    },
    {
      id: STAGES.qualify,
      name: "Qualify",
      icon: "qualify",
      tooltip: "Checks each lead's needs and ability to borrow.",
      idealPerWeek: 2,
      maxMembers: 2,
    },
    {
      id: STAGES.proposal,
      name: "Proposal",
      icon: "proposal",
      tooltip: "Prepares the loan proposal for qualified leads.",
      idealPerWeek: 1,
      maxMembers: 2,
    },
    {
      id: STAGES.negotiate,
      name: "Negotiate",
      icon: "negotiate",
      tooltip: "Agrees terms and handles objections.",
      idealPerWeek: 1,
      maxMembers: 2,
    },
    {
      id: STAGES.conversion,
      name: "Conversion",
      icon: "conversion",
      tooltip: "Closes the deal and signs the loan.",
      idealPerWeek: 1,
      maxMembers: 2,
    },
  ],
  workUnit: "lead",
  // TODO(decision): D-11 derived default (A-25) until the real formula is documented.
  throughput: { weights: { skill: 0.4, morale: 0.3, result: 0.3 }, referenceProductivity: 0.6 },
  bottleneck: { stageCapacity: true, carryOver: true },
  branching: { enabled: false },
  targets: {
    primary: { kind: "revenue", value: 240000 },
    valuePerUnit: 30000,
    secondary: ["team_skill", "morale", "performance"],
    kpiDials: ["skill", "morale", "result"],
    kpiLabels: {},
    weeklyDrift: { morale: 3, result: 3 },
    winCondition: { kind: "hit_target" },
  },
};
