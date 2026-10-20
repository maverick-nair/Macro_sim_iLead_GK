import salesElevator from './sales-elevator.json';

/** The job titles one stage each, as Sales Elevator had them. */
const TITLES: Record<string, string> = {
  leads: 'Lead Generation Executive', qualify: 'Lead Qualifier', proposal: 'Proposal Specialist', negotiation: 'Negotiation Specialist', conversion: 'Conversion Specialist'
};
const retitle = <P extends { homeStage: string; title: string }>(p: P): P => ({ ...p, title: TITLES[p.homeStage] ?? p.title });

/**
 * Sales Elevator as it played before the full cycle model (D243): one stage each, with its job titles, Swap roles
 * and the calibration it had then (buffer 116, 34 leads a day). Tests that check the stage model's rules, or outcomes
 * recorded on it, play this (and the mock engine with `?model=stages`), so the stage model stays covered for the
 * storylines that keep it.
 */
export const salesElevatorStages = {
  ...salesElevator,
  salesModel: 'stages' as const,
  performanceThreshold: 116,
  money: { ...salesElevator.money, inputPerSubPeriod: [34] },
  members: salesElevator.members.map(retitle),
  candidates: salesElevator.candidates.map(retitle),
  actions: salesElevator.actions.map(a => (a.rule !== 'swap' ? a : {
    ...a, name: 'Swap roles', description: 'Move people between stages, then explain the decision to them.',
    options: a.options.map(o => ({ ...o, label: o.key === 'reassign' ? 'Reassign role' : 'Swap role' }))
  }))
};
