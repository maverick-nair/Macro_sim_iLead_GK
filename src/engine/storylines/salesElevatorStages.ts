import salesElevator from './sales-elevator.json';

/**
 * Sales Elevator as it played before the full cycle model (D243): one stage each, with the calibration it had then
 * (buffer 116, 34 leads a day). Tests that check the stage model's rules, or outcomes recorded on it, play this, so
 * the stage model stays covered for the storylines that keep it.
 */
export const salesElevatorStages = { ...salesElevator, salesModel: 'stages' as const, performanceThreshold: 116, money: { ...salesElevator.money, inputPerSubPeriod: [34] } };
