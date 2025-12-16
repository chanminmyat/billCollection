"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "./contexts/auth-context";
import { useRouter } from "next/navigation";
import { Building2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const [credentials, setCredentials] = useState({
    identifier: "",
    password: "",
  });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isForgotOpen, setIsForgotOpen] = useState(false);
  const [resetChoice, setResetChoice] = useState<"email" | "security">("email");
  const [forgotData, setForgotData] = useState({
    email: "",
    identifier: "",
    securityAnswers: [] as string[],
  });
  const [securityQuestions, setSecurityQuestions] = useState<
    { question: string; prompt: string }[]
  >([]);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [isFetchingQuestions, setIsFetchingQuestions] = useState(false);
  const [isVerifyingAnswers, setIsVerifyingAnswers] = useState(false);
  const [emailResetStatus, setEmailResetStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const { login } = useAuth();
  const router = useRouter();
  const resetCloseTimer = useRef<NodeJS.Timeout | null>(null);

  const [passwordVisible, setPasswordVisible] = useState({
    login: false,
  });
  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!credentials.identifier || !credentials.password) {
      setErrorMessage("Please enter your login details.");
      return;
    }

    setIsSubmitting(true);
    try {
      await login(credentials.identifier, credentials.password);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to login. Please try again.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchSecurityQuestions = async () => {
    if (!forgotData.identifier) {
      setSecurityError("Please enter your email or username first.");
      return;
    }

    setSecurityError(null);
    setIsVerifyingAnswers(false);
    setIsFetchingQuestions(true);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/security-questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier: forgotData.identifier }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          data?.message ??
          "Unable to load security questions. Please try again.";
        throw new Error(message);
      }

      const questions = Array.isArray(data?.questions) ? data.questions : [];
      setSecurityQuestions(
        questions.map((item: { question: any; prompt: any }) => ({
          question: item.question ?? "",
          prompt: item.prompt ?? item.question ?? "",
        }))
      );
      setForgotData((prev) => ({
        ...prev,
        securityAnswers: new Array(questions.length).fill(""),
      }));
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load security questions.";
      setSecurityError(message);
    } finally {
      setIsFetchingQuestions(false);
    }
  };

  useEffect(() => {
    if (emailResetStatus?.type === "success" && isForgotOpen) {
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
        type: "error",
        message: "Please enter your registered email.",
      });
      return;
    }

    setEmailResetStatus(null);
    setIsSendingEmail(true);

    try {
      const response = await fetch("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        type: "success",
        message:
          data?.message ?? "Reset link sent. Please check your email inbox.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to process reset request.";
      setEmailResetStatus({ type: "error", message });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleSecurityResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!forgotData.identifier || securityQuestions.length === 0) {
      setSecurityError("Please load your security questions first.");
      return;
    }

    if (forgotData.securityAnswers.some((answer) => !answer)) {
      setSecurityError("Please answer all security questions.");
      return;
    }

    setSecurityError(null);
    setIsVerifyingAnswers(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/auth/security-question-reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            identifier: forgotData.identifier,
            answers: securityQuestions.map((question, index) => ({
              question: question.question,
              answer: forgotData.securityAnswers[index],
            })),
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        const message = data?.message ?? "Unable to verify your answers.";
        throw new Error(message);
      }

      router.push(`/reset-password?token=${encodeURIComponent(data.token)}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to verify your answers.";
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
      setResetChoice("email");
      setForgotData({ email: "", identifier: "", securityAnswers: [] });
      setSecurityQuestions([]);
      setSecurityError(null);
      setIsVerifyingAnswers(false);
      setEmailResetStatus(null);
      setIsSendingEmail(false);
    }
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4'>
      <Card className='w-full max-w-md'>
        <CardHeader className='text-center'>
          <div className='flex justify-center mb-4'>
            <Building2 className='h-12 w-12 text-blue-600' />
          </div>
          <CardTitle className='text-2xl font-bold text-gray-800'>
            Bill Pro
          </CardTitle>
          <p className='text-gray-600'>Billing Management System</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className='space-y-4'>
            <div className='space-y-2'>
              <Label htmlFor='identifier'>Email / Username / Phone</Label>
              <Input
                id='identifier'
                type='text'
                placeholder='Enter your email, username, or phone'
                value={credentials.identifier}
                onChange={(e) =>
                  setCredentials({ ...credentials, identifier: e.target.value })
                }
                autoComplete='username'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='password'>Password</Label>
              <div className='relative'>
                <Input
                  id='password'
                  type={passwordVisible.login ? "text" : "password"}
                  placeholder='Enter password'
                  value={credentials.password}
                  onChange={(e) =>
                    setCredentials({ ...credentials, password: e.target.value })
                  }
                  autoComplete='current-password'
                  required
                  className='pr-10'
                />
                <button
                  type='button'
                  onClick={() =>
                    setPasswordVisible((prev) => ({
                      ...prev,
                      login: !prev.login,
                    }))
                  }
                  className='absolute inset-y-0 right-2 text-gray-500 hover:text-gray-800'
                  aria-label={
                    passwordVisible.login ? "Hide password" : "Show password"
                  }
                >
                  {passwordVisible.login ? (
                    <EyeOff className='h-4 w-4' />
                  ) : (
                    <Eye className='h-4 w-4' />
                  )}
                </button>
              </div>
            </div>
            {errorMessage && (
              <div className='text-sm text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2'>
                {errorMessage}
              </div>
            )}
            <Button type='submit' className='w-full' disabled={isSubmitting}>
              {isSubmitting ? "Signing In..." : "Sign In"}
            </Button>
            <button
              type='button'
              className='w-full text-sm text-blue-600 hover:underline'
              onClick={() => handleForgotOpenChange(true)}
            >
              Forgot password?
            </button>
          </form>
          <div className='mt-6 text-sm text-gray-500 text-center'>
            <p>Demo credentials:</p>
            <p>Use any valid email, username, or phone number plus password.</p>
          </div>
        </CardContent>
      </Card>

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
              setResetChoice(value as "email" | "security")
            }
          >
            <TabsList className='grid grid-cols-2'>
              <TabsTrigger value='email'>Email</TabsTrigger>
              <TabsTrigger value='security'>Security Question</TabsTrigger>
            </TabsList>
            <TabsContent value='email'>
              <form className='space-y-3 mt-4' onSubmit={handleForgotSubmit}>
                <Label htmlFor='forgotEmail'>Registered Email</Label>
                <Input
                  id='forgotEmail'
                  type='email'
                  value={forgotData.email}
                  onChange={(e) =>
                    setForgotData({ ...forgotData, email: e.target.value })
                  }
                  required
                />
                {emailResetStatus && (
                  <p
                    className={`text-sm ${
                      emailResetStatus.type === "error"
                        ? "text-red-600"
                        : "text-green-600"
                    }`}
                  >
                    {emailResetStatus.message}
                  </p>
                )}
                <DialogFooter>
                  <Button
                    type='submit'
                    disabled={!forgotData.email || isSendingEmail}
                  >
                    {isSendingEmail ? "Sending..." : "Send Reset Email"}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value='security'>
              <div className='space-y-4 mt-4'>
                <div className='space-y-2'>
                  <Label htmlFor='forgotIdentifier'>Username / Phone</Label>
                  <div className='flex gap-2'>
                    <Input
                      id='forgotIdentifier'
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
                      type='button'
                      variant='outline'
                      onClick={fetchSecurityQuestions}
                      disabled={!forgotData.identifier || isFetchingQuestions}
                    >
                      {isFetchingQuestions ? "Loading..." : "Load Questions"}
                    </Button>
                  </div>
                </div>
                {securityError && (
                  <p className='text-sm text-red-600'>{securityError}</p>
                )}
                {securityQuestions.length > 0 && (
                  <form
                    className='space-y-3'
                    onSubmit={handleSecurityResetSubmit}
                  >
                    {securityQuestions.map((question, index) => (
                      <div
                        className='space-y-2'
                        key={`${question.question}-${index}`}
                      >
                        <Label htmlFor={`security-answer-${index}`}>
                          {question.prompt || question.question}
                        </Label>
                        <Input
                          id={`security-answer-${index}`}
                          value={forgotData.securityAnswers[index] ?? ""}
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
                    <DialogFooter className='flex flex-col gap-2 sm:flex-row sm:justify-end'>
                      <Button
                        type='submit'
                        disabled={
                          isVerifyingAnswers ||
                          forgotData.securityAnswers.some((answer) => !answer)
                        }
                      >
                        {isVerifyingAnswers
                          ? "Verifying..."
                          : "Continue with Security Question"}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
