export interface User {
  id: string;
  username?: string; // unique login handle, e.g. "alice"
  phone_number: string; // e.g. "9876543210"
  email_address: string; // e.g. "9876543210@phonemail.com"
  password_hash?: string;
  display_name: string;
  avatar_url?: string;
  language: string; // 'en' | 'es' | 'hi' | 'fr'
  created_at: string;
  updated_at: string;
}

export interface OtpRecord {
  id: string;
  phone_number: string;
  /** HMAC hash of the OTP — plaintext is never persisted */
  code: string;
  expires_at: number;
  attempts: number;
  verified: boolean;
}

export interface Alias {
  id: string;
  user_id: string;
  alias_email: string;
  created_at: string;
  is_active: boolean;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  subject: string;
  participant_phone_keys: string; // sorted colon-separated list of normalized phones
  created_at: string;
  updated_at: string;
  // Dynamic computed fields for queries:
  latest_message?: Message;
  unread_count?: number;
  participants?: UserSummary[];
  is_favorite?: boolean;
  is_spam?: boolean;
  is_trash?: boolean;
}

export interface UserSummary {
  id: string;
  username?: string;
  phone_number: string;
  email_address: string;
  display_name: string;
  avatar_url?: string;
}

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  url: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_email: string;
  sender_phone?: string;
  sender_name: string;
  to_recipients: string[];
  cc_recipients: string[];
  subject: string;
  body_text: string;
  body_html?: string;
  in_reply_to_id?: string | null;
  has_been_replied_to?: boolean;
  is_draft: boolean;
  attachments: Attachment[];
  created_at: string;
  // User-specific state:
  is_read?: boolean;
  is_favorite?: boolean;
  is_spam?: boolean;
  is_trash?: boolean;
}

export interface UserMessageState {
  user_id: string;
  message_id: string;
  is_read: boolean;
  is_favorite: boolean;
  is_spam: boolean;
  is_trash: boolean;
  is_sent: boolean;
}

export interface SmsNotification {
  id: string;
  recipient_phone: string;
  message_body: string;
  sender_email: string;
  subject: string;
  status: 'sent' | 'simulated' | 'failed';
  provider: string;
  created_at: string;
  error_message?: string;
  /** Deduplication key — one SMS per inbound/outbound message */
  related_message_id?: string;
}

export interface IvrLog {
  id: string;
  caller_phone: string;
  digit_pressed: string;
  result_account_created: boolean;
  created_at: string;
}
