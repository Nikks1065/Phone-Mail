import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import { SmsNotification } from '../../types.ts';
import {
  X,
  MessageSquare,
  RefreshCw,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface SmsLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SmsLogsModal: React.FC<SmsLogsModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<SmsNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getSmsLogs();
      setLogs(data);
    } catch (err) {
      console.warn('Failed to load SMS logs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-amber-400" />
            <div>
              <h3 className="text-sm font-bold">SMS Notifications Audit Log</h3>
              <p className="text-[11px] text-slate-300">Automated SMS alerts dispatched upon incoming emails</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh logs"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2.5">
          {logs.length === 0 ? (
            <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
              No SMS notifications logged yet. Send an email or trigger the inbound webhook to generate an SMS alert.
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1.5 hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-mono font-semibold text-slate-900 dark:text-slate-100">
                    <Phone className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>+{log.recipient_phone}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase ${
                        log.status === 'sent'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300/40'
                          : log.status === 'simulated'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300/40'
                          : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300/40'
                      }`}
                    >
                      {log.status} ({log.provider})
                    </span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-800 dark:text-slate-200">
                  "{log.message_body}"
                </div>

                <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center justify-between pt-0.5">
                  <span>From: <strong className="text-slate-700 dark:text-slate-300">{log.sender_email}</strong></span>
                  <span>Subject: <span className="text-slate-700 dark:text-slate-300">{log.subject}</span></span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
