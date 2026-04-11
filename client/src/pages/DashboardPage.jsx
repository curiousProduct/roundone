import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Send, Pencil, Users, FileVideo, CheckCircle2,
  LayoutTemplate, LogOut, ClipboardList, Briefcase, Trash2,
  Layers,
} from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SendLinkModal from '../components/SendLinkModal'

// ── Shared modal ──────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, danger = false, onConfirm, onCancel }) {
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
            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm
              font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold
              transition-colors shadow-sm
              ${danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-[#005ea4] hover:bg-[#004d8a]'
              }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Job opening card ──────────────────────────────────────────────────────────

function JobOpeningCard({ job, onDelete }) {
  const stageCount = job.pipeline_stages?.length ?? 0
  const candidateCount = job.candidate_applications?.length ?? 0

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden
      hover:shadow-md hover:border-slate-300 transition-all">

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 tracking-tight truncate">{job.title}</h3>
            {job.description && (
              <p className="mt-0.5 text-xs text-slate-500 truncate">{job.description}</p>
            )}
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

        <div className="mt-4 flex items-center gap-5">
          <JobStat icon={<Layers size={13} />}  value={stageCount}    label={stageCount === 1 ? 'stage' : 'stages'} />
          <JobStat icon={<Users size={13} />}   value={candidateCount} label={candidateCount === 1 ? 'candidate' : 'candidates'} />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60
        flex items-center justify-between gap-2">
        <Link
          to={`/jobs/${job.id}/edit`}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200
            bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50
            hover:border-slate-300 transition-colors"
        >
          <Pencil size={12} />
          Edit
        </Link>

        <button
          type="button"
          onClick={() => onDelete(job)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400
            hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-semibold"
          title="Delete job opening"
        >
          <Trash2 size={13} />
          Delete
        </button>
      </div>
    </div>
  )
}

function JobStat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-sm font-bold text-slate-700">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onSendLink, onToggleActive, toggling }) {
  const questionCount  = template.questions?.length ?? 0
  const invitedCount   = template.interviews?.length ?? 0
  const submittedCount = template.interviews?.filter(i => i.status === 'submitted').length ?? 0
  const isActive       = template.is_active

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden
      hover:shadow-md hover:border-slate-300 transition-all">

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 tracking-tight truncate">
              {template.title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Created {new Date(template.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full
            text-xs font-semibold border
            ${isActive
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-5">
          <Stat icon={<FileVideo size={13} />}   value={questionCount}  label="questions" />
          <Stat icon={<Users size={13} />}        value={invitedCount}   label="invited"   />
          <Stat icon={<CheckCircle2 size={13} />} value={submittedCount} label="submitted" />
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center
        gap-2 flex-wrap">
        <span
          title={!isActive ? 'Reopen this job to send new links' : undefined}
          className={!isActive ? 'cursor-not-allowed' : undefined}
        >
          <button
            type="button"
            onClick={() => onSendLink(template)}
            disabled={!isActive}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold
              transition-colors
              ${isActive
                ? 'bg-[#005ea4] hover:bg-[#004d8a] text-white shadow-sm'
                : 'bg-slate-100 text-slate-400 pointer-events-none'
              }`}
          >
            <Send size={12} />
            Send link
          </button>
        </span>

        <Link
          to={`/templates/${template.id}/responses`}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200
            bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50
            hover:border-slate-300 transition-colors"
        >
          <ClipboardList size={12} />
          View responses
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleActive(template)}
            disabled={toggling}
            className={`text-xs font-semibold px-3 py-2 rounded-lg border transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isActive
                ? 'border-slate-200 text-slate-400 hover:border-red-200 hover:text-red-600 hover:bg-red-50'
                : 'border-green-200 text-green-700 hover:bg-green-50 bg-white'
              }`}
          >
            {toggling
              ? (isActive ? 'Closing…' : 'Reopening…')
              : (isActive ? 'Close job' : 'Reopen')
            }
          </button>

          <Link
            to={`/templates/${template.id}/edit`}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-400
              hover:text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
            title="Edit template"
          >
            <Pencil size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}

function Stat({ icon, value, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400">{icon}</span>
      <span className="text-sm font-bold text-slate-700">{value}</span>
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function JobsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#e6f0f9] flex items-center justify-center mb-4">
        <Briefcase size={24} className="text-[#005ea4]" />
      </div>
      <h3 className="text-base font-bold text-slate-900 tracking-tight">No job openings yet</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-xs leading-relaxed">
        Create a job opening to set up a multi-stage interview pipeline for a role.
      </p>
      <Link
        to="/jobs/new"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#005ea4]
          hover:bg-[#004d8a] text-white text-sm font-semibold transition-colors shadow-sm"
      >
        <Plus size={15} />
        Create first job opening
      </Link>
    </div>
  )
}

function TemplatesEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        <LayoutTemplate size={20} className="text-slate-400" />
      </div>
      <h3 className="text-sm font-bold text-slate-700 tracking-tight">No templates yet</h3>
      <p className="mt-1 text-sm text-slate-400 max-w-xs">
        Templates power Stage 1 of your job openings. Create one to get started.
      </p>
      <Link
        to="/templates/new"
        className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg border
          border-slate-200 bg-white text-slate-600 text-sm font-semibold
          hover:bg-slate-50 transition-colors"
      >
        <Plus size={14} />
        New template
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()

  // Job openings
  const [jobOpenings,   setJobOpenings]   = useState([])
  const [jobsLoading,   setJobsLoading]   = useState(true)
  const [deleteJobConfirm, setDeleteJobConfirm] = useState(null)  // job | null
  const [deletingJobId, setDeletingJobId] = useState(null)

  // Templates (existing)
  const [templates,    setTemplates]    = useState([])
  const [tmplLoading,  setTmplLoading]  = useState(true)
  const [activeModal,  setActiveModal]  = useState(null)
  const [confirmClose, setConfirmClose] = useState(null)
  const [togglingId,   setTogglingId]   = useState(null)

  useEffect(() => {
    fetchJobOpenings()
    fetchTemplates()
  }, [])

  // ── Job openings ────────────────────────────────────────────────────────

  async function fetchJobOpenings() {
    setJobsLoading(true)
    const { data, error } = await supabase
      .from('job_openings')
      .select(`
        id, title, description, is_active, created_at,
        pipeline_stages ( id ),
        candidate_applications ( id )
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load job openings.')
      console.error(error)
    } else {
      setJobOpenings(data ?? [])
    }
    setJobsLoading(false)
  }

  async function handleDeleteJob(job) {
    setDeletingJobId(job.id)
    try {
      const { error } = await supabase
        .from('job_openings')
        .delete()
        .eq('id', job.id)
        .eq('created_by', user.id)

      if (error) throw error

      setJobOpenings(prev => prev.filter(j => j.id !== job.id))
      toast.success('Job opening deleted.')
    } catch {
      toast.error('Failed to delete job opening.')
    } finally {
      setDeletingJobId(null)
      setDeleteJobConfirm(null)
    }
  }

  // ── Templates ───────────────────────────────────────────────────────────

  async function fetchTemplates() {
    setTmplLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select(`
        id, title, is_active, created_at,
        questions ( id ),
        interviews ( id, status )
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Failed to load templates.')
      console.error(error)
    } else {
      setTemplates(data ?? [])
    }
    setTmplLoading(false)
  }

  function handleToggleActive(template) {
    if (template.is_active) {
      setConfirmClose(template)
    } else {
      executeToggle(template.id, true)
    }
  }

  async function executeToggle(templateId, newValue) {
    setTogglingId(templateId)
    try {
      const { error } = await supabase
        .from('templates')
        .update({ is_active: newValue })
        .eq('id', templateId)
        .eq('created_by', user.id)

      if (error) throw error

      setTemplates(prev =>
        prev.map(t => t.id === templateId ? { ...t, is_active: newValue } : t)
      )
      toast.success(newValue ? 'Job reopened.' : 'Job closed.')
    } catch {
      toast.error('Failed to update job status.')
    } finally {
      setConfirmClose(null)
      setTogglingId(null)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  const loading = jobsLoading && tmplLoading

  return (
    <div className="min-h-screen bg-[#f5f7fa]">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center
          justify-between gap-4">
          <a
            href="https://roundone-theta.vercel.app"
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center
              justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R1</span>
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">RoundOne</span>
          </a>

          <div className="flex items-center gap-3">
            <span className="hidden sm:block text-xs text-slate-400 truncate max-w-[200px]">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border
                border-slate-200 text-xs font-semibold text-slate-500 hover:bg-slate-50
                hover:text-slate-700 transition-colors"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-10">

        {/* ── Job Openings section ───────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-5">
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

          {jobsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent
                rounded-full animate-spin" />
            </div>
          ) : jobOpenings.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <JobsEmptyState />
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {jobOpenings.map(job => (
                <JobOpeningCard
                  key={job.id}
                  job={job}
                  onDelete={setDeleteJobConfirm}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Templates section ─────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Interview templates
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Question sets used in Stage 1 async screenings.
              </p>
            </div>
            <Link
              to="/templates/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border
                border-slate-200 bg-white text-slate-600 text-sm font-semibold
                hover:bg-slate-50 transition-colors shrink-0"
            >
              <Plus size={14} />
              New template
            </Link>
          </div>

          {tmplLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent
                rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
              <TemplatesEmptyState />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {templates.map(t => (
                <TemplateCard
                  key={t.id}
                  template={t}
                  onSendLink={setActiveModal}
                  onToggleActive={handleToggleActive}
                  toggling={togglingId === t.id}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Send link modal */}
      {activeModal && (
        <SendLinkModal
          template={activeModal}
          onClose={() => {
            setActiveModal(null)
            fetchTemplates()
          }}
        />
      )}

      {/* Confirm close template */}
      {confirmClose && (
        <ConfirmModal
          title="Close this job?"
          body="Candidates with pending links won't be able to submit their responses. You can reopen the job at any time."
          confirmLabel="Close job"
          danger
          onConfirm={() => executeToggle(confirmClose.id, false)}
          onCancel={() => setConfirmClose(null)}
        />
      )}

      {/* Confirm delete job opening */}
      {deleteJobConfirm && (
        <ConfirmModal
          title="Delete this job opening?"
          body="Are you sure you want to delete this job opening? All candidate applications and stage data will be permanently deleted."
          confirmLabel={deletingJobId ? 'Deleting…' : 'Delete'}
          danger
          onConfirm={() => handleDeleteJob(deleteJobConfirm)}
          onCancel={() => setDeleteJobConfirm(null)}
        />
      )}
    </div>
  )
}
