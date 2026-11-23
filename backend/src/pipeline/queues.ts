import type { FlowJob, JobsOptions, Queue } from 'bullmq';
import type { Scanner } from '../scanners/scanner.interface.js';

export const SCAN_QUEUE = 'scan';
export const SCANNER_QUEUE = 'scanner';
export const MAINTENANCE_QUEUE = 'maintenance';
export const SCAN_FLOW_PRODUCER = 'scan-flow';
export const PROGRESS_CHANNEL = 'scan-progress';

export interface PrepareJobData {
  runId: string;
}

export interface AnalyzeJobData {
  runId: string;
  attempt: number;
}

export interface ScannerJobData {
  runId: string;
  attempt: number;
  scanner: string;
}

const RETENTION: JobsOptions = {
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 7 * 24 * 3600 },
};

export function enqueuePrepare(queue: Queue, runId: string) {
  return queue.add('prepare', { runId } satisfies PrepareJobData, {
    jobId: runId,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
    ...RETENTION,
  });
}

export function analyzeJobId(runId: string, attempt: number): string {
  return `${runId}-analyze-${attempt}`;
}

export function buildScanFlow(
  runId: string,
  attempt: number,
  scanners: readonly Scanner[],
): FlowJob {
  return {
    name: 'analyze',
    queueName: SCAN_QUEUE,
    data: { runId, attempt } satisfies AnalyzeJobData,
    opts: {
      jobId: analyzeJobId(runId, attempt),
      attempts: 3,
      backoff: { type: 'exponential', delay: 5_000 },
      ...RETENTION,
    },
    children: scanners.map((scanner) => ({
      name: 'scan',
      queueName: SCANNER_QUEUE,
      data: {
        runId,
        attempt,
        scanner: scanner.name,
      } satisfies ScannerJobData,
      opts: {
        jobId: `${runId}-${scanner.name}-${attempt}`,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5_000 },
        ignoreDependencyOnFailure: true,
        ...RETENTION,
      },
    })),
  };
}
