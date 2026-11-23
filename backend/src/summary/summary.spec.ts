import type { ConfigType } from '@nestjs/config';
import type { llmConfig } from '../config/namespaces.js';
import type { RiskGroup } from '../risk/risk-groups.js';
import type { SummaryInput } from './summary-template.js';
import { validateSummaryOutput } from './summary.schema.js';
import { SummaryService } from './summary.service.js';

const IDS: [string, ...string[]] = ['a1b2c3d4e5f6', 'f6e5d4c3b2a1'];

const valid = {
  headline: 'Rotate the AWS key first',
  overview: 'Two risks need attention.',
  risks: [
    { riskId: IDS[0], why: 'It is public.', nextAction: 'Rotate it.' },
    { riskId: IDS[1], why: 'Direct dependency.', nextAction: 'Upgrade it.' },
  ],
};

describe('summary output validation', () => {
  it('accepts output that cites only the given risk ids', () => {
    expect(validateSummaryOutput(valid, IDS)).toEqual(valid);
  });

  it('rejects a risk id the model was not given', () => {
    const invented = {
      ...valid,
      risks: [{ riskId: 'deadbeef0000', why: 'x', nextAction: 'y' }],
    };
    expect(validateSummaryOutput(invented, IDS)).toBeNull();
  });

  it('rejects the same risk cited twice', () => {
    const repeated = { ...valid, risks: [valid.risks[0], valid.risks[0]] };
    expect(validateSummaryOutput(repeated, IDS)).toBeNull();
  });

  it('rejects output that does not match the schema', () => {
    expect(validateSummaryOutput({ headline: 'x' }, IDS)).toBeNull();
    expect(validateSummaryOutput('not json', IDS)).toBeNull();
  });
});

describe('SummaryService fallback', () => {
  const risk = (id: string): RiskGroup => ({
    id,
    kind: 'secret',
    title: 'AWS access token in src/config.js',
    location: 'src/config.js:4',
    finalSeverity: 'critical',
    reportedSeverity: 'high',
    riskScore: 70,
    factors: [
      { name: 'damage', level: 'high', points: 40, reason: 'Cloud credential' },
    ],
    findingIds: ['f1'],
    advisoryCount: 1,
    action: 'Revoke and rotate this AWS access token now.',
  });
  const input: SummaryInput = {
    repositoryName: 'acme/app',
    totalFindings: 2,
    riskCount: 2,
    severityCounts: { critical: 1, high: 1, medium: 0, low: 0, info: 0 },
    topRisks: [risk(IDS[0]), risk(IDS[1])],
    partialReason: null,
  };
  const config = (apiKey?: string): ConfigType<typeof llmConfig> => ({
    anthropicApiKey: apiKey,
    model: 'claude-sonnet-5-5',
  });

  it('uses the deterministic template when no API key is configured', async () => {
    const summary = await new SummaryService(config()).summarize(input);
    expect(summary.source).toBe('template');
    expect(summary.risks.map((r) => r.riskId)).toEqual(IDS);
  });

  it('falls back to the template when the model cites an unknown id', async () => {
    const service = new SummaryService(config('test-key'));
    const parse = vi.fn().mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: {
        ...valid,
        risks: [{ riskId: 'deadbeef0000', why: 'x', nextAction: 'y' }],
      },
    });
    Object.assign(service, { client: { messages: { parse } } });
    const summary = await service.summarize(input);
    expect(parse).toHaveBeenCalledOnce();
    expect(summary.source).toBe('template');
  });

  it('uses the model output when it is valid', async () => {
    const service = new SummaryService(config('test-key'));
    const parse = vi
      .fn()
      .mockResolvedValue({ stop_reason: 'end_turn', parsed_output: valid });
    Object.assign(service, { client: { messages: { parse } } });
    const summary = await service.summarize(input);
    expect(summary).toMatchObject({ source: 'llm', headline: valid.headline });
    const prompt = JSON.stringify(parse.mock.calls[0][0]);
    expect(prompt).not.toContain('********');
  });
});
