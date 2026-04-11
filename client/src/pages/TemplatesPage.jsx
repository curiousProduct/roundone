import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Trash2, FileVideo, LayoutTemplate } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NavBar from '../components/NavBar'

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel, loading }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
      bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-5">
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
              disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onDelete }) {
  const questionCount = template.questions?.length ?? 0

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
          <div className="flex items-center gap-1.5 shrink-0 text-slate-500">
            <FileVideo size={13} className="text-slate-400" />
            <span className="text-sm font-bold text-slate-700">{questionCount}</span>
            <span className="text-xs text-slate-400">
              {questionCount === 1 ? 'question' : 'questions'}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/60
        flex items-center justify-between gap-2">
        <Link
          to={`/templates/${template.id}/edit`}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200
            bg-white text-slate-600 text-xs font-semibold hover:bg-slate-50
            hover:border-slate-300 transition-colors"
        >
          <Pencil size={12} />
          Edit
        </Link>

        <button
          type="button"
          onClick={() => onDelete(template)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400
            hover:text-red-600 hover:bg-red-50 transition-colors text-xs font-semibold"
        >
          <Trash2 size={13} />
          Delete
        </button>
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
        <LayoutTemplate size={24} className="text-[#005ea4]" />
      </div>
      <h3 className="text-base font-bold text-slate-900 tracking-tight">No templates yet</h3>
      <p className="mt-1.5 text-sm text-slate-500 max-w-xs leading-relaxed">
        Create your first template to start screening candidates with async video questions.
      </p>
      <Link
        to="/templates/new"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
          bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
          transition-colors shadow-sm"
      >
        <Plus size={15} />
        Create your first template
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const { user } = useAuth()
  const [templates,    setTemplates]    = useState([])
  const [loading,      setLoading]      = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)  // { template, usedInJobs }
  const [deleting,     setDeleting]     = useState(false)

  useEffect(() => { fetchTemplates() }, [])

  async function fetchTemplates() {
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select('id, title, created_at, questions(id)')
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

  async function initiateDelete(template) {
    // Check whether this template is referenced in any pipeline stage
    const { count } = await supabase
      .from('pipeline_stages')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', template.id)

    setDeleteTarget({ template, usedInJobs: (count ?? 0) > 0 })
  }

  async function confirmDelete() {
    const { template } = deleteTarget
    setDeleting(true)
    try {
      // If referenced in job openings, nullify those links first
      if (deleteTarget.usedInJobs) {
        await supabase
          .from('pipeline_stages')
          .update({ template_id: null })
          .eq('template_id', template.id)
      }

      // Delete questions explicitly (no CASCADE defined on this FK)
      await supabase.from('questions').delete().eq('template_id', template.id)

      // Delete the template
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', template.id)
        .eq('created_by', user.id)
      if (error) throw error

      setTemplates(prev => prev.filter(t => t.id !== template.id))
      toast.success('Template deleted.')
    } catch (err) {
      console.error(err)
      toast.error('Failed to delete template.')
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
              Interview templates
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Question sets used for Stage 1 async video screenings.
            </p>
          </div>
          <Link
            to="/templates/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
              transition-colors shadow-sm shrink-0"
          >
            <Plus size={15} />
            New template
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent
              rounded-full animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <EmptyState />
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {templates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onDelete={initiateDelete}
              />
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <ConfirmModal
          title="Delete this template?"
          body={deleteTarget.usedInJobs
            ? 'This template is being used in one or more job openings. Deleting it will affect those job openings. Are you sure?'
            : 'Are you sure you want to delete this template? This cannot be undone.'
          }
          confirmLabel="Delete template"
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
