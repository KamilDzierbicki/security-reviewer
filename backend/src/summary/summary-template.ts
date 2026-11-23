import type { RiskGroup } from '../risk/risk-groups.js';
import type { Severity } from '../risk/risk.types.js';
import type { RunSummary } from './summary.schema.js';

export interface SummaryInput {
  repositoryName: string;
  totalFindings: number;
  riskCount: number;
  severityCounts: Record<Severity, number>;
  topRisks: RiskGroup[];
  partialReason: string | null;
}

export function templateSummary(input: SummaryInput): RunSummary {
  const { severityCounts: c } = input;
  const urgent = c.critical + c.high;
  const headline =
    input.totalFindings === 0
      ? `No known vulnerable dependencies or exposed secrets found in ${input.repositoryName}`
      : urgent > 0
        ? `${plural(urgent, 'risk')} in ${input.repositoryName} ${urgent === 1 ? 'needs' : 'need'} attention first (${c.critical} critical, ${c.high} high)`
        : `No critical or high risks in ${input.repositoryName}; ${plural(input.riskCount, 'lower-priority risk')} to review`;

  const overviewParts = [
    input.totalFindings === 0
      ? 'The scanners completed without findings.'
      : `We found ${plural(input.totalFindings, 'finding')}, grouped them into ${plural(input.riskCount, 'risk')} you can act on, and ranked them by context: whether the code is reachable in production, whether it is being exploited, and how much damage it allows.`,
  ];
  if (input.topRisks.length > 0) {
    overviewParts.push(
      `Start with ${input.topRisks[0].title}: ${input.topRisks[0].action}`,
    );
  }
  if (input.partialReason) {
    overviewParts.push(`Note: ${input.partialReason}`);
  }

  return {
    source: 'template',
    headline,
    overview: overviewParts.join(' '),
    risks: input.topRisks.map((risk) => ({
      riskId: risk.id,
      why: risk.factors
        .filter((f) => f.level !== 'unknown')
        .map((f) => f.reason)
        .join('. '),
      nextAction: risk.action,
    })),
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}
