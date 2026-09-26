import { db, normalizePhoneNumber } from './db.ts';
import { smsService } from './sms.ts';

export class IvrService {
  /**
   * Generates initial TwiML for an incoming call to PhoneMail's toll-free line
   */
  generateGreetingTwiml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather action="/api/ivr/action" method="POST" numDigits="1" timeout="10">
    <Say voice="Polly.Joanna">
      Welcome to PhoneMail, where your phone number is your email address. 
      To create your free PhoneMail account instantly, press 1. 
      To hear this menu again, press 2.
    </Say>
  </Gather>
  <Say voice="Polly.Joanna">We did not receive any input. Goodbye.</Say>
  <Hangup/>
</Response>`;
  }

  /**
   * Processes the user's DTMF keypress action from Twilio
   */
  async handleIvrAction(callerPhone: string, digits: string): Promise<{ twiml: string; accountCreated: boolean; user?: any }> {
    const cleanPhone = normalizePhoneNumber(callerPhone);

    if (digits === '1') {
      let user = await db.getUserByPhone(cleanPhone);
      let created = false;

      if (!user) {
        // Create the user automatically using caller ID phone number
        user = await db.createUser({
          phone_number: cleanPhone,
          display_name: `PhoneMail Member (+${cleanPhone})`
        });
        created = true;
      }

      // Log IVR event
      await db.logIvr({
        caller_phone: cleanPhone,
        digit_pressed: '1',
        result_account_created: created
      });

      // Send confirmation SMS
      await smsService.sendEmailReceivedNotification({
        recipientPhone: cleanPhone,
        senderEmail: 'system@phonemail.com',
        subject: created ? 'Welcome to PhoneMail! Your account is active' : 'PhoneMail Account Info'
      });

      const message = created
        ? `Congratulations! Your PhoneMail account has been created. Your email address is ${user.email_address}. A confirmation message has been sent to your phone. Thank you for using PhoneMail.`
        : `Welcome back! You already have an active PhoneMail account with address ${user.email_address}. We have sent your account confirmation. Thank you.`;

      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${message}</Say>
  <Hangup/>
</Response>`;

      return { twiml, accountCreated: created, user };
    }

    // Invalid or repeat
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">You pressed ${digits}. Please call back and press 1 to register your PhoneMail account. Goodbye.</Say>
  <Hangup/>
</Response>`;

    await db.logIvr({
      caller_phone: cleanPhone,
      digit_pressed: digits,
      result_account_created: false
    });

    return { twiml, accountCreated: false };
  }
}

export const ivrService = new IvrService();
