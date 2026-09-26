import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import { Attachment, Conversation } from '../../types.ts';
import {
  X,
  Send,
  Save,
  Paperclip,
  Trash2,
  Lock,
  Users,
  AlertCircle,
  FileText
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (conversation: Conversation) => void;
  initialConversationId?: string;
  initialTo?: string[];
  initialSubject?: string;
  initialBody?: string;
  isLockedRecipient?: boolean;
  inReplyToId?: string | null;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialConversationId,
  initialTo = [],
  initialSubject = '',
  initialBody = '',
  isLockedRecipient = false,
  inReplyToId = null
}) => {
  const { user } = useAuth();

  const [toInput, setToInput] = useState<string>('');
  const [toRecipients, setToRecipients] = useState<string[]>([]);
  const [showCc, setShowCc] = useState<boolean>(false);
  const [ccInput, setCcInput] = useState<string>('');
  const [ccRecipients, setCcRecipients] = useState<string[]>([]);

  const [subject, setSubject] = useState<string>('');
  const [bodyText, setBodyText] = useState<string>('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setToRecipients(initialTo.length > 0 ? initialTo : []);
      setToInput('');
      setSubject(initialSubject);
      setBodyText(initialBody);
      setError('');
      setAttachments([]);
    }
  }, [isOpen, initialTo, initialSubject, initialBody]);

  useEffect(() => {
    const onForward = (event: Event) => {
      const detail = (event as CustomEvent<{ subject: string; body: string }>).detail;
      if (!detail) return;
      setSubject(detail.subject || '');
      setBodyText(detail.body || '');
      setToRecipients([]);
      setToInput('');
    };
    window.addEventListener('phonemail:forward', onForward);
    return () => window.removeEventListener('phonemail:forward', onForward);
  }, []);

  if (!isOpen) return null;

  const handleAddRecipient = (type: 'to' | 'cc') => {
    const val = (type === 'to' ? toInput : ccInput).trim();
    if (!val) return;

    if (type === 'to') {
      if (!toRecipients.includes(val)) {
        setToRecipients([...toRecipients, val]);
      }
      setToInput('');
    } else {
      if (!ccRecipients.includes(val)) {
        setCcRecipients([...ccRecipients, val]);
      }
      setCcInput('');
    }
  };

  const handleRemoveRecipient = (type: 'to' | 'cc', index: number) => {
    if (isLockedRecipient) return;
    if (type === 'to') {
      setToRecipients(toRecipients.filter((_, i) => i !== index));
    } else {
      setCcRecipients(ccRecipients.filter((_, i) => i !== index));
    }
  };

  const handleAddAttachment = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async () => {
      const files = Array.from(input.files || []);
      for (const file of files) {
        if (file.size > 4_000_000) {
          setError(`Attachment "${file.name}" exceeds the 4MB limit.`);
          continue;
        }
        try {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
          });
          const uploaded = await api.uploadAttachment({
            name: file.name,
            type: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl
          });
          setAttachments((prev) => [...prev, uploaded]);
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : 'Failed to attach file');
        }
      }
    };
    input.click();
  };

  const handleRemoveAttachment = (attId: string) => {
    setAttachments(attachments.filter(a => a.id !== attId));
  };

  const handleSubmit = async (isDraft = false) => {
    setError('');

    // Ensure pending input is captured
    const finalTo = [...toRecipients];
    if (toInput.trim() && !finalTo.includes(toInput.trim())) {
      finalTo.push(toInput.trim());
    }

    if (finalTo.length === 0) {
      setError('Please provide at least one recipient email address or phone number.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.composeMessage({
        to: finalTo,
        cc: ccRecipients,
        subject,
        bodyText,
        conversationId: initialConversationId,
        inReplyToId,
        isDraft,
        attachments
      });

      onSuccess(res.conversation);
      onClose();
    } catch (err: any) {
      console.error('[COMPOSE] Error:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 px-5 py-3.5 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold">
              {isLockedRecipient ? 'Compose in Conversation' : 'New Email Message'}
            </h3>
            {toRecipients.length > 1 && (
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-mono border border-emerald-400/30">
                Group Conversation
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender indicator */}
          <div className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-800">
            <span className="text-slate-500 dark:text-slate-400 font-medium">From:</span>
            <span className="font-mono text-slate-800 dark:text-slate-200 font-semibold">{user?.emailAddress}</span>
          </div>

          {/* Recipients (To) */}
          <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center justify-between mb-1 text-xs">
              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                <span>To:</span>
                {isLockedRecipient && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                    <Lock className="w-3 h-3" /> Locked to conversation
                  </span>
                )}
              </div>
              {!showCc && !isLockedRecipient && (
                <button
                  type="button"
                  onClick={() => setShowCc(true)}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium"
                >
                  + Add CC
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[38px]">
              {toRecipients.map((recipient, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                >
                  <span>{recipient}</span>
                  {!isLockedRecipient && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient('to', i)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}

              {!isLockedRecipient && (
                <input
                  type="text"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddRecipient('to');
                    }
                  }}
                  onBlur={() => handleAddRecipient('to')}
                  placeholder={toRecipients.length === 0 ? "Enter recipient phone or email (e.g. 9123456789 or name@domain.com)..." : "Add another..."}
                  className="flex-1 min-w-[200px] text-xs bg-transparent border-none outline-hidden focus:ring-0 p-1 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              )}
            </div>
          </div>

          {/* CC Field */}
          {showCc && !isLockedRecipient && (
            <div className="border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="text-xs text-slate-600 dark:text-slate-400 font-medium mb-1">CC:</div>
              <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl min-h-[38px]">
                {ccRecipients.map((cc, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-2 py-0.5 text-xs text-slate-800 dark:text-slate-200 font-mono"
                  >
                    <span>{cc}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecipient('cc', i)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      handleAddRecipient('cc');
                    }
                  }}
                  onBlur={() => handleAddRecipient('cc')}
                  placeholder="Enter CC recipient..."
                  className="flex-1 min-w-[150px] text-xs bg-transparent border-none outline-hidden focus:ring-0 p-1 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
                />
              </div>
            </div>
          )}

          {/* Subject Field */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject:
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Message:
            </label>
            <textarea
              rows={8}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Write your email here..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
            />
          </div>

          {/* Attachments List */}
          {attachments.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">Attached Files:</div>
              <div className="flex flex-wrap gap-2">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="truncate max-w-[150px] font-medium">{att.name}</span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">({Math.round(att.size / 1024)} KB)</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-slate-50 dark:bg-slate-800/80 px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddAttachment}
              className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <Paperclip className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Attach File</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Sending...' : 'Send Email'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
