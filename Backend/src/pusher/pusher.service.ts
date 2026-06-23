import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class PusherService {
  private readonly client: Pusher;
  private readonly logger = new Logger(PusherService.name);

  constructor(private readonly config: ConfigService) {
    this.client = new Pusher({
      appId: this.config.getOrThrow<string>('SOKETI_APP_ID'),
      key: this.config.getOrThrow<string>('SOKETI_APP_KEY'),
      secret: this.config.getOrThrow<string>('SOKETI_APP_SECRET'),
      host: this.config.getOrThrow<string>('SOKETI_HOST'),
      port: this.config.getOrThrow<string>('SOKETI_PORT'),
      useTLS: false,
    });
  }

  async trigger(channel: string, event: string, data: unknown): Promise<void> {
    try {
      await this.client.trigger(channel, event, data);
    } catch (err) {
      this.logger.warn(
        `Soketi trigger failed for ${channel}/${event}: ${String(err)}`,
      );
    }
  }
}
