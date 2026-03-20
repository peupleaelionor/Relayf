export interface SmsProvider {
  send(to: string, from: string, body: string): Promise<{ messageId: string; cost?: number }>;
}
