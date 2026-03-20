import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './queue.service';
import { env } from '@relayflow/config';

function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1) || '0', 10) : 0,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const redisOptions = parseRedisUrl(env.REDIS_URL);

@Module({
  imports: [
    BullModule.forRoot({
      redis: redisOptions,
    }),
    BullModule.registerQueue(
      { name: 'campaigns' },
      { name: 'messages' },
      { name: 'webhooks' },
    ),
  ],
  providers: [QueueService],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
