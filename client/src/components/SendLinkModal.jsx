import { useEffect, useRef, useState } from 'react'
import { X, Copy, Check, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import Input from './ui/Input'
import Select from './ui/Select'

const EXPIRY_OPTIONS = [
  { label: '3 days',  value: 3 },
  { label: '7 days',  value: 7 },
  { label: '14 days', value: 14 },
]

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function SendLinkModal({ template, onClose }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [expiry, setExpiry] = useState(7)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [generatedLink, setGeneratedLink] = useState(null)
  const [copied, setCopied] = useState(false)

  const backdropRef = useRef(null)
  const firstInputRef = useRef(null)

  // Focus first input on open
  useEffect(() => {
    firstInputRef.current?.focus()
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function validate() {
    const e = {}
    if (!name.trim()) e.name = 'Candidate name is required'
    if (!email.trim()) {
      e.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Enter a valid email address'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleGenerate() {
    if (!validate()) return
    setSubmitting(true)

    try {
      // 1. Create candidate record
      const { data: candidate, error: cErr } = await supabase
        .from('candidates')
        .insert({ name: name.trim(), email: email.trim().toLowerCase() })
        .select()
        .single()
      if (cErr) throw cErr

      // 2. Generate unique token (retry once on collision)
      let token = generateToken()
      const { data: existing } = await supabase
        .from('interviews')
        .select('id')
        .eq('token', token)
        .maybeSingle()
      if (existing) token = generateToken()

      // 3. Create interview record
      const { error: iErr } = await supabase
        .from('interviews')
        .insert({
          candidate_id: candidate.id,
          template_id:  template.id,
          token,
          status:     'pending',
          expires_at: addDays(Number(expiry)),
          sent_at:    new Date().toISOString(),
        })
      if (iErr) throw iErr

      setGeneratedLink(`${window.location.origin}/i/${token}`)
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to generate link. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedLink)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Could not copy — please copy the link manually.')
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current) onClose()
  }

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center px-4
        bg-black/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl
        flex flex-col overflow-hidden">

        {/* Modal header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Send screening link
            </h2>
            <p className="mt-0.5 text-sm text-slate-500 leading-snug">
              {template.title}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100
              transition-colors shrink-0 -mt-0.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          {!generatedLink ? (
            // ── Form state ───────────────────────────────────────────────────
            <>
              <Input
                ref={firstInputRef}
                label="Candidate name"
                type="text"
                placeholder="Full name"
                value={name}
                onChange={e => setName(e.target.value)}
                error={errors.name}
              />
              <Input
                label="Candidate email"
                type="email"
                placeholder="candidate@company.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={errors.email}
              />
              <Select
                label="Link expiry"
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                hint="Candidate cannot submit after this date."
              >
                {EXPIRY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
                    text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white
                    text-sm font-semibold transition-colors shadow-sm
                    disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Generate link
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            // ── Success state ────────────────────────────────────────────────
            <>
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
                <Check size={15} className="text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-700">
                  Link generated! Send it to the candidate.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-600">Screening link</span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50
                    text-sm text-slate-700 font-mono truncate select-all">
                    {generatedLink}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopy}
                    title="Copy link"
                    className={`shrink-0 p-2.5 rounded-lg border text-sm font-medium transition-all
                      ${copied
                        ? 'bg-green-50 border-green-200 text-green-600'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                      }`}
                  >
                    {copied ? <Check size={15} /> : <Copy size={15} />}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Expires in {expiry} {Number(expiry) === 1 ? 'day' : 'days'}.
                  The candidate will record their video responses at this link.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setGeneratedLink(null)
                    setName('')
                    setEmail('')
                    setExpiry(7)
                    setCopied(false)
                    setErrors({})
                  }}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
                    text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Send another
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white
                    text-sm font-semibold transition-colors shadow-sm"
                >
                  Done
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
