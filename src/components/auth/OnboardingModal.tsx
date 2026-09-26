import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import { ThemeToggle } from '../common/ThemeToggle.tsx';
import { api } from '../../services/api.ts';
import {
  Phone,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  Globe,
  FileText,
  Lock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

interface OnboardingModalProps {
  isOpen: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen }) => {
  const { loginWithOtp, loginWithPassword, switchDemoUser } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'es' | 'hi' | 'fr'>('en');
  const [agreedTerms, setAgreedTerms] = useState<boolean>(false);
  const [showTermsDetail, setShowTermsDetail] = useState<boolean>(false);

  const [phoneNumber, setPhoneNumber] = useState<string>('9876543210');
  const [displayName, setDisplayName] = useState<string>('Nikhil Nitt');
  const [otpCode, setOtpCode] = useState<string>('');
  const [demoReceivedCode, setDemoReceivedCode] = useState<string>('');

  // Password fallback mode
  const [usePasswordFallback, setUsePasswordFallback] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<string>('');

  if (!isOpen) return null;

  const handleLanguageNext = () => {
    setStep(2);
  };

  const handleTermsNext = () => {
    if (!agreedTerms) {
      setError('Please accept the Terms of Service to proceed.');
      return;
    }
    setError('');
    setStep(3);
  };

  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const res = await api.requestOtp(phoneNumber, 'login');
      if (res.demoCode) {
        setDemoReceivedCode(res.demoCode);
        setOtpCode(res.demoCode);
        setInfo(`Demo mode: verification code is ${res.demoCode}`);
      } else {
        setInfo('OTP sent. Enter the code from SMS, or wait for browser auto-fill if supported.');
      }
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to request OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginWithOtp(phoneNumber, otpCode, displayName);
    } catch (err: any) {
      setError(err.message || 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginWithPassword(phoneNumber, password);
    } catch (err: any) {
      setError(err.message || 'Password authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (phone: string, name: string) => {
    setPhoneNumber(phone);
    setDisplayName(name);
    setLoading(true);
    try {
      await switchDemoUser(phone);
    } catch (err: any) {
      setError(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col text-slate-900 dark:text-slate-100 transition-colors">
        {/* Header Branding */}
        <div className="bg-gradient-to-r from-emerald-600 to-slate-900 p-6 text-white relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/src/assets/images/phonemail_brand_mark_1790265389236.jpg"
                alt="PhoneMail Emblem"
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-xl object-cover border border-white/20 shadow-sm"
              />
              <div>
                <h2 className="text-xl font-bold tracking-tight">PhoneMail</h2>
                <p className="text-xs text-emerald-100">Your phone number is your email address</p>
              </div>
            </div>

            <ThemeToggle variant="icon" className="bg-white/10 hover:bg-white/20 text-white border-white/20" />
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-6 bg-white' : s < step ? 'w-3 bg-emerald-300' : 'w-3 bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Card Content Area */}
        <div className="p-6 flex-1 flex flex-col justify-between text-slate-900 dark:text-slate-100">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {/* Screen 1: Language Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
                <Globe className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Screen 1: Select Language</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose your preferred interface language for PhoneMail.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { code: 'en', label: 'English', native: 'English' },
                  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
                  { code: 'es', label: 'Spanish', native: 'Español' },
                  { code: 'fr', label: 'French', native: 'Français' }
                ].map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLanguage(lang.code as any)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedLanguage === lang.code
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{lang.native}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">{lang.label}</div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleLanguageNext}
                className="w-full mt-4 py-2.5 bg-slate-900 dark:bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Screen 2: Terms & Conditions */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
                <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Screen 2: Terms & Privacy</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 max-h-40 overflow-y-auto space-y-2">
                <p className="font-semibold text-slate-800 dark:text-slate-100">PhoneMail Service Agreement</p>
                <p>
                  1. <strong>Identity Principle:</strong> Your verified phone number constitutes your PhoneMail email identity (<span className="font-mono text-emerald-700 dark:text-emerald-400">phone@phonemail.com</span>).
                </p>
                <p>
                  2. <strong>Delivery & Notifications:</strong> External emails sent to your PhoneMail ID will be ingested and may trigger real-time SMS alerts to your phone.
                </p>
                <p>
                  3. <strong>Anti-Abuse:</strong> Spamming or sending unsolicited bulk commercial email is strictly prohibited.
                </p>
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={agreedTerms}
                  onChange={(e) => setAgreedTerms(e.target.checked)}
                  className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>
                  By signing up, you agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsDetail(true)}
                    className="text-emerald-700 dark:text-emerald-400 font-semibold underline hover:text-emerald-800"
                  >
                    Terms of Service
                  </button>{' '}
                  and Privacy Policy.
                </span>
              </label>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!agreedTerms}
                  onClick={handleTermsNext}
                  className="flex-2 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  <span>Agree & Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Screen 3: Phone Number Verification */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Screen 3: Phone Number Verification</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Enter your phone number. It will be converted into your official PhoneMail ID.
              </p>

              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number (Auto-normalized)
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-mono text-slate-500 dark:text-slate-400 font-semibold">+</span>
                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel"
                      inputMode="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="9876543210"
                      required
                      className="w-full pl-7 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Include country code when possible (e.g. 19876543210). Browsers cannot read your SIM number directly.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Your Name (Display Name)
                  </label>
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Full Name"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span className="font-medium">Assigned PhoneMail Address:</span>
                  <span className="font-mono font-bold">{phoneNumber.replace(/\D/g, '') || 'phone'}@phonemail.com</span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  By continuing you agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsDetail(true)}
                    className="text-emerald-700 dark:text-emerald-400 font-semibold underline"
                  >
                    Terms of Service
                  </button>
                  . New accounts can also register at{' '}
                  <a href="/register" className="text-emerald-700 dark:text-emerald-400 font-semibold underline">
                    /register
                  </a>
                  .
                </p>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading ? 'Sending OTP...' : 'Next'}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Screen 4: OTP Verification / Password Fallback */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
                  {usePasswordFallback ? (
                    <>
                      <Lock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Password Authentication</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>Screen 4: Verify OTP</span>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setUsePasswordFallback(!usePasswordFallback)}
                  className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 underline"
                >
                  {usePasswordFallback ? 'Use OTP Login' : 'Password Fallback'}
                </button>
              </div>

              {!usePasswordFallback ? (
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter the 6-digit code sent to <strong className="font-mono text-slate-800 dark:text-slate-200">+{phoneNumber}</strong>.
                  </p>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                      OTP Code
                    </label>
                    <input
                      type="text"
                      name="one-time-code"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter OTP"
                      required
                      className="w-full text-center tracking-widest text-lg font-mono py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {demoReceivedCode && (
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                      Demo OTP (dev only): <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{demoReceivedCode}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                    <button
                      type="button"
                      onClick={() => setShowTermsDetail(true)}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold underline"
                    >
                      Terms of Service
                    </button>
                  </p>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setStep(3)}
                      className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Change Phone
                    </button>
                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 4}
                      className="flex-2 py-2.5 bg-emerald-600 text-white text-xs font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? 'Verifying...' : 'Next'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handlePasswordLogin} className="space-y-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Enter your account password for <strong className="font-mono text-slate-800 dark:text-slate-200">+{phoneNumber}</strong>. (Demo password: <code className="font-mono text-emerald-700 dark:text-emerald-400">Password123!</code>)
                  </p>

                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      required
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setUsePasswordFallback(false)}
                      className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Back to OTP
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !password}
                      className="flex-2 py-2.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? 'Authenticating...' : 'Sign In'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Quick Demo Shortcuts for Buildathon Evaluators */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" />
              <span>AlphaStack Quick Demo Accounts</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickDemo('9876543210', 'Nikhil Nitt')}
                className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-xl text-left transition-colors"
              >
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">User 1: Nikhil</div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">9876543210</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemo('9123456789', 'Sarah Chen')}
                className="p-2 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 rounded-xl text-left transition-colors"
              >
                <div className="text-[11px] font-bold text-slate-800 dark:text-slate-100">User 2: Sarah</div>
                <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">9123456789</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
