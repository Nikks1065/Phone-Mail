export interface User {
  id: string;
  username: string;
  phoneNumber: string;
  emailAddress: string;
  displayName: string;
  avatarUrl?: string;
  language: string;
  createdAt: string;
  hasPassword?: boolean;
  aliases: Alias[];
}

export interface Alias {
  id: string;
  user_id: string;
  alias_email: string;
  created_at: string;
  is_active: boolean;
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
  is_read?: boolean;
  is_favorite?: boolean;
  is_spam?: boolean;
  is_trash?: boolean;
}

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  subject: string;
  participant_phone_keys: string;
  created_at: string;
  updated_at: string;
  latest_message?: Message;
  unread_count?: number;
  participants?: UserSummary[];
  is_favorite?: boolean;
  is_spam?: boolean;
  is_trash?: boolean;
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
}

export type FolderType = 'inbox' | 'unread' | 'favorites' | 'attachments' | 'spam' | 'trash' | 'drafts';

export type ViewportMode = 'responsive' | 'mobile' | 'desktop';
