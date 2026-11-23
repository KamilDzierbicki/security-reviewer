import {
  Catch,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type HttpServer,
} from '@nestjs/common';
import { BaseExceptionFilter, type AbstractHttpAdapter } from '@nestjs/core';
import type { Request } from 'express';

@Catch()
export class AllExceptionsFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  override handleUnknownError(
    exception: unknown,
    host: ArgumentsHost,
    applicationRef: HttpServer | AbstractHttpAdapter,
  ): void {
    if (this.isHttpError(exception)) {
      return super.handleUnknownError(exception, host, applicationRef);
    }
    const request = host.switchToHttp().getRequest<Request>();
    this.logger.error('Unhandled error', {
      method: request.method,
      path: request.path,
      error:
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
    });
    const response: unknown = host.getArgByIndex(1);
    if (applicationRef.isHeadersSent(response)) {
      applicationRef.end(response);
      return;
    }
    applicationRef.reply(
      response,
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Internal server error',
      },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
}
