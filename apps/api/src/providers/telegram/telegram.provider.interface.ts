export interface TelegramProviderInterface {
  sendMessage(chatId: string, text: string): Promise<{ messageId: string }>;
}
