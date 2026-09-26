import React, { useState } from 'react';
import { api } from '../../services/api.ts';
import {
  X,
  PhoneCall,
  Volume2,
  PhoneOff,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';

interface IvrSimulatorProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountCreated?: () => void;
}

export const IvrSimulator: React.FC<IvrSimulatorProps> = ({
  isOpen,
  onClose,
  onAccountCreated
}) => {
  const [callerPhone, setCallerPhone] = useState<string>('9944332211');
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'completed'>('idle');
  const [twimlOutput, setTwimlOutput] = useState<string>('');
  const [createdUser, setCreatedUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  const handleStartCall = () => {
    setCallState('calling');
    setErrorMsg('');
    setTimeout(() => {
      setCallState('connected');
    }, 1000);
  };

  const handlePressKey = async (digit: string) => {
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await api.simulateIvr(callerPhone, digit);
      setTwimlOutput(res.twimlResponse);
      setCreatedUser(res.user);
      setCallState('completed');
      if (onAccountCreated && res.accountCreated) {
        onAccountCreated();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Telephony error');
    } finally {
      setLoading(false);
    }
  };

  const handleHangup = () => {
    setCallState('idle');
    setTwimlOutput('');
    setCreatedUser(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 to-slate-900 px-5 py-4 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5 text-blue-400" />
            <div>
              <h3 className="text-sm font-bold">Toll-Free IVR Telephony Tester</h3>
              <p className="text-[11px] text-blue-200">Dial-in Automated Account Provisioning</p>
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
        <div className="p-5 space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-900 dark:text-blue-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>AlphaStack Telephony Architecture</span>
            </div>
            <p className="text-[11px] text-blue-800 dark:text-blue-300">
              Dial Toll-Free (1-800-PHONEMAIL) <span className="font-semibold">&rarr;</span> IVR Greeting <span className="font-semibold">&rarr;</span> Press 1 <span className="font-semibold">&rarr;</span> Captures Caller ID <span className="font-semibold">&rarr;</span> Instant Account Creation & SMS.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {callState === 'idle' && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Caller Phone Number (Caller ID)
                </label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">+</span>
                  <input
                    type="tel"
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    placeholder="9944332211"
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleStartCall}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Dial 1-800-PHONEMAIL</span>
              </button>
            </div>
          )}

          {callState === 'calling' && (
            <div className="py-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 flex items-center justify-center mx-auto animate-pulse">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div className="text-xs font-bold text-slate-800 dark:text-slate-100">Connecting to 1-800-PHONEMAIL...</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Caller ID: +{callerPhone}</div>
            </div>
          )}

          {callState === 'connected' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-slate-900 text-emerald-300 rounded-xl font-mono text-xs space-y-1.5 border border-slate-800 shadow-inner">
                <div className="flex items-center gap-1.5 text-white font-bold text-[11px]">
                  <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Interactive Voice Prompt:</span>
                </div>
                <p className="text-slate-200 text-[11px] leading-relaxed">
                  "Welcome to PhoneMail, where your phone number is your email address. To create your free PhoneMail account instantly, press 1."
                </p>
              </div>

              <div className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Keypad Input (DTMF)
              </div>

              <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    disabled={loading}
                    onClick={() => handlePressKey(k)}
                    className={`py-3 rounded-xl border text-sm font-bold font-mono transition-all ${
                      k === '1'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleHangup}
                className="w-full py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 border border-rose-200 dark:border-rose-800"
              >
                <PhoneOff className="w-3.5 h-3.5" />
                <span>Hang Up</span>
              </button>
            </div>
          )}

          {callState === 'completed' && (
            <div className="space-y-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Account Provisioned via IVR!</span>
                </div>
                {createdUser ? (
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                    Created: <strong>{createdUser.email_address || createdUser.emailAddress}</strong>
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                    Caller phone already registered; confirmation dispatched via SMS.
                  </p>
                )}
              </div>

              {twimlOutput && (
                <div>
                  <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
                    Generated TwiML XML Response
                  </div>
                  <pre className="p-2.5 bg-slate-900 text-emerald-400 font-mono text-[10px] rounded-lg overflow-x-auto max-h-32 border border-slate-800">
                    {twimlOutput}
                  </pre>
                </div>
              )}

              <button
                type="button"
                onClick={handleHangup}
                className="w-full py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
