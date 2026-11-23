import {
  ConflictException,
  Logger,
  type ArgumentsHost,
  type HttpServer,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { AllExceptionsFilter } from './all-exceptions.filter.js';

function fakeHttp() {
  const replies: { body: unknown; status: number }[] = [];
  const adapter = {
    reply: (_res: unknown, body: unknown, status: number) =>
      replies.push({ body, status }),
    isHeadersSent: () => false,
    end: vi.fn(),
  } as unknown as HttpServer;
  const host = {
    getType: () => 'http',
    getArgByIndex: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ method: 'GET', path: '/api/scans/x/result' }),
      getResponse: () => ({}),
    }),
  } as unknown as ArgumentsHost;
  return { adapter, host, replies };
}

describe('AllExceptionsFilter', () => {
  it('answers an unexpected error with a generic 500 and logs it with the route', () => {
    const { adapter, host, replies } = fakeHttp();
    const log = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => {});
    const error = new QueryFailedError(
      'SELECT * FROM findings WHERE id = $1',
      ['x'],
      new Error('invalid input syntax for type uuid'),
    );

    new AllExceptionsFilter(adapter).catch(error, host);

    expect(replies).toEqual([
      {
        body: { statusCode: 500, message: 'Internal server error' },
        status: 500,
      },
    ]);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][1]).toMatchObject({
      method: 'GET',
      path: '/api/scans/x/result',
    });
    log.mockRestore();
  });

  it('keeps the body of an HttpException', () => {
    const { adapter, host, replies } = fakeHttp();

    new AllExceptionsFilter(adapter).catch(
      new ConflictException('An account with this email already exists'),
      host,
    );

    expect(replies).toEqual([
      {
        body: {
          message: 'An account with this email already exists',
          error: 'Conflict',
          statusCode: 409,
        },
        status: 409,
      },
    ]);
  });
});
