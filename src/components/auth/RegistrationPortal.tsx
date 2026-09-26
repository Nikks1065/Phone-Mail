import React, { useState, useEffect } from 'react';
import { api } from '../../services/api.ts';
import {
  Phone,
  ShieldCheck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw
} from 'lucide-react';

/**
 * Registration-only portal (/register).
 * Phone + OTP + single Next button. Does not log the user into the main app.
 */
export const RegistrationPortal: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [demoHint, setDemoHint] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);

  useEffect(() => {
    // Autofill from browser contact pickers / autocomplete where supported
    // (websites cannot read SIM numbers directly)
  }, []);

  const resetForm = () => {
    setPhoneNumber('');
    setOtpCode('');
    setOtpSent(false);
    setDemoHint('');
    setAgreedTerms(false);
  };

  const handleNext = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!agreedTerms) {
      setError('Please accept the Terms of Service to continue.');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Phone number is required.');
      return;
    }

    setLoading(true);
    try {
      if (!otpSent) {
        const res = await api.requestOtp(phoneNumber, 'register');
        setOtpSent(true);
        if (res.demoCode) {
          setOtpCode(res.demoCode);
          setDemoHint(`Demo mode: verification code is ${res.demoCode}`);
        } else {
          setDemoHint('Enter the OTP sent to your phone.');
        }
      } else {
        if (!otpCode.trim()) {
          setError('OTP code is required.');
          setLoading(false);
          return;
        }
        const result = await api.registerAccount(phoneNumber, otpCode);
        setSuccess(
          `Account created! Your PhoneMail address is ${result.emailAddress}. You can now log in from the home page.`
        );
        resetForm();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4 font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-slate-900 p-6 text-white">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/phonemail_brand_mark_1790265389236.jpg"
              alt="PhoneMail"
              className="w-10 h-10 rounded-xl object-cover border border-white/20"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-xl font-bold tracking-tight">PhoneMail Registration</h1>
              <p className="text-xs text-emerald-100">Create your phone-number email identity</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleNext} className="p-6 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            This portal is for <strong>account creation only</strong>. After registering, return to the
            main app to log in.
          </p>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              Phone Number
            </span>
            <input
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              disabled={otpSent && !success}
              placeholder="+1 987 654 3210"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden disabled:opacity-60"
              required
            />
          </label>

          {otpSent && (
            <label className="block space-y-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                OTP Code
              </span>
              <input
                type="text"
                name="one-time-code"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]*"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="6-digit code"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm tracking-widest font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                required
              />
              {demoHint && (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">{demoHint}</span>
              )}
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  try {
                    const res = await api.requestOtp(phoneNumber, 'register');
                    if (res.demoCode) {
                      setOtpCode(res.demoCode);
                      setDemoHint(`Demo mode: new code is ${res.demoCode}`);
                    } else {
                      setDemoHint('A new OTP was sent to your phone.');
                    }
                  } catch (err: unknown) {
                    setError(err instanceof Error ? err.message : 'Failed to resend OTP.');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="text-[11px] text-slate-500 hover:text-emerald-700 flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" /> Resend OTP
              </button>
            </label>
          )}

          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={agreedTerms}
              onChange={(e) => setAgreedTerms(e.target.checked)}
              className="mt-0.5 rounded text-emerald-600"
            />
            <span>
              I agree to the{' '}
              <a href="/#terms" className="text-emerald-700 font-semibold underline inline-flex items-center gap-0.5">
                <FileText className="w-3 h-3" /> Terms of Service
              </a>
            </span>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? 'Please wait…' : (
              <>
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <a
            href="/"
            className="block text-center text-xs text-slate-500 hover:text-emerald-700 underline"
          >
            Already have an account? Log in
          </a>
        </form>
      </div>
    </div>
  );
};
