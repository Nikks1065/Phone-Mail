import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Conversation, Message, FolderType, UserSummary } from '../../types.ts';
import { UserSearch } from '../common/UserSearch.tsx';
import {
  Inbox,
  Star,
  FileEdit,
  AlertOctagon,
  Trash2,
  Search,
  Plus,
  Paperclip,
  Send,
  CornerUpLeft,
  MoreHorizontal,
  Mail,
  Users,
  Shield,
  RefreshCw,
  Archive,
  ArrowLeft,
  CheckCircle,
  Clock,
  ExternalLink,
  ChevronDown,
  Forward,
  RotateCcw
} from 'lucide-react';

interface DesktopAppProps {
  onOpenCompose: (conversationId?: string, to?: string[], isLocked?: boolean) => void;
  onOpenSettings: () => void;
}

export const DesktopApp: React.FC<DesktopAppProps> = ({ onOpenCompose, onOpenSettings }) => {
  const { user } = useAuth();

  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'attachments' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);

  // Reply box state in detail view
  const [replyText, setReplyText] = useState<string>('');
  const [targetReplyMessage, setTargetReplyMessage] = useState<Message | null>(null);
  const [replyError, setReplyError] = useState<string>('');
  const [replyLoading, setReplyLoading] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      let queryFolder: FolderType = activeFolder;
      if (activeFolder === 'inbox') {
        if (activeFilter === 'unread') queryFolder = 'unread';
        if (activeFilter === 'favorites') queryFolder = 'favorites';
        if (activeFilter === 'attachments') queryFolder = 'attachments';
      }

      const data = await api.getConversations(queryFolder, searchQuery);
      setConversations(data);

      // If active selection no longer exists in current folder, clear it
      if (selectedConversation && !data.some(c => c.id === selectedConversation.id)) {
        setSelectedConversation(null);
      }
    } catch (err) {
      console.warn('Failed to load desktop conversations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [activeFolder, activeFilter, searchQuery]);

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setReplyError('');
    setReplyText('');
    setTargetReplyMessage(null);

    try {
      const details = await api.getConversationDetails(conv.id);
      setConversationMessages(details.messages);

      // Default target reply message to the last incoming message
      const incomingMsgs = details.messages.filter(m => m.sender_email !== user?.emailAddress);
      if (incomingMsgs.length > 0) {
        setTargetReplyMessage(incomingMsgs[incomingMsgs.length - 1]);
      } else if (details.messages.length > 0) {
        setTargetReplyMessage(details.messages[details.messages.length - 1]);
      }

      await api.markConversationRead(conv.id);
    } catch (err) {
      console.warn('Failed to load conversation thread', err);
    }
  };

  const handleToggleFavorite = async (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!conv.latest_message) return;

    try {
      await api.toggleFavorite(conv.latest_message.id);
      fetchConversations();
      if (selectedConversation?.id === conv.id) {
        const details = await api.getConversationDetails(conv.id);
        setConversationMessages(details.messages);
      }
    } catch (err) {
      console.warn('Toggle favorite error', err);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedConversation) return;

    setReplyError('');
    setReplyLoading(true);

    try {
      if (targetReplyMessage) {
        // Enforce strict single-reply rule
        await api.replyMessage({
          messageId: targetReplyMessage.id,
          conversationId: selectedConversation.id,
          bodyText: replyText
        });
      } else {
        // Compose in conversation context
        const toEmails = selectedConversation.participants
          ? selectedConversation.participants
              .filter(p => p.email_address !== user?.emailAddress)
              .map(p => p.email_address)
          : [];

        await api.composeMessage({
          conversationId: selectedConversation.id,
          to: toEmails.length > 0 ? toEmails : [selectedConversation.participants?.[0]?.email_address || ''],
          subject: selectedConversation.subject,
          bodyText: replyText
        });
      }

      setReplyText('');
      // Reload thread
      const details = await api.getConversationDetails(selectedConversation.id);
      setConversationMessages(details.messages);
      fetchConversations();
    } catch (err: any) {
      console.warn('[DESKTOP REPLY] Error:', err.message);
      setReplyError(err.message || 'Failed to send reply');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleMoveToSpam = async (conv: Conversation) => {
    if (!conv.latest_message) return;
    try {
      await api.setSpam(conv.latest_message.id, true);
      setSelectedConversation(null);
      fetchConversations();
    } catch (err) {
      console.warn('Spam error', err);
    }
  };

  const handleMoveToTrash = async (conv: Conversation) => {
    if (!conv.latest_message) return;
    try {
      await api.setTrash(conv.latest_message.id, true);
      setSelectedConversation(null);
      fetchConversations();
    } catch (err) {
      console.warn('Trash error', err);
    }
  };

  const handleRestoreFromTrash = async (conv: Conversation) => {
    if (!conv.latest_message) return;
    try {
      await api.setTrash(conv.latest_message.id, false);
      await api.setSpam(conv.latest_message.id, false);
      setSelectedConversation(null);
      fetchConversations();
    } catch (err) {
      console.warn('Restore error', err);
    }
  };

  const handleForward = (msg: Message) => {
    const prefillBody = `\n\n---------- Forwarded message ----------\nFrom: ${msg.sender_name} <${msg.sender_email}>\nDate: ${msg.created_at}\nSubject: ${msg.subject}\n\n${msg.body_text}`;
    window.dispatchEvent(
      new CustomEvent('phonemail:forward', {
        detail: {
          subject: msg.subject.startsWith('Fwd:') ? msg.subject : `Fwd: ${msg.subject}`,
          body: prefillBody,
          messageId: msg.id,
          conversationId: msg.conversation_id
        }
      })
    );
  };

  const handleMarkUnread = async (msg: Message) => {
    try {
      await api.setReadState(msg.id, false);
      fetchConversations();
    } catch (err) {
      console.warn('Mark unread error', err);
    }
  };

  const handleSelectUsername = async (selected: UserSummary) => {
    if (!selected.username) return;
    try {
      const res = await api.openConversationWithUser(selected.username);
      setSelectedConversation(res.conversation);
      setConversationMessages(res.messages);
      fetchConversations();
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : 'Could not open conversation');
    }
  };

  return (
    <div className="flex h-[calc(100vh-53px)] bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100">
      {/* 1. Left Sidebar Navigation (Gmail Style) */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 p-3">
        <div className="space-y-4">
          {/* Prominent "+ Compose" Pill Button */}
          <button
            onClick={() => onOpenCompose()}
            className="w-full py-3 px-5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 hover:shadow-md text-slate-800 dark:text-slate-100 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all shadow-xs"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <span>Compose</span>
          </button>

          <div className="space-y-1">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-1">New chat by username</div>
            <UserSearch onSelectUser={handleSelectUsername} />
          </div>

          {/* Folder Navigation Menu */}
          <nav className="space-y-0.5 text-xs font-medium">
            {[
              { id: 'inbox', label: 'Inbox (Home)', icon: Inbox, count: conversations.filter(c => (c.unread_count || 0) > 0).length },
              { id: 'favorites', label: 'Starred (Favorites)', icon: Star },
              { id: 'drafts', label: 'Drafts', icon: FileEdit },
              { id: 'spam', label: 'Spam', icon: AlertOctagon },
              { id: 'trash', label: 'Trash', icon: Trash2 }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeFolder === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveFolder(item.id as any);
                    setActiveFilter('all');
                    setSelectedConversation(null);
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-r-full flex items-center justify-between transition-colors ${
                    isActive
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 font-bold border-l-4 border-emerald-600'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-emerald-600' : 'text-slate-400 dark:text-slate-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-900/60 px-2 py-0.5 rounded-full">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Identity & Aliases Card */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-1.5">
          <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3 text-emerald-600" />
            <span>Active Phone Identity</span>
          </div>
          <div className="font-bold text-slate-800 dark:text-slate-200 truncate">+{user?.phoneNumber}</div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-mono font-medium truncate">
            {user?.emailAddress}
          </div>
          {user?.aliases && user.aliases.length > 0 && (
            <div className="text-[10px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-200 dark:border-slate-700">
              +{user.aliases.length} active alias address
            </div>
          )}
        </div>
      </aside>

      {/* 2. Middle Email List & Top Search Section */}
      <section className="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Top Search & Filter Bar */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-2.5 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="flex-1 relative flex items-center">
              <Search className="w-4 h-4 absolute left-3.5 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search mail by sender, recipient, subject, or message content..."
                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 focus:bg-white dark:focus:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />
            </div>

            <button
              onClick={fetchConversations}
              disabled={loading}
              title="Refresh messages"
              className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Interactive Filter Segmented Buttons */}
          {activeFolder === 'inbox' && (
            <div className="flex items-center gap-1.5">
              {[
                { id: 'all', label: 'All Messages' },
                { id: 'unread', label: 'Unread' },
                { id: 'attachments', label: 'Has Attachments' },
                { id: 'favorites', label: 'Starred' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as any)}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    activeFilter === f.id
                      ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Email Rows List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {conversations.length === 0 ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-xs px-4">
              No conversations found in {activeFolder}. Try clearing search filters or compose a new email.
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              const hasUnread = conv.unread_count && conv.unread_count > 0;
              const otherParticipants = conv.participants?.filter(p => p.id !== user?.id) || [];
              const primaryContact = otherParticipants[0] || conv.participants?.[0];
              const latest = conv.latest_message;

              return (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-l-4 border-emerald-600'
                      : hasUnread
                      ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 font-bold'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {/* Star Toggle */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(conv, e)}
                    className="text-slate-300 dark:text-slate-600 hover:text-amber-400 transition-colors p-0.5 shrink-0"
                  >
                    <Star
                      className={`w-4 h-4 ${conv.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`}
                    />
                  </button>

                  {/* Sender Name & PhoneMail Badge */}
                  <div className="w-48 shrink-0 truncate flex items-center gap-1.5">
                    <span
                      className={`text-xs truncate ${
                        hasUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {primaryContact?.username
                        ? `@${primaryContact.username}`
                        : primaryContact?.display_name || conv.subject}
                    </span>
                    {conv.type === 'group' && (
                      <span className="text-[10px] text-slate-400">
                        <Users className="w-3 h-3 inline" />
                      </span>
                    )}
                  </div>

                  {/* Subject & Preview Snippet */}
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <span
                      className={`text-xs truncate max-w-[200px] ${
                        hasUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-semibold text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {conv.subject}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 font-normal">
                      {latest?.body_text || 'No message preview'}
                    </span>
                  </div>

                  {/* Right Meta (Attachments, Time) */}
                  <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {latest?.attachments && latest.attachments.length > 0 && (
                      <Paperclip className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    )}
                    <span>
                      {latest
                        ? new Date(latest.created_at).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric'
                          })
                        : ''}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 3. Right Email Thread & Details Pane */}
      <section className="w-[520px] lg:w-[620px] xl:w-[720px] bg-slate-50 dark:bg-slate-950 flex flex-col shrink-0 border-l border-slate-200 dark:border-slate-800">
        {selectedConversation ? (
          <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {/* Detail Top Action Bar */}
            <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                  title="Close detail view"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleMoveToSpam(selectedConversation)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                  title="Move to Spam"
                >
                  <AlertOctagon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleMoveToTrash(selectedConversation)}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
                  title="Move to Trash"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {(activeFolder === 'trash' || activeFolder === 'spam') && (
                  <button
                    onClick={() => handleRestoreFromTrash(selectedConversation)}
                    className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 rounded-lg transition-colors"
                    title="Restore to Inbox"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const toList = selectedConversation.participants
                      ?.filter(p => p.email_address !== user?.emailAddress)
                      .map(p => p.email_address) || [];
                    onOpenCompose(selectedConversation.id, toList, true);
                  }}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Full Composer</span>
                </button>
              </div>
            </div>

            {/* Conversation Subject Title */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                {selectedConversation.subject}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-700 dark:text-slate-300">Participants:</span>
                <span className="font-mono">
                  {selectedConversation.participants?.map(p => p.email_address).join(', ')}
                </span>
              </div>
            </div>

            {/* Message Thread Chain (Gmail Style Accordion / Cards) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversationMessages.map((msg, index) => {
                const isUser = msg.sender_email === user?.emailAddress;
                return (
                  <div
                    key={msg.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 shadow-xs space-y-3"
                  >
                    {/* Message Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs">
                          {msg.sender_name ? msg.sender_name.charAt(0).toUpperCase() : 'M'}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                            <span>{msg.sender_name}</span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono font-normal">
                              &lt;{msg.sender_email}&gt;
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            to: {msg.to_recipients.join(', ')}
                          </div>
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {new Date(msg.created_at).toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short'
                        })}
                      </div>
                    </div>

                    {/* In reply to indication */}
                    {msg.in_reply_to_id && (
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5 font-medium">
                        <CornerUpLeft className="w-3.5 h-3.5" />
                        <span>In reply to earlier thread message</span>
                      </div>
                    )}

                    {/* Body Text */}
                    <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                      {msg.body_text}
                    </div>

                    {/* Attachments */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs flex items-center gap-2 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="font-medium">{att.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-400">
                              ({Math.round(att.size / 1024)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Card Footer Actions */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          disabled={msg.has_been_replied_to}
                          onClick={() => {
                            if (msg.has_been_replied_to) {
                              setReplyError('This message has already been replied to. Duplicate replies are rejected by backend constraints.');
                              return;
                            }
                            setTargetReplyMessage(msg);
                            setReplyError('');
                          }}
                          className={`text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold flex items-center gap-1 transition-colors ${
                            msg.has_been_replied_to ? 'opacity-40 cursor-not-allowed' : ''
                          }`}
                        >
                          <CornerUpLeft className="w-3.5 h-3.5" />
                          <span>{msg.has_been_replied_to ? 'Already Replied' : 'Reply'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleForward(msg)}
                          className="text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 font-semibold flex items-center gap-1 transition-colors"
                        >
                          <Forward className="w-3.5 h-3.5" />
                          <span>Forward</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkUnread(msg)}
                          className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 text-[11px] font-medium"
                        >
                          Mark unread
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={async () => {
                          await api.toggleFavorite(msg.id);
                          const details = await api.getConversationDetails(selectedConversation.id);
                          setConversationMessages(details.messages);
                          fetchConversations();
                        }}
                        className="text-slate-400 dark:text-slate-500 hover:text-amber-400 transition-colors"
                        title="Favorite this message"
                      >
                        <Star className={`w-4 h-4 ${msg.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick Reply Box at Bottom */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800">
              {replyError && (
                <div className="mb-2 p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300">
                  {replyError}
                </div>
              )}

              {targetReplyMessage && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                  <div>
                    Replying to: <strong>{targetReplyMessage.sender_name}</strong> &lt;{targetReplyMessage.sender_email}&gt;
                  </div>
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium">Single-Reply Protected</span>
                </div>
              )}

              <form onSubmit={handleSendReply} className="space-y-2">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Click here to reply to this thread..."
                  className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner"
                />

                <div className="flex items-center justify-between">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Recipient is automatically locked to thread participants.
                  </div>
                  <button
                    type="submit"
                    disabled={replyLoading || !replyText.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{replyLoading ? 'Sending...' : 'Send Reply'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 p-8 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-300 dark:text-slate-600">
              <Mail className="w-7 h-7" />
            </div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Select an email to view conversation</div>
            <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
              Conversations group all replies into unified threads by sender and participants.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
