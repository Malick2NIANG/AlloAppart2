import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as OneSignal from '@onesignal/node-onesignal';

@Injectable()
export class OnesignalService {
  private readonly logger = new Logger(OnesignalService.name);
  private readonly client: OneSignal.DefaultApi | null = null;
  private readonly appId: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ONESIGNAL_API_KEY');
    this.appId = this.config.get<string>('ONESIGNAL_APP_ID') ?? '';

    if (apiKey && this.appId) {
      const configuration = OneSignal.createConfiguration({
        restApiKey: apiKey,
      });
      this.client = new OneSignal.DefaultApi(configuration);
    }
  }

  async sendToExternalIds(
    externalIds: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!this.client || !externalIds.length) return;

    try {
      const notification = new OneSignal.Notification();
      notification.app_id = this.appId;
      notification.include_aliases = { external_id: externalIds };
      notification.target_channel = 'push';
      notification.headings = { en: title, fr: title };
      notification.contents = { en: body, fr: body };
      if (data) notification.data = data;

      await this.client.createNotification(notification);
    } catch (err) {
      this.logger.warn(`OneSignal push failed: ${String(err)}`);
    }
  }

  // Broadcast ciblé : undefined = tous les abonnés, tableau vide = skip
  async sendBroadcast(
    title: string,
    body: string,
    externalIds?: string[],
  ): Promise<void> {
    if (!this.client) return;
    if (externalIds !== undefined && externalIds.length === 0) return;

    try {
      const notification = new OneSignal.Notification();
      notification.app_id = this.appId;
      if (externalIds !== undefined) {
        notification.include_aliases = { external_id: externalIds };
      }
      notification.target_channel = 'push';
      notification.headings = { en: title, fr: title };
      notification.contents = { en: body, fr: body };
      await this.client.createNotification(notification);
    } catch (err) {
      this.logger.warn(`OneSignal broadcast failed: ${String(err)}`);
    }
  }
}
