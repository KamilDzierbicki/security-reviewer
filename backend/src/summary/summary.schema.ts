import { z } from 'zod';

export interface RiskNarrative {
  riskId: string;
  why: string;
  nextAction: string;
}

export interface RunSummary {
  source: 'llm' | 'template';
  model?: string;
  headline: string;
  overview: string;
  risks: RiskNarrative[];
}

export function summaryOutputSchema(riskIds: [string, ...string[]]) {
  return z.object({
    headline: z.string().min(1).max(200),
    overview: z.string().min(1).max(1200),
    risks: z
      .array(
        z.object({
          riskId: z.enum(riskIds),
          why: z.string().min(1).max(600),
          nextAction: z.string().min(1).max(400),
        }),
      )
      .min(1)
      .max(riskIds.length),
  });
}

export type SummaryOutput = z.infer<ReturnType<typeof summaryOutputSchema>>;

export function validateSummaryOutput(
  raw: unknown,
  riskIds: [string, ...string[]],
): SummaryOutput | null {
  const parsed = summaryOutputSchema(riskIds).safeParse(raw);
  if (!parsed.success) return null;
  const ids = parsed.data.risks.map((r) => r.riskId);
  if (new Set(ids).size !== ids.length) return null;
  return parsed.data;
}
