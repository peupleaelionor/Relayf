import { Injectable, Logger } from '@nestjs/common';
import { TwilioProvider } from './twilio.provider';

@Injectable()
export class SmsRouterService {
  private readonly logger = new Logger(SmsRouterService.name);

  constructor(private twilioProvider: TwilioProvider) {}

  async send(to: string, from: string, body: string, workspaceId?: string) {
    this.logger.log(`Routing SMS to ${to} for workspace ${workspaceId || 'unknown'}`);
    return this.twilioProvider.send(to, from, body);
  }
}
