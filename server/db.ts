import fs from 'fs';
import path from 'path';
import pg from 'pg';
import {
  User,
  OtpRecord,
  Alias,
  Conversation,
  Message,
  UserMessageState,
  SmsNotification,
  IvrLog,
  UserSummary,
  Attachment
} from './types.ts';
import { hashOtp, verifyOtpHash } from './otpStore.ts';

/**
 * Normalize phone numbers for identity keys.
 * Strips punctuation; preserves full international digit sequences (E.164 without '+').
 * Optional defaultCountryDigits prepended when local numbers are shorter than 10 digits.
 */
export function normalizePhoneNumber(raw: string, defaultCountryDigits = ''): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (defaultCountryDigits && digits.length >= 7 && digits.length <= 10 && !digits.startsWith(defaultCountryDigits)) {
    return `${defaultCountryDigits}${digits}`;
  }
  return digits;
}

export function generatePhoneMailAddress(phone: string, domain?: string): string {
  const emailDomain = domain || process.env.EMAIL_DOMAIN || 'phonemail.com';
  const normalized = normalizePhoneNumber(phone);
  return `${normalized}@${emailDomain}`;
}

export function isValidPhoneNumber(phone: string): boolean {
  const digits = normalizePhoneNumber(phone);
  return digits.length >= 7 && digits.length <= 15;
}

interface DatabaseSchema {
  users: User[];
  otps: OtpRecord[];
  aliases: Alias[];
  conversations: Conversation[];
  conversation_participants: { conversation_id: string; phone_number: string; user_id?: string }[];
  messages: Message[];
  user_message_states: UserMessageState[];
  sms_notifications: SmsNotification[];
  ivr_logs: IvrLog[];
}

class RelationalDatabase {
  private isPg = false;
  private pgPool: pg.Pool | null = null;
  private memoryData: DatabaseSchema = {
    users: [],
    otps: [],
    aliases: [],
    conversations: [],
    conversation_participants: [],
    messages: [],
    user_message_states: [],
    sms_notifications: [],
    ivr_logs: []
  };
  private dataDir = path.resolve(process.cwd(), '.data');
  private dataFile = path.resolve(process.cwd(), '.data', 'phonemail_db.json');

  constructor() {
    this.init();
  }

  private init() {
    // Check if DATABASE_URL is provided for PostgreSQL
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')) {
      try {
        this.pgPool = new pg.Pool({
          connectionString: process.env.DATABASE_URL,
          connectionTimeoutMillis: 3000
        });
        this.isPg = true;
        console.log('[DB] PostgreSQL URL detected at', process.env.DATABASE_URL.split('@')[1] || 'remote');
        console.log('[DB] Runtime data uses the persistent JSON store (.data/phonemail_db.json). Postgres schema is provisioned for future migration.');
        this.initLocalStore();
        this.initPostgresSchema().catch(err => {
          console.warn('[DB] PostgreSQL schema init skipped/failed:', err.message);
          this.isPg = false;
        });
        return;
      } catch (e: any) {
        console.warn('[DB] Could not connect to PostgreSQL, falling back to local file store:', e.message);
        this.isPg = false;
      }
    }

