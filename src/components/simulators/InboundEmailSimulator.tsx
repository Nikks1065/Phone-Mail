import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { api } from '../../services/api.ts';
import {
  X,
  Mail,
  Send,
  Sparkles,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  MessageSquare
} from 'lucide-react';

interface InboundEmailSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onEmailIngested: () => void;
}

export const InboundEmailSimulator: React.FC<InboundEmailSimulatorProps> = ({
  isOpen,
  onClose,
  onEmailIngested
}) => {
  const { user } = useAuth();

  const [fromEmail, setFromEmail] = useState<string>('alex.partner@alphaventures.vc');
  const [senderName, setSenderName] = useState<string>('Alex Venture Partner');
  const [subject, setSubject] = useState<string>('Urgent: PhoneMail Investment Term Sheet Q3');
  const [textBody, setTextBody] = useState<string>(
    'Hi Nikhil,\n\nWe were incredibly impressed by your PhoneMail buildathon demo today! We would like to extend an invitation for our upcoming accelerator cohort.\n\nPlease review the terms and let us know your availability tomorrow morning.'
  );

  const [loading, setLoading] = useState<boolean>(false);
  const [resultMsg, setResultMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen || !user) return null;

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResultMsg('');
    setErrorMsg('');

    try {
      const res = await api.simulateIncomingEmail({
        from: fromEmail,
        senderName,
        to: user.emailAddress,
        subject,
        text: textBody
      });

      setResultMsg(`Success! Inbound email ingested into ${user.emailAddress} and SMS notification dispatched.`);
      onEmailIngested();
    } catch (err: any) {
      setErrorMsg(err.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-emerald-950 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold">Inbound Email Webhook Simulator</h3>
              <p className="text-[11px] text-slate-300">Simulate external sender emailing a PhoneMail user</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSimulate} className="p-5 space-y-3.5">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>AlphaStack Buildathon Pipeline Test</span>
            </div>
            <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
              External Sender <ArrowRight className="inline w-3 h-3" /> Inbound Webhook <ArrowRight className="inline w-3 h-3" /> PhoneMail Database <ArrowRight className="inline w-3 h-3" /> User Inbox + Instant SMS Trigger.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {resultMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{resultMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                From (External Sender)
              </label>
              <input
                type="email"
                required
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sender Name
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              To (Recipient PhoneMail Address)
            </label>
            <input
              type="text"
              readOnly
              value={user.emailAddress}
              className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-800 dark:text-emerald-400"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Subject Line
            </label>
            <input
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Message Body
            </label>
            <textarea
              rows={4}
              required
              value={textBody}
              onChange={(e) => setTextBody(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 leading-relaxed font-sans"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Dispatching Webhook...' : 'Fire Inbound Webhook'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
