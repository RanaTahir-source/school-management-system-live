import { FormEvent, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, BarChart3, CalendarCheck2, CheckCircle2, GraduationCap } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resetSuccess = Boolean((location.state as any)?.resetSuccess);

  if (isAuthenticated) {
    const from = (location.state as any)?.from?.pathname || '/';
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body?.message || 'Login failed');
      } else {
        setError('Something went wrong. Please try again.');
      }
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
          <h1 className="text-3xl font-semibold leading-tight">
            Run every campus from one place.
          </h1>
          <p className="text-sm leading-relaxed text-white/60">
            Attendance, fee collection, exam results, and academic records for every branch
            &mdash; unified, accurate, and always up to date.
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

          <h2 className="text-2xl font-semibold text-foreground">Welcome back</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in with the email and password provided by your school.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {resetSuccess && (
              <div className="flex items-start gap-1.5 rounded-lg border border-emerald-600/20 bg-emerald-600/5 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Password reset. Sign in with your new password.</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="director@yourschool.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" loading={submitting}>
              Sign in
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Having trouble signing in? Contact your school administrator.
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
