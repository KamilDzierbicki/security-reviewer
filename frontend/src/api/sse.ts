import { api, authHeaders } from './client.ts';
import { TERMINAL_STATUSES, type StatusView } from './types.ts';

export function parseSse(buffer: string): { events: string[]; rest: string } {
  const events: string[] = [];
  const blocks = buffer.replaceAll('\r\n', '\n').split('\n\n');
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^ /, ''))
      .join('\n');
    if (data) events.push(data);
  }
  return { events, rest };
}

export async function streamScan(
  runId: string,
  onStatus: (status: StatusView) => void,
  signal: AbortSignal,
): Promise<StatusView | null> {
  const response = await fetch(`/api/scans/${runId}/events`, {
    headers: { ...authHeaders(), Accept: 'text/event-stream' },
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`Could not open the scan (${response.status})`);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  let last: StatusView | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return last;
    const parsed = parseSse(buffer + value);
    buffer = parsed.rest;
    for (const data of parsed.events) {
      last = JSON.parse(data) as StatusView;
      onStatus(last);
    }
  }
}

const RECONNECT_MS = 2_000;

export async function followScan(
  runId: string,
  onStatus: (status: StatusView) => void,
  signal: AbortSignal,
  reconnectMs = RECONNECT_MS,
): Promise<StatusView | null> {
  for (;;) {
    const last = await streamScan(runId, onStatus, signal);
    if (last && TERMINAL_STATUSES.includes(last.status)) return last;
    await wait(reconnectMs, signal);
    if (signal.aborted) return null;
    const current = await api<StatusView>(`/scans/${runId}`);
    onStatus(current);
    if (TERMINAL_STATUSES.includes(current.status)) return current;
  }
}

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
