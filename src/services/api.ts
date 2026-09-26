import { User, Conversation, Message, Alias, SmsNotification, FolderType, Attachment, UserSummary } from '../types.ts';

const TOKEN_KEY = 'phonemail_auth_token';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (!response.ok) {
      let errMsg = `Request failed with status ${response.status}`;
      try {
        const data = await response.json();
        if (data.error) errMsg = data.error;
      } catch (e) {
        // ignore
      }
      throw new Error(errMsg);
    }

    return response.json();
  }

  // Auth endpoints
  async requestOtp(
    phone: string,
    purpose?: 'login' | 'register'
  ): Promise<{ success: boolean; message: string; demoCode?: string; demoHint?: string }> {
    return this.request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, purpose })
    });
  }

  async registerAccount(data: {
    username: string;
    password: string;
    confirmPassword: string;
    phone: string;
    displayName?: string;
  }): Promise<{ success: boolean; message: string; username: string; emailAddress: string; phoneNumber: string }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async login(username: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setToken(res.token);
    return res;
  }

  async verifyOtp(phone: string, otp: string, displayName?: string): Promise<{ token: string; user: User; isNewUser: boolean }> {
    const res = await this.request<{ token: string; user: User; isNewUser: boolean }>('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, displayName })
    });
    this.setToken(res.token);
    return res;
  }

  async passwordLogin(phone: string, password: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/api/auth/password-login', {
      method: 'POST',
      body: JSON.stringify({ phone, password })
    });
    this.setToken(res.token);
    return res;
  }

  async searchUsers(query: string): Promise<UserSummary[]> {
    const params = new URLSearchParams({ q: query });
    return this.request<UserSummary[]>(`/api/users/search?${params.toString()}`);
  }

  async openConversationWithUser(username: string): Promise<{
    conversation: Conversation;
    messages: Message[];
    recipient: UserSummary;
  }> {
    return this.request('/api/conversations/with-user', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  }

  async setPassword(password: string): Promise<{ success: boolean }> {
    return this.request('/api/auth/set-password', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }

  async getMe(): Promise<User> {
    return this.request<User>('/api/auth/me');
  }

  async updateProfile(updates: { displayName?: string; avatarUrl?: string; language?: string }): Promise<{ user: User }> {
    return this.request('/api/user/profile', {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  // Alias endpoints
  async getAliases(): Promise<Alias[]> {
    return this.request<Alias[]>('/api/aliases');
  }

  async createAlias(aliasName: string): Promise<Alias> {
    return this.request<Alias>('/api/aliases', {
      method: 'POST',
      body: JSON.stringify({ aliasName })
    });
  }

  async deleteAlias(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/aliases/${id}`, {
      method: 'DELETE'
    });
  }

  // Conversations & Messages
  async getConversations(folder: FolderType = 'inbox', search = ''): Promise<Conversation[]> {
    const params = new URLSearchParams({ folder, search });
    return this.request<Conversation[]>(`/api/conversations?${params.toString()}`);
  }

  async getConversationDetails(id: string): Promise<{ conversation: Conversation; messages: Message[] }> {
    return this.request(`/api/conversations/${id}`);
  }

  async composeMessage(data: {
    to: string[];
    cc?: string[];
    subject: string;
    bodyText: string;
    bodyHtml?: string;
    conversationId?: string;
    inReplyToId?: string | null;
    isDraft?: boolean;
    attachments?: Attachment[];
  }): Promise<{ message: Message; conversation: Conversation }> {
    return this.request('/api/messages/compose', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateDraft(
    draftId: string,
    data: {
      to?: string[];
      cc?: string[];
      subject?: string;
      bodyText?: string;
      bodyHtml?: string;
      attachments?: Attachment[];
    }
  ): Promise<{ success: boolean; message: Message }> {
    return this.request(`/api/messages/drafts/${draftId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async sendDraft(draftId: string): Promise<{ message: Message; conversation: Conversation }> {
    return this.request(`/api/messages/drafts/${draftId}/send`, {
      method: 'POST'
    });
  }

  async forwardMessage(data: {
    messageId: string;
    conversationId: string;
    to: string[];
    subject?: string;
    bodyText?: string;
  }): Promise<{ message: Message; conversation: Conversation }> {
    return this.request('/api/messages/forward', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async uploadAttachment(file: {
    name: string;
    type: string;
    size: number;
    dataUrl: string;
  }): Promise<Attachment> {
    return this.request('/api/attachments/upload', {
      method: 'POST',
      body: JSON.stringify(file)
    });
  }

  async replyMessage(data: {
    messageId: string;
    conversationId: string;
    bodyText: string;
    bodyHtml?: string;
    attachments?: Attachment[];
  }): Promise<{ message: Message; conversation: Conversation }> {
    return this.request('/api/messages/reply', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async toggleFavorite(messageId: string, isFavorite?: boolean): Promise<{ success: boolean; isFavorite: boolean }> {
    return this.request(`/api/messages/${messageId}/favorite`, {
      method: 'POST',
      body: JSON.stringify({ isFavorite })
    });
  }

  async setReadState(messageId: string, isRead: boolean): Promise<{ success: boolean; isRead: boolean }> {
    return this.request(`/api/messages/${messageId}/read`, {
      method: 'POST',
      body: JSON.stringify({ isRead })
    });
  }

  async markConversationRead(conversationId: string): Promise<{ success: boolean }> {
    return this.request(`/api/conversations/${conversationId}/read`, {
      method: 'POST'
    });
  }

  async setSpam(messageId: string, isSpam: boolean): Promise<{ success: boolean; isSpam: boolean }> {
    return this.request(`/api/messages/${messageId}/spam`, {
      method: 'POST',
      body: JSON.stringify({ isSpam })
    });
  }

  async setTrash(messageId: string, isTrash: boolean): Promise<{ success: boolean; isTrash: boolean }> {
    return this.request(`/api/messages/${messageId}/trash`, {
      method: 'POST',
      body: JSON.stringify({ isTrash })
    });
  }

  async deletePermanently(messageId: string): Promise<{ success: boolean }> {
    return this.request(`/api/messages/${messageId}`, {
      method: 'DELETE'
    });
  }

  // Webhook and Telephony Simulators
  async simulateIncomingEmail(data: {
    from: string;
    senderName?: string;
    to: string;
    subject: string;
    text: string;
    attachments?: Attachment[];
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/api/emails/webhook/incoming', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async simulateIvr(callerPhone: string, digit = '1'): Promise<{
    success: boolean;
    callerPhone: string;
    digitPressed: string;
    accountCreated: boolean;
    user?: any;
    twimlResponse: string;
  }> {
    return this.request('/api/ivr/simulate', {
      method: 'POST',
      body: JSON.stringify({ callerPhone, digit })
    });
  }

  async getSmsLogs(): Promise<SmsNotification[]> {
    return this.request<SmsNotification[]>('/api/sms/logs');
  }

  async resetSeed(): Promise<{ success: boolean }> {
    return this.request('/api/seed/reset', {
      method: 'POST'
    });
  }
}

export const api = new ApiService();
