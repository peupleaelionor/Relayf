import { Injectable, Logger } from '@nestjs/common';
import TelegramBot from 'node-telegram-bot-api';
import { env } from '@relayflow/config';

@Injectable()
export class TelegramProvider {
  private bot: TelegramBot | null = null;
  private readonly logger = new Logger(TelegramProvider.name);

  constructor() {
    if (env.TELEGRAM_BOT_TOKEN) {
      this.bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });
    } else {
      this.logger.warn('TELEGRAM_BOT_TOKEN not set – Telegram provider disabled');
    }
  }

  async sendMessage(chatId: string, text: string): Promise<{ messageId: string }> {
    if (!this.bot) {
      throw new Error('Telegram bot not configured');
    }
    const msg = await this.bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
    this.logger.log(`Telegram message sent chatId=${chatId} messageId=${msg.message_id}`);
    return { messageId: String(msg.message_id) };
  }
}
