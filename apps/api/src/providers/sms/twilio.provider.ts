import { Injectable, Logger } from '@nestjs/common';
import Twilio from 'twilio';
import { env } from '@relayflow/config';
import { SmsProvider } from './sms-provider.interface';

@Injectable()
export class TwilioProvider implements SmsProvider {
  private client: Twilio.Twilio;
  private readonly logger = new Logger(TwilioProvider.name);

  constructor() {
    this.client = Twilio(env.TWILIO_ACCOUNT_SID || '', env.TWILIO_AUTH_TOKEN || '');
  }

  async send(to: string, from: string, body: string) {
    const message = await this.client.messages.create({
      to,
      from: from || env.TWILIO_FROM_NUMBER || '',
      body,
    });
    this.logger.log(`SMS sent to ${to}, sid=${message.sid}`);
    return { messageId: message.sid, cost: parseFloat(message.price || '0') };
  }
}
