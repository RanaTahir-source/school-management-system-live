import { Injectable, Logger } from '@nestjs/common';
import { CommunicationChannel, CommunicationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Pluggable outbound-communication stub.
 *
 * No real SMS/Email/WhatsApp provider is wired up yet - credentials for
 * those come later (Twilio/SNS for SMS, SES/SMTP for email, the WhatsApp
 * Business API). Until then this service only logs what *would* be sent and
 * records it in CommunicationLog, so the rest of the app (urgent
 * announcements, receipts, etc.) can already call it without changes once a
 * real provider is plugged in.
 *
 * To go live: implement the three private `dispatch*` methods below using
 * env vars (SMS_PROVIDER_*, SMTP_*, WHATSAPP_*) - never hardcode keys.
 */
@Injectable()
export class CommunicationProviderService {
  private readonly logger = new Logger(CommunicationProviderService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendSms(recipient: string, body: string, schoolId?: string, relatedAnnouncementId?: string) {
    return this.send(CommunicationChannel.SMS, recipient, undefined, body, schoolId, relatedAnnouncementId);
  }

  async sendEmail(
    recipient: string,
    subject: string,
    body: string,
    schoolId?: string,
    relatedAnnouncementId?: string,
  ) {
    return this.send(CommunicationChannel.EMAIL, recipient, subject, body, schoolId, relatedAnnouncementId);
  }

  async sendWhatsApp(recipient: string, body: string, schoolId?: string, relatedAnnouncementId?: string) {
    return this.send(CommunicationChannel.WHATSAPP, recipient, undefined, body, schoolId, relatedAnnouncementId);
  }

  private async send(
    channel: CommunicationChannel,
    recipient: string,
    subject: string | undefined,
    body: string,
    schoolId: string | undefined,
    relatedAnnouncementId: string | undefined,
  ) {
    let status: CommunicationStatus = CommunicationStatus.PENDING;
    let providerResponse: string | undefined;

    try {
      providerResponse = await this.dispatch(channel, recipient, subject, body);
      status = CommunicationStatus.SENT;
    } catch (err) {
      status = CommunicationStatus.FAILED;
      providerResponse = err instanceof Error ? err.message : 'Unknown error';
      this.logger.warn(`${channel} to ${recipient} failed: ${providerResponse}`);
    }

    return this.prisma.communicationLog.create({
      data: {
        schoolId,
        channel,
        recipient,
        subject,
        body,
        status,
        providerResponse,
        relatedAnnouncementId,
      },
    });
  }

  // No real provider configured yet - just log so behaviour is visible in
  // dev/staging without sending anything or requiring API keys.
  private async dispatch(
    channel: CommunicationChannel,
    recipient: string,
    subject: string | undefined,
    body: string,
  ): Promise<string> {
    this.logger.log(`[STUB ${channel}] to=${recipient}${subject ? ` subject="${subject}"` : ''} body="${body}"`);
    return 'stub: not sent - no provider configured';
  }
}
