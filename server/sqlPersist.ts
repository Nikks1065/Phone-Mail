/**
 * SQL persistence layer for PhoneMail.
 * - DATABASE_URL (postgres…) → real PostgreSQL via `pg`
 * - otherwise → embedded PGlite (Postgres-compatible) at .data/pglite
 *
 * Application reads/writes go through SQL-backed tables.
 */

import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import type {
  User,
  OtpRecord,
  Alias,
  Conversation,
  Message,
  UserMessageState,
  SmsNotification,
  IvrLog
} from './types.ts';

export interface DatabaseSchema {
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

export function emptySchema(): DatabaseSchema {
  return {
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
}

interface SqlClient {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  close?: () => Promise<void>;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(64) UNIQUE,
  phone_number VARCHAR(32) UNIQUE NOT NULL,
  email_address VARCHAR(128) UNIQUE NOT NULL,
  password_hash VARCHAR(256),
  display_name VARCHAR(128) NOT NULL,
  avatar_url TEXT,
  language VARCHAR(16) DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`,
  `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone_number)`,
  `CREATE TABLE IF NOT EXISTS otps (
  id VARCHAR(64) PRIMARY KEY,
  phone_number VARCHAR(32) NOT NULL,
  code VARCHAR(128) NOT NULL,
  expires_at BIGINT NOT NULL,
  attempts INT DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE
)`,
  `CREATE TABLE IF NOT EXISTS aliases (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  alias_email VARCHAR(128) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
)`,
  `CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(16) NOT NULL DEFAULT 'direct',
  subject VARCHAR(256) NOT NULL,
  participant_phone_keys VARCHAR(256) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`,
  `CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id VARCHAR(64) REFERENCES conversations(id) ON DELETE CASCADE,
  phone_number VARCHAR(32) NOT NULL,
  user_id VARCHAR(64),
  PRIMARY KEY (conversation_id, phone_number)
)`,
  `CREATE TABLE IF NOT EXISTS messages (
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
)`,
  `CREATE TABLE IF NOT EXISTS user_message_states (
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  message_id VARCHAR(64) REFERENCES messages(id) ON DELETE CASCADE,
  is_read BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_spam BOOLEAN DEFAULT FALSE,
  is_trash BOOLEAN DEFAULT FALSE,
  is_sent BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (user_id, message_id)
)`,
  `CREATE TABLE IF NOT EXISTS sms_notifications (
  id VARCHAR(64) PRIMARY KEY,
  recipient_phone VARCHAR(32) NOT NULL,
  message_body TEXT NOT NULL,
  sender_email VARCHAR(128) NOT NULL,
  subject VARCHAR(256) NOT NULL,
  status VARCHAR(32) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message TEXT,
  related_message_id VARCHAR(64)
)`,
  `CREATE TABLE IF NOT EXISTS ivr_logs (
  id VARCHAR(64) PRIMARY KEY,
  caller_phone VARCHAR(32) NOT NULL,
  digit_pressed VARCHAR(8) NOT NULL,
  result_account_created BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`
];

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export class SqlPersist {
  private client: SqlClient | null = null;
  private ready: Promise<void>;
  private mode: 'postgres' | 'pglite' = 'pglite';

  constructor() {
    this.ready = this.init();
  }

  getMode(): string {
    return this.mode;
  }

  async waitReady(): Promise<void> {
    await this.ready;
  }

  private async init(): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL || '';
    if (databaseUrl.startsWith('postgres')) {
      try {
        const pool = new pg.Pool({
          connectionString: databaseUrl,
          connectionTimeoutMillis: 5000
        });
        await pool.query('SELECT 1');
        this.client = {
          query: async (text, params = []) => {
            const result = await pool.query(text, params);
            return { rows: result.rows as Record<string, unknown>[] };
          },
          close: async () => {
            await pool.end();
          }
        };
        this.mode = 'postgres';
        for (const stmt of SCHEMA_STATEMENTS) {
          await this.client.query(stmt);
        }
        await this.client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64)`);
        console.log('[DB] Connected to PostgreSQL');
        return;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn('[DB] PostgreSQL unavailable, falling back to PGlite:', message);
      }
    }

    const dataDir = path.resolve(process.cwd(), '.data', 'pglite');
    if (!fs.existsSync(path.dirname(dataDir))) {
      fs.mkdirSync(path.dirname(dataDir), { recursive: true });
    }
    const pglite = new PGlite(dataDir);
    await pglite.waitReady;
    this.client = {
      query: async (text, params = []) => {
        const result = await pglite.query(text, params as never[]);
        return { rows: (result.rows || []) as Record<string, unknown>[] };
      }
    };
    this.mode = 'pglite';
    for (const stmt of SCHEMA_STATEMENTS) {
      await this.client.query(stmt);
    }
    console.log('[DB] Using embedded PGlite at', dataDir);
  }

  private q(text: string, params: unknown[] = []) {
    if (!this.client) throw new Error('Database not initialized');
    return this.client.query(text, params);
  }

  async loadAll(): Promise<DatabaseSchema> {
    await this.ready;
    const schema = emptySchema();

    const users = await this.q('SELECT * FROM users ORDER BY created_at ASC');
    schema.users = users.rows.map((r) => ({
      id: String(r.id),
      username: r.username ? String(r.username) : undefined,
      phone_number: String(r.phone_number),
      email_address: String(r.email_address),
      password_hash: r.password_hash ? String(r.password_hash) : undefined,
      display_name: String(r.display_name),
      avatar_url: r.avatar_url ? String(r.avatar_url) : '',
      language: String(r.language || 'en'),
      created_at: toIso(r.created_at),
      updated_at: toIso(r.updated_at)
    }));

    const otps = await this.q('SELECT * FROM otps');
    schema.otps = otps.rows.map((r) => ({
      id: String(r.id),
      phone_number: String(r.phone_number),
      code: String(r.code),
      expires_at: Number(r.expires_at),
      attempts: Number(r.attempts || 0),
      verified: Boolean(r.verified)
    }));

    const aliases = await this.q('SELECT * FROM aliases');
    schema.aliases = aliases.rows.map((r) => ({
      id: String(r.id),
      user_id: String(r.user_id),
      alias_email: String(r.alias_email),
      created_at: toIso(r.created_at),
      is_active: Boolean(r.is_active)
    }));

    const conversations = await this.q('SELECT * FROM conversations');
    schema.conversations = conversations.rows.map((r) => ({
      id: String(r.id),
      type: (r.type === 'group' ? 'group' : 'direct') as 'direct' | 'group',
      subject: String(r.subject),
      participant_phone_keys: String(r.participant_phone_keys),
      created_at: toIso(r.created_at),
      updated_at: toIso(r.updated_at)
    }));

    const parts = await this.q('SELECT * FROM conversation_participants');
    schema.conversation_participants = parts.rows.map((r) => ({
      conversation_id: String(r.conversation_id),
      phone_number: String(r.phone_number),
      user_id: r.user_id ? String(r.user_id) : undefined
    }));

    const messages = await this.q('SELECT * FROM messages ORDER BY created_at ASC');
    schema.messages = messages.rows.map((r) => ({
      id: String(r.id),
      conversation_id: String(r.conversation_id),
      sender_email: String(r.sender_email),
      sender_phone: r.sender_phone ? String(r.sender_phone) : undefined,
      sender_name: String(r.sender_name),
      to_recipients: parseJsonField<string[]>(r.to_recipients, []),
      cc_recipients: parseJsonField<string[]>(r.cc_recipients, []),
      subject: String(r.subject),
      body_text: String(r.body_text),
      body_html: r.body_html ? String(r.body_html) : undefined,
      in_reply_to_id: r.in_reply_to_id ? String(r.in_reply_to_id) : null,
      has_been_replied_to: Boolean(r.has_been_replied_to),
      is_draft: Boolean(r.is_draft),
      attachments: parseJsonField(r.attachments, []),
      created_at: toIso(r.created_at)
    }));

    const states = await this.q('SELECT * FROM user_message_states');
    schema.user_message_states = states.rows.map((r) => ({
      user_id: String(r.user_id),
      message_id: String(r.message_id),
      is_read: Boolean(r.is_read),
      is_favorite: Boolean(r.is_favorite),
      is_spam: Boolean(r.is_spam),
      is_trash: Boolean(r.is_trash),
      is_sent: Boolean(r.is_sent)
    }));

    const sms = await this.q('SELECT * FROM sms_notifications ORDER BY created_at DESC');
    schema.sms_notifications = sms.rows.map((r) => ({
      id: String(r.id),
      recipient_phone: String(r.recipient_phone),
      message_body: String(r.message_body),
      sender_email: String(r.sender_email),
      subject: String(r.subject),
      status: r.status as SmsNotification['status'],
      provider: String(r.provider),
      created_at: toIso(r.created_at),
      error_message: r.error_message ? String(r.error_message) : undefined,
      related_message_id: r.related_message_id ? String(r.related_message_id) : undefined
    }));

    const ivr = await this.q('SELECT * FROM ivr_logs ORDER BY created_at DESC');
    schema.ivr_logs = ivr.rows.map((r) => ({
      id: String(r.id),
      caller_phone: String(r.caller_phone),
      digit_pressed: String(r.digit_pressed),
      result_account_created: Boolean(r.result_account_created),
      created_at: toIso(r.created_at)
    }));

    console.log(
      `[DB] Loaded SQL store (${this.mode}): ${schema.users.length} users, ${schema.conversations.length} conversations, ${schema.messages.length} messages`
    );
    return schema;
  }

  async saveAll(data: DatabaseSchema): Promise<void> {
    await this.ready;

    // Full replace in a transaction for consistency
    await this.q('BEGIN');
    try {
      await this.q('DELETE FROM user_message_states');
      await this.q('DELETE FROM messages');
      await this.q('DELETE FROM conversation_participants');
      await this.q('DELETE FROM conversations');
      await this.q('DELETE FROM aliases');
      await this.q('DELETE FROM otps');
      await this.q('DELETE FROM sms_notifications');
      await this.q('DELETE FROM ivr_logs');
      await this.q('DELETE FROM users');

      for (const u of data.users) {
        await this.q(
          `INSERT INTO users (id, username, phone_number, email_address, password_hash, display_name, avatar_url, language, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            u.id,
            u.username || null,
            u.phone_number,
            u.email_address,
            u.password_hash || null,
            u.display_name,
            u.avatar_url || null,
            u.language || 'en',
            u.created_at,
            u.updated_at
          ]
        );
      }

      for (const o of data.otps) {
        await this.q(
          `INSERT INTO otps (id, phone_number, code, expires_at, attempts, verified) VALUES ($1,$2,$3,$4,$5,$6)`,
          [o.id, o.phone_number, o.code, o.expires_at, o.attempts, o.verified]
        );
      }

      for (const a of data.aliases) {
        await this.q(
          `INSERT INTO aliases (id, user_id, alias_email, created_at, is_active) VALUES ($1,$2,$3,$4,$5)`,
          [a.id, a.user_id, a.alias_email, a.created_at, a.is_active]
        );
      }

      for (const c of data.conversations) {
        await this.q(
          `INSERT INTO conversations (id, type, subject, participant_phone_keys, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6)`,
          [c.id, c.type, c.subject, c.participant_phone_keys, c.created_at, c.updated_at]
        );
      }

      for (const p of data.conversation_participants) {
        await this.q(
          `INSERT INTO conversation_participants (conversation_id, phone_number, user_id) VALUES ($1,$2,$3)`,
          [p.conversation_id, p.phone_number, p.user_id || null]
        );
      }

      for (const m of data.messages) {
        await this.q(
          `INSERT INTO messages (
            id, conversation_id, sender_email, sender_phone, sender_name, to_recipients, cc_recipients,
            subject, body_text, body_html, in_reply_to_id, has_been_replied_to, is_draft, attachments, created_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            m.id,
            m.conversation_id,
            m.sender_email,
            m.sender_phone || null,
            m.sender_name,
            JSON.stringify(m.to_recipients || []),
            JSON.stringify(m.cc_recipients || []),
            m.subject,
            m.body_text,
            m.body_html || null,
            m.in_reply_to_id || null,
            Boolean(m.has_been_replied_to),
            Boolean(m.is_draft),
            JSON.stringify(m.attachments || []),
            m.created_at
          ]
        );
      }

      for (const s of data.user_message_states) {
        await this.q(
          `INSERT INTO user_message_states (user_id, message_id, is_read, is_favorite, is_spam, is_trash, is_sent)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [s.user_id, s.message_id, s.is_read, s.is_favorite, s.is_spam, s.is_trash, s.is_sent]
        );
      }

      for (const s of data.sms_notifications) {
        await this.q(
          `INSERT INTO sms_notifications (id, recipient_phone, message_body, sender_email, subject, status, provider, created_at, error_message, related_message_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            s.id,
            s.recipient_phone,
            s.message_body,
            s.sender_email,
            s.subject,
            s.status,
            s.provider,
            s.created_at,
            s.error_message || null,
            s.related_message_id || null
          ]
        );
      }

      for (const i of data.ivr_logs) {
        await this.q(
          `INSERT INTO ivr_logs (id, caller_phone, digit_pressed, result_account_created, created_at) VALUES ($1,$2,$3,$4,$5)`,
          [i.id, i.caller_phone, i.digit_pressed, i.result_account_created, i.created_at]
        );
      }

      await this.q('COMMIT');
    } catch (err) {
      await this.q('ROLLBACK').catch(() => undefined);
      throw err;
    }
  }
}

export const sqlPersist = new SqlPersist();
