import { Module } from '@nestjs/common';
import { TwilioProvider } from './sms/twilio.provider';
import { SmsRouterService } from './sms/sms-router.service';
import { TelegramProvider } from './telegram/telegram.provider';

@Module({
  providers: [TwilioProvider, SmsRouterService, TelegramProvider],
  exports: [TwilioProvider, SmsRouterService, TelegramProvider],
})
export class ProvidersModule {}