    this.initLocalStore();
  }

  private initLocalStore() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      if (fs.existsSync(this.dataFile)) {
        const raw = fs.readFileSync(this.dataFile, 'utf8');
        this.memoryData = JSON.parse(raw);
        console.log(`[DB] Loaded persistent data store: ${this.memoryData.users.length} users, ${this.memoryData.conversations.length} conversations, ${this.memoryData.messages.length} messages.`);
      } else {
        this.persistLocalStore();
      }
    } catch (e) {
      console.error('[DB] Error loading local file store:', e);
    }
  }

  private persistLocalStore() {
    try {
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
      fs.writeFileSync(this.dataFile, JSON.stringify(this.memoryData, null, 2), 'utf8');
    } catch (e) {
      console.error('[DB] Failed to persist data to file:', e);
    }
  }

  private async initPostgresSchema() {
    if (!this.pgPool) return;
    const client = await this.pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(64) PRIMARY KEY,
          phone_number VARCHAR(32) UNIQUE NOT NULL,
          email_address VARCHAR(128) UNIQUE NOT NULL,
          password_hash VARCHAR(256),
          display_name VARCHAR(128) NOT NULL,
          avatar_url TEXT,
          language VARCHAR(16) DEFAULT 'en',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email_address);

        CREATE TABLE IF NOT EXISTS otps (
          id VARCHAR(64) PRIMARY KEY,
          phone_number VARCHAR(32) NOT NULL,
          code VARCHAR(16) NOT NULL,
          expires_at BIGINT NOT NULL,
          attempts INT DEFAULT 0,
          verified BOOLEAN DEFAULT FALSE
        );
        CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone_number);

        CREATE TABLE IF NOT EXISTS aliases (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          alias_email VARCHAR(128) UNIQUE NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          is_active BOOLEAN DEFAULT TRUE
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id VARCHAR(64) PRIMARY KEY,
          type VARCHAR(16) NOT NULL DEFAULT 'direct',
          subject VARCHAR(256) NOT NULL,
          participant_phone_keys VARCHAR(256) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_conv_keys ON conversations(participant_phone_keys);

        CREATE TABLE IF NOT EXISTS conversation_participants (
          conversation_id VARCHAR(64) REFERENCES conversations(id) ON DELETE CASCADE,
          phone_number VARCHAR(32) NOT NULL,
          user_id VARCHAR(64),
          PRIMARY KEY (conversation_id, phone_number)
        );

        CREATE TABLE IF NOT EXISTS messages (
          id VARCHAR(64) PRIMARY KEY,
          conversation_id VARCHAR(64) REFERENCES conversations(id) ON DELETE CASCADE,
          sender_email VARCHAR(128) NOT NULL,
          sender_phone VARCHAR(32),
          sender_name VARCHAR(128) NOT NULL,
          to_recipients JSONB NOT NULL DEFAULT '[]',
          cc_recipients JSONB NOT NULL DEFAULT '[]',
          subject VARCHAR(256) NOT NULL,
          body_text TEXT NOT NULL,
          body_html TEXT,
          in_reply_to_id VARCHAR(64),
          has_been_replied_to BOOLEAN DEFAULT FALSE,
          is_draft BOOLEAN DEFAULT FALSE,
          attachments JSONB NOT NULL DEFAULT '[]',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);
        CREATE INDEX IF NOT EXISTS idx_messages_reply ON messages(in_reply_to_id);

        CREATE TABLE IF NOT EXISTS user_message_states (
          user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
          message_id VARCHAR(64) REFERENCES messages(id) ON DELETE CASCADE,
          is_read BOOLEAN DEFAULT FALSE,
          is_favorite BOOLEAN DEFAULT FALSE,
          is_spam BOOLEAN DEFAULT FALSE,
          is_trash BOOLEAN DEFAULT FALSE,
          is_sent BOOLEAN DEFAULT FALSE,
          PRIMARY KEY (user_id, message_id)
        );

        CREATE TABLE IF NOT EXISTS sms_notifications (
          id VARCHAR(64) PRIMARY KEY,
          recipient_phone VARCHAR(32) NOT NULL,
          message_body TEXT NOT NULL,
          sender_email VARCHAR(128) NOT NULL,
          subject VARCHAR(256) NOT NULL,
          status VARCHAR(32) NOT NULL,
          provider VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          error_message TEXT
        );

        CREATE TABLE IF NOT EXISTS ivr_logs (
          id VARCHAR(64) PRIMARY KEY,
          caller_phone VARCHAR(32) NOT NULL,
          digit_pressed VARCHAR(8) NOT NULL,
          result_account_created BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      console.log('[DB] PostgreSQL schema verified successfully.');
    } finally {
      client.release();
    }
  }

  // --- Users Operations ---
  async getUserByPhone(phone: string): Promise<User | null> {
    const normalized = normalizePhoneNumber(phone);
    return this.memoryData.users.find(u => u.phone_number === normalized) || null;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.memoryData.users.find(u => u.id === id) || null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const lower = email.trim().toLowerCase();
    // Direct match
    const user = this.memoryData.users.find(u => u.email_address.toLowerCase() === lower);
    if (user) return user;
    // Check aliases
    const alias = this.memoryData.aliases.find(a => a.alias_email.toLowerCase() === lower && a.is_active);
    if (alias) {
      return this.memoryData.users.find(u => u.id === alias.user_id) || null;
    }
    return null;
  }

  async createUser(data: {
    phone_number: string;
    display_name?: string;
    password_hash?: string;
    avatar_url?: string;
    language?: string;
  }): Promise<User> {
    const normalized = normalizePhoneNumber(data.phone_number);
    const existing = await this.getUserByPhone(normalized);
    if (existing) {
      throw new Error(`Account already exists for phone number ${normalized}`);
    }

    const newUser: User = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      phone_number: normalized,
      email_address: generatePhoneMailAddress(normalized),
      password_hash: data.password_hash,
      display_name: data.display_name || `PhoneMail User (${normalized.slice(-4)})`,
      avatar_url: data.avatar_url || '',
      language: data.language || 'en',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    this.memoryData.users.push(newUser);
    this.persistLocalStore();
    return newUser;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const index = this.memoryData.users.findIndex(u => u.id === id);
    if (index === -1) return null;
    this.memoryData.users[index] = {
      ...this.memoryData.users[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    this.persistLocalStore();
    return this.memoryData.users[index];
  }

  // --- OTP Operations ---
  async saveOtp(phone: string, code: string, expiryMinutes = 10): Promise<OtpRecord> {
    const normalized = normalizePhoneNumber(phone);
    // Invalidate prior OTPs (prevents reuse of old codes)
    this.memoryData.otps = this.memoryData.otps.filter(o => o.phone_number !== normalized);

    const record: OtpRecord = {
      id: `otp_${Date.now()}`,
      phone_number: normalized,
      code: hashOtp(normalized, code.trim()),
      expires_at: Date.now() + expiryMinutes * 60 * 1000,
      attempts: 0,
      verified: false
    };
    this.memoryData.otps.push(record);
    this.persistLocalStore();
    return record;
  }

  async verifyOtp(phone: string, code: string): Promise<{ success: boolean; message?: string }> {
    const normalized = normalizePhoneNumber(phone);
    const record = this.memoryData.otps.find(o => o.phone_number === normalized && !o.verified);
    if (!record) {
      return { success: false, message: 'No OTP requested or code has expired. Please request a new OTP.' };
    }

    if (Date.now() > record.expires_at) {
      this.memoryData.otps = this.memoryData.otps.filter(o => o.id !== record.id);
      this.persistLocalStore();
      return { success: false, message: 'OTP has expired. Please request a new code.' };
    }

    record.attempts += 1;
    if (record.attempts > 5) {
      this.memoryData.otps = this.memoryData.otps.filter(o => o.id !== record.id);
      this.persistLocalStore();
      return { success: false, message: 'Too many failed attempts. Please request a new OTP.' };
    }

    if (!verifyOtpHash(normalized, code.trim(), record.code)) {
      this.persistLocalStore();
      return { success: false, message: `Invalid OTP code. (${5 - record.attempts} attempts remaining)` };
    }

    // Mark verified and remove so the code cannot be reused
    record.verified = true;
    this.memoryData.otps = this.memoryData.otps.filter(o => o.id !== record.id);
    this.persistLocalStore();
    return { success: true };
  }

  // --- Aliases Operations ---
  async getAliasesByUser(userId: string): Promise<Alias[]> {
    return this.memoryData.aliases.filter(a => a.user_id === userId);
  }

  async createAlias(userId: string, aliasName: string): Promise<Alias> {
    let cleanAlias = aliasName.trim().toLowerCase();
    if (!cleanAlias.includes('@')) {
      const domain = process.env.EMAIL_DOMAIN || 'phonemail.com';
      cleanAlias = `${cleanAlias}@${domain}`;
    }

    // Check uniqueness across primary emails and existing aliases
    const existingUser = this.memoryData.users.find(u => u.email_address.toLowerCase() === cleanAlias);
    if (existingUser) {
      throw new Error(`The address '${cleanAlias}' is already registered as a primary PhoneMail account.`);
    }

    const existingAlias = this.memoryData.aliases.find(a => a.alias_email.toLowerCase() === cleanAlias && a.is_active);
    if (existingAlias) {
      throw new Error(`The alias '${cleanAlias}' is already taken.`);
    }

    const newAlias: Alias = {
      id: `als_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      user_id: userId,
      alias_email: cleanAlias,
      created_at: new Date().toISOString(),
      is_active: true
    };
    this.memoryData.aliases.push(newAlias);
    this.persistLocalStore();
    return newAlias;
  }

  async deleteAlias(userId: string, aliasId: string): Promise<boolean> {
    const alias = this.memoryData.aliases.find(a => a.id === aliasId && a.user_id === userId);
    if (!alias) return false;
    this.memoryData.aliases = this.memoryData.aliases.filter(a => a.id !== aliasId);
    this.persistLocalStore();
    return true;
  }

  // --- Conversations & Messages Operations ---

  // Canonical key for 1-to-1 conversation to ensure only one thread exists between two phones
  generateParticipantKey(phones: string[]): string {
    const normalized = Array.from(new Set(phones.map(p => normalizePhoneNumber(p)))).sort();
    return normalized.join(':');
  }

  async getOrCreateDirectConversation(phoneA: string, phoneB: string, subject = 'Conversation'): Promise<Conversation> {
    const key = this.generateParticipantKey([phoneA, phoneB]);
    const normA = normalizePhoneNumber(phoneA);
    const normB = normalizePhoneNumber(phoneB);

    let conv = this.memoryData.conversations.find(c => c.type === 'direct' && c.participant_phone_keys === key);
    if (!conv) {
      conv = {
        id: `conv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'direct',
        subject,
        participant_phone_keys: key,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.memoryData.conversations.push(conv);

      // Add participants
      const userA = await this.getUserByPhone(normA);
      const userB = await this.getUserByPhone(normB);

      this.memoryData.conversation_participants.push(
        { conversation_id: conv.id, phone_number: normA, user_id: userA?.id },
        { conversation_id: conv.id, phone_number: normB, user_id: userB?.id }
      );
      this.persistLocalStore();
    }
    return conv;
  }

  async createGroupConversation(phones: string[], subject: string): Promise<Conversation> {
    const key = this.generateParticipantKey(phones);
    const conv: Conversation = {
      id: `conv_grp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'group',
      subject: subject || 'Group Conversation',
      participant_phone_keys: key,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    this.memoryData.conversations.push(conv);

    for (const phone of phones) {
      const norm = normalizePhoneNumber(phone);
      const user = await this.getUserByPhone(norm);
      this.memoryData.conversation_participants.push({
        conversation_id: conv.id,
        phone_number: norm,
        user_id: user?.id
      });
    }

    this.persistLocalStore();
    return conv;
  }

  async getConversationById(convId: string, currentUserId?: string): Promise<Conversation | null> {
    const conv = this.memoryData.conversations.find(c => c.id === convId);
    if (!conv) return null;

    // Fetch participants
    const parts = this.memoryData.conversation_participants.filter(p => p.conversation_id === convId);
    const participantSummaries: UserSummary[] = [];
    for (const p of parts) {
      const user = p.user_id ? await this.getUserById(p.user_id) : await this.getUserByPhone(p.phone_number);
      if (user) {
        participantSummaries.push({
          id: user.id,
          phone_number: user.phone_number,
          email_address: user.email_address,
          display_name: user.display_name,
          avatar_url: user.avatar_url
        });
      } else {
        participantSummaries.push({
          id: p.phone_number,
          phone_number: p.phone_number,
          email_address: `${p.phone_number}@phonemail.com`,
          display_name: `+${p.phone_number}`
        });
      }
    }

    return {
      ...conv,
      participants: participantSummaries
    };
  }

  async getConversationMessages(convId: string, currentUserId?: string): Promise<Message[]> {
    const rawMessages = this.memoryData.messages.filter(m => m.conversation_id === convId);
    // Sort chronologically
    rawMessages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Merge user-specific state if currentUserId provided
    return rawMessages.map(m => {
      const state = currentUserId
        ? this.memoryData.user_message_states.find(s => s.user_id === currentUserId && s.message_id === m.id)
        : null;
      return {
        ...m,
        is_read: state ? state.is_read : true,
        is_favorite: state ? state.is_favorite : false,
        is_spam: state ? state.is_spam : false,
        is_trash: state ? state.is_trash : false
      };
    });
  }

  async getUserConversations(
    userId: string,
    folder: 'inbox' | 'unread' | 'favorites' | 'attachments' | 'spam' | 'trash' | 'drafts' = 'inbox',
    searchQuery = ''
  ): Promise<Conversation[]> {
    const user = await this.getUserById(userId);
    if (!user) return [];

    const normUserPhone = user.phone_number;

    // Get all conversation IDs user participates in
    const userPartConvIds = new Set(
      this.memoryData.conversation_participants
        .filter(p => p.phone_number === normUserPhone || p.user_id === userId)
        .map(p => p.conversation_id)
    );

    const results: Conversation[] = [];

    for (const conv of this.memoryData.conversations) {
      if (!userPartConvIds.has(conv.id)) continue;

      const messages = await this.getConversationMessages(conv.id, userId);
      if (messages.length === 0) continue;

      const nonDrafts = messages.filter(m => !m.is_draft);
      const drafts = messages.filter(m => m.is_draft);
      const latestMessage = messages[messages.length - 1];

      // Check states
      const hasUnread = messages.some(m => !m.is_read && m.sender_phone !== normUserPhone && !m.is_trash && !m.is_spam);
      const hasFavorite = messages.some(m => m.is_favorite && !m.is_trash);
      const hasSpam = messages.some(m => m.is_spam);
      const hasTrash = messages.some(m => m.is_trash);
      const hasAttachments = messages.some(m => m.attachments && m.attachments.length > 0 && !m.is_trash);
      const hasDraft = drafts.length > 0;

      const isEntirelyTrash = nonDrafts.length > 0 && nonDrafts.every(m => m.is_trash);
      const isEntirelySpam = nonDrafts.length > 0 && nonDrafts.every(m => m.is_spam);

      // Folder filtering
      if (folder === 'spam') {
        if (!hasSpam) continue;
      } else if (folder === 'trash') {
        if (!hasTrash) continue;
      } else if (folder === 'drafts') {
        if (!hasDraft) continue;
      } else if (folder === 'favorites') {
        if (!hasFavorite) continue;
      } else {
        // Normal views: Inbox, Unread, Attachments
        // Spam and Trash must NOT appear in normal Inbox results
        if (hasSpam || isEntirelyTrash || latestMessage?.is_trash) continue;

        if (folder === 'unread' && !hasUnread) continue;
        if (folder === 'attachments' && !hasAttachments) continue;
      }

      // Search query filtering
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSubject = conv.subject.toLowerCase().includes(q);
        const matchesMessages = messages.some(m =>
          m.subject.toLowerCase().includes(q) ||
          m.body_text.toLowerCase().includes(q) ||
          m.sender_name.toLowerCase().includes(q) ||
          m.sender_email.toLowerCase().includes(q) ||
          m.to_recipients.some(r => r.toLowerCase().includes(q))
        );
        if (!matchesSubject && !matchesMessages) continue;
      }

      // Get participants
      const parts = this.memoryData.conversation_participants.filter(p => p.conversation_id === conv.id);
      const participantSummaries: UserSummary[] = [];
      for (const p of parts) {
        const pUser = p.user_id ? await this.getUserById(p.user_id) : await this.getUserByPhone(p.phone_number);
        if (pUser) {
          participantSummaries.push({
            id: pUser.id,
            phone_number: pUser.phone_number,
            email_address: pUser.email_address,
            display_name: pUser.display_name,
            avatar_url: pUser.avatar_url
          });
        } else {
          participantSummaries.push({
            id: p.phone_number,
            phone_number: p.phone_number,
            email_address: `${p.phone_number}@phonemail.com`,
            display_name: `+${p.phone_number}`
          });
        }
      }

      const unreadCount = messages.filter(m => !m.is_read && m.sender_phone !== normUserPhone).length;

      results.push({
        ...conv,
        latest_message: latestMessage,
        unread_count: unreadCount,
        participants: participantSummaries,
        is_favorite: hasFavorite,
        is_spam: hasSpam,
        is_trash: hasTrash
      });
    }

    // Sort by latest message timestamp descending
    results.sort((a, b) => {
      const timeA = a.latest_message ? new Date(a.latest_message.created_at).getTime() : new Date(a.updated_at).getTime();
      const timeB = b.latest_message ? new Date(b.latest_message.created_at).getTime() : new Date(b.updated_at).getTime();
      return timeB - timeA;
    });

    return results;
  }

  // --- Message Creation & Constraints ---
  async createMessage(data: {
    sender_user_id: string;
    conversation_id?: string;
    to: string[];
    cc?: string[];
    subject: string;
    body_text: string;
    body_html?: string;
    in_reply_to_id?: string | null;
    is_draft?: boolean;
    attachments?: Attachment[];
  }): Promise<{ message: Message; conversation: Conversation; recipientPhonesToNotify: string[] }> {
    const sender = await this.getUserById(data.sender_user_id);
    if (!sender) {
      throw new Error('Sender user not found');
    }

    const cleanTo = data.to.map(t => t.trim().toLowerCase()).filter(Boolean);
    const cleanCc = (data.cc || []).map(c => c.trim().toLowerCase()).filter(Boolean);

    if (cleanTo.length === 0) {
      throw new Error('At least one recipient is required');
    }

    // Single-reply constraint validation:
    // If in_reply_to_id is provided, check that the original message exists and has not already been replied to!
    if (data.in_reply_to_id) {
      const parentMsg = this.memoryData.messages.find(m => m.id === data.in_reply_to_id);
      if (!parentMsg) {
        throw new Error(`Original message with ID '${data.in_reply_to_id}' not found`);
      }
      if (parentMsg.has_been_replied_to) {
        throw new Error('This message has already been replied to. Duplicate replies to the same message are prohibited.');
      }
    }

    let targetConv: Conversation | null = null;
    const recipientPhonesToNotify: string[] = [];

    // Extract all recipient phones/identities
    const allRecipientPhones: string[] = [];
    for (const recipient of [...cleanTo, ...cleanCc]) {
      // If email format, extract username part or lookup user
      let phone = '';
      if (recipient.includes('@')) {
        const user = await this.getUserByEmail(recipient);
        if (user) {
          phone = user.phone_number;
        } else {
          // Parse potential phone number from 9876543210@phonemail.com
          const prefix = recipient.split('@')[0];
          phone = normalizePhoneNumber(prefix);
        }
      } else {
        phone = normalizePhoneNumber(recipient);
      }

      if (phone && phone !== sender.phone_number && !allRecipientPhones.includes(phone)) {
        allRecipientPhones.push(phone);
        recipientPhonesToNotify.push(phone);
      }
    }

    // Conversation routing logic:
    if (data.conversation_id) {
      // Replying / composing inside existing conversation
      targetConv = this.memoryData.conversations.find(c => c.id === data.conversation_id) || null;
      if (!targetConv) {
        throw new Error('Specified conversation does not exist');
      }

      // Recipient Rule: Inside an existing conversation, do not allow adding completely new recipients.
      // Recipient fields remain locked to conversation participants.
      const existingParts = this.memoryData.conversation_participants
        .filter(p => p.conversation_id === targetConv!.id)
        .map(p => p.phone_number);

      // Verify that all recipients are existing participants
      for (const phone of allRecipientPhones) {
        if (!existingParts.includes(phone)) {
          throw new Error(`Cannot add new recipient (${phone}) to an existing conversation. Start a new compose action from Home to create a new group conversation.`);
        }
      }
    } else {
      // New compose from Home
      if (allRecipientPhones.length === 0) {
        // Sending to self or external
        allRecipientPhones.push(sender.phone_number);
      }

      if (allRecipientPhones.length === 1) {
        // 1-to-1 conversation rule: reuse or create canonical 1-to-1 thread
        targetConv = await this.getOrCreateDirectConversation(sender.phone_number, allRecipientPhones[0], data.subject);
      } else {
        // Group conversation rule: 2+ recipients selected creates a brand new group conversation!
        targetConv = await this.createGroupConversation([sender.phone_number, ...allRecipientPhones], data.subject);
      }
    }

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const isDraft = Boolean(data.is_draft);

    const newMessage: Message = {
      id: messageId,
      conversation_id: targetConv.id,
      sender_email: sender.email_address,
      sender_phone: sender.phone_number,
      sender_name: sender.display_name,
      to_recipients: cleanTo,
      cc_recipients: cleanCc,
      subject: data.subject || '(No Subject)',
      body_text: data.body_text || '',
      body_html: data.body_html || `<p>${(data.body_text || '').replace(/\n/g, '<br/>')}</p>`,
      in_reply_to_id: data.in_reply_to_id || null,
      has_been_replied_to: false,
      is_draft: isDraft,
      attachments: data.attachments || [],
      created_at: new Date().toISOString()
    };

    this.memoryData.messages.push(newMessage);

    // If this was a reply, mark parent message as replied
    if (data.in_reply_to_id && !isDraft) {
      const parent = this.memoryData.messages.find(m => m.id === data.in_reply_to_id);
      if (parent) {
        parent.has_been_replied_to = true;
      }
    }

    // Update conversation timestamp and subject if needed
    targetConv.updated_at = new Date().toISOString();
    if (!targetConv.subject || targetConv.subject === 'Conversation') {
      targetConv.subject = data.subject || 'Conversation';
    }

    // Update user message states
    if (!isDraft) {
      // For sender: marked as read and sent
      this.memoryData.user_message_states.push({
        user_id: sender.id,
        message_id: messageId,
        is_read: true,
        is_favorite: false,
        is_spam: false,
        is_trash: false,
        is_sent: true
      });

      // For all recipients who are registered users: marked as unread
      for (const rPhone of allRecipientPhones) {
        const rUser = await this.getUserByPhone(rPhone);
        if (rUser && rUser.id !== sender.id) {
          this.memoryData.user_message_states.push({
            user_id: rUser.id,
            message_id: messageId,
            is_read: false,
            is_favorite: false,
            is_spam: false,
            is_trash: false,
            is_sent: false
          });
        }
      }
    } else {
      // Draft state for current user
      this.memoryData.user_message_states.push({
        user_id: sender.id,
        message_id: messageId,
        is_read: true,
        is_favorite: false,
        is_spam: false,
        is_trash: false,
        is_sent: false
      });
    }

    this.persistLocalStore();
    return { message: newMessage, conversation: targetConv, recipientPhonesToNotify };
  }

  // Incoming webhook message from external sender
  async receiveInboundEmail(data: {
    sender_email: string;
    sender_name?: string;
    to_email: string;
    subject: string;
    body_text: string;
    body_html?: string;
    attachments?: Attachment[];
  }): Promise<{ message: Message; conversation: Conversation; recipientUser: User }> {
    const recipientUser = await this.getUserByEmail(data.to_email);
    if (!recipientUser) {
      throw new Error(`Recipient PhoneMail address '${data.to_email}' not found`);
    }

    // External sender phone normalized or pseudo phone
    const senderEmail = data.sender_email.trim().toLowerCase();
    const senderPrefix = senderEmail.split('@')[0];
    const senderPhone = isValidPhoneNumber(senderPrefix) ? normalizePhoneNumber(senderPrefix) : senderEmail;

    // Get or create conversation between recipient and this sender
    const conv = await this.getOrCreateDirectConversation(
      recipientUser.phone_number,
      senderPhone,
      data.subject || 'Incoming Email'
    );

    const messageId = `msg_inbound_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newMessage: Message = {
      id: messageId,
      conversation_id: conv.id,
      sender_email: senderEmail,
      sender_phone: senderPhone,
      sender_name: data.sender_name || senderEmail,
      to_recipients: [data.to_email],
      cc_recipients: [],
      subject: data.subject || '(No Subject)',
      body_text: data.body_text || '',
      body_html: data.body_html || `<p>${data.body_text.replace(/\n/g, '<br/>')}</p>`,
      in_reply_to_id: null,
      has_been_replied_to: false,
      is_draft: false,
      attachments: data.attachments || [],
      created_at: new Date().toISOString()
    };

    this.memoryData.messages.push(newMessage);

    // Set recipient state as unread
    this.memoryData.user_message_states.push({
      user_id: recipientUser.id,
      message_id: messageId,
      is_read: false,
      is_favorite: false,
      is_spam: false,
      is_trash: false,
      is_sent: false
    });

    conv.updated_at = new Date().toISOString();
    this.persistLocalStore();

    return { message: newMessage, conversation: conv, recipientUser };
  }

  // --- Message Actions: Read, Favorite, Spam, Trash ---
  async toggleFavorite(userId: string, messageId: string, state?: boolean): Promise<boolean> {
    let entry = this.memoryData.user_message_states.find(s => s.user_id === userId && s.message_id === messageId);
    if (!entry) {
      entry = {
        user_id: userId,
        message_id: messageId,
        is_read: true,
        is_favorite: true,
        is_spam: false,
        is_trash: false,
        is_sent: false
      };
      this.memoryData.user_message_states.push(entry);
    } else {
      entry.is_favorite = state !== undefined ? state : !entry.is_favorite;
    }
    this.persistLocalStore();
    return entry.is_favorite;
  }

  async setReadState(userId: string, messageId: string, isRead: boolean): Promise<void> {
    let entry = this.memoryData.user_message_states.find(s => s.user_id === userId && s.message_id === messageId);
    if (!entry) {
      entry = {
        user_id: userId,
        message_id: messageId,
        is_read: isRead,
        is_favorite: false,
        is_spam: false,
        is_trash: false,
        is_sent: false
      };
      this.memoryData.user_message_states.push(entry);
    } else {
      entry.is_read = isRead;
    }
    this.persistLocalStore();
  }

  async markConversationRead(userId: string, conversationId: string): Promise<void> {
    const msgs = this.memoryData.messages.filter(m => m.conversation_id === conversationId);
    for (const m of msgs) {
      await this.setReadState(userId, m.id, true);
    }
  }

  async setSpamState(userId: string, messageId: string, isSpam: boolean): Promise<void> {
    let entry = this.memoryData.user_message_states.find(s => s.user_id === userId && s.message_id === messageId);
    if (!entry) {
      entry = {
        user_id: userId,
        message_id: messageId,
        is_read: true,
        is_favorite: false,
        is_spam: isSpam,
        is_trash: false,
        is_sent: false
      };
      this.memoryData.user_message_states.push(entry);
    } else {
      entry.is_spam = isSpam;
      if (isSpam) entry.is_trash = false; // spam overrides trash
    }
    this.persistLocalStore();
  }

  async setTrashState(userId: string, messageId: string, isTrash: boolean): Promise<void> {
    let entry = this.memoryData.user_message_states.find(s => s.user_id === userId && s.message_id === messageId);
    if (!entry) {
      entry = {
        user_id: userId,
        message_id: messageId,
        is_read: true,
        is_favorite: false,
        is_spam: false,
        is_trash: isTrash,
        is_sent: false
      };
      this.memoryData.user_message_states.push(entry);
    } else {
      entry.is_trash = isTrash;
      if (isTrash) entry.is_spam = false;
    }
    this.persistLocalStore();
  }

  async deleteMessagePermanently(userId: string, messageId: string): Promise<boolean> {
    this.memoryData.user_message_states = this.memoryData.user_message_states.filter(
      s => !(s.user_id === userId && s.message_id === messageId)
    );
    this.memoryData.messages = this.memoryData.messages.filter(m => m.id !== messageId);
    this.persistLocalStore();
    return true;
  }

  // --- Draft update ---
  async updateDraft(
    userId: string,
    messageId: string,
    updates: {
      to?: string[];
      cc?: string[];
      subject?: string;
      body_text?: string;
      body_html?: string;
      attachments?: Attachment[];
    }
  ): Promise<Message> {
    const msg = this.memoryData.messages.find(m => m.id === messageId);
    if (!msg) throw new Error('Draft message not found.');
    if (!msg.is_draft) throw new Error('Only draft messages can be edited.');

    const state = this.memoryData.user_message_states.find(
      s => s.user_id === userId && s.message_id === messageId
    );
    if (!state) throw new Error('Unauthorized to edit this draft.');

    if (updates.to) msg.to_recipients = updates.to.map(t => t.trim().toLowerCase()).filter(Boolean);
    if (updates.cc) msg.cc_recipients = updates.cc.map(c => c.trim().toLowerCase()).filter(Boolean);
    if (updates.subject !== undefined) msg.subject = updates.subject || '(No Subject)';
    if (updates.body_text !== undefined) {
      msg.body_text = updates.body_text;
      msg.body_html = updates.body_html || `<p>${updates.body_text.replace(/\n/g, '<br/>')}</p>`;
    }
    if (updates.attachments) msg.attachments = updates.attachments;

    this.persistLocalStore();
    return msg;
  }

  async sendDraft(userId: string, messageId: string): Promise<{
    message: Message;
    conversation: Conversation;
    recipientPhonesToNotify: string[];
  }> {
    const draft = this.memoryData.messages.find(m => m.id === messageId && m.is_draft);
    if (!draft) throw new Error('Draft not found.');

    // Remove draft then recreate as a real send via createMessage
    this.memoryData.messages = this.memoryData.messages.filter(m => m.id !== messageId);
    this.memoryData.user_message_states = this.memoryData.user_message_states.filter(
      s => s.message_id !== messageId
    );
    this.persistLocalStore();

    return this.createMessage({
      sender_user_id: userId,
      conversation_id: draft.conversation_id,
      to: draft.to_recipients,
      cc: draft.cc_recipients,
      subject: draft.subject,
      body_text: draft.body_text,
      body_html: draft.body_html,
      attachments: draft.attachments,
      is_draft: false
    });
  }

  // --- SMS & IVR Logs ---
  async hasSmsForMessage(messageId: string): Promise<boolean> {
    return this.memoryData.sms_notifications.some(s => s.related_message_id === messageId);
  }

  async logSms(sms: Omit<SmsNotification, 'id' | 'created_at'>): Promise<SmsNotification> {
    if (sms.related_message_id) {
      const existing = this.memoryData.sms_notifications.find(
        s => s.related_message_id === sms.related_message_id && s.recipient_phone === sms.recipient_phone
      );
      if (existing) {
        return existing;
      }
    }

    const record: SmsNotification = {
      ...sms,
      id: `sms_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString()
    };
    this.memoryData.sms_notifications.unshift(record);
    if (this.memoryData.sms_notifications.length > 100) {
      this.memoryData.sms_notifications = this.memoryData.sms_notifications.slice(0, 100);
    }
    this.persistLocalStore();
    return record;
  }

  async getSmsLogs(): Promise<SmsNotification[]> {
    return this.memoryData.sms_notifications;
  }

  async logIvr(log: Omit<IvrLog, 'id' | 'created_at'>): Promise<IvrLog> {
    const record: IvrLog = {
      ...log,
      id: `ivr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      created_at: new Date().toISOString()
    };
    this.memoryData.ivr_logs.unshift(record);
    this.persistLocalStore();
    return record;
  }

  // Reset database to seed
  resetData(seed: DatabaseSchema) {
    this.memoryData = seed;
    this.persistLocalStore();
  }

  getData(): DatabaseSchema {
    return this.memoryData;
  }
}

export const db = new RelationalDatabase();
