import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function SetPasswordPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Not logged in → send to auth
  if (!user) return <Navigate to="/auth" replace />
  // Already has a password → send to dashboard
  if (user.user_metadata?.password_set) return <Navigate to="/dashboard" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSaving(true)
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
        data: { password_set: true },
      })
      if (updateErr) throw updateErr
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message || 'Failed to set password. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center
      px-4 py-12">

      {/* Logo */}
      <a
        href="https://roundone-theta.vercel.app"
        className="inline-flex items-center gap-2.5 mb-8"
      >
        <div className="w-9 h-9 rounded-xl bg-[#005ea4] flex items-center justify-center shadow-sm">
          <span className="text-white font-bold text-sm tracking-tight">R1</span>
        </div>
        <span className="text-xl font-bold text-slate-900 tracking-tight">RoundOne</span>
      </a>

      {/* Card */}
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm">

        {/* Card header */}
        <div className="px-8 pt-8 pb-6 border-b border-slate-100 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#e6f0f9] border border-[#005ea4]/20
            flex items-center justify-center shrink-0 mt-0.5">
            <Lock size={18} className="text-[#005ea4]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">
              Set your password
            </h1>
            <p className="mt-1 text-sm text-slate-500 leading-relaxed">
              Welcome to RoundOne! Please set a password to secure your account.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate className="px-8 py-6 flex flex-col gap-5">

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-600">New password</label>
            <input
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900 bg-slate-50
                placeholder-slate-400 outline-none transition-all
                focus:bg-white focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
                ${error ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-slate-600">Confirm password</label>
            <input
              type="password"
              placeholder="Re-enter your password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              autoComplete="new-password"
              className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900 bg-slate-50
                placeholder-slate-400 outline-none transition-all
                focus:bg-white focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
                ${error ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-3
              text-sm text-red-700 leading-snug">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white
              text-sm font-semibold transition-colors shadow-sm
              disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white
                  rounded-full animate-spin" />
                Setting password…
              </>
            ) : 'Set password & continue'}
          </button>
        </form>
      </div>

      <p className="mt-8 text-xs text-slate-400">
        © {new Date().getFullYear()} RoundOne. All rights reserved.
      </p>
    </div>
  )
}
