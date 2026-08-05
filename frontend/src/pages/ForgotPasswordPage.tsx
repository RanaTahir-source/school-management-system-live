import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, BarChart3, CalendarCheck2, CheckCircle2, GraduationCap } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'code';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<{ message: string }>(
        '/auth/forgot-password',
        { email },
        { skipAuth: true },
      );
      setInfo(res.message);
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message || 'Something went wrong' : 'Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword }, { skipAuth: true });
      navigate('/login', { replace: true, state: { resetSuccess: true } });
    } catch (err) {
      setError(err instanceof ApiError ? err.body?.message || 'Invalid or expired code' : 'Could not reach the server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Branding panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgba(99,102,241,0.35), transparent 40%), radial-gradient(circle at 85% 80%, rgba(99,102,241,0.25), transparent 45%)',
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
            <GraduationCap className="h-5 w-5 text-sidebar" />
          </div>
          <span className="text-lg font-semibold">School Management System</span>
        </div>

        <div className="relative max-w-md space-y-8">
          <h1 className="text-3xl font-semibold leading-tight">Run every campus from one place.</h1>
          <p className="text-sm leading-relaxed text-white/60">
            Attendance, fee collection, exam results, and academic records for Jandanwala, Rodi
            and Ali Khel campuses &mdash; unified, accurate, and always up to date.
          </p>

          <div className="space-y-4 pt-4">
            <Feature icon={CalendarCheck2} label="Daily attendance & one-page registers" />
            <Feature icon={BarChart3} label="Income, expenses & branch-wise finance reports" />
            <Feature icon={ShieldCheck} label="Role-based access, school by school" />
          </div>
        </div>

        <p className="relative text-xs text-white/40">&copy; 2026 School Management System</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-border">
                <GraduationCap className="h-5 w-5 text-sidebar" />
              </div>
              <span className="text-lg font-semibold">School Management System</span>
            </div>
          </div>

          {step === 'email' ? (
            <>
              <h2 className="text-2xl font-semibold text-foreground">Reset your password</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Enter your account email and we&rsquo;ll send a 6-digit verification code.
              </p>

              <form onSubmit={requestCode} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="username"
                    placeholder="director@daralarqam.local"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={submitting}>
                  Send verification code
                </Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-foreground">Enter the code</h2>
              {info && (
                <div className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{info}</span>
                </div>
              )}

              <form onSubmit={resetPassword} className="mt-8 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="otp">Verification code</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="newPassword">New password</Label>
                  <PasswordInput
                    id="newPassword"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" loading={submitting}>
                  Reset password
                </Button>

                <button
                  type="button"
                  className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setStep('email')}
                >
                  Didn&rsquo;t get a code? Try a different email
                </button>
              </form>
            </>
          )}

          <p className="mt-8 text-center text-xs text-muted-foreground">
            <Link to="/login" className="font-medium text-foreground hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label }: { icon: typeof CalendarCheck2; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
        <Icon className="h-4 w-4" />
      </div>
      <span className="text-sm text-white/80">{label}</span>
    </div>
  );
}
