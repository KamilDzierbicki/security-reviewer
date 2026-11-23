import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { llmConfig } from '../config/namespaces.js';
import { templateSummary, type SummaryInput } from './summary-template.js';
import {
  summaryOutputSchema,
  validateSummaryOutput,
  type RunSummary,
} from './summary.schema.js';

const SYSTEM_PROMPT = `You write the summary screen of an application security product for a software developer.
You receive the top risks of one repository scan. Each risk is already ranked and scored by a deterministic engine; never change the ranking or the severity.
Write a short headline and an overview (2 to 4 sentences) of the overall risk posture, then for each risk explain in one or two plain sentences why it matters in this context and what to do next.
Use only the facts in the input. Do not invent CVE ids, versions, file names or exploits. Cite risks only by the riskId values given.`;

@Injectable()
export class SummaryService {
  private readonly logger = new Logger(SummaryService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(@Inject(llmConfig.KEY) llm: ConfigType<typeof llmConfig>) {
    const apiKey = llm.anthropicApiKey;
    this.model = llm.model;
    this.client = apiKey
      ? new Anthropic({ apiKey, timeout: 60_000, maxRetries: 2 })
      : null;
  }

  async summarize(input: SummaryInput): Promise<RunSummary> {
    const fallback = templateSummary(input);
    const ids = input.topRisks.map((r) => r.id);
    if (!this.client || ids.length === 0) return fallback;
    const riskIds = ids as [string, ...string[]];

    try {
      const response = await this.client.messages.parse({
        model: this.model,
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        output_config: {
          effort: 'low',
          format: zodOutputFormat(summaryOutputSchema(riskIds)),
        },
        messages: [
          { role: 'user', content: JSON.stringify(this.toPromptInput(input)) },
        ],
      });
      if (response.stop_reason !== 'end_turn') {
        this.logger.warn('Summary model stopped early', {
          stopReason: response.stop_reason,
        });
        return fallback;
      }
      const output = validateSummaryOutput(response.parsed_output, riskIds);
      if (!output) {
        this.logger.warn('Summary model output failed validation');
        return fallback;
      }
      return { source: 'llm', model: this.model, ...output };
    } catch (error) {
      this.logger.warn('Summary model call failed', { error: String(error) });
      return fallback;
    }
  }

  private toPromptInput(input: SummaryInput) {
    return {
      repository: input.repositoryName,
      totalFindings: input.totalFindings,
      riskCount: input.riskCount,
      riskSeverityCounts: input.severityCounts,
      partialScanNote: input.partialReason,
      topRisks: input.topRisks.map((r) => ({
        riskId: r.id,
        kind: r.kind,
        title: r.title,
        location: r.location,
        finalSeverity: r.finalSeverity,
        reportedSeverity: r.reportedSeverity,
        advisoryCount: r.advisoryCount,
        factors: r.factors.map((f) => `${f.name} (${f.level}): ${f.reason}`),
        recommendedAction: r.action,
      })),
    };
  }
}
