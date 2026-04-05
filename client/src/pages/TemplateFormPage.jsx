import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Trash2, Plus, GripVertical, ChevronLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import Input from '../components/ui/Input'
import Textarea from '../components/ui/Textarea'
import VideoRecorder from '../components/VideoRecorder'

const THINKING_MIN = 10
const THINKING_MAX = 120
const THINKING_DEFAULT = 30
const ANSWER_MIN = 30
const ANSWER_MAX = 300
const ANSWER_DEFAULT = 90

function newQuestion() {
  return {
    _key: crypto.randomUUID(),
    text: '',
    thinking_time: THINKING_DEFAULT,
    answer_time: ANSWER_DEFAULT,
    videoBlob: null,
  }
}

function clamp(value, min, max) {
  const n = parseInt(value, 10)
  if (isNaN(n)) return min
  return Math.min(max, Math.max(min, n))
}

function TimeField({ label, value, min, max, onChange, error }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={e => onChange(e.target.value)}
          onBlur={e => onChange(clamp(e.target.value, min, max))}
          className={`w-20 px-3 py-2 rounded-lg border text-sm text-slate-900 bg-slate-50 text-center
            outline-none transition-all
            focus:bg-white focus:border-[#005ea4] focus:ring-2 focus:ring-[#005ea4]/10
            [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
            [&::-webkit-outer-spin-button]:appearance-none
            ${error ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
        />
        <span className="text-xs text-slate-400">sec</span>
      </div>
      <p className="text-xs text-slate-400">{min}–{max}s</p>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function QuestionCard({ question, index, total, errors, onChange, onDelete }) {
  const isOnly = total === 1

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Card header bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-slate-300" />
          <span className="text-xs font-bold text-[#005ea4] uppercase tracking-widest">
            Question {index + 1}
          </span>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={isOnly}
          title={isOnly ? 'At least one question is required' : 'Remove question'}
          className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50
            transition-colors disabled:opacity-30 disabled:cursor-not-allowed
            disabled:hover:bg-transparent disabled:hover:text-slate-300"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Question text */}
        <Textarea
          label="Question"
          placeholder="Enter the interview question you want candidates to answer"
          value={question.text}
          onChange={e => onChange({ text: e.target.value })}
          error={errors?.text}
          rows={2}
        />

        {/* Video recorder */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-slate-600">Video question</span>
          <VideoRecorder
            onVideoReady={blob => onChange({ videoBlob: blob })}
          />
        </div>

        {/* Time fields */}
        <div className="pt-1 border-t border-slate-100">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Candidate time limits
          </p>
          <div className="flex flex-wrap gap-6">
            <TimeField
              label="Thinking time"
              value={question.thinking_time}
              min={THINKING_MIN}
              max={THINKING_MAX}
              onChange={val => onChange({ thinking_time: val })}
              error={errors?.thinking_time}
            />
            <TimeField
              label="Answer time"
              value={question.answer_time}
              min={ANSWER_MIN}
              max={ANSWER_MAX}
              onChange={val => onChange({ answer_time: val })}
              error={errors?.answer_time}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function validate(title, questions) {
  const errors = {}
  if (!title.trim()) errors.title = 'Job title is required'

  const qErrors = questions.map(q => {
    const e = {}
    if (!q.text.trim()) e.text = 'Question text is required'
    const tt = parseInt(q.thinking_time, 10)
    if (isNaN(tt) || tt < THINKING_MIN || tt > THINKING_MAX)
      e.thinking_time = `Must be ${THINKING_MIN}–${THINKING_MAX}s`
    const at = parseInt(q.answer_time, 10)
    if (isNaN(at) || at < ANSWER_MIN || at > ANSWER_MAX)
      e.answer_time = `Must be ${ANSWER_MIN}–${ANSWER_MAX}s`
    return e
  })

  const hasQErrors = qErrors.some(e => Object.keys(e).length > 0)
  return { errors, qErrors, valid: Object.keys(errors).length === 0 && !hasQErrors }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TemplateFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState([newQuestion()])
  const [errors, setErrors] = useState({})
  const [qErrors, setQErrors] = useState([])
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(isEdit)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (!isEdit) return

    async function load() {
      const { data: tmpl, error: tErr } = await supabase
        .from('templates')
        .select('*')
        .eq('id', id)
        .single()

      if (tErr || !tmpl) {
        setLoadError('Template not found or you do not have access.')
        setLoading(false)
        return
      }

      const { data: qs, error: qErr } = await supabase
        .from('questions')
        .select('*')
        .eq('template_id', id)
        .order('order_index')

      if (qErr) {
        setLoadError('Failed to load questions.')
        setLoading(false)
        return
      }

      setTitle(tmpl.title)
      setQuestions(qs.map(q => ({
        _key: q.id,
        id: q.id,
        text: q.text,
        thinking_time: q.thinking_time,
        answer_time: q.answer_time,
        videoBlob: null,
      })))
      setLoading(false)
    }

    load()
  }, [id, isEdit])

  function updateQuestion(index, patch) {
    setQuestions(prev => prev.map((q, i) => i === index ? { ...q, ...patch } : q))
  }

  function deleteQuestion(index) {
    setQuestions(prev => prev.filter((_, i) => i !== index))
  }

  function addQuestion() {
    setQuestions(prev => [...prev, newQuestion()])
  }

  async function handleSave() {
    const { errors: e, qErrors: qe, valid } = validate(title, questions)
    setErrors(e)
    setQErrors(qe)
    if (!valid) return

    setSaving(true)
    try {
      if (isEdit) {
        const { error: tErr } = await supabase
          .from('templates')
          .update({ title: title.trim() })
          .eq('id', id)
        if (tErr) throw tErr

        const { error: dErr } = await supabase
          .from('questions')
          .delete()
          .eq('template_id', id)
        if (dErr) throw dErr

        const { error: qErr } = await supabase
          .from('questions')
          .insert(questions.map((q, i) => ({
            template_id: id,
            order_index: i,
            text: q.text.trim(),
            thinking_time: clamp(q.thinking_time, THINKING_MIN, THINKING_MAX),
            answer_time: clamp(q.answer_time, ANSWER_MIN, ANSWER_MAX),
          })))
        if (qErr) throw qErr
        toast.success('Template updated')
      } else {
        const { data: tmpl, error: tErr } = await supabase
          .from('templates')
          .insert({ title: title.trim(), created_by: user.id })
          .select()
          .single()
        if (tErr) throw tErr

        const { error: qErr } = await supabase
          .from('questions')
          .insert(questions.map((q, i) => ({
            template_id: tmpl.id,
            order_index: i,
            text: q.text.trim(),
            thinking_time: clamp(q.thinking_time, THINKING_MIN, THINKING_MAX),
            answer_time: clamp(q.answer_time, ANSWER_MIN, ANSWER_MAX),
          })))
        if (qErr) throw qErr
        toast.success('Template saved')
      }

      navigate('/dashboard')
    } catch (err) {
      console.error(err)
      toast.error(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // ── States ──────────────────────────────────────────────────────────────

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
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 text-sm text-[#005ea4] hover:underline"
          >
            Back to dashboard
          </button>
        </div>
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f7fa]">

      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-500
              hover:text-slate-800 transition-colors"
          >
            <ChevronLeft size={16} />
            Dashboard
          </button>
          <a
            href="https://roundone-theta.vercel.app"
            className="flex items-center gap-2"
          >
            <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-xs">R1</span>
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">RoundOne</span>
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* Page heading */}
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {isEdit ? 'Edit template' : 'New interview template'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Define the questions candidates will record video answers for.
          </p>
        </div>

        {/* Job title card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <Input
            label="Job title"
            placeholder="e.g. Product Manager — Round 1"
            value={title}
            onChange={e => setTitle(e.target.value)}
            error={errors.title}
            hint="Shown to candidates on the interview page."
          />
        </div>

        {/* Questions section */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 tracking-tight">
              Questions
            </h2>
            <span className="text-xs text-slate-400 font-medium">
              {questions.length} / 10
            </span>
          </div>

          {questions.map((q, i) => (
            <QuestionCard
              key={q._key}
              question={q}
              index={i}
              total={questions.length}
              errors={qErrors[i]}
              onChange={patch => updateQuestion(i, patch)}
              onDelete={() => deleteQuestion(i)}
            />
          ))}

          {questions.length < 10 && (
            <button
              type="button"
              onClick={addQuestion}
              className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl
                border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-400
                hover:border-[#005ea4] hover:text-[#005ea4] hover:bg-[#005ea4]/5
                transition-all"
            >
              <Plus size={15} />
              Add question
            </button>
          )}
        </div>

        {/* Save bar */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <p className="text-xs text-slate-400">
            {isEdit ? 'Changes are saved when you click below.' : 'Templates can be edited after saving.'}
          </p>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] active:bg-[#003d6e]
              text-white text-sm font-semibold transition-colors shadow-sm
              disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              isEdit ? 'Save changes' : 'Save template'
            )}
          </button>
        </div>
      </main>
    </div>
  )
}
