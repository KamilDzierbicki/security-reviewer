import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { followScan } from './sse.ts';
import type { StatusView } from './types.ts';

function status(value: StatusView['status'], progress: number): StatusView {
  return {
    id: 'run-1',
    status: value,
    repository: { id: 'repo-1', fullName: 'acme/app' },
    commitSha: null,
    error: null,
    progress,
    stages: [],
    scanners: [],
  };
}

function eventStream(...events: StatusView[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('');
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

describe('followScan', () => {
  beforeEach(() => {
    vi.stubGlobal('sessionStorage', { getItem: () => 'token' });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reconnects after the stream ends early and returns the final status', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(eventStream(status('running', 25)))
      .mockResolvedValueOnce(Response.json(status('running', 48)))
      .mockResolvedValueOnce(eventStream(status('completed', 100)));
    vi.stubGlobal('fetch', fetchMock);
    const seen: number[] = [];

    const last = await followScan(
      'run-1',
      (s) => seen.push(s.progress),
      new AbortController().signal,
      0,
    );

    expect(last?.status).toBe('completed');
    expect(seen).toEqual([25, 48, 100]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/scans/run-1/events',
      '/api/scans/run-1',
      '/api/scans/run-1/events',
    ]);
  });

  it('stops when the run ended while the stream was down', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(eventStream(status('running', 25)))
      .mockResolvedValueOnce(Response.json(status('partial', 100)));
    vi.stubGlobal('fetch', fetchMock);

    const last = await followScan(
      'run-1',
      () => undefined,
      new AbortController().signal,
      0,
    );

    expect(last?.status).toBe('partial');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns null without another request once the view is closed', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn<typeof fetch>().mockImplementationOnce(() => {
      controller.abort();
      return Promise.resolve(eventStream(status('running', 25)));
    });
    vi.stubGlobal('fetch', fetchMock);

    const last = await followScan(
      'run-1',
      () => undefined,
      controller.signal,
      0,
    );

    expect(last).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
