import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  Sse,
  type MessageEvent,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  auditTime,
  concatMap,
  distinctUntilChanged,
  from,
  interval,
  map,
  merge,
  of,
  takeUntil,
  takeWhile,
  type Observable,
} from 'rxjs';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-user.js';
import { ProgressSubscriber } from './progress.subscriber.js';
import { TERMINAL_RUN_STATUSES } from './scan.types.js';
import { ScanResultsService } from './scan-results.service.js';
import { ScanStatusService } from './scan-status.service.js';
import { ScansService } from './scans.service.js';

const FALLBACK_REFRESH_MS = 15_000;

@Controller()
export class ScansController {
  constructor(
    private readonly scans: ScansService,
    private readonly scanStatus: ScanStatusService,
    private readonly results: ScanResultsService,
    private readonly progress: ProgressSubscriber,
  ) {}

  @Post('repositories/:id/scans')
  @HttpCode(HttpStatus.CREATED)
  async start(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) repositoryId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { run, created } = await this.scans.startLatest(
      user.id,
      repositoryId,
    );
    if (!created) response.status(HttpStatus.OK);
    return { ...(await this.scanStatus.toStatusView(run)), created };
  }

  @Get('repositories')
  listRepositories(@CurrentUser() user: AuthUser) {
    return this.scanStatus.listRepositoriesWithLatestRun(user.id);
  }

  @Get('repositories/:id/scans')
  list(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) repositoryId: string,
  ) {
    return this.scanStatus.listForRepository(user.id, repositoryId);
  }

  @Get('scans/:id')
  status(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) runId: string,
  ) {
    return this.scanStatus.getStatus(user.id, runId);
  }

  @Get('scans/:id/result')
  result(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) runId: string,
  ) {
    return this.results.getResult(user.id, runId);
  }

  @Sse('scans/:id/events')
  async events(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) runId: string,
  ): Promise<Observable<MessageEvent>> {
    const initial = await this.scanStatus.getStatus(user.id, runId);
    const refreshes = merge(
      this.progress.updatesFor(runId),
      interval(FALLBACK_REFRESH_MS),
    ).pipe(
      auditTime(200),
      concatMap(() => from(this.scanStatus.getStatus(user.id, runId))),
    );
    return merge(of(initial), refreshes).pipe(
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      takeWhile((s) => !TERMINAL_RUN_STATUSES.includes(s.status), true),
      takeUntil(this.progress.shuttingDown),
      map((status) => ({ type: 'status', data: status })),
    );
  }
}
