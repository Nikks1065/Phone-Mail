import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { db, normalizePhoneNumber, isValidPhoneNumber } from './server/db.ts';
import {
  authenticateToken,
  AuthenticatedRequest,
  generateToken,
  generateOtpCode,
  comparePassword,
  hashPassword
} from './server/auth.ts';
import { smsService } from './server/sms.ts';
import { ivrService } from './server/ivr.ts';
import { seedDatabase } from './server/seed.ts';
import { checkRateLimit } from './server/rateLimit.ts';
import { isDemoMode } from './server/otpStore.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';
const ADMIN_SECRET = process.env.ADMIN_SECRET || '';

app.use(cors({
  origin: process.env.CORS_ORIGIN || true,
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

/** Require JWT or matching ADMIN_SECRET header for demo/admin tools */
function requireAuthOrAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const adminHeader = req.headers['x-admin-secret'];
  if (ADMIN_SECRET && adminHeader === ADMIN_SECRET) {
    return next();
  }
  return authenticateToken(req, res, next);
}

// --- API ROUTES ---

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'PhoneMail API',
    timestamp: new Date().toISOString(),
    smsProvider: smsService.isTwilioConfigured() ? 'twilio (live)' : 'simulated demo mode'
  });
});

// 2. Auth: Request OTP (rate-limited; plaintext OTP never stored; demoCode only in demo mode)
app.post('/api/auth/request-otp', async (req: Request, res: Response) => {
  try {
    const { phone, purpose } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Valid phone number is required.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number (7-15 digits, optional country code).' });
    }

    const rate = checkRateLimit(`otp:${cleanPhone}`, 5, 10 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Too many OTP requests. Please wait ${rate.retryAfterSeconds} seconds before trying again.`
      });
    }

    // Registration-only requests must not target an existing account
    if (purpose === 'register') {
      const existing = await db.getUserByPhone(cleanPhone);
      if (existing) {
        return res.status(409).json({
          error: 'An account already exists for this phone number. Please use the login screen instead.'
        });
      }
    }

    const code = generateOtpCode();
    await db.saveOtp(cleanPhone, code, 10);

    // Dispatch OTP via SMS when Twilio is configured; otherwise log server-side only
    if (smsService.isTwilioConfigured() && process.env.SMS_PROVIDER === 'twilio') {
      await smsService.sendEmailReceivedNotification({
        recipientPhone: cleanPhone,
        senderEmail: 'auth@phonemail.com',
        subject: `Your PhoneMail verification code is ${code}`
      }).catch((err) => console.warn('[AUTH] OTP SMS dispatch failed:', err.message));
    } else {
      console.log(`[AUTH:OTP] Code generated for +${cleanPhone} (server log only; not returned in production)`);
      if (isDemoMode()) {
        console.log(`[AUTH:OTP:DEMO] +${cleanPhone} => ${code}`);
      }
    }

    const payload: Record<string, unknown> = {
      success: true,
      message: `OTP sent successfully to +${cleanPhone}.`,
      expiresInMinutes: 10
    };

    // Never expose OTP in production responses
    if (isDemoMode()) {
      payload.demoCode = code;
      payload.demoHint = 'Demo mode only — OTP is also printed in the server console.';
    }

    res.json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to request OTP.';
    console.error('[API] request-otp error:', err);
    res.status(500).json({ error: message });
  }
});

// 2b. Auth: Registration-only portal (creates account; rejects duplicates)
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { phone, otp, displayName } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and OTP code are required.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    if (!isValidPhoneNumber(cleanPhone)) {
      return res.status(400).json({ error: 'Please enter a valid phone number (7-15 digits).' });
    }

    const existing = await db.getUserByPhone(cleanPhone);
    if (existing) {
      return res.status(409).json({
        error: 'Account already exists for this phone number. Duplicate registration is not allowed.'
      });
    }

    const verification = await db.verifyOtp(cleanPhone, otp);
    if (!verification.success) {
      return res.status(400).json({ error: verification.message || 'OTP verification failed.' });
    }

    const user = await db.createUser({
      phone_number: cleanPhone,
      display_name: displayName || `PhoneMail User (+${cleanPhone})`
    });

    await db.receiveInboundEmail({
      sender_email: 'welcome@phonemail.com',
      sender_name: 'PhoneMail System',
      to_email: user.email_address,
      subject: 'Welcome to PhoneMail — Your phone number is your email!',
      body_text: `Hello!\n\nWelcome to PhoneMail. Your phone number has been linked to your official email identity: ${user.email_address}.\n\nYou can send and receive emails right from this inbox.`
    });

    res.status(201).json({
      success: true,
      message: 'Account created successfully. You can now log in.',
      emailAddress: user.email_address,
      phoneNumber: user.phone_number
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register account.';
    console.error('[API] register error:', err);
    res.status(500).json({ error: message });
  }
});

// 3. Auth: Verify OTP & Login / Register
app.post('/api/auth/verify-otp', async (req: Request, res: Response) => {
  try {
    const { phone, otp, displayName } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ error: 'Phone number and OTP code are required.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    const verification = await db.verifyOtp(cleanPhone, otp);

    if (!verification.success) {
      return res.status(400).json({ error: verification.message || 'OTP verification failed.' });
    }

    // Check if user already exists
    let user = await db.getUserByPhone(cleanPhone);
    let isNewUser = false;

    if (!user) {
      // Create new user account automatically!
      user = await db.createUser({
        phone_number: cleanPhone,
        display_name: displayName || `PhoneMail User (+${cleanPhone})`
      });
      isNewUser = true;

      // Send welcome email to their brand new PhoneMail inbox!
      await db.receiveInboundEmail({
        sender_email: 'welcome@phonemail.com',
        sender_name: 'PhoneMail System',
        to_email: user.email_address,
        subject: 'Welcome to PhoneMail — Your phone number is your email!',
        body_text: `Hello!\n\nWelcome to PhoneMail. Your phone number has been linked to your official email identity: ${user.email_address}.\n\nYou can send and receive emails right from this inbox. Any external sender can email ${user.email_address} and you will be instantly notified.\n\nEnjoy the next generation of simplified communication!`
      });
    }

    const token = generateToken(user);
    const aliases = await db.getAliasesByUser(user.id);

    res.json({
      success: true,
      token,
      isNewUser,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        emailAddress: user.email_address,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        language: user.language,
        createdAt: user.created_at,
        aliases
      }
    });
  } catch (err: any) {
    console.error('[API] verify-otp error:', err);
    res.status(500).json({ error: err.message || 'Failed to verify OTP.' });
  }
});

// 4. Auth: Password Login Fallback
app.post('/api/auth/password-login', async (req: Request, res: Response) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone number and password are required.' });
    }

    const cleanPhone = normalizePhoneNumber(phone);
    const user = await db.getUserByPhone(cleanPhone);

    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Account not found or password not set. Please use OTP login.' });
    }

    const matches = await comparePassword(password, user.password_hash);
    if (!matches) {
      return res.status(401).json({ error: 'Invalid password. Please try again or use OTP.' });
    }

    const token = generateToken(user);
    const aliases = await db.getAliasesByUser(user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        phoneNumber: user.phone_number,
        emailAddress: user.email_address,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        language: user.language,
        createdAt: user.created_at,
        aliases
      }
    });
  } catch (err: any) {
    console.error('[API] password-login error:', err);
    res.status(500).json({ error: err.message || 'Failed to authenticate with password.' });
  }
});

// 5. Auth: Set Password (Fallback Configuration)
app.post('/api/auth/set-password', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const hash = await hashPassword(password);
    await db.updateUser(req.user!.id, { password_hash: hash });

    res.json({ success: true, message: 'Password fallback configured successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update password.' });
  }
});

// 6. Current User Profile
app.get('/api/auth/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const aliases = await db.getAliasesByUser(user.id);
    res.json({
      id: user.id,
      phoneNumber: user.phone_number,
      emailAddress: user.email_address,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      language: user.language,
      createdAt: user.created_at,
      hasPassword: Boolean(user.password_hash),
      aliases
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch user profile.' });
  }
});

// 7. Update Profile Settings
app.put('/api/user/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { displayName, avatarUrl, language } = req.body;
    const updated = await db.updateUser(req.user!.id, {
      ...(displayName ? { display_name: displayName.trim() } : {}),
      ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
      ...(language ? { language: language.trim() } : {})
    });
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to update profile.' });
  }
});

// 8. Alias Management
app.get('/api/aliases', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const aliases = await db.getAliasesByUser(req.user!.id);
    res.json(aliases);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/aliases', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { aliasName } = req.body;
    if (!aliasName || typeof aliasName !== 'string') {
      return res.status(400).json({ error: 'Alias name is required.' });
    }
    const newAlias = await db.createAlias(req.user!.id, aliasName);
    res.status(201).json(newAlias);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/aliases/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const success = await db.deleteAlias(req.user!.id, req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Alias not found or unauthorized.' });
    }
    res.json({ success: true, message: 'Alias removed successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Conversations List (with Folder & Search Filters)
app.get('/api/conversations', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const folder = (req.query.folder as any) || 'inbox';
    const search = (req.query.search as string) || '';
    const conversations = await db.getUserConversations(req.user!.id, folder, search);
    res.json(conversations);
  } catch (err: any) {
    console.error('[API] get conversations error:', err);
    res.status(500).json({ error: err.message || 'Failed to retrieve conversations.' });
  }
});

// 10. Conversation Details & Messages
app.get('/api/conversations/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const convId = req.params.id;
    const conversation = await db.getConversationById(convId, req.user!.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found.' });
    }

    // Verify user is a participant
    const isParticipant = conversation.participants?.some(
      p => p.id === req.user!.id || p.phone_number === req.user!.phone_number
    );
    if (!isParticipant) {
      return res.status(403).json({ error: 'Unauthorized to view this conversation.' });
    }

    const messages = await db.getConversationMessages(convId, req.user!.id);
    res.json({
      conversation,
      messages
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to retrieve conversation details.' });
  }
});

// 11. Compose Message (supports traditional compose, conversation compose, single/group conversation creation, and draft saving)
app.post('/api/messages/compose', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      conversationId,
      to,
      cc,
      subject,
      bodyText,
      bodyHtml,
      inReplyToId,
      isDraft,
      attachments
    } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: 'Recipient email address (or phone number) is required.' });
    }

    const result = await db.createMessage({
      sender_user_id: req.user!.id,
      conversation_id: conversationId,
      to,
      cc,
      subject: subject || '',
      body_text: bodyText || '',
      body_html: bodyHtml,
      in_reply_to_id: inReplyToId,
      is_draft: isDraft,
      attachments
    });

    // If not draft, dispatch SMS notification to recipients (deduped by message id)
    if (!isDraft && result.recipientPhonesToNotify.length > 0) {
      for (const phone of result.recipientPhonesToNotify) {
        smsService.sendEmailReceivedNotification({
          recipientPhone: phone,
          senderEmail: req.user!.email_address,
          subject: result.message.subject,
          relatedMessageId: result.message.id
        }).catch(err => console.warn('[SMS] Notification error:', err.message));
      }
    }

    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send message.';
    console.error('[API] compose error:', message);
    res.status(400).json({ error: message });
  }
});

// 11b. Update an existing draft
app.put('/api/messages/drafts/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = await db.updateDraft(req.user!.id, req.params.id, {
      to: req.body.to,
      cc: req.body.cc,
      subject: req.body.subject,
      body_text: req.body.bodyText,
      body_html: req.body.bodyHtml,
      attachments: req.body.attachments
    });
    res.json({ success: true, message: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update draft.';
    res.status(400).json({ error: message });
  }
});

// 11c. Send a previously saved draft
app.post('/api/messages/drafts/:id/send', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await db.sendDraft(req.user!.id, req.params.id);
    for (const phone of result.recipientPhonesToNotify) {
      smsService.sendEmailReceivedNotification({
        recipientPhone: phone,
        senderEmail: req.user!.email_address,
        subject: result.message.subject,
        relatedMessageId: result.message.id
      }).catch(err => console.warn('[SMS] Draft-send notification error:', err.message));
    }
    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send draft.';
    res.status(400).json({ error: message });
  }
});

// 11d. Forward a message (creates a new compose with quoted original)
app.post('/api/messages/forward', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId, conversationId, to, subject, bodyText } = req.body;
    if (!messageId || !to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: 'messageId and at least one recipient (to) are required.' });
    }

    const messages = await db.getConversationMessages(conversationId, req.user!.id);
    const original = messages.find(m => m.id === messageId);
    if (!original) {
      return res.status(404).json({ error: 'Original message not found.' });
    }

    const forwardBody =
      (bodyText || '') +
      `\n\n---------- Forwarded message ----------\nFrom: ${original.sender_name} <${original.sender_email}>\nDate: ${original.created_at}\nSubject: ${original.subject}\n\n${original.body_text}`;

    const result = await db.createMessage({
      sender_user_id: req.user!.id,
      to,
      subject: subject || (original.subject.startsWith('Fwd:') ? original.subject : `Fwd: ${original.subject}`),
      body_text: forwardBody,
      attachments: original.attachments || [],
      is_draft: false
    });

    for (const phone of result.recipientPhonesToNotify) {
      smsService.sendEmailReceivedNotification({
        recipientPhone: phone,
        senderEmail: req.user!.email_address,
        subject: result.message.subject,
        relatedMessageId: result.message.id
      }).catch(err => console.warn('[SMS] Forward notification error:', err.message));
    }

    res.status(201).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to forward message.';
    res.status(400).json({ error: message });
  }
});

// 12. Strict Reply Message (validates single-reply constraint, links in_reply_to_id)
app.post('/api/messages/reply', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { messageId, conversationId, bodyText, bodyHtml, attachments } = req.body;
    if (!messageId) {
      return res.status(400).json({ error: 'Original messageId is required to reply.' });
    }

    // Fetch original message to get sender and recipient context
    const messages = await db.getConversationMessages(conversationId, req.user!.id);
    const originalMsg = messages.find(m => m.id === messageId);
    if (!originalMsg) {
      return res.status(404).json({ error: 'Original message not found in this conversation.' });
    }

    // Determine recipient for reply (reply to the sender of the original message)
    const replyToRecipient = originalMsg.sender_email;

    const result = await db.createMessage({
      sender_user_id: req.user!.id,
      conversation_id: conversationId,
      to: [replyToRecipient],
      subject: originalMsg.subject.startsWith('Re:') ? originalMsg.subject : `Re: ${originalMsg.subject}`,
      body_text: bodyText || '',
      body_html: bodyHtml,
      in_reply_to_id: messageId,
      is_draft: false,
      attachments
    });

    // Notify original sender via SMS (deduped)
    if (originalMsg.sender_phone) {
      smsService.sendEmailReceivedNotification({
        recipientPhone: originalMsg.sender_phone,
        senderEmail: req.user!.email_address,
        subject: result.message.subject,
        relatedMessageId: result.message.id
      }).catch(err => console.warn('[SMS] Reply notification error:', err.message));
    }

    res.status(201).json(result);
  } catch (err: any) {
    console.warn('[API] Reply constraint violation or error:', err.message);
    res.status(400).json({ error: err.message || 'Failed to reply.' });
  }
});

// 13. Message States: Favorite
app.post('/api/messages/:id/favorite', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isFav = await db.toggleFavorite(req.user!.id, req.params.id, req.body.isFavorite);
    res.json({ success: true, isFavorite: isFav });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. Message States: Read
app.post('/api/messages/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isRead = req.body.isRead !== undefined ? Boolean(req.body.isRead) : true;
    await db.setReadState(req.user!.id, req.params.id, isRead);
    res.json({ success: true, isRead });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. Mark entire conversation as read
app.post('/api/conversations/:id/read', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.markConversationRead(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Conversation marked as read.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. Message States: Spam
app.post('/api/messages/:id/spam', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isSpam = req.body.isSpam !== undefined ? Boolean(req.body.isSpam) : true;
    await db.setSpamState(req.user!.id, req.params.id, isSpam);
    res.json({ success: true, isSpam });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. Message States: Trash
app.post('/api/messages/:id/trash', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const isTrash = req.body.isTrash !== undefined ? Boolean(req.body.isTrash) : true;
    await db.setTrashState(req.user!.id, req.params.id, isTrash);
    res.json({ success: true, isTrash });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 18. Delete Message Permanently
app.delete('/api/messages/:id', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await db.deleteMessagePermanently(req.user!.id, req.params.id);
    res.json({ success: true, message: 'Message permanently deleted.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 19. External Inbound Email Webhook
// External sender -> PhoneMail email address -> email receiving webhook -> backend -> database -> user's PhoneMail inbox -> trigger SMS
app.post('/api/emails/webhook/incoming', async (req: Request, res: Response) => {
  try {
    const { from, to, subject, text, html, attachments } = req.body;
    if (!from || !to) {
      return res.status(400).json({ error: 'Missing required webhook fields: from, to' });
    }

    const result = await db.receiveInboundEmail({
      sender_email: from,
      sender_name: req.body.senderName || from,
      to_email: to,
      subject: subject || '(No Subject)',
      body_text: text || '',
      body_html: html,
      attachments: attachments || []
    });

    // Trigger SMS only after successful ingest; dedupe by message id
    await smsService.sendEmailReceivedNotification({
      recipientPhone: result.recipientUser.phone_number,
      senderEmail: from,
      subject: subject || '(No Subject)',
      relatedMessageId: result.message.id
    });

    res.status(200).json({
      success: true,
      message: 'Inbound email ingested and SMS notification triggered.',
      messageId: result.message.id,
      conversationId: result.conversation.id
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to process inbound email.';
    console.error('[WEBHOOK] Inbound email error:', err);
    res.status(400).json({ error: message });
  }
});

// 20. Toll-Free / IVR Webhooks & Telephony Endpoints
app.post('/api/ivr/incoming', (req: Request, res: Response) => {
  res.type('text/xml');
  res.send(ivrService.generateGreetingTwiml());
});

app.post('/api/ivr/action', async (req: Request, res: Response) => {
  const callerPhone = (req.body.From || req.body.Caller || '9876543210') as string;
  const digits = (req.body.Digits || '1') as string;

  const result = await ivrService.handleIvrAction(callerPhone, digits);
  res.type('text/xml');
  res.send(result.twiml);
});

// Interactive Simulator for IVR (lets user test "Call Toll-Free -> Press 1 -> Account Created" right from the app)
app.post('/api/ivr/simulate', async (req: Request, res: Response) => {
  try {
    const { callerPhone, digit } = req.body;
    if (!callerPhone) {
      return res.status(400).json({ error: 'Caller phone number is required.' });
    }
    const result = await ivrService.handleIvrAction(callerPhone, digit || '1');
    res.json({
      success: true,
      callerPhone,
      digitPressed: digit || '1',
      accountCreated: result.accountCreated,
      user: result.user,
      twimlResponse: result.twiml
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 21. SMS Notification Logs (authenticated or admin secret)
app.get('/api/sms/logs', requireAuthOrAdmin, async (req: Request, res: Response) => {
  try {
    const logs = await db.getSmsLogs();
    res.json(logs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load SMS logs.';
    res.status(500).json({ error: message });
  }
});

// 22. Seed Reset Endpoint (demo tools — requires auth or admin secret)
app.post('/api/seed/reset', requireAuthOrAdmin, async (req: Request, res: Response) => {
  try {
    if (!isDemoMode() && !ADMIN_SECRET) {
      return res.status(403).json({ error: 'Seed reset is disabled outside demo mode.' });
    }
    await seedDatabase({ force: true });
    res.json({ success: true, message: 'Database reset to demo seed state successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reset seed data.';
    res.status(500).json({ error: message });
  }
});

// 23. Simple attachment metadata upload (stores data-URL for demo; max ~4MB)
app.post('/api/attachments/upload', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, size, dataUrl } = req.body;
    if (!name || !dataUrl || typeof dataUrl !== 'string') {
      return res.status(400).json({ error: 'Attachment name and dataUrl are required.' });
    }
    if (dataUrl.length > 5_500_000) {
      return res.status(400).json({ error: 'Attachment exceeds maximum size (approx 4MB).' });
    }
    const attachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: String(name).slice(0, 200),
      size: Number(size) || dataUrl.length,
      type: String(type || 'application/octet-stream'),
      url: dataUrl
    };
    res.status(201).json(attachment);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to upload attachment.';
    res.status(500).json({ error: message });
  }
});

// --- SERVER INITIALIZATION & VITE MIDDLEWARE MOUNTING ---
async function startServer() {
  // Initialize initial seed data
  await seedDatabase().catch(err => console.error('[SEED] Seed error:', err));

  if (!isProd) {
    // Development mode: Mount Vite middlewares
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
    console.log('[SERVER] Vite development middleware mounted.');
  } else {
    // Production mode: Serve built static files
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[SERVER] Production static files mounted from dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PHONE-MAIL] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('[FATAL] Failed to start server:', err);
  process.exit(1);
});
