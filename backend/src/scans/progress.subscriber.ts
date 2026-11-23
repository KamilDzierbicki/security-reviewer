import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Redis } from 'ioredis';
import { filter, Subject, type Observable } from 'rxjs';
import { PROGRESS_CHANNEL } from '../pipeline/queues.js';
import { logRedisErrors, REDIS } from '../redis/redis.module.js';

@Injectable()
export class ProgressSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly updates$ = new Subject<string>();
  private readonly shutdown$ = new Subject<void>();
  private subscriber?: Redis;

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleInit() {
    this.subscriber = logRedisErrors(this.redis.duplicate());
    this.subscriber.on('message', (_channel: string, runId: string) =>
      this.updates$.next(runId),
    );
    await this.subscriber.subscribe(PROGRESS_CHANNEL);
  }

  async onModuleDestroy() {
    this.shutdown$.next();
    this.shutdown$.complete();
    this.updates$.complete();
    await this.subscriber?.quit();
  }

  updatesFor(runId: string): Observable<string> {
    return this.updates$.pipe(filter((id) => id === runId));
  }

  get shuttingDown(): Observable<void> {
    return this.shutdown$.asObservable();
  }
}
