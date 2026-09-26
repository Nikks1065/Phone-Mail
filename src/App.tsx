import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { Header } from './components/common/Header.tsx';
import { MobileApp } from './components/mobile/MobileApp.tsx';
import { DesktopApp } from './components/desktop/DesktopApp.tsx';
import { OnboardingModal } from './components/auth/OnboardingModal.tsx';
import { RegistrationPortal } from './components/auth/RegistrationPortal.tsx';
import { ComposeModal } from './components/compose/ComposeModal.tsx';
import { SettingsModal } from './components/settings/SettingsModal.tsx';
import { InboundEmailSimulator } from './components/simulators/InboundEmailSimulator.tsx';
import { IvrSimulator } from './components/simulators/IvrSimulator.tsx';
import { SmsLogsModal } from './components/simulators/SmsLogsModal.tsx';
import { ViewportMode } from './types.ts';
import { api } from './services/api.ts';

function MainApp() {
  const { user, loading } = useAuth();
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Dedicated registration-only portal
  if (path === '/register' || path.startsWith('/register/')) {
    return <RegistrationPortal />;
  }

  const [viewportMode, setViewportMode] = useState<ViewportMode>('responsive');
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);

  // Modals state
  const [isComposeOpen, setIsComposeOpen] = useState<boolean>(false);
  const [composeContext, setComposeContext] = useState<{
    conversationId?: string;
    to?: string[];
    isLocked?: boolean;
    subject?: string;
    body?: string;
    inReplyToId?: string | null;
  }>({});

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isInboundOpen, setIsInboundOpen] = useState<boolean>(false);
  const [isIvrOpen, setIsIvrOpen] = useState<boolean>(false);
  const [isSmsLogsOpen, setIsSmsLogsOpen] = useState<boolean>(false);

  const [globalNotice, setGlobalNotice] = useState<string>('');

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine whether to show mobile or desktop
  const isMobileLayout =
    viewportMode === 'mobile' || (viewportMode === 'responsive' && windowWidth < 860);

  const handleOpenCompose = (conversationId?: string, to?: string[], isLocked = false) => {
    setComposeContext({
      conversationId,
      to,
      isLocked
    });
    setIsComposeOpen(true);
  };

  useEffect(() => {
    const onForward = (event: Event) => {
      const detail = (event as CustomEvent<{ subject: string; body: string }>).detail;
      setComposeContext({
        subject: detail?.subject,
        body: detail?.body,
        to: [],
        isLocked: false
      });
      setIsComposeOpen(true);
    };
    window.addEventListener('phonemail:forward', onForward);
    return () => window.removeEventListener('phonemail:forward', onForward);
  }, []);

  const handleResetSeed = async () => {
    try {
      await api.resetSeed();
      setGlobalNotice('Database re-seeded successfully with demo threads & contacts.');
      setTimeout(() => setGlobalNotice(''), 4000);
      window.location.reload();
    } catch (err: any) {
      console.warn('Seed reset failed', err);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white space-y-4 font-sans">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center animate-pulse">
          <img
            src="/src/assets/images/phonemail_brand_mark_1790265389236.jpg"
            alt="PhoneMail Emblem"
            referrerPolicy="no-referrer"
            className="w-10 h-10 rounded-xl object-cover"
          />
        </div>
        <div className="text-sm font-semibold tracking-wide text-slate-300">Loading PhoneMail...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans select-none sm:select-auto transition-colors duration-300 ease-in-out">
      {/* Universal Top Header with Brand, Identity, Viewport Switcher & Simulator Tools */}
      <Header
        viewportMode={viewportMode}
        setViewportMode={setViewportMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenInboundSimulator={() => setIsInboundOpen(true)}
        onOpenIvrSimulator={() => setIsIvrOpen(true)}
        onOpenSmsLogs={() => setIsSmsLogsOpen(true)}
        onResetSeed={handleResetSeed}
        unreadCount={0}
      />

      {/* Global Banner Notice */}
      {globalNotice && (
        <div className="bg-emerald-600 text-white text-xs px-4 py-1.5 text-center font-semibold shadow-xs">
          {globalNotice}
        </div>
      )}

      {/* Main Viewport Content */}
      <main className="flex-1 flex flex-col overflow-hidden transition-colors duration-300 ease-in-out">
        {isMobileLayout ? (
          <MobileApp
            onOpenCompose={handleOpenCompose}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        ) : (
          <DesktopApp
            onOpenCompose={handleOpenCompose}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
        )}
      </main>

      {/* Onboarding & Auth Modal (if user not signed in) */}
      <OnboardingModal isOpen={!user} />

      {/* Traditional & Conversation Compose Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={(conv) => {
          setGlobalNotice(`Email sent successfully to ${conv.subject}. SMS alert triggered.`);
          setTimeout(() => setGlobalNotice(''), 4000);
        }}
        initialConversationId={composeContext.conversationId}
        initialTo={composeContext.to}
        isLockedRecipient={composeContext.isLocked}
        initialSubject={composeContext.subject}
        initialBody={composeContext.body}
        inReplyToId={composeContext.inReplyToId}
      />

      {/* Profile & Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Inbound Email Simulator Modal */}
      <InboundEmailSimulator
        isOpen={isInboundOpen}
        onClose={() => setIsInboundOpen(false)}
        onEmailIngested={() => {
          setGlobalNotice('Inbound email ingested into PhoneMail! SMS alert dispatched to phone.');
          setTimeout(() => setGlobalNotice(''), 4000);
        }}
      />

      {/* Toll-Free IVR Telephony Simulator Modal */}
      <IvrSimulator
        isOpen={isIvrOpen}
        onClose={() => setIsIvrOpen(false)}
        onAccountCreated={() => {
          setGlobalNotice('New user account provisioned via Toll-Free IVR dial-in!');
          setTimeout(() => setGlobalNotice(''), 4000);
        }}
      />

      {/* SMS Notifications Audit Logs Modal */}
      <SmsLogsModal
        isOpen={isSmsLogsOpen}
        onClose={() => setIsSmsLogsOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ThemeProvider>
  );
}
