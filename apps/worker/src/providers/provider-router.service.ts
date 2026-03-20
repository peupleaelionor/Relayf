import { Injectable, Logger } from '@nestjs/common';
import { MessageChannel } from '@prisma/client';
import { SmsProvider } from './sms.provider';
import { TelegramProvider } from './telegram.provider';

export interface SendResult {
  providerMessageId: string;
  cost: number;
}

@Injectable()
export class ProviderRouterService {
  private readonly logger = new Logger(ProviderRouterService.name);

  constructor(
    private readonly sms: SmsProvider,
    private readonly telegram: TelegramProvider,
  ) {}

  async send(opts: {
    channel: MessageChannel;
    to: string;
    from: string;
    body: string;
    subject?: string;
    workspaceId: string;
  }): Promise<SendResult> {
    this.logger.debug(`Routing ${opts.channel} message to ${opts.to}`);

    switch (opts.channel) {
      case MessageChannel.SMS: {
        const result = await this.sms.send(opts.to, opts.from, opts.body);
        return { providerMessageId: result.messageId, cost: result.cost };
      }

      case MessageChannel.TELEGRAM: {
        const result = await this.telegram.sendMessage(opts.to, opts.body);
        return { providerMessageId: result.messageId, cost: 0 };
      }

      case MessageChannel.WHATSAPP: {
        // WhatsApp via Twilio – from must be whatsapp:<number>
        const result = await this.sms.send(
          `whatsapp:${opts.to}`,
          `whatsapp:${opts.from}`,
          opts.body,
        );
        return { providerMessageId: result.messageId, cost: result.cost };
      }

      default:
        throw new Error(`Unsupported channel: ${opts.channel}`);
    }
  }
}
