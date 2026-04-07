import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ── Validation schemas ────────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

const signupSchema = z.object({
  fullName:    z.string().min(2, 'Full name must be at least 2 characters'),
  email:       z.string().email('Enter a valid email address'),
  password:    z.string().min(8, 'Password must be at least 8 characters'),
  companyName: z.string().min(2, 'Company name must be at least 2 characters'),
})

// ── Field component ───────────────────────────────────────────────────────────

function Field({ label, error, hint, ...props }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-slate-600">{label}</label>
      <input
        className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900 bg-slate-50
          placeholder-slate-400 outline-none transition-all
          focus:bg-white focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
          ${error
            ? 'border-red-400 bg-red-50 focus:border-red-400 focus:ring-red-400/10'
            : 'border-slate-200'
          }`}
        {...props}
      />
      {hint  && !error && <p className="text-xs text-slate-400">{hint}</p>}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <a href="https://roundone-theta.vercel.app" className="inline-flex items-center gap-2.5 mb-8">
      <div className="w-9 h-9 rounded-xl bg-[#005ea4] flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-sm tracking-tight">R1</span>
      </div>
      <span className="text-xl font-bold text-slate-900 tracking-tight">RoundOne</span>
    </a>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [mode,                setMode]                = useState('login')
  const [serverError,         setServerError]         = useState('')
  const [isSubmitting,        setIsSubmitting]        = useState(false)
  // Token from email link
  const [tokenError,          setTokenError]          = useState('')
  const [verifying,           setVerifying]           = useState(false)
  // After signup — waiting for user to verify
  const [pendingVerification, setPendingVerification] = useState(false)
  const [pendingEmail,        setPendingEmail]        = useState('')
  const [resending,           setResending]           = useState(false)
  // Login attempted before verification
  const [unverifiedEmail,     setUnverifiedEmail]     = useState('')

  const navigate    = useNavigate()
  const { user, loading } = useAuth()
  const isLogin     = mode === 'login'

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(isLogin ? loginSchema : signupSchema),
  })

  // ── Handle email confirmation token on mount ──────────────────────────────
  //
  // Supabase sends one of two URL formats when a user clicks a confirmation link:
  //
  //   Implicit flow:  /auth#access_token=xxx&refresh_token=xxx&type=signup
  //   OTP flow:       /auth?token_hash=xxx&type=signup  (or type=email)
  //
  // We detect both, exchange the token for a session explicitly (don't rely on
  // Supabase's auto-detection which has a race condition with our hash scrub),
  // then route based on password_set.

  useEffect(() => {
    async function handleConfirmation() {
      const hashParams   = new URLSearchParams(window.location.hash.slice(1))
      const searchParams = new URLSearchParams(window.location.search)

      // ── Error in URL ────────────────────────────────────────────────────
      if (hashParams.get('error') || searchParams.get('error')) {
        setTokenError(
          'This verification link has expired or is no longer valid. ' +
          'Please request a new one below.'
        )
        window.history.replaceState(null, '', window.location.pathname)
        return
      }

      // ── Implicit flow: #access_token=... ────────────────────────────────
      const accessToken  = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token') ?? ''
      if (accessToken) {
        window.history.replaceState(null, '', window.location.pathname)
        setVerifying(true)
        const { data: { session }, error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        })
        setVerifying(false)
        if (error || !session) {
          setTokenError(
            'This verification link has expired or is no longer valid. ' +
            'Please request a new one below.'
          )
          return
        }
        navigate(
          session.user.user_metadata?.password_set ? '/dashboard' : '/set-password',
          { replace: true }
        )
        return
      }

      // ── OTP / PKCE flow: ?token_hash=...&type=... ───────────────────────
      const tokenHash = searchParams.get('token_hash')
      const type      = searchParams.get('type')
      if (tokenHash && type) {
        window.history.replaceState(null, '', window.location.pathname)
        setVerifying(true)
        const { data: { session }, error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })
        setVerifying(false)
        if (error || !session) {
          setTokenError(
            'This verification link has expired or is no longer valid. ' +
            'Please request a new one below.'
          )
          return
        }
        navigate(
          session.user.user_metadata?.password_set ? '/dashboard' : '/set-password',
          { replace: true }
        )
      }
    }

    handleConfirmation()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Redirect authenticated users away from /auth.
  // Early-access users (no password yet) go to /set-password; everyone else to /dashboard.
  if (!loading && user) {
    const dest = user.user_metadata?.password_set ? '/dashboard' : '/set-password'
    return <Navigate to={dest} replace />
  }

  // Token exchange in progress — show a neutral loading screen so the user
  // never sees a flash of the login form while we process the confirmation link.
  if (verifying) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center gap-4">
        <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-xs">R1</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-500 font-medium">Verifying your email…</span>
        </div>
      </div>
    )
  }

  // ── Mode switch ─────────────────────────────────────────────────────────────

  function switchMode(newMode) {
    setMode(newMode)
    setServerError('')
    setUnverifiedEmail('')
    setTokenError('')
    reset()
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function onSubmit(data) {
    setIsSubmitting(true)
    setServerError('')
    setUnverifiedEmail('')

    try {
      if (isLogin) {
        const { data: authData, error } = await supabase.auth.signInWithPassword({
          email:    data.email,
          password: data.password,
        })
        if (error) throw error
        // Route based on password_set so early-access users still land on /set-password
        const dest = authData.user?.user_metadata?.password_set ? '/dashboard' : '/set-password'
        navigate(dest, { replace: true })

      } else {
        const { error } = await supabase.auth.signUp({
          email:    data.email,
          password: data.password,
          options: {
            // /auth is a public route — safe for token exchange on redirect
            emailRedirectTo: 'https://app.roundone.work/auth',
            data: {
              full_name:    data.fullName,
              company_name: data.companyName,
              password_set: true,   // signed up via form → password already set
            },
          },
        })
        if (error) throw error
        setPendingEmail(data.email)
        setPendingVerification(true)
      }
    } catch (err) {
      const msg = err?.message ?? ''
      if (msg.includes('Invalid login credentials')) {
        setServerError('Incorrect email or password.')
      } else if (msg.includes('User already registered')) {
        setServerError('An account with this email already exists. Try logging in.')
      } else if (msg.includes('Email not confirmed')) {
        setServerError('Please verify your email before logging in. Check your inbox.')
        setUnverifiedEmail(data.email)
      } else {
        setServerError(msg || 'Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Resend verification email ───────────────────────────────────────────────

  async function handleResend(email) {
    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type:    'signup',
        email,
        options: { emailRedirectTo: 'https://app.roundone.work/auth' },
      })
      if (error) throw error
      toast.success('Verification email resent. Check your inbox.')
    } catch (err) {
      toast.error(err?.message || 'Failed to resend. Please try again.')
    } finally {
      setResending(false)
    }
  }

  // ── Verification pending screen ─────────────────────────────────────────────

  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center
        px-4 py-12">
        <Logo />

        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm
          p-8 flex flex-col items-center text-center gap-5">

          <div className="w-14 h-14 rounded-full bg-[#e6f0f9] border border-[#005ea4]/20
            flex items-center justify-center">
            <Mail size={24} className="text-[#005ea4]" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Check your email
            </h2>
            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              We sent a verification link to{' '}
              <span className="font-semibold text-slate-700">{pendingEmail}</span>.
              Click the link to complete your signup.
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <p className="text-xs text-slate-400">Didn't receive it? Check your spam folder, or:</p>
            <button
              type="button"
              onClick={() => handleResend(pendingEmail)}
              disabled={resending}
              className="w-full py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
                text-slate-600 hover:bg-slate-50 transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {resending ? (
                <>
                  <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-500
                    rounded-full animate-spin" />
                  Resending…
                </>
              ) : 'Resend verification email'}
            </button>
            <button
              type="button"
              onClick={() => {
                setPendingVerification(false)
                setPendingEmail('')
                switchMode('login')
              }}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
            >
              Back to sign in
            </button>
          </div>
        </div>

        <p className="mt-8 text-xs text-slate-400">
          © {new Date().getFullYear()} RoundOne. All rights reserved.
        </p>
      </div>
    )
  }

  // ── Main auth form ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center
      px-4 py-12">
      <Logo />

      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm">

        {/* Card header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isLogin
              ? 'Welcome back. Enter your credentials below.'
              : 'Start screening candidates faster with async video interviews.'
            }
          </p>
        </div>

        <div className="px-8 py-6 flex flex-col gap-5">

          {/* Expired / invalid token banner */}
          {tokenError && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200
              rounded-lg px-3.5 py-3 text-sm text-amber-800">
              <span className="leading-snug">{tokenError}</span>
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1 gap-1">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all
                ${isLogin
                  ? 'bg-white text-[#005ea4] shadow-sm border border-slate-200'
                  : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all
                ${!isLogin
                  ? 'bg-white text-[#005ea4] shadow-sm border border-slate-200'
                  : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              Sign up
            </button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            {!isLogin && (
              <Field
                label="Full name"
                type="text"
                placeholder="Your full name"
                autoComplete="name"
                error={errors.fullName?.message}
                {...register('fullName')}
              />
            )}

            <Field
              label="Work email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              error={errors.email?.message}
              {...register('email')}
            />

            <Field
              label="Password"
              type="password"
              placeholder="Enter your password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              error={errors.password?.message}
              {...register('password')}
            />

            {!isLogin && (
              <Field
                label="Company name"
                type="text"
                placeholder="Your company name"
                autoComplete="organization"
                error={errors.companyName?.message}
                {...register('companyName')}
              />
            )}

            {/* Server / auth error */}
            {serverError && (
              <div className="flex flex-col gap-2.5 bg-red-50 border border-red-200
                rounded-lg px-3.5 py-3">
                <p className="text-sm text-red-700 leading-snug">{serverError}</p>

                {/* Resend option when email isn't verified */}
                {unverifiedEmail && (
                  <button
                    type="button"
                    onClick={() => handleResend(unverifiedEmail)}
                    disabled={resending}
                    className="self-start text-xs font-semibold text-red-700 underline
                      underline-offset-2 hover:text-red-800 transition-colors
                      disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resending ? 'Resending…' : 'Resend verification email'}
                  </button>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-1 w-full py-2.5 px-4 rounded-lg bg-[#005ea4] hover:bg-[#004d8a]
                active:bg-[#003d6e] text-white text-sm font-semibold transition-colors
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white
                    rounded-full animate-spin" />
                  {isLogin ? 'Signing in…' : 'Creating account…'}
                </>
              ) : (
                isLogin ? 'Sign in' : 'Create account'
              )}
            </button>
          </form>
        </div>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        © {new Date().getFullYear()} RoundOne. All rights reserved.
      </p>
    </div>
  )
}
