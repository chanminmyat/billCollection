'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from './contexts/auth-context';
import { useRouter } from 'next/navigation';
import { AlertCircle, Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import {
  fetchSystemBranding,
  readSystemBranding,
  SYSTEM_BRANDING_STORAGE_KEY,
  SYSTEM_BRANDING_UPDATED_EVENT,
} from '@/lib/system-branding';
import type { SystemBranding } from '@/lib/system-branding';

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    identifier: '',
    password: '',
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    identifier?: string;
    password?: string;
  }>({});
  const [capsLockOn, setCapsLockOn] = useState(false);
  const loginInFlight = useRef(false);
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const loginErrorRef = useRef<HTMLDivElement>(null);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [resetChoice, setResetChoice] = useState<'email' | 'security'>('email');
  const [forgotData, setForgotData] = useState({
    email: '',
    identifier: '',
    securityAnswers: [] as string[],
  });
  const [securityQuestions, setSecurityQuestions] = useState<
    { question: string; prompt: string }[]
  >([]);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [isFetchingQuestions, setIsFetchingQuestions] = useState(false);
  const [isVerifyingAnswers, setIsVerifyingAnswers] = useState(false);
  const [emailResetStatus, setEmailResetStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const resetCloseTimer = useRef<NodeJS.Timeout | null>(null);
  const [branding, setBranding] = useState<SystemBranding>(() =>
    readSystemBranding(),
  );

  const [passwordVisible, setPasswordVisible] = useState({
    login: false,
  });
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncBranding = () => {
      setBranding(readSystemBranding());
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SYSTEM_BRANDING_STORAGE_KEY) {
        syncBranding();
      }
    };
    fetchSystemBranding()
      .then(setBranding)
      .catch(() => {
        syncBranding();
      });
    window.addEventListener('storage', onStorage);
    window.addEventListener(
      SYSTEM_BRANDING_UPDATED_EVENT,
      syncBranding as EventListener,
    );
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(
        SYSTEM_BRANDING_UPDATED_EVENT,
        syncBranding as EventListener,
      );
    };
  }, []);

  useEffect(() => {
    if (errorMessage) loginErrorRef.current?.focus();
  }, [errorMessage]);

  const updateCredential = (
    field: 'identifier' | 'password',
    value: string,
  ) => {
    setCredentials((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setErrorMessage(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginInFlight.current) return;

    const identifier = credentials.identifier.trim();
    const errors: { identifier?: string; password?: string } = {};
    if (!identifier) errors.identifier = 'Enter your email, username or phone.';
    if (!credentials.password) errors.password = 'Enter your password.';
    setFieldErrors(errors);
    setErrorMessage(null);

    if (errors.identifier || errors.password) {
      (errors.identifier ? identifierRef : passwordRef).current?.focus();
      return;
    }

    loginInFlight.current = true;
    setIsSubmitting(true);
    try {
      // Keep the form locked while the existing auth flow opens the dashboard.
      await login(identifier, credentials.password);
    } catch (error) {
      setErrorMessage(
        error instanceof TypeError
          ? 'Unable to connect. Please try again.'
          : error instanceof Error
            ? error.message
            : 'Unable to sign in. Please try again.',
      );
      loginInFlight.current = false;
      setIsSubmitting(false);
    }
  };

  const fetchSecurityQuestions = async () => {
    if (!forgotData.identifier) {
      setSecurityError('Please enter your email or username first.');
      return;
    }

    setSecurityError(null);
    setIsVerifyingAnswers(false);
    setIsFetchingQuestions(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/security-questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identifier: forgotData.identifier }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data?.message ??
          'Unable to load security questions. Please try again.';
        throw new Error(message);
      }

      const questions = Array.isArray(data?.questions) ? data.questions : [];
      setSecurityQuestions(
        questions.map((item: { question: any; prompt: any }) => ({
          question: item.question ?? '',
          prompt: item.prompt ?? item.question ?? '',
        })),
      );
      setForgotData((prev) => ({
        ...prev,
        securityAnswers: new Array(questions.length).fill(''),
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load security questions.';
      setSecurityError(message);
    } finally {
      setIsFetchingQuestions(false);
    }
  };

  useEffect(() => {
    if (emailResetStatus?.type === 'success' && isForgotOpen) {
      if (resetCloseTimer.current) {
        clearTimeout(resetCloseTimer.current);
      }
      resetCloseTimer.current = setTimeout(() => {
        handleForgotOpenChange(false);
      }, 3000);
    }
    return () => {
      if (resetCloseTimer.current) {
        clearTimeout(resetCloseTimer.current);
        resetCloseTimer.current = null;
      }
    };
  }, [emailResetStatus, isForgotOpen]);

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotData.email) {
      setEmailResetStatus({
        type: 'error',
        message: 'Please enter your registered email.',
      });
      return;
    }

    setEmailResetStatus(null);
    setIsSendingEmail(true);

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotData.email }),
      });

      const raw = await response.text(); // <-- always read text first
      let data: any = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = { message: raw }; // if server returned non-JSON
      }

      if (!response.ok) {
        throw new Error(data?.message || `Request failed (${response.status})`);
      }

      setEmailResetStatus({
        type: 'success',
        message:
          data?.message ?? 'Reset link sent. Please check your email inbox.',
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to process reset request.';
      setEmailResetStatus({ type: 'error', message });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSecurityResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotData.identifier || securityQuestions.length === 0) {
      setSecurityError('Please load your security questions first.');
      return;
    }

    if (forgotData.securityAnswers.some((answer) => !answer)) {
      setSecurityError('Please answer all security questions.');
      return;
    }

    setSecurityError(null);
    setIsVerifyingAnswers(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/security-question-reset`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            identifier: forgotData.identifier,
            answers: securityQuestions.map((question, index) => ({
              question: question.question,
              answer: forgotData.securityAnswers[index],
            })),
          }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.message ?? 'Unable to verify your answers.';
        throw new Error(message);
      }

      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to verify your answers.';
      setSecurityError(message);
    }
    setIsVerifyingAnswers(false);
  };

  const handleForgotOpenChange = (open: boolean) => {
    if (!open && resetCloseTimer.current) {
      clearTimeout(resetCloseTimer.current);
      resetCloseTimer.current = null;
    }
    setIsForgotOpen(open);
    if (!open) {
      setResetChoice('email');
      setForgotData({ email: '', identifier: '', securityAnswers: [] });
      setSecurityQuestions([]);
      setSecurityError(null);
      setIsVerifyingAnswers(false);
      setEmailResetStatus(null);
      setIsSendingEmail(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 supports-[height:100svh]:min-h-[100svh] sm:px-6">
      <div className="w-full max-w-[420px]">
        <div className="mb-7 flex min-w-0 items-center justify-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            {branding.logoDataUrl ? (
              <img
                src={branding.logoDataUrl}
                alt=""
                className="h-8 w-8 rounded-lg bg-white object-contain p-1"
              />
            ) : (
              <Building2
                className="h-5 w-5"
                strokeWidth={1.7}
                aria-hidden="true"
              />
            )}
          </div>
          <span className="min-w-0 break-words text-xl font-semibold tracking-tight">
            {branding.systemName}
          </span>
        </div>
        <Card className="rounded-2xl border-border/80 shadow-[0_2px_4px_rgba(24,34,31,0.02),0_16px_48px_-20px_rgba(24,34,31,0.16)]">
          <CardHeader className="px-6 pb-6 pt-7 sm:px-8 sm:pt-8">
            <h1
              id="sign-in-heading"
              className="text-[26px] font-semibold leading-tight tracking-tight"
            >
              Sign in
            </h1>
          </CardHeader>
          <CardContent className="px-6 pb-7 sm:px-8 sm:pb-8">
            <form
              onSubmit={handleLogin}
              noValidate
              aria-labelledby="sign-in-heading"
              aria-busy={isSubmitting}
              className="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="identifier" className="text-[13px] font-medium">
                  Email, username or phone
                </Label>
                <Input
                  ref={identifierRef}
                  id="identifier"
                  name="username"
                  type="text"
                  placeholder="Email, username or phone"
                  value={credentials.identifier}
                  onChange={(e) =>
                    updateCredential('identifier', e.target.value)
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !credentials.password) {
                      e.preventDefault();
                      passwordRef.current?.focus();
                    }
                  }}
                  className="h-12 rounded-lg px-3.5 text-base aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint={credentials.password ? 'go' : 'next'}
                  aria-invalid={Boolean(fieldErrors.identifier)}
                  aria-describedby={
                    fieldErrors.identifier ? 'identifier-error' : undefined
                  }
                  disabled={isSubmitting}
                  required
                />
                {fieldErrors.identifier && (
                  <p
                    id="identifier-error"
                    className="text-xs leading-relaxed text-destructive"
                  >
                    {fieldErrors.identifier}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex h-7 items-center justify-between gap-2">
                  <Label htmlFor="password" className="text-[13px] font-medium">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => handleForgotOpenChange(true)}
                    disabled={isSubmitting}
                    className="inline-flex min-h-[44px] shrink-0 items-center rounded-md px-1 text-xs font-medium text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    ref={passwordRef}
                    id="password"
                    name="password"
                    type={passwordVisible.login ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={credentials.password}
                    onChange={(e) =>
                      updateCredential('password', e.target.value)
                    }
                    onKeyDown={(e) =>
                      setCapsLockOn(e.getModifierState('CapsLock'))
                    }
                    onKeyUp={(e) =>
                      setCapsLockOn(e.getModifierState('CapsLock'))
                    }
                    onBlur={() => setCapsLockOn(false)}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={
                      [
                        fieldErrors.password ? 'password-error' : '',
                        capsLockOn ? 'caps-lock-hint' : '',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    disabled={isSubmitting}
                    required
                    className="h-12 rounded-lg pl-3.5 pr-12 text-base aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/20"
                  />
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() =>
                      setPasswordVisible((current) => ({
                        ...current,
                        login: !current.login,
                      }))
                    }
                    className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    aria-label={
                      passwordVisible.login ? 'Hide password' : 'Show password'
                    }
                    aria-pressed={passwordVisible.login}
                    aria-controls="password"
                  >
                    {passwordVisible.login ? (
                      <EyeOff
                        className="h-[18px] w-[18px]"
                        aria-hidden="true"
                      />
                    ) : (
                      <Eye className="h-[18px] w-[18px]" aria-hidden="true" />
                    )}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p
                    id="password-error"
                    className="text-xs leading-relaxed text-destructive"
                  >
                    {fieldErrors.password}
                  </p>
                )}
                {capsLockOn && (
                  <p
                    id="caps-lock-hint"
                    role="status"
                    className="text-xs text-muted-foreground"
                  >
                    Caps Lock is on.
                  </p>
                )}
              </div>
              {errorMessage && (
                <div
                  ref={loginErrorRef}
                  id="login-error"
                  role="alert"
                  tabIndex={-1}
                  className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/5 px-3 py-3 text-xs leading-relaxed text-destructive focus:outline-none focus:ring-2 focus:ring-destructive/25"
                >
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{errorMessage}</span>
                </div>
              )}
              <Button
                type="submit"
                className="!mt-6 h-12 w-full rounded-lg text-sm font-semibold shadow-[0_2px_3px_rgba(0,0,0,0.08)] active:translate-y-px motion-reduce:transform-none"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
            <span className="sr-only" role="status">
              {isSubmitting ? 'Signing in. Please wait.' : ''}
            </span>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isForgotOpen} onOpenChange={handleForgotOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Choose how you would like to reset your password.
            </DialogDescription>
          </DialogHeader>
          <Tabs
            value={resetChoice}
            onValueChange={(value) =>
              setResetChoice(value as 'email' | 'security')
            }
          >
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="email">Email</TabsTrigger>
              <TabsTrigger value="security">Security Question</TabsTrigger>
            </TabsList>
            <TabsContent value="email">
              <form className="space-y-3 mt-4" onSubmit={handleForgotSubmit}>
                <Label htmlFor="forgotEmail">Registered Email</Label>
                <Input
                  id="forgotEmail"
                  type="email"
                  value={forgotData.email}
                  onChange={(e) =>
                    setForgotData({ ...forgotData, email: e.target.value })
                  }
                  required
                />
                {emailResetStatus && (
                  <p
                    className={`text-sm ${
                      emailResetStatus.type === 'error'
                        ? 'text-red-600'
                        : 'text-green-600'
                    }`}
                  >
                    {emailResetStatus.message}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={!forgotData.email || isSendingEmail}
                  >
                    {isSendingEmail ? 'Sending...' : 'Send Reset Email'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="security">
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotIdentifier">Username / Phone</Label>
                  <div className="flex gap-2">
                    <Input
                      id="forgotIdentifier"
                      value={forgotData.identifier}
                      onChange={(e) =>
                        setForgotData({
                          ...forgotData,
                          identifier: e.target.value,
                        })
                      }
                      required
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={fetchSecurityQuestions}
                      disabled={!forgotData.identifier || isFetchingQuestions}
                    >
                      {isFetchingQuestions ? 'Loading...' : 'Load Questions'}
                    </Button>
                  </div>
                </div>
                {securityError && (
                  <p className="text-sm text-red-600">{securityError}</p>
                )}
                {securityQuestions.length > 0 && (
                  <form
                    className="space-y-3"
                    onSubmit={handleSecurityResetSubmit}
                  >
                    {securityQuestions.map((question, index) => (
                      <div
                        className="space-y-2"
                        key={`${question.question}-${index}`}
                      >
                        <Label htmlFor={`security-answer-${index}`}>
                          {question.prompt || question.question}
                        </Label>
                        <Input
                          id={`security-answer-${index}`}
                          value={forgotData.securityAnswers[index] ?? ''}
                          onChange={(e) => {
                            const newAnswers = [...forgotData.securityAnswers];
                            newAnswers[index] = e.target.value;
                            setForgotData({
                              ...forgotData,
                              securityAnswers: newAnswers,
                            });
                          }}
                          required
                        />
                      </div>
                    ))}
                    <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                      <Button
                        type="submit"
                        disabled={
                          isVerifyingAnswers ||
                          forgotData.securityAnswers.some((answer) => !answer)
                        }
                      >
                        {isVerifyingAnswers
                          ? 'Verifying...'
                          : 'Continue with Security Question'}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </main>
  );
}
