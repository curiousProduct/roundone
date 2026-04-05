import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Send, Pencil, Users, FileVideo, CheckCircle2,
         LayoutTemplate, LogOut, ClipboardList } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import SendLinkModal from '../components/SendLinkModal'

// ── Confirm close dialog ──────────────────────────────────────────────────────

function ConfirmCloseDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4
      bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl
        p-6 flex flex-col gap-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Close this job?
          </h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Candidates with pending links won't be able to submit their responses.
            You can reopen the job at any time.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white
              text-sm font-semibold transition-colors shadow-sm"
          >
            Close job
          </button>
        </div>
      </div>
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

      {/* Card body */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-slate-900 tracking-tight truncate">
              {template.title}
            </h3>
            <p className="mt-0.5 text-xs text-slate-400">
              Created {new Date(template.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </p>
          </div>
          {/* Status badge */}
          <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-full
            text-xs font-semibold border
            ${isActive
              ? 'bg-green-50 text-green-700 border-green-200'
              : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}>
            {isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex items-center gap-5">
          <Stat icon={<FileVideo size={13} />}     value={questionCount}  label="questions" />
          <Stat icon={<Users size={13} />}          value={invitedCount}   label="invited"   />
          <Stat icon={<CheckCircle2 size={13} />}   value={submittedCount} label="submitted" />
        </div>
      </div>

      {/* Card footer */}
      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center gap-2
        flex-wrap">

        {/* Send link — disabled with tooltip when inactive */}
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
            bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50 hover:border-slate-300
            transition-colors"
        >
          <ClipboardList size={12} />
          View responses
        </Link>

        {/* Right-side controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Toggle active/inactive */}
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

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#e6f0f9] flex items-center justify-center mb-4">
        <LayoutTemplate size={24} className="text-[#005ea4]" />
      </div>
      <h3 className="text-base font-bold text-slate-900 tracking-tight">No templates yet</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-xs">
        Create your first interview template to start screening candidates asynchronously.
      </p>
      <Link
        to="/templates/new"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#005ea4]
          hover:bg-[#004d8a] text-white text-sm font-semibold transition-colors shadow-sm"
      >
        <Plus size={15} />
        Create your first template
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth()
  const [templates,    setTemplates]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [activeModal,  setActiveModal]  = useState(null)  // template | null (send-link modal)
  const [confirmClose, setConfirmClose] = useState(null)  // template | null (close-job dialog)
  const [togglingId,   setTogglingId]   = useState(null)  // template.id | null

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    setLoading(true)
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
    setLoading(false)
  }

  // Called when the toggle button is clicked on a card
  function handleToggleActive(template) {
    if (template.is_active) {
      // Deactivating: require confirmation first
      setConfirmClose(template)
    } else {
      // Reactivating: no confirmation needed
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

  return (
    <div className="min-h-screen bg-[#f5f7fa]">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <a
            href="https://roundone-theta.vercel.app"
            className="flex items-center gap-2 shrink-0"
          >
            <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center justify-center shadow-sm">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200
                text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700
                transition-colors"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Page title row */}
        <div className="flex items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Your interviews</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage templates and track candidate responses.
            </p>
          </div>
          <Link
            to="/templates/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#005ea4]
              hover:bg-[#004d8a] text-white text-sm font-semibold transition-colors shadow-sm shrink-0"
          >
            <Plus size={15} />
            New template
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <EmptyState />
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

      {/* Confirm close dialog */}
      {confirmClose && (
        <ConfirmCloseDialog
          onConfirm={() => executeToggle(confirmClose.id, false)}
          onCancel={() => setConfirmClose(null)}
        />
      )}
    </div>
  )
}
