import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Textarea from '../components/ui/Textarea'
import { StatusBadge, formatDateTime } from '../lib/candidateStatus.jsx'

// ── Verdict config ─────────────────────────────────────────────────────────────

const VERDICTS = [
  {
    key: 'shortlisted',
    label: 'Shortlist',
    active:   'bg-green-500 border-green-500 text-white shadow-sm',
    inactive: 'bg-white border-green-300 text-green-700 hover:bg-green-50',
  },
  {
    key: 'under_review',
    label: 'Under review',
    active:   'bg-amber-500 border-amber-500 text-white shadow-sm',
    inactive: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50',
  },
  {
    key: 'rejected',
    label: 'Reject',
    active:   'bg-red-500 border-red-500 text-white shadow-sm',
    inactive: 'bg-white border-red-300 text-red-700 hover:bg-red-50',
  },
]

// ── Star rating ────────────────────────────────────────────────────────────────

function StarRating({ value, onChange, saving }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          disabled={saving}
          onClick={() => onChange(value === star ? 0 : star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="p-0.5 rounded transition-transform hover:scale-110 disabled:cursor-not-allowed"
          title={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <Star
            size={22}
            fill={active >= star ? '#f59e0b' : 'none'}
            stroke={active >= star ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={1.5}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="ml-1 text-xs text-slate-400 font-medium">
          {value} / 5
        </span>
      )}
    </div>
  )
}

// ── Question + answer card ────────────────────────────────────────────────────

function QuestionAnswerCard({ question, response, index }) {
  const hasVideo = Boolean(response?.video_url)

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60 flex items-center
        justify-between gap-3">
        <span className="text-xs font-bold text-[#005ea4] uppercase tracking-widest">
          Question {index + 1}
        </span>
        {response?.duration != null && (
          <span className="text-xs text-slate-400 font-medium">
            {response.duration}s recorded
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Question text */}
        <p className="text-sm font-semibold text-slate-800 leading-relaxed">
          {question.text}
        </p>

        {/* Video answer */}
        {hasVideo ? (
          <div className="rounded-xl overflow-hidden bg-black aspect-video w-full shadow-sm">
            <video
              src={response.video_url}
              controls
              playsInline
              preload="metadata"
              className="w-full h-full object-cover"
            />
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CandidateReviewPage() {
  const { id: templateId, interviewId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  // Interview data
  const [interview,  setInterview]  = useState(null)
  const [questions,  setQuestions]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [loadError,  setLoadError]  = useState('')

  // Review state — initialised from existing hr_review if present
  const [verdict,    setVerdict]    = useState(null)
  const [rating,     setRating]     = useState(0)
  const [notes,      setNotes]      = useState('')
  const [reviewId,   setReviewId]   = useState(null)

  // Saving indicators
  const [savingVerdict, setSavingVerdict] = useState(false)
  const [savingRating,  setSavingRating]  = useState(false)
  const [savingNotes,   setSavingNotes]   = useState(false)

  useEffect(() => { load() }, [interviewId])

  async function load() {
    setLoading(true)

    // Load interview + related data (no hr_reviews join — see below)
    const { data: inv, error: invErr } = await supabase
      .from('interviews')
      .select(`
        id, status, submitted_at, created_at, template_id,
        candidates ( name, email ),
        templates ( id, title, questions ( id, text, order_index, thinking_time, answer_time ) ),
        responses ( id, question_id, video_url, duration )
      `)
      .eq('id', interviewId)
      .single()

    if (invErr || !inv) {
      setLoadError('Interview not found or you do not have access.')
      setLoading(false)
      return
    }

    if (inv.templates?.questions) {
      inv.templates.questions.sort((a, b) => a.order_index - b.order_index)
    }

    setInterview(inv)
    setQuestions(inv.templates?.questions ?? [])

    // Fetch the existing review with a direct query instead of a join.
    // Supabase/PostgREST returns unique-FK embeds as a plain object (not an
    // array), which makes ?.[0] always undefined. A direct query avoids that.
    const { data: review, error: reviewErr } = await supabase
      .from('hr_reviews')
      .select('id, verdict, rating, notes')
      .eq('interview_id', interviewId)
      .maybeSingle()

    if (reviewErr) {
      // Non-fatal: the review panel still renders, just without saved values
      console.error('Failed to load HR review:', reviewErr.message)
    } else if (review) {
      setReviewId(review.id)
      setVerdict(review.verdict ?? null)
      setRating(review.rating ?? 0)
      setNotes(review.notes ?? '')
    }

    setLoading(false)
  }

  // ── Upsert helpers ──────────────────────────────────────────────────────────

  async function upsertReview(patch) {
    const payload = {
      interview_id: interviewId,
      reviewed_by:  user.id,
      verdict,
      rating:       rating || null,
      notes,
      ...patch,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('hr_reviews')
      .upsert(payload, { onConflict: 'interview_id' })
      .select('id')
      .single()

    if (error) throw error
    if (data?.id && !reviewId) setReviewId(data.id)
  }

  async function handleVerdict(key) {
    const next = verdict === key ? null : key
    setVerdict(next)
    setSavingVerdict(true)
    try {
      await upsertReview({ verdict: next })
    } catch {
      toast.error('Failed to save verdict.')
      setVerdict(verdict) // revert
    } finally {
      setSavingVerdict(false)
    }
  }

  async function handleRating(stars) {
    setRating(stars)
    setSavingRating(true)
    try {
      await upsertReview({ rating: stars || null })
    } catch {
      toast.error('Failed to save rating.')
      setRating(rating) // revert
    } finally {
      setSavingRating(false)
    }
  }

  async function handleSaveNotes() {
    setSavingNotes(true)
    try {
      await upsertReview({ notes })
      toast.success('Notes saved.')
    } catch {
      toast.error('Failed to save notes.')
    } finally {
      setSavingNotes(false)
    }
  }

  // ── Loading / error ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa] px-4">
        <div className="text-center">
          <p className="text-sm text-red-500">{loadError}</p>
          <button onClick={() => navigate(`/templates/${templateId}/responses`)}
            className="mt-4 text-sm text-[#005ea4] hover:underline">
            Back to candidates
          </button>
        </div>
      </div>
    )
  }

  const candidate = interview.candidates
  const responses = interview.responses ?? []

  // Map responses by question_id for fast lookup
  const responseByQuestion = Object.fromEntries(responses.map(r => [r.question_id, r]))

  const displayStatus = verdict ?? (interview.status === 'submitted' ? 'submitted' : 'pending')

  return (
    <div className="min-h-screen bg-[#f5f7fa]">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(`/templates/${templateId}/responses`)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500
              hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={16} />
            All candidates
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R1</span>
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">RoundOne</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">

        {/* Candidate info + verdict row */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          {/* Left: candidate info */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                {candidate?.name}
              </h1>
              <StatusBadge status={displayStatus} />
            </div>
            <p className="text-sm text-slate-500">{candidate?.email}</p>
            {interview.submitted_at && (
              <p className="text-xs text-slate-400">
                Submitted {formatDateTime(interview.submitted_at)}
              </p>
            )}
          </div>

          {/* Right: verdict buttons */}
          <div className="flex flex-col gap-2 items-start sm:items-end">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Verdict
            </p>
            <div className="flex flex-wrap gap-2">
              {VERDICTS.map(v => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => handleVerdict(v.key)}
                  disabled={savingVerdict}
                  className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all
                    disabled:cursor-not-allowed disabled:opacity-70
                    ${verdict === v.key ? v.active : v.inactive}`}
                >
                  {verdict === v.key && savingVerdict ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 border-2 border-current/40 border-t-current
                        rounded-full animate-spin" />
                      {v.label}
                    </span>
                  ) : v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main grid: Q&A + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">

          {/* Q&A list */}
          <div className="flex flex-col gap-4">
            {questions.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
                <p className="text-sm text-slate-500">No questions found for this template.</p>
              </div>
            ) : questions.map((q, i) => (
              <QuestionAnswerCard
                key={q.id}
                question={q}
                response={responseByQuestion[q.id]}
                index={i}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="lg:sticky lg:top-20 flex flex-col gap-4">

            {/* Rating */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-slate-700 tracking-tight">Overall rating</p>
                {savingRating && (
                  <span className="w-3.5 h-3.5 border-2 border-[#005ea4]/40 border-t-[#005ea4]
                    rounded-full animate-spin" />
                )}
              </div>
              <StarRating
                value={rating}
                onChange={handleRating}
                saving={savingRating}
              />
              {rating === 0 && (
                <p className="mt-2 text-xs text-slate-400">Click to rate this candidate</p>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-3">
              <p className="text-sm font-bold text-slate-700 tracking-tight">Internal notes</p>
              <Textarea
                placeholder="Add notes visible only to your team…"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={5}
              />
              <button
                type="button"
                onClick={handleSaveNotes}
                disabled={savingNotes}
                className="w-full py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white
                  text-sm font-semibold transition-colors shadow-sm
                  disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {savingNotes ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving…
                  </>
                ) : 'Save notes'}
              </button>
            </div>

            {/* Quick info */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <p className="text-sm font-bold text-slate-700 tracking-tight mb-3">Submission info</p>
              <dl className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <dt className="text-xs text-slate-500">Questions</dt>
                  <dd className="text-xs font-semibold text-slate-700">{questions.length}</dd>
                </div>
                <div className="flex justify-between items-center">
                  <dt className="text-xs text-slate-500">Answered</dt>
                  <dd className="text-xs font-semibold text-slate-700">{responses.length}</dd>
                </div>
                {interview.submitted_at && (
                  <div className="flex justify-between items-center">
                    <dt className="text-xs text-slate-500">Submitted</dt>
                    <dd className="text-xs font-semibold text-slate-700 text-right max-w-[140px]">
                      {formatDateTime(interview.submitted_at)}
                    </dd>
                  </div>
                )}
                {responses.length > 0 && (
                  <div className="flex justify-between items-center">
                    <dt className="text-xs text-slate-500">Total recorded</dt>
                    <dd className="text-xs font-semibold text-slate-700">
                      {responses.reduce((s, r) => s + (r.duration ?? 0), 0)}s
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
