import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES } from './queue.constants';

function parseRedisConnection(url: string) {
  try {
    const parsed = new URL(url);
    const opts: Record<string, unknown> = {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1) || '0', 10) : 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
    if (parsed.protocol === 'rediss:') {
      opts['tls'] = {};
    }
    return opts;
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

@Module({
  imports: [
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: parseRedisConnection(
          config.get<string>('REDIS_URL') ?? 'redis://localhost:6379',
        ),
        defaultJobOptions: {
          removeOnComplete: { count: 500 },
          removeOnFail: { count: 1000 },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.CAMPAIGNS },
      { name: QUEUE_NAMES.MESSAGES },
      { name: QUEUE_NAMES.WEBHOOKS },
      { name: QUEUE_NAMES.USAGE },
    ),
  ],
  exports: [BullModule],
})
export class QueueModule {}
