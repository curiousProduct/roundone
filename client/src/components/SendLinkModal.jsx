import { useEffect, useRef, useState } from 'react'
import { X, Copy, Check, Send, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Input from './ui/Input'
import Select from './ui/Select'

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPIRY_OPTIONS = [
  { label: '3 days',  value: 3 },
  { label: '7 days',  value: 7 },
  { label: '14 days', value: 14 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

function addDays(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// Strip everything except digits — turns "+91 98765 43210" into "919876543210"
// which is what wa.me expects (country code without +).
function cleanPhoneForWhatsApp(phone) {
  return phone.replace(/[^\d]/g, '')
}

function buildShareMessage({ candidateName, jobTitle, company, link, expiryDays, hrName }) {
  const days      = Number(expiryDays)
  const atCompany = company ? ` at ${company}` : ''
  const sigLine   = company ? `\n${company}` : ''

  return (
    `Hi ${candidateName},\n\n` +
    `You have been invited to record a short video interview for the ${jobTitle} position${atCompany}.\n\n` +
    `Please complete your interview using the link below at your convenience:\n${link}\n\n` +
    `This link will expire in ${days} ${days === 1 ? 'day' : 'days'}.\n\n` +
    `Best regards,\n${hrName}${sigLine}`
  )
}

// ── WhatsApp icon (not in lucide-react) ───────────────────────────────────────

function WhatsAppIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function SendLinkModal({ template, onClose }) {
  const { user } = useAuth()

  const [name,       setName]       = useState('')
  const [email,      setEmail]      = useState('')
  const [phone,      setPhone]      = useState('')
  const [expiry,     setExpiry]     = useState(7)
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState(null)
  // result: { link, candidateName, email, phone, expiryDays }
  const [copied,     setCopied]     = useState(false)

  const backdropRef   = useRef(null)
  const firstInputRef = useRef(null)

  useEffect(() => { firstInputRef.current?.focus() }, [])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── Validation ──────────────────────────────────────────────────────────────

  function validate() {
    const e = {}
    if (!name.trim()) {
      e.name = 'Candidate name is required'
    }
    if (!email.trim()) {
      e.email = 'Email address is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      e.email = 'Enter a valid email address'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // ── Generate ────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!validate()) return
    setSubmitting(true)

    try {
      // Build candidate record — only include phone if provided
      const candidatePayload = {
        name:  name.trim(),
        email: email.trim().toLowerCase(),
      }
      const trimmedPhone = phone.trim()
      if (trimmedPhone) candidatePayload.phone = trimmedPhone

      const { data: candidate, error: cErr } = await supabase
        .from('candidates')
        .insert(candidatePayload)
        .select()
        .single()
      if (cErr) throw cErr

      // Generate unique token (retry once on collision)
      let token = generateToken()
      const { data: existing } = await supabase
        .from('interviews')
        .select('id')
        .eq('token', token)
        .maybeSingle()
      if (existing) token = generateToken()

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

      setResult({
        link:          `${window.location.origin}/i/${token}`,
        candidateName: name.trim(),
        email:         email.trim().toLowerCase(),
        phone:         trimmedPhone,
        expiryDays:    expiry,
      })
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to generate link. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Share actions ───────────────────────────────────────────────────────────

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result.link)
      setCopied(true)
      toast.success('Link copied to clipboard')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error('Could not copy — please copy the link manually.')
    }
  }

  function getSenderInfo() {
    const hrName = user?.user_metadata?.full_name || user?.email || ''
    const company = user?.user_metadata?.company_name || ''
    return { hrName, company }
  }

  function handleWhatsApp() {
    const { hrName, company } = getSenderInfo()
    const rawPhone = cleanPhoneForWhatsApp(result.phone)
    const message  = buildShareMessage({
      candidateName: result.candidateName,
      jobTitle:      template.title,
      company,
      link:          result.link,
      expiryDays:    result.expiryDays,
      hrName,
    })
    window.open(
      `https://wa.me/${rawPhone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  function handleEmail() {
    const { hrName, company } = getSenderInfo()
    const subject = `Video Interview Invitation — ${template.title}`
    const body    = buildShareMessage({
      candidateName: result.candidateName,
      jobTitle:      template.title,
      company,
      link:          result.link,
      expiryDays:    result.expiryDays,
      hrName,
    })

    const to  = encodeURIComponent(result.email)
    const su  = encodeURIComponent(subject)
    const bd  = encodeURIComponent(body)

    const hrDomain = (user?.email ?? '').split('@')[1]?.toLowerCase() ?? ''

    let url
    if (hrDomain === 'gmail.com') {
      url = `https://mail.google.com/mail/?view=cm&to=${to}&su=${su}&body=${bd}`
    } else if (['outlook.com', 'hotmail.com', 'live.com'].includes(hrDomain)) {
      url = `https://outlook.live.com/mail/0/deeplink/compose?to=${to}&subject=${su}&body=${bd}`
    } else if (hrDomain === 'yahoo.com') {
      url = `https://compose.mail.yahoo.com/?to=${to}&subject=${su}&body=${bd}`
    } else {
      url = `mailto:${result.email}?subject=${su}&body=${bd}`
    }

    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current) onClose()
  }

  function handleSendAnother() {
    setResult(null)
    setName('')
    setEmail('')
    setPhone('')
    setExpiry(7)
    setCopied(false)
    setErrors({})
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-center justify-center px-4
        bg-black/40 backdrop-blur-sm"
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl
        flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5
          border-b border-slate-100">
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

          {!result ? (
            // ── Form ──────────────────────────────────────────────────────────
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
                placeholder="candidate@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                error={errors.email}
              />
              <Input
                label="Phone number"
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                hint="Optional — enables WhatsApp sharing"
                value={phone}
                onChange={e => setPhone(e.target.value.replace(/[^0-9+\s]/g, ''))}
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
                    disabled:opacity-60 disabled:cursor-not-allowed
                    flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white
                        rounded-full animate-spin" />
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
            // ── Success ────────────────────────────────────────────────────────
            <>
              <div className="flex items-center gap-2 p-2.5 bg-green-50 rounded-lg
                border border-green-200">
                <Check size={15} className="text-green-600 shrink-0" />
                <p className="text-sm font-medium text-green-700">
                  Link generated! Share it with the candidate.
                </p>
              </div>

              {/* Link display */}
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-slate-600">Screening link</span>
                <div className="px-3.5 py-2.5 rounded-lg border border-slate-200 bg-slate-50
                  text-sm text-slate-700 font-mono truncate select-all">
                  {result.link}
                </div>
                <p className="text-xs text-slate-400">
                  Expires in {Number(result.expiryDays)}{' '}
                  {Number(result.expiryDays) === 1 ? 'day' : 'days'}.
                </p>
              </div>

              {/* Sharing options */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Share via
                </p>

                {/* Copy link */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                    border text-sm font-semibold transition-all
                    ${copied
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300'
                    }`}
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? 'Copied!' : 'Copy link'}
                </button>

                {/* WhatsApp — only when phone was provided */}
                {result.phone && (
                  <button
                    type="button"
                    onClick={handleWhatsApp}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                      bg-[#25D366] hover:bg-[#1da851] text-white text-sm font-semibold
                      transition-colors shadow-sm"
                  >
                    <WhatsAppIcon size={15} />
                    Send via WhatsApp
                  </button>
                )}

                {/* Email — only when email was provided (always true since it's required,
                    but guarded defensively so the button never renders with an empty href) */}
                {result.email && (
                  <button
                    type="button"
                    onClick={handleEmail}
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
                      bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
                      transition-colors shadow-sm"
                  >
                    <Mail size={15} />
                    Send via Email
                  </button>
                )}
              </div>

              {/* Footer actions */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleSendAnother}
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
