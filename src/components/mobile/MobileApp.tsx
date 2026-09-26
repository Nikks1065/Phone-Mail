import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Conversation, Message, FolderType, UserSummary } from '../../types.ts';
import { UserSearch } from '../common/UserSearch.tsx';
import {
  Search,
  Plus,
  Inbox,
  Star,
  FileEdit,
  AlertOctagon,
  Trash2,
  Paperclip,
  Send,
  ArrowLeft,
  MoreVertical,
  Check,
  CheckCheck,
  Maximize2,
  CornerUpLeft,
  Mail,
  Users,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

interface MobileAppProps {
  onOpenCompose: (conversationId?: string, to?: string[], isLocked?: boolean) => void;
  onOpenSettings: () => void;
}

export const MobileApp: React.FC<MobileAppProps> = ({ onOpenCompose, onOpenSettings }) => {
  const { user } = useAuth();

  const [activeFolder, setActiveFolder] = useState<FolderType>('inbox');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'attachments' | 'favorites'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [conversationMessages, setConversationMessages] = useState<Message[]>([]);

  // Chat bar states
  const [chatInput, setChatInput] = useState<string>('');
  const [chatSubject, setChatSubject] = useState<string>('');
  const [inReplyToMessage, setInReplyToMessage] = useState<Message | null>(null);
  const [replyError, setReplyError] = useState<string>('');
  const [swipeOffsets, setSwipeOffsets] = useState<Record<string, number>>({});
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchMsgId, setTouchMsgId] = useState<string | null>(null);

  // Long email expander modal
  const [expandedMessage, setExpandedMessage] = useState<Message | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [phoneSearchBusy, setPhoneSearchBusy] = useState<boolean>(false);

  const loadConversations = async () => {
    setLoading(true);
    try {
      // Map filter
      let queryFolder: FolderType = activeFolder;
      if (activeFolder === 'inbox') {
        if (activeFilter === 'unread') queryFolder = 'unread';
        if (activeFilter === 'favorites') queryFolder = 'favorites';
        if (activeFilter === 'attachments') queryFolder = 'attachments';
      }

      const data = await api.getConversations(queryFolder, searchQuery);
      setConversations(data);
    } catch (err) {
      console.warn('Failed to load mobile conversations', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [activeFolder, activeFilter, searchQuery]);

  const handleSelectConversation = async (conv: Conversation) => {
    setSelectedConversation(conv);
    setInReplyToMessage(null);
    setReplyError('');
    setChatSubject(conv.subject || '');
    try {
      const details = await api.getConversationDetails(conv.id);
      setConversationMessages(details.messages);
      // Mark as read
      await api.markConversationRead(conv.id);
    } catch (err) {
      console.warn('Failed to load conversation messages', err);
    }
  };

  const handleSelectUsername = async (selected: UserSummary) => {
    if (!selected.username) return;
    setPhoneSearchBusy(true);
    setReplyError('');
    try {
      const res = await api.openConversationWithUser(selected.username);
      setSelectedConversation(res.conversation);
      setConversationMessages(res.messages);
      setChatSubject(res.conversation.subject || `@${selected.username}`);
      loadConversations();
    } catch (err: unknown) {
      setReplyError(err instanceof Error ? err.message : 'Could not open conversation');
    } finally {
      setPhoneSearchBusy(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedConversation) return;

    setReplyError('');
    try {
      if (inReplyToMessage) {
        // Enforce strict single-reply rule (backend also validates)
        await api.replyMessage({
          messageId: inReplyToMessage.id,
          conversationId: selectedConversation.id,
          bodyText: chatInput
        });
      } else {
        // Normal conversation compose (recipients locked to conversation partners)
        const recipientEmails = selectedConversation.participants
          ? selectedConversation.participants
              .filter(p => p.email_address !== user?.emailAddress)
              .map(p => p.email_address)
          : [];

        await api.composeMessage({
          conversationId: selectedConversation.id,
          to: recipientEmails.length > 0 ? recipientEmails : [selectedConversation.participants?.[0]?.email_address || ''],
          subject: chatSubject.trim() || selectedConversation.subject || 'Conversation',
          bodyText: chatInput
        });
      }

      setChatInput('');
      setInReplyToMessage(null);

      // Refresh messages
      const details = await api.getConversationDetails(selectedConversation.id);
      setConversationMessages(details.messages);
      setSelectedConversation(details.conversation);
      setChatSubject(details.conversation.subject || '');
      loadConversations();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      console.warn('[MOBILE COMPOSE] Error:', message);
      setReplyError(message);
    }
  };

  const handleInitiateReply = (msg: Message) => {
    if (msg.has_been_replied_to) {
      setReplyError('This message has already been replied to. Single-reply constraint prohibits duplicate replies.');
      return;
    }
    setInReplyToMessage(msg);
    setReplyError('');
  };

  const handleToggleFavorite = async (msgId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.toggleFavorite(msgId);
      if (selectedConversation) {
        const details = await api.getConversationDetails(selectedConversation.id);
        setConversationMessages(details.messages);
      }
      loadConversations();
    } catch (err) {
      console.warn('Favorite error', err);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-53px)] max-w-md mx-auto bg-slate-100 dark:bg-slate-950 border-x border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden font-sans">
      {/* If a conversation is selected, show WhatsApp Conversation View */}
      {selectedConversation ? (
        <div className="flex flex-col h-full bg-[#efeae2] dark:bg-slate-950">
          {/* WhatsApp Chat Header */}
          <div className="bg-slate-900 dark:bg-slate-900 text-white px-3 py-2.5 flex items-center justify-between shadow-xs z-20 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedConversation(null)}
                className="p-1 -ml-1 text-slate-300 hover:text-white rounded-full transition-colors"
                title="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {selectedConversation.subject ? selectedConversation.subject.charAt(0).toUpperCase() : 'P'}
                </div>
                <div className="leading-tight max-w-[170px] sm:max-w-[210px]">
                  <div className="text-xs font-bold truncate text-white">
                    {selectedConversation.subject || 'PhoneMail Conversation'}
                  </div>
                  <div className="text-[10px] text-emerald-400 truncate font-mono">
                    {selectedConversation.participants
                      ?.map(p => p.email_address)
                      .join(', ')}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-300">
              <button
                onClick={() => {
                  const toList = selectedConversation.participants
                    ?.filter(p => p.email_address !== user?.emailAddress)
                    .map(p => p.email_address) || [];
                  onOpenCompose(selectedConversation.id, toList, true);
                }}
                title="Switch to Traditional Email View"
                className="p-1.5 hover:text-white hover:bg-slate-800 rounded-lg text-xs flex items-center gap-1 font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                <span className="hidden sm:inline text-[11px]">Traditional</span>
              </button>
            </div>
          </div>

          {/* Messages Stream Container */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[radial-gradient(#d1d5db_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]">
            {/* Subject Kicker Card */}
            <div className="mx-auto max-w-xs text-center my-2">
              <span className="px-3 py-1 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 text-[11px] font-semibold rounded-full shadow-xs border border-slate-200 dark:border-slate-700 inline-block truncate max-w-full">
                Subject: {selectedConversation.subject}
              </span>
            </div>

            {conversationMessages.map((msg) => {
              const isOutgoing = msg.sender_email === user?.emailAddress;
              const hasAttachments = msg.attachments && msg.attachments.length > 0;
              const isLong = msg.body_text.length > 250;
              const swipeX = swipeOffsets[msg.id] || 0;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'} max-w-[85%] ${
                    isOutgoing ? 'ml-auto' : 'mr-auto'
                  } relative`}
                  onTouchStart={(e) => {
                    setTouchStartX(e.touches[0]?.clientX ?? null);
                    setTouchMsgId(msg.id);
                  }}
                  onTouchMove={(e) => {
                    if (touchStartX === null || touchMsgId !== msg.id) return;
                    const delta = (e.touches[0]?.clientX ?? touchStartX) - touchStartX;
                    // Swipe-right to tag message for reply
                    if (delta > 0) {
                      setSwipeOffsets((prev) => ({ ...prev, [msg.id]: Math.min(delta, 72) }));
                    }
                  }}
                  onTouchEnd={() => {
                    if (swipeX > 48 && !msg.has_been_replied_to) {
                      handleInitiateReply(msg);
                    }
                    setSwipeOffsets((prev) => ({ ...prev, [msg.id]: 0 }));
                    setTouchStartX(null);
                    setTouchMsgId(null);
                  }}
                  style={{ transform: `translateX(${swipeX}px)`, transition: touchStartX ? 'none' : 'transform 0.2s ease' }}
                >
                  {swipeX > 20 && (
                    <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-emerald-700 text-[10px] font-bold">
                      Reply
                    </span>
                  )}
                  <div
                    className={`relative p-3 rounded-2xl shadow-xs border text-xs leading-relaxed ${
                      isOutgoing
                        ? 'bg-emerald-600 text-white border-emerald-700 rounded-br-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800 rounded-bl-xs'
                    }`}
                  >
                    {/* Subject shown at top of new (non-reply) emails */}
                    {!msg.in_reply_to_id && msg.subject && (
                      <div
                        className={`mb-1.5 text-[11px] font-bold ${
                          isOutgoing ? 'text-emerald-100' : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {msg.subject}
                      </div>
                    )}
                    {/* If this is a reply to an earlier email */}
                    {msg.in_reply_to_id && (
                      <div
                        className={`mb-2 pl-2 border-l-2 py-0.5 text-[11px] rounded-r-md ${
                          isOutgoing
                            ? 'border-emerald-300 bg-emerald-700/60 text-emerald-100'
                            : 'border-slate-400 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <span className="font-semibold flex items-center gap-1">
                          <CornerUpLeft className="w-3 h-3" /> In reply to original message
                        </span>
                      </div>
                    )}

                    {/* Sender kicker for group conversations */}
                    {!isOutgoing && (
                      <div className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 mb-0.5 flex items-center justify-between">
                        <span>{msg.sender_name || msg.sender_email}</span>
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 font-normal">
                          {msg.sender_email}
                        </span>
                      </div>
                    )}

                    {/* Body text with length truncation escape hatch */}
                    <div className="whitespace-pre-wrap break-words">
                      {isLong ? `${msg.body_text.substring(0, 240)}...` : msg.body_text}
                    </div>

                    {/* Expand full email if long */}
                    {isLong && (
                      <button
                        type="button"
                        onClick={() => setExpandedMessage(msg)}
                        className={`mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold underline ${
                          isOutgoing ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        <Maximize2 className="w-3 h-3" /> Read full email
                      </button>
                    )}

                    {/* Attachments pills */}
                    {hasAttachments && (
                      <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10 space-y-1">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium ${
                              isOutgoing ? 'bg-emerald-700/80 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <Paperclip className="w-3 h-3 shrink-0" />
                            <span className="truncate">{att.name}</span>
                            <span className="text-[9px] opacity-75">
                              ({Math.round(att.size / 1024)} KB)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Bubble Bottom Meta & Action Controls */}
                    <div
                      className={`flex items-center justify-between mt-2 pt-1 border-t ${
                        isOutgoing ? 'border-emerald-500/50 text-emerald-100' : 'border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500'
                      } text-[10px]`}
                    >
                      <div className="flex items-center gap-1.5">
                        {/* Reply Action */}
                        <button
                          type="button"
                          disabled={msg.has_been_replied_to}
                          onClick={() => handleInitiateReply(msg)}
                          className={`font-semibold hover:underline flex items-center gap-0.5 ${
                            msg.has_been_replied_to ? 'opacity-40 cursor-not-allowed' : ''
                          }`}
                          title={msg.has_been_replied_to ? 'Already replied to' : 'Reply to this message'}
                        >
                          <CornerUpLeft className="w-3 h-3" />
                          <span>{msg.has_been_replied_to ? 'Replied' : 'Reply'}</span>
                        </button>

                        {/* Favorite Star */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(msg.id, e)}
                          className="hover:text-amber-400 transition-colors ml-1"
                          title="Favorite"
                        >
                          <Star
                            className={`w-3 h-3 ${msg.is_favorite ? 'fill-amber-400 text-amber-400' : ''}`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center gap-1 tabular-nums">
                        <span>
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                        {isOutgoing && (
                          <span>
                            <CheckCheck className="w-3.5 h-3.5 text-emerald-200" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error banner */}
          {replyError && (
            <div className="bg-rose-50 dark:bg-rose-950/60 border-t border-rose-200 dark:border-rose-800 px-3 py-1.5 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span className="truncate">{replyError}</span>
              <button
                onClick={() => setReplyError('')}
                className="text-rose-500 hover:text-rose-800 dark:hover:text-rose-200 font-bold ml-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Reply Context Bar */}
          {inReplyToMessage && (
            <div className="bg-slate-200/90 dark:bg-slate-800 border-t border-slate-300 dark:border-slate-700 px-3 py-2 text-xs flex items-center justify-between">
              <div className="truncate max-w-[85%]">
                <span className="font-bold text-slate-800 dark:text-slate-200">Replying to {inReplyToMessage.sender_name}:</span>{' '}
                <span className="text-slate-600 dark:text-slate-400 truncate">{inReplyToMessage.body_text}</span>
              </div>
              <button
                type="button"
                onClick={() => setInReplyToMessage(null)}
                className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 font-bold ml-2 p-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* WhatsApp Message Input Bar — subject for new emails, hidden when replying */}
          <form
            onSubmit={handleSendMessage}
            className="p-2 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-1.5"
          >
            {!inReplyToMessage && (
              <input
                type="text"
                value={chatSubject}
                onChange={(e) => setChatSubject(e.target.value)}
                placeholder="Subject"
                aria-label="Email subject"
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            )}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  const toList = selectedConversation.participants
                    ?.filter(p => p.email_address !== user?.emailAddress)
                    .map(p => p.email_address) || [];
                  onOpenCompose(selectedConversation.id, toList, true);
                }}
                title="Open traditional email composer"
                className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <Mail className="w-5 h-5" />
              </button>

              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={inReplyToMessage ? 'Type reply...' : 'Type email message...'}
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full px-4 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner"
              />

              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* WhatsApp Home Screen */
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
          {/* Top Bar with Brand Title and Actions */}
          <div className="bg-slate-900 text-white px-4 py-3 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img
                  src="/src/assets/images/phonemail_brand_mark_1790265389236.jpg"
                  alt="PhoneMail Logo"
                  referrerPolicy="no-referrer"
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <h1 className="text-lg font-bold tracking-tight">PhoneMail</h1>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={loadConversations}
                  disabled={loading}
                  className="p-1.5 text-slate-300 hover:text-white rounded-full transition-colors"
                  title="Refresh inbox"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onOpenSettings}
                  className="p-0.5 text-slate-300 hover:text-white rounded-full transition-colors"
                  title="Profile & Settings"
                  aria-label="Open profile settings"
                >
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt="Profile"
                      className="w-7 h-7 rounded-full object-cover border border-slate-600"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {(user?.displayName || 'U').charAt(0)}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Username search to start a chat */}
            <div className="mb-2">
              <UserSearch onSelectUser={handleSelectUsername} placeholder="Message a username…" />
            </div>

            {/* Conversation filter search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter conversations…"
                aria-label="Filter conversations"
                className="w-full pl-9 pr-4 py-1.5 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:bg-slate-900 focus:outline-hidden focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            {phoneSearchBusy && (
              <div className="text-[10px] text-emerald-300 mt-1">Opening conversation…</div>
            )}
          </div>

          {/* Filter Segmented Controls (All / Unread / Attachments / Favorites) */}
          {activeFolder === 'inbox' && (
            <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'attachments', label: 'Attachments' },
                { id: 'favorites', label: 'Favorites' }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as any)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors shrink-0 ${
                    activeFilter === f.id
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Folder Context Header if not Inbox */}
          {activeFolder !== 'inbox' && (
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center justify-between">
              <span>Folder: {activeFolder}</span>
              <button
                onClick={() => setActiveFolder('inbox')}
                className="text-emerald-700 dark:text-emerald-400 normal-case font-semibold text-[11px] underline"
              >
                Back to Inbox
              </button>
            </div>
          )}

          {/* Conversation List Feed */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {conversations.length === 0 ? (
              <div className="py-16 text-center text-slate-400 dark:text-slate-500 text-xs px-4">
                No conversations found in {activeFolder}. Tap the button below to compose an email or simulate an incoming email.
              </div>
            ) : (
              conversations.map((conv) => {
                const hasUnread = conv.unread_count && conv.unread_count > 0;
                const latest = conv.latest_message;
                const otherParticipants = conv.participants?.filter(p => p.id !== user?.id) || [];
                const primaryContact = otherParticipants[0] || conv.participants?.[0];

                return (
                  <div
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv)}
                    className={`p-3.5 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors ${
                      hasUnread ? 'bg-emerald-50/40 dark:bg-emerald-950/30' : ''
                    }`}
                  >
                    {/* Contact Avatar */}
                    <div className="relative shrink-0">
                      {primaryContact?.avatar_url ? (
                        <img
                          src={primaryContact.avatar_url}
                          alt={primaryContact.display_name}
                          referrerPolicy="no-referrer"
                          className="w-12 h-12 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-sm">
                          {conv.subject.charAt(0).toUpperCase() || 'P'}
                        </div>
                      )}
                      {conv.type === 'group' && (
                        <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white rounded-full p-0.5 border border-white dark:border-slate-800">
                          <Users className="w-3 h-3" />
                        </span>
                      )}
                    </div>

                    {/* Center Text Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span
                          className={`text-sm truncate ${
                            hasUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-semibold text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {primaryContact?.username
                            ? `@${primaryContact.username}`
                            : primaryContact?.display_name || conv.subject || 'Unknown Contact'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums shrink-0 ml-2">
                          {latest
                            ? new Date(latest.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            : ''}
                        </span>
                      </div>

                      <div className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate mb-0.5">
                        {conv.subject}
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px]">
                          {latest?.body_text || 'No messages yet'}
                        </p>

                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          {conv.is_favorite && (
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          )}
                          {latest?.attachments && latest.attachments.length > 0 && (
                            <Paperclip className="w-3 h-3 text-slate-400 dark:text-slate-500" />
                          )}
                          {hasUnread && (
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Floating Action Button (FAB) - WhatsApp Style Compose */}
          <button
            onClick={() => onOpenCompose()}
            className="absolute bottom-18 right-4 w-13 h-13 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-95 z-30"
            title="Compose New Email"
          >
            <Plus className="w-6 h-6" />
          </button>

          {/* Bottom Fixed Tab Navigation (Home, Drafts, Spam, Trash) */}
          <div className="h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center z-20">
            <button
              onClick={() => {
                setActiveFolder('inbox');
                setActiveFilter('all');
              }}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                activeFolder === 'inbox' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Inbox className="w-5 h-5" />
              <span className="text-[10px] mt-1">Home</span>
            </button>

            <button
              onClick={() => setActiveFolder('drafts')}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                activeFolder === 'drafts' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <FileEdit className="w-5 h-5" />
              <span className="text-[10px] mt-1">Drafts</span>
            </button>

            <button
              onClick={() => setActiveFolder('spam')}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                activeFolder === 'spam' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <AlertOctagon className="w-5 h-5" />
              <span className="text-[10px] mt-1">Spam</span>
            </button>

            <button
              onClick={() => setActiveFolder('trash')}
              className={`flex flex-col items-center justify-center py-1 transition-colors ${
                activeFolder === 'trash' ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-[10px] mt-1">Trash</span>
            </button>
          </div>
        </div>
      )}

      {/* Traditional Long Email Viewer Modal */}
      {expandedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold truncate">{expandedMessage.subject}</span>
              </div>
              <button
                onClick={() => setExpandedMessage(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs text-slate-800 dark:text-slate-200">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-2 space-y-1">
                <div>From: <strong className="text-slate-900 dark:text-slate-100">{expandedMessage.sender_name}</strong> &lt;{expandedMessage.sender_email}&gt;</div>
                <div>To: <span className="font-mono text-slate-600 dark:text-slate-400">{expandedMessage.to_recipients.join(', ')}</span></div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500">{new Date(expandedMessage.created_at).toLocaleString()}</div>
              </div>

              <div className="whitespace-pre-wrap leading-relaxed py-2">
                {expandedMessage.body_text}
              </div>

              {expandedMessage.attachments && expandedMessage.attachments.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="font-semibold mb-1">Attachments:</div>
                  <div className="space-y-1">
                    {expandedMessage.attachments.map((att) => (
                      <div key={att.id} className="p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded flex items-center gap-2">
                        <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{att.name}</span>
                        <span className="text-slate-400 dark:text-slate-400 text-[10px]">({Math.round(att.size / 1024)} KB)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/80 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setExpandedMessage(null)}
                className="px-4 py-1.5 bg-slate-900 dark:bg-slate-700 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
