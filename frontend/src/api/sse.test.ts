import { describe, expect, it } from 'vitest';
import { parseSse } from './sse.ts';

describe('parseSse', () => {
  it('keeps an event that is split across chunks until it is complete', () => {
    const first = parseSse('data: {"progress":1');
    expect(first.events).toEqual([]);
    const second = parseSse(first.rest + '0}\n\n');
    expect(second.events).toEqual(['{"progress":10}']);
    expect(second.rest).toBe('');
  });

  it('returns every complete event in one chunk, in order', () => {
    const { events, rest } = parseSse(
      'data: {"a":1}\n\ndata: {"a":2}\n\ndata: {"a"',
    );
    expect(events).toEqual(['{"a":1}', '{"a":2}']);
    expect(rest).toBe('data: {"a"');
  });

  it('ignores comments, ids and event names, and handles CRLF', () => {
    const { events } = parseSse(
      ': keep-alive\r\n\r\nid: 3\r\nevent: status\r\ndata: {"a":3}\r\n\r\n',
    );
    expect(events).toEqual(['{"a":3}']);
  });

  it('joins multi-line data with newlines', () => {
    expect(parseSse('data: line1\ndata: line2\n\n').events).toEqual([
      'line1\nline2',
    ]);
  });
});
