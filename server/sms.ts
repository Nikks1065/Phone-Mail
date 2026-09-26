import { db } from './db.ts';
import { SmsNotification } from './types.ts';

export interface SendSmsParams {
  recipientPhone: string;
  senderEmail: string;
  subject: string;
  /** Used to prevent duplicate SMS for the same email message */
  relatedMessageId?: string;
}

export class SmsService {
  private provider: string;
  private twilioSid: string;
  private twilioAuthToken: string;
  private twilioFrom: string;

  constructor() {
    this.provider = process.env.SMS_PROVIDER || 'simulated';
    this.twilioSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.twilioFrom = process.env.TWILIO_PHONE_NUMBER || '';
  }

  isTwilioConfigured(): boolean {
    return Boolean(this.twilioSid && this.twilioAuthToken && this.twilioFrom);
  }

  async sendEmailReceivedNotification(params: SendSmsParams): Promise<SmsNotification> {
    const { recipientPhone, senderEmail, subject, relatedMessageId } = params;

    if (relatedMessageId && (await db.hasSmsForMessage(relatedMessageId))) {
      const existing = (await db.getSmsLogs()).find(
        (s) => s.related_message_id === relatedMessageId && s.recipient_phone === recipientPhone
      );
      if (existing) {
        console.log(`[SMS] Skipping duplicate notification for message ${relatedMessageId}`);
        return existing;
      }
    }

    // Twilio free-tier pre-approved templates often restrict custom bodies.
    // Prefer TWILIO_SMS_TEMPLATE if set; otherwise use a concise sender/subject alert.
    const template = process.env.TWILIO_SMS_TEMPLATE;
    const body = template
      ? template.replace('{{sender}}', senderEmail).replace('{{subject}}', subject)
      : `PhoneMail: New email from ${senderEmail}. Subject: ${subject}`;

    // If twilio is chosen and configured
    if (this.provider === 'twilio' && this.isTwilioConfigured()) {
      try {
        const auth = Buffer.from(`${this.twilioSid}:${this.twilioAuthToken}`).toString('base64');
        const postData = new URLSearchParams({
          To: recipientPhone.startsWith('+') ? recipientPhone : `+${recipientPhone}`,
          From: this.twilioFrom,
          Body: body
        }).toString();

        const response = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${this.twilioSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: postData
          }
        );

        if (!response.ok) {
          const errText = await response.text();
          console.warn('[SMS] Twilio API call failed:', errText);
          return await db.logSms({
            recipient_phone: recipientPhone,
            message_body: body,
            sender_email: senderEmail,
            subject,
            status: 'failed',
            provider: 'twilio',
            error_message: `Twilio API status ${response.status}: ${errText}`,
            related_message_id: relatedMessageId
          });
        }

        console.log(`[SMS] Live Twilio SMS dispatched to +${recipientPhone}`);
        return await db.logSms({
          recipient_phone: recipientPhone,
          message_body: body,
          sender_email: senderEmail,
          subject,
          status: 'sent',
          provider: 'twilio',
          related_message_id: relatedMessageId
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown SMS error';
        console.error('[SMS] Error sending Twilio SMS:', err);
        return await db.logSms({
          recipient_phone: recipientPhone,
          message_body: body,
          sender_email: senderEmail,
          subject,
          status: 'failed',
          provider: 'twilio',
          error_message: message,
          related_message_id: relatedMessageId
        });
      }
    }

    // Demo/Simulated fallback mode
    console.log(`[SMS:SIMULATED] To: +${recipientPhone} | Body: "${body}"`);
    return await db.logSms({
      recipient_phone: recipientPhone,
      message_body: body,
      sender_email: senderEmail,
      subject,
      status: 'simulated',
      provider: 'demo-fallback',
      related_message_id: relatedMessageId
    });
  }
}

export const smsService = new SmsService();
