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

  // ── Check URL hash on mount ─────────────────────────────────────────────────
  //
  // When the user clicks the verification link in their email, Supabase
  // redirects them to /auth with the result in the URL hash:
  //   Success: #access_token=...&type=signup  (Supabase JS processes automatically)
  //   Failure: #error=access_denied&error_code=otp_expired&error_description=...
  //
  // For success: Supabase JS v2 detects & processes the hash during initialisation,
  // fires onAuthStateChange(SIGNED_IN) → AuthContext updates → the guard below
  // redirects to /dashboard. Nothing extra needed.
  //
  // For failure: we read the hash, show an error, then clean up the URL.

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.slice(1))
    if (params.get('error')) {
      setTokenError(
        'This verification link has expired or is no longer valid. ' +
        'Please request a new one below.'
      )
      // Remove the hash so it doesn't persist on reload
      window.history.replaceState(
        null, '',
        window.location.pathname + window.location.search
      )
    }
    // Non-error hash → Supabase JS handles it; no action needed here.
  }, [])

  // Redirect authenticated users away from /auth
  if (!loading && user) return <Navigate to="/dashboard" replace />

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
        const { error } = await supabase.auth.signInWithPassword({
          email:    data.email,
          password: data.password,
        })
        if (error) throw error
        // Session established → onAuthStateChange → AuthContext → guard above redirects

      } else {
        const { error } = await supabase.auth.signUp({
          email:    data.email,
          password: data.password,
          options: {
            // /auth is a public route — safe for token exchange on redirect
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              full_name:    data.fullName,
              company_name: data.companyName,
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
        options: { emailRedirectTo: `${window.location.origin}/auth` },
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
