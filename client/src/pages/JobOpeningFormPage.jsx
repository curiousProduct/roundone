import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const MAX_ADDITIONAL_STAGES = 4   // stage 1 is fixed; 4 more = 5 total

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, danger = false, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center
      bg-black/40 backdrop-blur-sm px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700
              text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold
              transition-colors
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function JobOpeningFormPage() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { user }   = useAuth()
  const isEditing  = !!id

  // ── Form state
  const [title,            setTitle]            = useState('')
  const [description,      setDescription]      = useState('')
  const [stage1TemplateId, setStage1TemplateId] = useState('')
  // additionalStages: [{ dbId: string|null, name: string }]
  const [additionalStages, setAdditionalStages] = useState([])
  const [deletedStageIds,  setDeletedStageIds]  = useState([])

  // ── Data
  const [templates, setTemplates] = useState([])
  const [pageLoading, setPageLoading] = useState(isEditing)
  const [saving,      setSaving]      = useState(false)
  const [errors,      setErrors]      = useState({})

  // ── Edit-mode guards
  const [hasSubmissions,         setHasSubmissions]         = useState(false)
  const [stagesWithApplications, setStagesWithApplications] = useState(new Set())
  const [deleteStageConfirm,     setDeleteStageConfirm]     = useState(null)  // stage index

  // ─────────────────────────────────────────────────────────────────────────
  // Initialise
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchTemplates()
    if (isEditing) loadJobOpening()
  }, [id])

  async function fetchTemplates() {
    const { data } = await supabase
      .from('templates')
      .select('id, title')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    setTemplates(data ?? [])
  }

  async function loadJobOpening() {
    setPageLoading(true)
    try {
      const { data: job, error } = await supabase
        .from('job_openings')
        .select('id, title, description')
        .eq('id', id)
        .eq('created_by', user.id)
        .single()

      if (error || !job) {
        toast.error('Job opening not found.')
        navigate('/dashboard', { replace: true })
        return
      }

      setTitle(job.title)
      setDescription(job.description ?? '')

      // Stages
      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id, order_index, name, type, template_id')
        .eq('job_opening_id', id)
        .order('order_index')

      const stage1 = stages?.find(s => s.order_index === 1)
      if (stage1) setStage1TemplateId(stage1.template_id ?? '')

      setAdditionalStages(
        (stages ?? [])
          .filter(s => s.order_index > 1)
          .map(s => ({ dbId: s.id, name: s.name }))
      )

      // Is stage 1 template locked? (any interview submission linked to it)
      if (stage1) {
        const { count } = await supabase
          .from('stage_results')
          .select('id', { count: 'exact', head: true })
          .eq('stage_id', stage1.id)
          .not('interview_id', 'is', null)
        setHasSubmissions((count ?? 0) > 0)
      }

      // Which additional stages already have results?
      const addlIds = (stages ?? [])
        .filter(s => s.order_index > 1)
        .map(s => s.id)

      if (addlIds.length > 0) {
        const { data: results } = await supabase
          .from('stage_results')
          .select('stage_id')
          .in('stage_id', addlIds)
        setStagesWithApplications(new Set((results ?? []).map(r => r.stage_id)))
      }
    } finally {
      setPageLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────────────────

  function validate() {
    const errs = {}
    if (!title.trim()) errs.title = 'Job title is required.'
    if (!stage1TemplateId) errs.stage1 = 'Please select an interview template for Stage 1.'
    additionalStages.forEach((s, i) => {
      if (!s.name.trim()) errs[`stage_${i}`] = 'Stage name is required.'
    })
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Save
  // ─────────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      if (isEditing) {
        await saveEdit()
      } else {
        await saveNew()
      }
      toast.success(isEditing ? 'Job opening updated.' : 'Job opening created.')
      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function saveNew() {
    const { data: job, error: jobErr } = await supabase
      .from('job_openings')
      .insert({
        title:       title.trim(),
        description: description.trim() || null,
        created_by:  user.id,
        company_id:  user.id,
      })
      .select('id')
      .single()
    if (jobErr) throw jobErr

    const stagesToInsert = [
      {
        job_opening_id: job.id,
        order_index:    1,
        name:           'Async video screening',
        type:           'async_video',
        template_id:    stage1TemplateId,
      },
      ...additionalStages.map((s, i) => ({
        job_opening_id: job.id,
        order_index:    i + 2,
        name:           s.name.trim(),
        type:           'live_interview',
      })),
    ]

    const { error: stageErr } = await supabase
      .from('pipeline_stages')
      .insert(stagesToInsert)
    if (stageErr) throw stageErr
  }

  async function saveEdit() {
    // 1. Update job opening fields
    const { error: jobErr } = await supabase
      .from('job_openings')
      .update({
        title:       title.trim(),
        description: description.trim() || null,
      })
      .eq('id', id)
      .eq('created_by', user.id)
    if (jobErr) throw jobErr

    // 2. Update stage 1 template (only if no submissions yet)
    if (!hasSubmissions) {
      const { data: s1 } = await supabase
        .from('pipeline_stages')
        .select('id')
        .eq('job_opening_id', id)
        .eq('order_index', 1)
        .single()
      if (s1) {
        await supabase
          .from('pipeline_stages')
          .update({ template_id: stage1TemplateId })
          .eq('id', s1.id)
      }
    }

    // 3. Delete removed stages
    for (const stageId of deletedStageIds) {
      await supabase.from('pipeline_stages').delete().eq('id', stageId)
    }

    // 4. Update or insert additional stages
    for (let i = 0; i < additionalStages.length; i++) {
      const s = additionalStages[i]
      if (s.dbId) {
        await supabase
          .from('pipeline_stages')
          .update({ name: s.name.trim(), order_index: i + 2 })
          .eq('id', s.dbId)
      } else {
        await supabase.from('pipeline_stages').insert({
          job_opening_id: id,
          order_index:    i + 2,
          name:           s.name.trim(),
          type:           'live_interview',
        })
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Stage management
  // ─────────────────────────────────────────────────────────────────────────

  function handleAddStage() {
    if (additionalStages.length >= MAX_ADDITIONAL_STAGES) return
    setAdditionalStages(prev => [...prev, { dbId: null, name: '' }])
  }

  function handleDeleteStage(index) {
    const stage = additionalStages[index]
    if (stage.dbId && stagesWithApplications.has(stage.dbId)) {
      setDeleteStageConfirm(index)
    } else {
      removeStage(index)
    }
  }

  function removeStage(index) {
    const stage = additionalStages[index]
    if (stage.dbId) {
      setDeletedStageIds(prev => [...prev, stage.dbId])
    }
    setAdditionalStages(prev => prev.filter((_, i) => i !== index))
    setDeleteStageConfirm(null)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const totalStages = 1 + additionalStages.length
  const canAddMore  = totalStages < 5

  return (
    <>
      {deleteStageConfirm !== null && (
        <ConfirmModal
          title="Delete this stage?"
          body="Candidates are already in this stage. Deleting it will remove their progress. This cannot be undone."
          confirmLabel="Delete stage"
          danger
          onConfirm={() => removeStage(deleteStageConfirm)}
          onCancel={() => setDeleteStageConfirm(null)}
        />
      )}

      <div className="min-h-screen bg-[#f5f7fa]">

        {/* Sticky header */}
        <header className="sticky top-0 z-10 bg-white border-b border-slate-200">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
            <Link
              to="/dashboard"
              className="p-1.5 -ml-1 rounded-lg text-slate-400 hover:text-slate-700
                hover:bg-slate-100 transition-colors shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>

            <h1 className="flex-1 text-base font-bold text-slate-900 tracking-tight truncate">
              {isEditing ? 'Edit job opening' : 'New job opening'}
            </h1>

            <button
              onClick={handleSave}
              disabled={saving}
              className="shrink-0 px-4 py-2 rounded-lg bg-[#005ea4] hover:bg-[#004d8a]
                text-white text-sm font-semibold transition-colors shadow-sm
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white
                    rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                isEditing ? 'Save changes' : 'Save'
              )}
            </button>
          </div>
        </header>

        {/* Body */}
        <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

          {/* ── Job details ───────────────────────────────────────────────── */}
          <section className="bg-white border border-slate-200 rounded-2xl shadow-sm
            p-6 flex flex-col gap-5">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              Job details
            </h2>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Job title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => {
                  setTitle(e.target.value)
                  setErrors(p => ({ ...p, title: undefined }))
                }}
                placeholder="e.g. Senior Product Manager"
                className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900
                  bg-slate-50 placeholder-slate-400 outline-none transition-all
                  focus:bg-white focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
                  ${errors.title ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
              />
              {errors.title && (
                <p className="text-xs text-red-600 mt-0.5">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700">
                Job description{' '}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of the role..."
                rows={3}
                className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-sm
                  text-gray-900 bg-slate-50 placeholder-slate-400 outline-none resize-none
                  transition-all focus:bg-white focus:border-[#005ea4]
                  focus:ring-2 focus:ring-[#005ea4]/10"
              />
            </div>
          </section>

          {/* ── Interview stages ──────────────────────────────────────────── */}
          <section className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Interview stages
              </h2>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Define the rounds candidates will go through. You can add up to 5 stages.
              </p>
            </div>

            {/* ── Stage 1 — fixed, async video ─────────────────────────── */}
            <div className="bg-[#e8f1fb] border border-[#005ea4]/25 rounded-2xl p-5
              flex flex-col gap-4">

              {/* Stage 1 header */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-[#005ea4] flex items-center
                    justify-center shrink-0">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">
                    Async video screening
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                  bg-[#005ea4]/10 border border-[#005ea4]/20
                  text-xs font-semibold text-[#005ea4]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#005ea4]" />
                  Powered by RoundOne
                </span>
              </div>

              {/* Template selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Interview template <span className="text-red-400">*</span>
                </label>

                {hasSubmissions ? (
                  /* Locked — candidates have already submitted */
                  <div className="flex flex-col gap-1.5">
                    <div className="w-full px-3.5 py-2.5 rounded-lg border border-[#005ea4]/20
                      bg-white/60 text-sm text-slate-600 cursor-not-allowed select-none">
                      {templates.find(t => t.id === stage1TemplateId)?.title
                        ?? 'Selected template'}
                    </div>
                    <p className="text-xs text-slate-500 flex items-start gap-1.5">
                      <span className="mt-0.5 w-3.5 h-3.5 shrink-0 inline-flex items-center
                        justify-center rounded-full bg-amber-100 text-amber-600
                        text-[10px] font-bold">
                        !
                      </span>
                      Template cannot be changed after candidates have submitted responses.
                    </p>
                  </div>
                ) : (
                  /* Editable */
                  <div className="flex flex-col gap-2">
                    <div className="relative">
                      <select
                        value={stage1TemplateId}
                        onChange={e => {
                          setStage1TemplateId(e.target.value)
                          setErrors(p => ({ ...p, stage1: undefined }))
                        }}
                        className={`w-full appearance-none px-3.5 py-2.5 pr-9 rounded-lg border
                          text-sm bg-white outline-none transition-all cursor-pointer
                          focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
                          ${errors.stage1
                            ? 'border-red-300 text-gray-900'
                            : stage1TemplateId
                              ? 'border-slate-200 text-gray-900'
                              : 'border-slate-200 text-slate-400'
                          }`}
                      >
                        <option value="">Select a template…</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>{t.title}</option>
                        ))}
                      </select>
                      <ChevronDown
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2
                          text-slate-400 pointer-events-none"
                      />
                    </div>

                    {errors.stage1 && (
                      <p className="text-xs text-red-600">{errors.stage1}</p>
                    )}

                    <a
                      href="/templates/new"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-[#005ea4] hover:underline
                        inline-flex items-center gap-1 w-fit"
                    >
                      <Plus size={11} />
                      Create new template
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ── Additional stages ─────────────────────────────────────── */}
            {additionalStages.map((stage, index) => (
              <div
                key={`${stage.dbId ?? 'new'}-${index}`}
                className="bg-white border border-slate-200 rounded-2xl p-5
                  flex flex-col gap-4 shadow-sm"
              >
                {/* Stage header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200
                      flex items-center justify-center shrink-0">
                      <span className="text-slate-600 text-xs font-bold">{index + 2}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-700">
                      Stage {index + 2}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      bg-violet-50 border border-violet-200
                      text-xs font-semibold text-violet-700">
                      Live interview
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteStage(index)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500
                        hover:bg-red-50 transition-colors"
                      title="Delete this stage"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Stage name input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Stage name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={stage.name}
                    onChange={e => {
                      const val = e.target.value
                      setAdditionalStages(prev =>
                        prev.map((s, i) => i === index ? { ...s, name: val } : s)
                      )
                      setErrors(p => ({ ...p, [`stage_${index}`]: undefined }))
                    }}
                    placeholder="e.g. Technical round"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900
                      bg-slate-50 placeholder-slate-400 outline-none transition-all
                      focus:bg-white focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
                      ${errors[`stage_${index}`]
                        ? 'border-red-300 bg-red-50'
                        : 'border-slate-200'
                      }`}
                  />
                  {errors[`stage_${index}`] && (
                    <p className="text-xs text-red-600 mt-0.5">{errors[`stage_${index}`]}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Add stage button */}
            {canAddMore ? (
              <button
                type="button"
                onClick={handleAddStage}
                className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-300
                  text-sm font-semibold text-slate-400
                  hover:border-[#005ea4] hover:text-[#005ea4] hover:bg-[#005ea4]/5
                  transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={15} />
                Add another stage
              </button>
            ) : (
              <p className="text-center text-xs text-slate-400 py-2">
                Maximum of 5 stages reached.
              </p>
            )}
          </section>
        </main>
      </div>
    </>
  )
}
