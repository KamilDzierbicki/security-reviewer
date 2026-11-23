import type { RiskGroup } from '../risk/risk-groups.js';

const ALWAYS_SHOWN = 3;
const MAX_SHOWN = 5;

export function selectTopRisks(groups: RiskGroup[]): RiskGroup[] {
  return groups
    .slice(0, MAX_SHOWN)
    .filter(
      (group, index) =>
        index < ALWAYS_SHOWN ||
        group.finalSeverity === 'critical' ||
        group.finalSeverity === 'high' ||
        group.finalSeverity === 'medium',
    );
}
