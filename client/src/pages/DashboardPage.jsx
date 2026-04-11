import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, Layers, Users, Briefcase, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NavBar from '../components/NavBar'

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4
      bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200
        shadow-xl p-6 flex flex-col gap-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{body}</p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm
              font-semibold text-slate-600 hover:bg-slate-50 transition-colors
              disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white
              text-sm font-semibold transition-colors shadow-sm
              disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white
                  rounded-full animate-spin" />
                Deleting…
              </>
            ) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Stage stat row ────────────────────────────────────────────────────────────

function StageStatRow({ stage, invited, primary, primaryLabel }) {
  const isAsync = stage.type === 'async_video'
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0
          ${isAsync ? 'bg-[#005ea4]' : 'bg-violet-500'}`}
        />
        <span className="text-xs text-slate-600 truncate">
          <span className="font-semibold">Stage {stage.order_index}</span>
          {' — '}
          {stage.name}
        </span>
      </div>
      <span className="shrink-0 text-xs text-slate-400 tabular-nums whitespace-nowrap">
        <span className="font-semibold text-slate-700">{primary}</span>
        {' '}{primaryLabel}{' / '}
        <span className="font-semibold text-slate-700">{invited}</span>
        {' '}invited
      </span>
    </div>
  )
}

// ── Job opening card ──────────────────────────────────────────────────────────

function JobOpeningCard({ job, stage1StatsMap, stageStatsMap, onDelete }) {
  const stageCount     = job.pipeline_stages?.length ?? 0
  const candidateCount = job.candidate_applications?.length ?? 0

  const sortedStages = [...(job.pipeline_stages ?? [])]
    .sort((a, b) => a.order_index - b.order_index)

  // Build only the rows that have data
  const statsRows = sortedStages.flatMap(stage => {
    if (stage.order_index === 1) {
      if (!stage.template_id) return []
      const s = stage1StatsMap[stage.template_id]
      if (!s || s.invited === 0) return []
      return [{ stage, invited: s.invited, primary: s.submitted, primaryLabel: 'submitted' }]
    } else {
      const s = stageStatsMap[stage.id]
      if (!s || s.invited === 0) return []
      return [{ stage, invited: s.invited, primary: s.completed, primaryLabel: 'completed' }]
    }
  })

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden
      hover:shadow-md hover:border-slate-300 transition-all">

      {/* Body */}
      <div className="p-5 flex flex-col gap-4">

        {/* Title + status badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 tracking-tight truncate">
              {job.title}
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Created {new Date(job.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full
            text-xs font-semibold border
            ${job.is_active
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
            {job.is_active ? 'Active' : 'Closed'}
          </span>
        </div>

        {/* Summary counts */}
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-1.5">
            <Layers size={13} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-700">{stageCount}</span>
            <span className="text-xs text-slate-400">
              {stageCount === 1 ? 'stage' : 'stages'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={13} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-700">{candidateCount}</span>
            <span className="text-xs text-slate-400">
              {candidateCount === 1 ? 'candidate' : 'candidates'}
            </span>
          </div>
        </div>

        {/* Progressive stage stats — only shown when data exists */}
        {statsRows.length > 0 && (
          <div className="border-t border-slate-100 pt-4 flex flex-col gap-2.5">
            {statsRows.map(row => (
              <StageStatRow
                key={row.stage.id}
                stage={row.stage}
                invited={row.invited}
                primary={row.primary}
                primaryLabel={row.primaryLabel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60
        flex items-center justify-between gap-2">

        <Link
          to={`/jobs/${job.id}`}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg
            bg-[#005ea4] hover:bg-[#004d8a] text-white text-xs font-semibold
            transition-colors shadow-sm"
        >
          View pipeline
          <ChevronRight size={12} />
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to={`/jobs/${job.id}/edit`}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700
              hover:bg-slate-100 transition-colors"
            title="Edit job opening"
          >
            <Pencil size={14} />
          </Link>
          <button
            type="button"
            onClick={() => onDelete(job)}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600
              hover:bg-red-50 transition-colors"
            title="Delete job opening"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#e6f0f9] flex items-center
        justify-center mb-4">
        <Briefcase size={24} className="text-[#005ea4]" />
      </div>
      <h3 className="text-base font-bold text-slate-900 tracking-tight">
        No job openings yet
      </h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-xs leading-relaxed">
        Create a job opening to start building your hiring pipeline.
      </p>
      <Link
        to="/jobs/new"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
          bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
          transition-colors shadow-sm"
      >
        <Plus size={15} />
        Create your first job opening
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()

  const [jobOpenings,    setJobOpenings]    = useState([])
  const [stage1StatsMap, setStage1StatsMap] = useState({})
  const [stageStatsMap,  setStageStatsMap]  = useState({})
  const [loading,        setLoading]        = useState(true)
  const [deleteTarget,   setDeleteTarget]   = useState(null)   // job | null
  const [deleting,       setDeleting]       = useState(false)

  useEffect(() => { fetchDashboard() }, [])

  async function fetchDashboard() {
    setLoading(true)
    try {
      // ── 1. Job openings with stages + application counts
      const { data: jobs, error: jobErr } = await supabase
        .from('job_openings')
        .select(`
          id, title, is_active, created_at,
          pipeline_stages ( id, order_index, name, type, template_id ),
          candidate_applications ( id )
        `)
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })

      if (jobErr) throw jobErr
      const jobList = jobs ?? []

      // ── 2. Collect IDs for batch stats queries
      const stage1TemplateIds = [
        ...new Set(
          jobList
            .flatMap(j => j.pipeline_stages ?? [])
            .filter(s => s.order_index === 1 && s.template_id)
            .map(s => s.template_id)
        ),
      ]

      const addlStageIds = jobList
        .flatMap(j => j.pipeline_stages ?? [])
        .filter(s => s.order_index > 1)
        .map(s => s.id)

      // ── 3. Batch fetch stats in parallel
      const [interviewsRes, stageResultsRes] = await Promise.all([
        stage1TemplateIds.length > 0
          ? supabase
              .from('interviews')
              .select('id, status, template_id')
              .in('template_id', stage1TemplateIds)
          : { data: [] },
        addlStageIds.length > 0
          ? supabase
              .from('stage_results')
              .select('id, stage_id, status')
              .in('stage_id', addlStageIds)
          : { data: [] },
      ])

      // ── 4. Build stage1StatsMap: { [templateId]: { invited, submitted } }
      const s1Map = {}
      for (const inv of interviewsRes.data ?? []) {
        if (!s1Map[inv.template_id]) s1Map[inv.template_id] = { invited: 0, submitted: 0 }
        s1Map[inv.template_id].invited++
        if (inv.status === 'submitted') s1Map[inv.template_id].submitted++
      }

      // ── 5. Build stageStatsMap: { [stageId]: { invited, completed } }
      const srMap = {}
      for (const sr of stageResultsRes.data ?? []) {
        if (!srMap[sr.stage_id]) srMap[sr.stage_id] = { invited: 0, completed: 0 }
        srMap[sr.stage_id].invited++
        if (sr.status === 'passed' || sr.status === 'failed') srMap[sr.stage_id].completed++
      }

      setJobOpenings(jobList)
      setStage1StatsMap(s1Map)
      setStageStatsMap(srMap)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load dashboard.')
    } finally {
      setLoading(false)
    }
  }

  async function handleDeleteJob() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const { error } = await supabase
        .from('job_openings')
        .delete()
        .eq('id', deleteTarget.id)
        .eq('created_by', user.id)

      if (error) throw error

      setJobOpenings(prev => prev.filter(j => j.id !== deleteTarget.id))
      toast.success('Job opening deleted.')
    } catch {
      toast.error('Failed to delete job opening.')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Job openings
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Multi-stage interview pipelines for your open roles.
            </p>
          </div>
          <Link
            to="/jobs/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
              transition-colors shadow-sm shrink-0"
          >
            <Plus size={15} />
            New job opening
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent
              rounded-full animate-spin" />
          </div>
        ) : jobOpenings.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <EmptyState />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {jobOpenings.map(job => (
              <JobOpeningCard
                key={job.id}
                job={job}
                stage1StatsMap={stage1StatsMap}
                stageStatsMap={stageStatsMap}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete this job opening?"
          body="All candidate applications and stage data will be permanently deleted. This cannot be undone."
          confirmLabel="Delete"
          loading={deleting}
          onConfirm={handleDeleteJob}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
