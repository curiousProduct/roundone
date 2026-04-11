import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  Star, Copy, Check, Lock, Award, Clock,
  CheckCircle2, ExternalLink, Mail, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NavBar from '../components/NavBar'

const APP_BASE_URL = 'https://app.roundone.work'

const PLATFORMS = [
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'zoom',        label: 'Zoom' },
  { value: 'teams',       label: 'Microsoft Teams' },
  { value: 'other',       label: 'Other' },
]

const QUICK_TAGS = [
  'Strong communicator',
  'Technical fit',
  'Culture fit',
  'Leadership potential',
  'Needs improvement',
  'Good attitude',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function platformLabel(val) {
  return PLATFORMS.find(p => p.value === val)?.label ?? val ?? '—'
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, variant = 'danger', onConfirm, onCancel, loading }) {
  const btnCls = variant === 'warning' ? 'bg-amber-500 hover:bg-amber-600' : 'bg-red-500 hover:bg-red-600'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6 flex flex-col gap-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{body}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors
              shadow-sm disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 ${btnCls}`}>
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Working…</>
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Overall status badge ──────────────────────────────────────────────────────

function OverallBadge({ status }) {
  if (status === 'hired')    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">Hired</span>
  if (status === 'rejected') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200">Rejected</span>
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">Active</span>
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange, saving }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" disabled={saving}
          onClick={() => onChange(value === star ? 0 : star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 rounded transition-transform hover:scale-110 disabled:cursor-not-allowed">
          <Star size={20}
            fill={active >= star ? '#f59e0b' : 'none'}
            stroke={active >= star ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={1.5}
          />
        </button>
      ))}
      {value > 0 && <span className="ml-1.5 text-xs text-slate-400 font-medium">{value}/5</span>}
    </div>
  )
}

// ── Video response card ───────────────────────────────────────────────────────

function VideoResponseCard({ question, response, index }) {
  const hasVideo = Boolean(response?.video_url)
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-[#005ea4] uppercase tracking-widest">
          Question {index + 1}
        </span>
        {response?.duration != null && (
          <span className="text-xs text-slate-400 font-medium">{response.duration}s recorded</span>
        )}
      </div>
      <div className="p-5 flex flex-col gap-4">
        <p className="text-sm font-semibold text-slate-800 leading-relaxed">{question.text}</p>
        {hasVideo ? (
          <div className="rounded-xl overflow-hidden bg-black aspect-video w-full shadow-sm">
            <video src={response.video_url} controls playsInline preload="metadata"
              className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="flex items-center justify-center rounded-xl border-2 border-dashed
            border-slate-200 bg-slate-50 aspect-video">
            <p className="text-xs text-slate-400">No video submitted for this question</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Live interview details card ───────────────────────────────────────────────

function LiveInterviewCard({
  stageResult, onSaved,
  candidateName, candidateEmail,
  stageName, jobTitle, hrUser,
}) {
  const [editing,    setEditing]    = useState(!stageResult?.scheduled_at)
  const [email,      setEmail]      = useState(stageResult?.interviewer_email ?? '')
  const [dt,         setDt]         = useState(
    stageResult?.scheduled_at
      ? new Date(stageResult.scheduled_at).toISOString().slice(0, 16)
      : ''
  )
  const [platform,   setPlatform]   = useState(stageResult?.platform ?? 'google_meet')
  const [meetLink,   setMeetLink]   = useState(stageResult?.meet_link ?? 'https://meet.google.com/new')
  const [saving,     setSaving]     = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)

  function handlePlatformChange(v) {
    setPlatform(v)
    if (v === 'google_meet') setMeetLink('https://meet.google.com/new')
    else if (meetLink === 'https://meet.google.com/new') setMeetLink('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase
        .from('stage_results')
        .update({
          interviewer_email: email.trim() || null,
          scheduled_at:      dt ? new Date(dt).toISOString() : null,
          platform:          platform || null,
          meet_link:         meetLink.trim() || null,
          updated_at:        new Date().toISOString(),
        })
        .eq('id', stageResult.id)
      if (error) throw error
      toast.success('Interview details saved.')
      setEditing(false)
      onSaved()
    } catch {
      toast.error('Failed to save interview details.')
    } finally {
      setSaving(false)
    }
  }

  function handleCopyLink() {
    if (!stageResult?.meet_link) return
    navigator.clipboard.writeText(stageResult.meet_link)
      .then(() => {
        setCopiedLink(true)
        setTimeout(() => setCopiedLink(false), 2000)
      })
      .catch(() => toast.error('Could not copy link.'))
  }

  // Detect HR's email provider to open the right compose window
  function openEmailClient({ to, subject, body }) {
    const hrEmail = hrUser?.email ?? ''
    const isGmail   = /@gmail\.com$/i.test(hrEmail)
    const isOutlook = /@(outlook|hotmail|live)\.(com|co\.in|co\.uk|org)$/i.test(hrEmail)

    if (isGmail) {
      const url = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } else if (isOutlook) {
      const url = `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
      window.open(url, '_blank', 'noopener,noreferrer')
    } else {
      window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
  }

  function buildInviteBody({ recipientName, includeCandidate }) {
    const hrName      = hrUser?.user_metadata?.full_name
                     ?? hrUser?.user_metadata?.name
                     ?? hrUser?.email
                     ?? ''
    const dateTime    = fmtDateTime(stageResult?.scheduled_at)
    const plat        = platformLabel(stageResult?.platform)
    const link        = stageResult?.meet_link ?? ''
    const stage       = stageName ?? 'Interview'
    const job         = jobTitle  ?? 'this position'

    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,'
    const candidateLine = includeCandidate
      ? `\nCandidate: ${candidateName ?? ''}\n`
      : ''

    const lines = [
      greeting,
      '',
      `You have been shortlisted for the ${stage} interview for the ${job} position.`,
      candidateLine,
      'Interview details:',
      `Date & Time: ${dateTime}`,
      `Platform: ${plat}`,
      link ? `Meeting link: ${link}` : '',
      '',
      'Please confirm your availability by replying to this email.',
      '',
      'Best regards,',
      hrName,
    ].filter(l => l !== undefined)

    return lines.join('\n')
  }

  function handleSendCandidate() {
    if (!candidateEmail) { toast.error('No candidate email on file.'); return }
    const subject = `Interview Invitation — ${jobTitle ?? 'Position'}`
    const body    = buildInviteBody({ recipientName: candidateName, includeCandidate: false })
    openEmailClient({ to: candidateEmail, subject, body })
  }

  function handleNotifyInterviewer() {
    const interviewerEmail = stageResult?.interviewer_email
    if (!interviewerEmail) { toast.error('No interviewer email saved.'); return }
    const subject = `Interview Scheduled — ${jobTitle ?? 'Position'}`
    const body    = buildInviteBody({ recipientName: '', includeCandidate: true })
    openEmailClient({ to: interviewerEmail, subject, body })
  }

  const isScheduled    = Boolean(stageResult?.scheduled_at)
  const canSendInvites = isScheduled && Boolean(stageResult?.meet_link)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
        <span className="text-xs font-bold text-violet-600 uppercase tracking-widest">Live interview</span>
        {isScheduled && !editing && (
          <button type="button" onClick={() => setEditing(true)}
            className="text-xs font-semibold text-[#005ea4] hover:underline">Edit</button>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {!editing && isScheduled ? (
          /* ── Details view ─────────────────────────────────────────────────── */
          <>
            <div className="flex flex-col gap-3">
              <Row label="Interviewer" value={stageResult.interviewer_email ?? '—'} />
              <Row label="Scheduled"   value={fmtDateTime(stageResult.scheduled_at)} />
              <Row label="Platform"    value={platformLabel(stageResult.platform)} />

              {/* Meet link row with copy button */}
              {stageResult.meet_link && (
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-slate-500 shrink-0 pt-0.5">Meet link</span>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <a href={stageResult.meet_link} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs font-semibold text-[#005ea4]
                        hover:underline truncate max-w-[160px]">
                      <ExternalLink size={11} className="shrink-0" />
                      {stageResult.meet_link}
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      title="Copy meeting link"
                      className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-md text-xs
                        font-semibold transition-colors
                        ${copiedLink
                          ? 'bg-[#1D9E75] text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {copiedLink ? <><Check size={10} />Copied</> : <Copy size={10} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Send invite buttons */}
            {canSendInvites && (
              <div className="pt-1 border-t border-slate-100 flex flex-col gap-2">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Send invite
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSendCandidate}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                      rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white text-xs
                      font-semibold transition-colors shadow-sm"
                  >
                    <Mail size={13} />
                    Invite candidate
                  </button>
                  <button
                    type="button"
                    onClick={handleNotifyInterviewer}
                    disabled={!stageResult?.interviewer_email}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5
                      rounded-lg border border-slate-200 bg-white text-slate-700 text-xs
                      font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors
                      disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send size={13} />
                    Notify interviewer
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Schedule form ─────────────────────────────────────────────────── */
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Interviewer email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="interviewer@company.com"
                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900
                  placeholder:text-slate-400 focus:outline-none focus:ring-2
                  focus:ring-[#005ea4]/30 focus:border-[#005ea4] transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Date &amp; time</label>
              <input type="datetime-local" value={dt} onChange={e => setDt(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900
                  focus:outline-none focus:ring-2 focus:ring-[#005ea4]/30 focus:border-[#005ea4] transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Platform</label>
              <select value={platform} onChange={e => handlePlatformChange(e.target.value)}
                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900
                  bg-white focus:outline-none focus:ring-2 focus:ring-[#005ea4]/30 focus:border-[#005ea4] transition-colors">
                {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Meeting link</label>
              <input type="url" value={meetLink} onChange={e => setMeetLink(e.target.value)}
                placeholder="https://..."
                className="px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900
                  placeholder:text-slate-400 focus:outline-none focus:ring-2
                  focus:ring-[#005ea4]/30 focus:border-[#005ea4] transition-colors" />
            </div>
            <div className="flex gap-2">
              {isScheduled && (
                <button type="button" onClick={() => setEditing(false)}
                  className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
                    text-slate-600 hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
              )}
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white
                  text-sm font-semibold transition-colors shadow-sm
                  disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {saving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
                  : 'Save schedule'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs text-slate-500 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
    </div>
  )
}

// ── Resend link panel ─────────────────────────────────────────────────────────

function ResendLinkPanel({ interview, candidateName, candidateEmail }) {
  const [copied, setCopied] = useState(false)
  const link = `${APP_BASE_URL}/i/${interview.token}`

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const waText   = encodeURIComponent(`Hi ${candidateName}, you've been invited to complete a video screening.\n\nRecord your responses here: ${link}`)
  const mailSubj = encodeURIComponent('Video screening invitation')
  const mailBody = encodeURIComponent(`Hi ${candidateName},\n\nYou've been invited to complete a video screening.\n\nClick below to record your responses:\n${link}\n\nThis link expires in 7 days.`)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Resend screening link</p>
      <div className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg border border-slate-200 mb-3">
        <span className="flex-1 text-xs font-mono text-slate-700 truncate">{link}</span>
        <button type="button" onClick={handleCopy}
          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors
            ${copied ? 'bg-[#1D9E75] text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
        </button>
      </div>
      {interview.expires_at && (
        <p className="text-xs text-slate-400 mb-3">Expires {fmtDate(interview.expires_at)}</p>
      )}
      <div className="flex gap-2">
        <a href={`https://wa.me/?text=${waText}`} target="_blank" rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
            bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-semibold transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          WhatsApp
        </a>
        <a href={`mailto:${candidateEmail}?subject=${mailSubj}&body=${mailBody}`}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg
            border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
          Email
        </a>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CandidatePipelineReviewPage() {
  const { id: jobId, appId } = useParams()
  const [searchParams] = useSearchParams()
  const stageParam = searchParams.get('stage')
  const navigate = useNavigate()
  const { user }  = useAuth()

  const [loading,  setLoading]  = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Core data
  const [app,       setApp]       = useState(null)
  const [job,       setJob]       = useState(null)
  const [stages,    setStages]    = useState([])
  const [allAppIds, setAllAppIds] = useState([])
  const [interview, setInterview] = useState(null)   // stage 1 interview
  const [questions, setQuestions] = useState([])
  const [responses, setResponses] = useState([])

  // Which stage tab is being viewed (order_index, not id)
  const [viewingStageIdx, setViewingStageIdx] = useState(null)

  // Per-stage review fields (bound to the viewed stage's stage_results row)
  const [stageNotes,       setStageNotes]       = useState('')
  const [stageRating,      setStageRating]      = useState(0)
  const [savingStageNotes, setSavingStageNotes] = useState(false)
  const [savingStageRating,setSavingStageRating]= useState(false)

  // Pipeline actions
  const [confirmReject,    setConfirmReject]    = useState(false)
  const [confirmHire,      setConfirmHire]      = useState(false)
  const [executingMove,    setExecutingMove]    = useState(false)
  const [executingReject,  setExecutingReject]  = useState(false)
  const [executingHire,    setExecutingHire]    = useState(false)
  const [executingUnder,   setExecutingUnder]   = useState(false)

  useEffect(() => { fetchAll() }, [appId])   // eslint-disable-line react-hooks/exhaustive-deps

  // Sync per-stage fields when the viewed stage changes
  useEffect(() => {
    if (!app || viewingStageIdx === null) return
    const viewingStage  = stages.find(s => s.order_index === viewingStageIdx)
    const viewingResult = app.stage_results?.find(sr => sr.stage_id === viewingStage?.id)
    setStageNotes(viewingResult?.notes ?? '')
    setStageRating(viewingResult?.rating ?? 0)
  }, [viewingStageIdx, app, stages])

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchAll() {
    setLoading(true)
    setNotFound(false)
    try {
      const [appRes, jobRes, allAppsRes] = await Promise.all([
        supabase
          .from('candidate_applications')
          .select(`
            id, current_stage_index, overall_status, created_at,
            candidates ( id, name, email, phone ),
            stage_results (
              id, stage_id, status, interview_id,
              interviewer_email, scheduled_at, meet_link,
              platform, notes, rating, updated_at
            )
          `)
          .eq('id', appId)
          .eq('company_id', user.id)
          .single(),

        supabase
          .from('job_openings')
          .select('id, title, pipeline_stages ( id, order_index, name, type, template_id )')
          .eq('id', jobId)
          .eq('created_by', user.id)
          .single(),

        supabase
          .from('candidate_applications')
          .select('id')
          .eq('job_opening_id', jobId)
          .order('created_at', { ascending: false }),
      ])

      if (appRes.error || !appRes.data || jobRes.error || !jobRes.data) {
        setNotFound(true)
        return
      }

      const appData      = appRes.data
      const sortedStages = [...(jobRes.data.pipeline_stages ?? [])].sort((a, b) => a.order_index - b.order_index)

      setApp(appData)
      setJob(jobRes.data)
      setStages(sortedStages)
      setAllAppIds((allAppsRes.data ?? []).map(a => a.id))

      // Default to stage from URL param, then current stage
      const curIdx        = appData.current_stage_index ?? 1
      const requestedIdx  = stageParam ? parseInt(stageParam, 10) : null
      const initialIdx    = (requestedIdx && sortedStages.some(s => s.order_index === requestedIdx))
        ? requestedIdx
        : curIdx
      setViewingStageIdx(initialIdx)

      // Sync stage fields immediately (effect won't fire until next render)
      const curStage  = sortedStages.find(s => s.order_index === initialIdx)
      const curResult = appData.stage_results?.find(sr => sr.stage_id === curStage?.id)
      setStageNotes(curResult?.notes ?? '')
      setStageRating(curResult?.rating ?? 0)

      // Stage 1 interview
      const stage1       = sortedStages.find(s => s.order_index === 1)
      const stage1Result = appData.stage_results?.find(sr => sr.stage_id === stage1?.id)
      const interviewId  = stage1Result?.interview_id

      const [intRes, questionsRes] = await Promise.all([
        interviewId
          ? supabase.from('interviews')
              .select('id, status, token, expires_at, submitted_at, created_at')
              .eq('id', interviewId)
              .single()
          : Promise.resolve({ data: null }),
        stage1?.template_id
          ? supabase.from('questions')
              .select('id, text, order_index, thinking_time, answer_time')
              .eq('template_id', stage1.template_id)
              .order('order_index', { ascending: true })
          : Promise.resolve({ data: [] }),
      ])

      const intData = intRes.data
      setInterview(intData)
      setQuestions(questionsRes.data ?? [])

      if (interviewId && (intData?.status === 'submitted' || intData?.status === 'reviewed')) {
        const { data: rData } = await supabase
          .from('responses')
          .select('id, question_id, video_url, duration')
          .eq('interview_id', interviewId)
        setResponses(rData ?? [])
      } else {
        setResponses([])
      }
    } catch (err) {
      console.error(err)
      toast.error('Failed to load candidate data.')
    } finally {
      setLoading(false)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const overallStatus = app?.overall_status ?? 'active'
  const isActive      = overallStatus === 'active'
  const candidate     = app?.candidates

  const currentStage      = stages.find(s => s.order_index === app?.current_stage_index)
  const currentResult     = app?.stage_results?.find(sr => sr.stage_id === currentStage?.id)
  const isLastStage       = app ? app.current_stage_index >= stages.length : false
  const nextStage         = stages.find(s => s.order_index === (app?.current_stage_index ?? 0) + 1)
  const isViewingCurrent  = viewingStageIdx === app?.current_stage_index

  const viewingStage  = stages.find(s => s.order_index === viewingStageIdx)
  const viewingResult = app?.stage_results?.find(sr => sr.stage_id === viewingStage?.id)

  const stage1            = stages.find(s => s.order_index === 1)
  const stage1Result      = app?.stage_results?.find(sr => sr.stage_id === stage1?.id)
  const interviewSubmitted = interview?.status === 'submitted' || interview?.status === 'reviewed'
  const responseMap       = Object.fromEntries(responses.map(r => [r.question_id, r]))
  const totalRecorded     = responses.reduce((s, r) => s + (r.duration ?? 0), 0)

  const currentNavIdx = allAppIds.indexOf(appId)
  const prevAppId     = currentNavIdx > 0 ? allAppIds[currentNavIdx - 1] : null
  const nextAppId     = currentNavIdx < allAppIds.length - 1 ? allAppIds[currentNavIdx + 1] : null

  function getStageDisplay(stage) {
    if (stage.order_index < (app?.current_stage_index ?? 0)) {
      const r = app?.stage_results?.find(sr => sr.stage_id === stage.id)
      return r?.status === 'failed' ? 'failed' : 'passed'
    }
    if (stage.order_index === app?.current_stage_index) return 'current'
    return 'future'
  }

  // ── Per-stage save helpers ─────────────────────────────────────────────────

  async function handleStageRating(stars) {
    if (!viewingResult?.id) return
    const prev = stageRating
    setStageRating(stars)
    setSavingStageRating(true)
    try {
      await supabase.from('stage_results')
        .update({ rating: stars || null, updated_at: new Date().toISOString() })
        .eq('id', viewingResult.id)
      setApp(a => ({
        ...a,
        stage_results: a.stage_results.map(sr =>
          sr.id === viewingResult.id ? { ...sr, rating: stars || null } : sr
        ),
      }))
    } catch {
      toast.error('Failed to save rating.')
      setStageRating(prev)
    } finally {
      setSavingStageRating(false)
    }
  }

  async function handleSaveStageNotes() {
    if (!viewingResult?.id) return
    setSavingStageNotes(true)
    try {
      await supabase.from('stage_results')
        .update({ notes: stageNotes, updated_at: new Date().toISOString() })
        .eq('id', viewingResult.id)
      setApp(a => ({
        ...a,
        stage_results: a.stage_results.map(sr =>
          sr.id === viewingResult.id ? { ...sr, notes: stageNotes } : sr
        ),
      }))
      toast.success('Notes saved.')
    } catch {
      toast.error('Failed to save notes.')
    } finally {
      setSavingStageNotes(false)
    }
  }

  // ── Pipeline actions (current stage only) ──────────────────────────────────

  async function handleUnderReview() {
    if (!currentResult?.id) return
    setExecutingUnder(true)
    try {
      await supabase.from('stage_results')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', currentResult.id)
      setApp(a => ({
        ...a,
        stage_results: a.stage_results.map(sr =>
          sr.id === currentResult.id ? { ...sr, status: 'in_progress' } : sr
        ),
      }))
      toast.success('Marked as under review.')
    } catch {
      toast.error('Failed to update status.')
    } finally {
      setExecutingUnder(false)
    }
  }

  async function handleMoveNext() {
    if (!app || !nextStage || !currentResult?.id) return
    setExecutingMove(true)
    try {
      await supabase.from('stage_results')
        .update({ status: 'passed', updated_at: new Date().toISOString() })
        .eq('id', currentResult.id)
      await supabase.from('candidate_applications')
        .update({ current_stage_index: app.current_stage_index + 1 })
        .eq('id', appId)
      await supabase.from('stage_results')
        .insert({ application_id: appId, stage_id: nextStage.id, status: 'pending' })
      toast.success(`Moved to Stage ${app.current_stage_index + 1}.`)
      await fetchAll()
    } catch {
      toast.error('Failed to move candidate.')
    } finally {
      setExecutingMove(false)
    }
  }

  async function handleRejectConfirm() {
    setExecutingReject(true)
    try {
      if (currentResult?.id) {
        await supabase.from('stage_results')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', currentResult.id)
      }
      await supabase.from('candidate_applications')
        .update({ overall_status: 'rejected' })
        .eq('id', appId)
      setConfirmReject(false)
      toast.success('Candidate rejected.')
      await fetchAll()
    } catch {
      toast.error('Failed to reject candidate.')
    } finally {
      setExecutingReject(false)
    }
  }

  async function handleHireConfirm() {
    setExecutingHire(true)
    try {
      if (currentResult?.id) {
        await supabase.from('stage_results')
          .update({ status: 'passed', updated_at: new Date().toISOString() })
          .eq('id', currentResult.id)
      }
      await supabase.from('candidate_applications')
        .update({ overall_status: 'hired' })
        .eq('id', appId)
      setConfirmHire(false)
      toast.success(`${candidate?.name} has been selected!`)
      await fetchAll()
    } catch {
      toast.error('Failed to select candidate.')
    } finally {
      setExecutingHire(false)
    }
  }

  function appendTag(tag) {
    setStageNotes(prev => prev ? `${prev}\n${tag}` : tag)
  }

  // ── Not found ──────────────────────────────────────────────────────────────

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-[#f5f7fa]">
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-20 flex flex-col items-center text-center gap-4">
          <h2 className="text-lg font-bold text-slate-900">Candidate not found</h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
            This record doesn't exist or you don't have access.
          </p>
          <Link to={`/jobs/${jobId}`}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold transition-colors shadow-sm">
            Back to pipeline
          </Link>
        </main>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Link to={`/jobs/${jobId}`}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
              <ArrowLeft size={15} />
              {loading ? 'Pipeline' : (job?.title ?? 'Pipeline')}
            </Link>

            {!loading && allAppIds.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 tabular-nums">
                  {currentNavIdx + 1} of {allAppIds.length}
                </span>
                <button type="button"
                  onClick={() => navigate(`/jobs/${jobId}/candidates/${prevAppId}`)}
                  disabled={!prevAppId}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border
                    border-slate-200 text-xs font-semibold text-slate-600
                    hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <ChevronLeft size={13} />Prev
                </button>
                <button type="button"
                  onClick={() => navigate(`/jobs/${jobId}/candidates/${nextAppId}`)}
                  disabled={!nextAppId}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border
                    border-slate-200 text-xs font-semibold text-slate-600
                    hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  Next<ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              <Sk className="h-7 w-52" /><Sk className="h-4 w-72" />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{candidate?.name}</h1>
                <OverallBadge status={overallStatus} />
                {currentStage && (
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
                    ${currentStage.type === 'async_video' ? 'bg-[#e6f0f9] text-[#005ea4]' : 'bg-violet-50 text-violet-700'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0
                      ${currentStage.type === 'async_video' ? 'bg-[#005ea4]' : 'bg-violet-500'}`} />
                    Stage {currentStage.order_index} — {currentStage.name}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-3 flex-wrap">
                <span className="text-sm text-slate-500">{candidate?.email}</span>
                {candidate?.phone && <span className="text-sm text-slate-400">{candidate.phone}</span>}
                <span className="text-xs text-slate-400">Applied {fmtDate(app?.created_at)}</span>
              </div>
            </div>
          )}
        </div>

        {/* ── Two-column layout ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
            <div className="flex flex-col gap-4">
              <Sk className="h-12 rounded-xl" /><Sk className="h-52 rounded-xl" /><Sk className="h-80 rounded-xl" />
            </div>
            <div className="flex flex-col gap-4">
              <Sk className="h-40 rounded-xl" /><Sk className="h-32 rounded-xl" /><Sk className="h-48 rounded-xl" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 items-start">

            {/* ── Left column ─────────────────────────────────────────────── */}
            <div className="flex flex-col gap-5">

              {/* Stage tabs */}
              {stages.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {stages.map(stage => {
                    const ds         = getStageDisplay(stage)
                    const isViewing  = viewingStageIdx === stage.order_index
                    const isFuture   = ds === 'future'
                    const isPast     = ds === 'passed' || ds === 'failed'

                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => !isFuture && setViewingStageIdx(stage.order_index)}
                        disabled={isFuture}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors
                          ${isViewing
                            ? 'bg-[#005ea4] text-white shadow-sm'
                            : isFuture
                              ? 'bg-white border border-slate-200 text-slate-300 cursor-not-allowed'
                              : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                      >
                        {isPast && ds === 'passed' && (
                          <CheckCircle2 size={12} className={isViewing ? 'text-white/80' : 'text-[#1D9E75]'} />
                        )}
                        {ds === 'failed' && (
                          <span className={`w-2 h-2 rounded-full ${isViewing ? 'bg-white/60' : 'bg-red-400'}`} />
                        )}
                        {ds === 'current' && (
                          <span className={`w-2 h-2 rounded-full ${isViewing ? 'bg-white/80' : 'bg-[#005ea4]'}`} />
                        )}
                        {isFuture && <Lock size={10} />}
                        Stage {stage.order_index} — {stage.name}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Success banner (hired) */}
              {overallStatus === 'hired' && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5
                  flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                    <Award size={20} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-800 tracking-tight">
                      {candidate?.name} has been selected for {job?.title}!
                    </p>
                    <p className="mt-0.5 text-xs text-emerald-600">
                      Overall status updated to Hired.
                    </p>
                  </div>
                </div>
              )}

              {/* Candidate profile card */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-4">Candidate profile</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3 mb-5">
                  {[
                    ['Name',    candidate?.name],
                    ['Email',   candidate?.email],
                    candidate?.phone && ['Phone', candidate.phone],
                    ['Applied', fmtDate(app?.created_at)],
                    ['Stage',   currentStage ? `Stage ${currentStage.order_index} — ${currentStage.name}` : '—'],
                    ['Status',  <OverallBadge key="ob" status={overallStatus} />],
                  ].filter(Boolean).map(([label, val]) => (
                    <div key={label}>
                      <span className="text-[11px] text-slate-400 uppercase tracking-wide block mb-0.5">{label}</span>
                      <span className="text-sm text-slate-800 font-medium">{val}</span>
                    </div>
                  ))}
                </div>

                {/* Mini stage progress */}
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Stage progress</p>
                  <div className="flex items-center flex-wrap gap-0">
                    {stages.map((stage, i) => {
                      const ds = getStageDisplay(stage)
                      const dotCls = ds === 'passed' ? 'bg-[#1D9E75]' : ds === 'failed' ? 'bg-red-500' : ds === 'current' ? 'bg-[#005ea4]' : 'bg-slate-300'
                      const lblCls = ds === 'passed' ? 'text-[#1D9E75]' : ds === 'failed' ? 'text-red-500' : ds === 'current' ? 'text-[#005ea4]' : 'text-slate-400'
                      const isCur  = stage.order_index === app?.current_stage_index
                      return (
                        <div key={stage.id} className="flex items-center">
                          <div className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg ${isCur ? 'bg-[#e6f0f9]' : ''}`}>
                            <div className={`w-3 h-3 rounded-full ${dotCls}`} />
                            <span className={`text-[10px] font-bold ${lblCls}`}>S{stage.order_index}</span>
                          </div>
                          {i < stages.length - 1 && (
                            <div className={`w-5 h-px ${ds === 'passed' ? 'bg-[#1D9E75]' : 'bg-slate-200'}`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Stage history timeline */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-5">Stage history</h2>
                <div className="flex flex-col">
                  {stages.map((stage, i) => {
                    const ds     = getStageDisplay(stage)
                    const result = app?.stage_results?.find(sr => sr.stage_id === stage.id)
                    const isCur  = ds === 'current'
                    const isFut  = ds === 'future'
                    const isLast = i === stages.length - 1
                    const dotCls = ds === 'passed' ? 'bg-[#1D9E75]' : ds === 'failed' ? 'bg-red-500' : ds === 'current' ? 'bg-[#005ea4]' : 'bg-slate-300'

                    return (
                      <div key={stage.id} className="flex gap-4">
                        <div className="flex flex-col items-center pt-0.5">
                          <div className={`w-3 h-3 rounded-full shrink-0 ${dotCls}`} />
                          {!isLast && <div className="w-px flex-1 bg-slate-200 my-1.5 min-h-[2rem]" />}
                        </div>
                        <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${isFut ? 'text-slate-400' : 'text-slate-900'}`}>
                              Stage {stage.order_index} — {stage.name}
                            </span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide
                              ${stage.type === 'async_video' ? 'bg-[#e6f0f9] text-[#005ea4]' : 'bg-violet-50 text-violet-700'}`}>
                              {stage.type === 'async_video' ? 'Video' : 'Live'}
                            </span>
                            {ds === 'passed' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#e6f5ef] text-[#1D9E75]">Passed</span>}
                            {ds === 'failed' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-600">Failed</span>}
                            {isCur && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#e6f0f9] text-[#005ea4]">Current</span>}
                            {isFut && <Lock size={11} className="text-slate-300" />}
                          </div>
                          {isFut && <p className="mt-1 text-xs text-slate-400">Unlocks when candidate reaches this stage</p>}
                          {!isFut && result && (
                            <div className="mt-1.5 flex flex-col gap-0.5">
                              {stage.type === 'live_interview' && result.scheduled_at && (
                                <p className="text-xs text-slate-500">
                                  {fmtDateTime(result.scheduled_at)}
                                  {result.platform && ` · ${platformLabel(result.platform)}`}
                                </p>
                              )}
                              {result.rating > 0 && (
                                <p className="text-xs text-slate-500">{'★'.repeat(result.rating)}{'☆'.repeat(5 - result.rating)} {result.rating}/5</p>
                              )}
                              {result.notes && (
                                <p className="text-xs text-slate-400 italic line-clamp-2">{result.notes}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Stage content area — driven by viewingStage */}
              {viewingStage?.type === 'async_video' ? (
                interviewSubmitted ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm font-bold text-slate-700">Video responses</h2>
                      <span className="text-xs text-slate-400">{responses.length} of {questions.length} answered</span>
                    </div>
                    {questions.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                        <p className="text-sm text-slate-500">No questions found for this template.</p>
                      </div>
                    ) : questions.map((q, i) => (
                      <VideoResponseCard key={q.id} question={q} response={responseMap[q.id]} index={i} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8
                    flex flex-col items-center text-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center">
                      <Clock size={22} className="text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Candidate has not submitted yet</p>
                      {interview?.expires_at && (
                        <p className="mt-1 text-xs text-slate-400">Screening link expires {fmtDate(interview.expires_at)}</p>
                      )}
                    </div>
                    {interview?.token && (
                      <ResendLinkPanel
                        interview={interview}
                        candidateName={candidate?.name ?? ''}
                        candidateEmail={candidate?.email ?? ''}
                      />
                    )}
                  </div>
                )
              ) : viewingStage?.type === 'live_interview' && viewingResult ? (
                <LiveInterviewCard
                  stageResult={viewingResult}
                  onSaved={fetchAll}
                  candidateName={candidate?.name ?? ''}
                  candidateEmail={candidate?.email ?? ''}
                  stageName={viewingStage.name}
                  jobTitle={job?.title ?? ''}
                  hrUser={user}
                />
              ) : null}

            </div>

            {/* ── Right column (sticky) ────────────────────────────────────── */}
            <div className="lg:sticky lg:top-[4.5rem] flex flex-col gap-4">

              {/* Verdict — only for current stage when active */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Verdict</p>

                {isActive && isViewingCurrent ? (
                  <div className="flex flex-col gap-2">

                    {/* Select candidate (last stage) */}
                    {isLastStage && (
                      <button type="button" onClick={() => setConfirmHire(true)}
                        className="w-full py-3 rounded-xl bg-[#1D9E75] hover:bg-[#178a63] text-white
                          text-sm font-bold tracking-tight transition-colors shadow-sm
                          flex items-center justify-center gap-2">
                        <Award size={15} />
                        Select candidate
                      </button>
                    )}

                    {/* Move to next stage (not last) */}
                    {!isLastStage && (
                      <button type="button" onClick={handleMoveNext} disabled={executingMove}
                        className="w-full py-2.5 rounded-lg bg-[#1D9E75] hover:bg-[#178a63] text-white
                          text-sm font-semibold transition-colors shadow-sm
                          disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {executingMove
                          ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Moving…</>
                          : `Move to Stage ${(app?.current_stage_index ?? 0) + 1}`}
                      </button>
                    )}

                    {/* Under review */}
                    <button type="button" onClick={handleUnderReview} disabled={executingUnder}
                      className={`w-full py-2.5 rounded-lg border text-sm font-semibold transition-all
                        disabled:cursor-not-allowed disabled:opacity-70
                        ${currentResult?.status === 'in_progress'
                          ? 'bg-amber-500 border-amber-500 text-white shadow-sm'
                          : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'}`}>
                      {executingUnder ? 'Saving…' : 'Under review'}
                    </button>

                    {/* Reject */}
                    <button type="button" onClick={() => setConfirmReject(true)}
                      className="w-full py-2.5 rounded-lg border border-red-300 text-red-600
                        text-sm font-semibold hover:bg-red-50 transition-colors">
                      Reject candidate
                    </button>
                  </div>
                ) : !isActive ? (
                  <div className={`rounded-lg p-4 text-center
                    ${overallStatus === 'hired' ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    <p className={`text-sm font-bold ${overallStatus === 'hired' ? 'text-emerald-700' : 'text-red-600'}`}>
                      {overallStatus === 'hired' ? 'Candidate selected' : 'Candidate rejected'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {overallStatus === 'hired' ? 'No further action needed.' : 'This application has been closed.'}
                    </p>
                  </div>
                ) : (
                  /* Viewing a past stage */
                  <p className="text-xs text-slate-400 italic">
                    Viewing Stage {viewingStageIdx}. Switch to Stage {app?.current_stage_index} to take action.
                  </p>
                )}
              </div>

              {/* Per-stage rating */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                    Stage {viewingStageIdx} rating
                  </p>
                  {savingStageRating && (
                    <span className="w-3.5 h-3.5 border-2 border-[#005ea4]/40 border-t-[#005ea4] rounded-full animate-spin" />
                  )}
                </div>
                <StarRating value={stageRating} onChange={handleStageRating} saving={savingStageRating} />
                {stageRating === 0 && <p className="mt-2 text-xs text-slate-400">Click a star to rate this stage</p>}
              </div>

              {/* Per-stage notes + quick tags */}
              <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">
                  Stage {viewingStageIdx} notes
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_TAGS.map(tag => (
                    <button key={tag} type="button" onClick={() => appendTag(tag)}
                      className="px-2.5 py-1 rounded-full border border-slate-200 text-xs font-medium
                        text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                      + {tag}
                    </button>
                  ))}
                </div>
                <textarea
                  value={stageNotes}
                  onChange={e => setStageNotes(e.target.value)}
                  rows={4}
                  placeholder="Add notes for this stage…"
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900
                    placeholder:text-slate-400 focus:outline-none focus:ring-2
                    focus:ring-[#005ea4]/30 focus:border-[#005ea4] resize-none transition-colors"
                />
                <button type="button" onClick={handleSaveStageNotes} disabled={savingStageNotes || !viewingResult?.id}
                  className="w-full py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white
                    text-sm font-semibold transition-colors shadow-sm
                    disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {savingStageNotes
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Saving…</>
                    : 'Save notes'}
                </button>
                {!viewingResult?.id && (
                  <p className="text-xs text-slate-400 text-center">
                    Notes available once candidate reaches this stage
                  </p>
                )}
              </div>

              {/* Submission info (Stage 1 only) */}
              {viewingStageIdx === 1 && interviewSubmitted && (
                <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-3">Submission info</p>
                  <dl className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-center">
                      <dt className="text-xs text-slate-500">Questions answered</dt>
                      <dd className="text-xs font-semibold text-slate-700">{responses.length} / {questions.length}</dd>
                    </div>
                    {totalRecorded > 0 && (
                      <div className="flex justify-between items-center">
                        <dt className="text-xs text-slate-500">Total recorded</dt>
                        <dd className="text-xs font-semibold text-slate-700">
                          {Math.floor(totalRecorded / 60) > 0 ? `${Math.floor(totalRecorded / 60)}m ` : ''}{totalRecorded % 60}s
                        </dd>
                      </div>
                    )}
                    {interview?.submitted_at && (
                      <div className="flex justify-between items-start">
                        <dt className="text-xs text-slate-500 shrink-0">Submitted</dt>
                        <dd className="text-xs font-semibold text-slate-700 text-right ml-4">{fmtDateTime(interview.submitted_at)}</dd>
                      </div>
                    )}
                    {interview?.expires_at && (
                      <div className="flex justify-between items-center">
                        <dt className="text-xs text-slate-500">Link expires</dt>
                        <dd className="text-xs font-semibold text-slate-700">{fmtDate(interview.expires_at)}</dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* Resend link (Stage 1, not submitted) */}
              {viewingStageIdx === 1 && !interviewSubmitted && interview?.token && (
                <ResendLinkPanel
                  interview={interview}
                  candidateName={candidate?.name ?? ''}
                  candidateEmail={candidate?.email ?? ''}
                />
              )}

            </div>
          </div>
        )}
      </main>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {confirmReject && (
        <ConfirmModal
          title={`Reject ${candidate?.name}?`}
          body="This will end their application. This action cannot be undone."
          confirmLabel="Reject candidate"
          variant="danger"
          loading={executingReject}
          onConfirm={handleRejectConfirm}
          onCancel={() => setConfirmReject(false)}
        />
      )}

      {confirmHire && (
        <ConfirmModal
          title={`Select ${candidate?.name}?`}
          body={`Mark ${candidate?.name} as hired for ${job?.title ?? 'this role'}?`}
          confirmLabel="Select candidate"
          variant="warning"
          loading={executingHire}
          onConfirm={handleHireConfirm}
          onCancel={() => setConfirmHire(false)}
        />
      )}
    </div>
  )
}
