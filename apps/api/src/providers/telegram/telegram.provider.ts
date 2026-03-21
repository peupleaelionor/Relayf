import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { env } from '@relayflow/config';
import { TelegramProviderInterface } from './telegram.provider.interface';

@Injectable()
export class TelegramProvider implements TelegramProviderInterface {
  private bot: TelegramBot;
  private readonly logger = new Logger(TelegramProvider.name);

  constructor() {
    if (env.TELEGRAM_BOT_TOKEN) {
      this.bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });
    }
  }

  async sendMessage(chatId: string, text: string) {
    if (!this.bot) throw new Error('Telegram bot not configured');
    const msg = await this.bot.sendMessage(chatId, text);
    this.logger.log(`Telegram message sent to ${chatId}, messageId=${msg.message_id}`);
    return { messageId: String(msg.message_id) };
  }
}
