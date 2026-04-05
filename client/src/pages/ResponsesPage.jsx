import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Users, CheckCircle2, ThumbsUp, ThumbsDown, Clock } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getStatus, StatusBadge, formatDateTime } from '../lib/candidateStatus.jsx'

const FILTERS = [
  { key: 'all',          label: 'All' },
  { key: 'submitted',    label: 'Submitted' },
  { key: 'shortlisted',  label: 'Shortlisted' },
  { key: 'under_review', label: 'Under review' },
  { key: 'rejected',     label: 'Rejected' },
  { key: 'pending',      label: 'Pending' },
]

function StatCard({ icon, value, label }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center
        justify-center shrink-0 text-slate-500">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
}

function CandidateCard({ interview, templateId }) {
  const status       = getStatus(interview)
  const candidate    = interview.candidates
  const isReviewable = interview.status === 'submitted' || interview.hr_reviews?.[0]?.verdict

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md
      hover:border-slate-300 transition-all p-5">
      <div className="flex items-start justify-between gap-4">

        {/* Candidate info */}
        <div className="min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-semibold text-slate-900 text-sm">{candidate?.name}</span>
            <StatusBadge status={status} />
          </div>
          <span className="text-xs text-slate-400">{candidate?.email}</span>
          {interview.submitted_at ? (
            <span className="text-xs text-slate-400">
              Submitted {formatDateTime(interview.submitted_at)}
            </span>
          ) : (
            <span className="text-xs text-slate-400 italic">
              Invited {formatDateTime(interview.created_at)}
            </span>
          )}
        </div>

        {/* Action */}
        <div className="shrink-0">
          {isReviewable ? (
            <Link
              to={`/templates/${templateId}/responses/${interview.id}`}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#005ea4]
                hover:bg-[#004d8a] text-white text-xs font-semibold transition-colors shadow-sm"
            >
              Review
            </Link>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg
              bg-slate-100 text-slate-400 text-xs font-medium cursor-default select-none">
              <Clock size={12} />
              Awaiting response
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ filtered }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm py-16 text-center px-4">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <Users size={20} className="text-slate-400" />
      </div>
      <p className="font-semibold text-slate-800 text-sm">
        {filtered ? 'No candidates match this filter' : 'No candidates yet'}
      </p>
      <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto">
        {filtered
          ? 'Try a different filter to see other candidates.'
          : 'Use "Send link" on the dashboard to invite candidates to this interview.'
        }
      </p>
    </div>
  )
}

export default function ResponsesPage() {
  const { id: templateId } = useParams()
  const navigate           = useNavigate()
  const { user }           = useAuth()

  const [template,   setTemplate]   = useState(null)
  const [interviews, setInterviews] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState('all')

  useEffect(() => { load() }, [templateId])

  async function load() {
    setLoading(true)

    const [{ data: tmpl, error: tErr }, { data: invs, error: iErr }] = await Promise.all([
      supabase
        .from('templates')
        .select('id, title')
        .eq('id', templateId)
        .eq('created_by', user.id)
        .single(),
      supabase
        .from('interviews')
        .select(`
          id, status, created_at, submitted_at, expires_at,
          candidates ( name, email )
        `)
        .eq('template_id', templateId)
        .order('created_at', { ascending: false }),
    ])

    if (tErr || !tmpl) { toast.error('Template not found.'); navigate('/dashboard'); return }
    if (iErr) { toast.error('Failed to load candidates.'); setLoading(false); return }

    const base = invs ?? []

    // Fetch verdicts in a single direct query instead of relying on the join.
    // Supabase/PostgREST returns unique-FK embeds as a plain object (not an
    // array), which breaks hr_reviews?.[0] access throughout the page.
    let reviewMap = {}
    if (base.length > 0) {
      const { data: reviews, error: rErr } = await supabase
        .from('hr_reviews')
        .select('interview_id, verdict, rating')
        .in('interview_id', base.map(i => i.id))

      if (rErr) {
        toast.error('Failed to load review data.')
      } else {
        reviewMap = Object.fromEntries(
          (reviews ?? []).map(r => [r.interview_id, r])
        )
      }
    }

    // Normalise to the array shape that getStatus and stats expect
    const merged = base.map(i => ({
      ...i,
      hr_reviews: reviewMap[i.id] ? [reviewMap[i.id]] : [],
    }))

    setTemplate(tmpl)
    setInterviews(merged)
    setLoading(false)
  }

  const stats = useMemo(() => ({
    total:       interviews.length,
    submitted:   interviews.filter(i => i.status === 'submitted').length,
    shortlisted: interviews.filter(i => i.hr_reviews?.[0]?.verdict === 'shortlisted').length,
    rejected:    interviews.filter(i => i.hr_reviews?.[0]?.verdict === 'rejected').length,
  }), [interviews])

  const filtered = useMemo(() =>
    filter === 'all' ? interviews : interviews.filter(i => getStatus(i) === filter),
    [interviews, filter]
  )

  const filterCounts = useMemo(() => {
    const counts = {}
    FILTERS.forEach(f => {
      counts[f.key] = f.key === 'all'
        ? interviews.length
        : interviews.filter(i => getStatus(i) === f.key).length
    })
    return counts
  }, [interviews])

  return (
    <div className="min-h-screen bg-[#f5f7fa]">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500
              hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={16} />
            Dashboard
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R1</span>
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">RoundOne</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-7 flex flex-col gap-6">

        {/* Page heading */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {template?.title ?? '…'}
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">Candidate responses</p>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={<Users size={16} />}       value={stats.total}       label="Invited" />
            <StatCard icon={<CheckCircle2 size={16} />} value={stats.submitted}  label="Submitted" />
            <StatCard icon={<ThumbsUp size={16} />}     value={stats.shortlisted} label="Shortlisted" />
            <StatCard icon={<ThumbsDown size={16} />}   value={stats.rejected}   label="Rejected" />
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold
                border transition-all
                ${filter === f.key
                  ? 'bg-[#005ea4] text-white border-[#005ea4] shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
            >
              {f.label}
              {filterCounts[f.key] > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 font-bold
                  ${filter === f.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {filterCounts[f.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={filter !== 'all'} />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map(inv => (
              <CandidateCard key={inv.id} interview={inv} templateId={templateId} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
