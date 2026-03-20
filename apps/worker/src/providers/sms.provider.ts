import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';
import { env } from '@relayflow/config';

@Injectable()
export class SmsProvider {
  private readonly client: Twilio.Twilio;
  private readonly logger = new Logger(SmsProvider.name);

  constructor() {
    this.client = Twilio(env.TWILIO_ACCOUNT_SID ?? '', env.TWILIO_AUTH_TOKEN ?? '');
  }

  async send(
    to: string,
    from: string,
    body: string,
  ): Promise<{ messageId: string; cost: number }> {
    const message = await this.client.messages.create({
      to,
      from: from || env.TWILIO_FROM_NUMBER || '',
      body,
    });
    this.logger.log(`SMS sent sid=${message.sid} to=${to}`);
    return {
      messageId: message.sid,
      cost: parseFloat(message.price ?? '0') || 0,
    };
  }
}
