import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ChevronRight, Clock, Mic, VideoOff } from 'lucide-react'
import supabase from '../lib/supabase'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  if (typeof MediaRecorder === 'undefined') return ''
  return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
}

function formatTime(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function estimatedMinutes(questions) {
  const total = questions.reduce((sum, q) => sum + q.thinking_time + q.answer_time, 0)
  return Math.ceil(total / 60)
}

// ── Small shared UI ───────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-[#005ea4] flex items-center justify-center shadow-sm">
        <span className="text-white font-bold text-xs">R1</span>
      </div>
      <span className="font-bold text-slate-900 text-sm tracking-tight">RoundOne</span>
    </div>
  )
}

function Spinner({ className = '' }) {
  return (
    <div className={`w-6 h-6 border-2 border-[#005ea4] border-t-transparent rounded-full animate-spin ${className}`} />
  )
}

// ── Error pages ───────────────────────────────────────────────────────────────

function ErrorPage({ type }) {
  const content = {
    invalid: {
      title: 'Invalid link',
      body: 'This interview link is not valid. Please check the link you received and try again.',
    },
    expired: {
      title: 'This link has expired',
      body: 'The interview link you followed is no longer active. Please contact the company to request a new link.',
    },
    closed: {
      title: 'This position is no longer accepting responses',
      body: 'The company has closed applications for this role. Please contact them if you have any questions.',
    },
    browser: {
      title: 'Browser not supported',
      body: 'Your browser does not support video recording. Please open this link in a recent version of Chrome, Safari, Firefox, or Edge.',
    },
  }[type] ?? { title: 'Something went wrong', body: 'Please try again or contact support.' }

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center
          justify-center mx-auto mb-4">
          <AlertCircle size={22} className="text-red-500" />
        </div>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">{content.title}</h1>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">{content.body}</p>
      </div>
    </div>
  )
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0
  return (
    <div className="fixed top-0 left-0 right-0 z-20 h-1 bg-slate-200">
      <div
        className="h-full bg-[#005ea4] transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

// ── Countdown ring ────────────────────────────────────────────────────────────

function CountdownDisplay({ value, max, accent = false }) {
  const pct = max > 0 ? value / max : 0
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dash = circumference * pct

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e2e5ea" strokeWidth="5" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={accent ? '#ef4444' : '#005ea4'}
          strokeWidth="5"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <span className={`absolute text-2xl font-bold tabular-nums tracking-tight
        ${accent ? 'text-red-500' : 'text-[#005ea4]'}`}>
        {formatTime(value)}
      </span>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const { token } = useParams()
  const navigate = useNavigate()

  // ── Page-level state
  const [pageState, setPageState] = useState('loading')   // loading | error | ready
  const [errorType, setErrorType] = useState('')
  const [interview, setInterview] = useState(null)
  // interview: { id, candidate: {name}, template: {title, questions: [{...}]} }

  // ── Interview flow
  const [phase, setPhase] = useState('welcome')           // welcome | thinking | recording | preview | submitting
  const [qIdx, setQIdx] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [answers, setAnswers] = useState([])              // [{blob, objectUrl, duration, mimeType}]

  // ── Camera
  const [cameraState, setCameraState] = useState('idle')  // idle | requesting | ready | error
  const [cameraErrorMsg, setCameraErrorMsg] = useState('')

  // ── Submit
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [submitError, setSubmitError] = useState('')

  // ── Refs (avoid stale closures in callbacks)
  const streamRef        = useRef(null)
  const recorderRef      = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const liveVideoRef     = useRef(null)
  const recordStartRef   = useRef(null)

  // ── Derived
  const questions    = interview?.template?.questions ?? []
  const currentQ     = questions[qIdx]
  const isLastQ      = qIdx === questions.length - 1

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch interview by token
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (typeof MediaRecorder === 'undefined') {
      setErrorType('browser')
      setPageState('error')
      return
    }
    loadInterview()
  }, [token])

  async function loadInterview() {
    const { data: inv, error } = await supabase
      .from('interviews')
      .select('id, status, expires_at, candidate_id, template_id')
      .eq('token', token)
      .maybeSingle()

    if (error || !inv) {
      setErrorType('invalid')
      setPageState('error')
      return
    }
    if (inv.status === 'submitted') {
      navigate('/submitted', { replace: true })
      return
    }
    if (new Date(inv.expires_at) < new Date()) {
      setErrorType('expired')
      setPageState('error')
      return
    }

    const [{ data: candidate }, { data: template }] = await Promise.all([
      supabase.from('candidates').select('name').eq('id', inv.candidate_id).single(),
      supabase
        .from('templates')
        .select('id, title, is_active, questions(id, text, thinking_time, answer_time, order_index)')
        .eq('id', inv.template_id)
        .single(),
    ])

    if (!candidate || !template) {
      setErrorType('invalid')
      setPageState('error')
      return
    }
    if (!template.is_active) {
      setErrorType('closed')
      setPageState('error')
      return
    }

    template.questions.sort((a, b) => a.order_index - b.order_index)
    setInterview({ id: inv.id, candidate, template })
    setPageState('ready')
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup on unmount
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach(t => t.stop())
      answers.forEach(a => { if (a?.objectUrl) URL.revokeObjectURL(a.objectUrl) })
    }
  }, [])

  // Attach live stream to video element when recording phase starts
  useEffect(() => {
    if (phase === 'recording' && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current
    }
  }, [phase])

  // ─────────────────────────────────────────────────────────────────────────
  // Timer
  // ─────────────────────────────────────────────────────────────────────────

  function startTimer(seconds, onEnd) {
    clearInterval(timerRef.current)
    let remaining = seconds
    setCountdown(remaining)
    timerRef.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(timerRef.current)
        onEnd()
      }
    }, 1000)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Camera
  // ─────────────────────────────────────────────────────────────────────────

  async function requestCamera() {
    setCameraState('requesting')
    setCameraErrorMsg('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = s
      setCameraState('ready')
      return s
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access was denied. Please allow camera and microphone access to continue.'
        : 'Could not access your camera. Please check your device settings and try again.'
      setCameraErrorMsg(msg)
      setCameraState('error')
      return null
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interview flow
  // ─────────────────────────────────────────────────────────────────────────

  async function handleStartInterview() {
    const s = await requestCamera()
    if (!s) return
    beginThinking(0, s)
  }

  function beginThinking(idx, s) {
    setQIdx(idx)
    setPhase('thinking')
    const q = questions[idx]
    startTimer(q.thinking_time, () => beginRecording(idx, s ?? streamRef.current))
  }

  function handleSkipThinking() {
    clearInterval(timerRef.current)
    beginRecording(qIdx, streamRef.current)
  }

  function beginRecording(idx, s) {
    const q = questions[idx]
    setPhase('recording')
    chunksRef.current = []

    const mimeType = getSupportedMimeType()
    const recorder = new MediaRecorder(s, mimeType ? { mimeType } : {})
    recorderRef.current = recorder
    recordStartRef.current = Date.now()

    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const usedMime = recorder.mimeType || 'video/webm'
      const blob     = new Blob(chunksRef.current, { type: usedMime })
      const objectUrl = URL.createObjectURL(blob)
      const duration  = Math.round((Date.now() - recordStartRef.current) / 1000)
      setAnswers(prev => {
        const next = [...prev]
        next[idx] = { blob, objectUrl, duration, mimeType: usedMime }
        return next
      })
      setPhase('preview')
    }

    recorder.start(250)
    startTimer(q.answer_time, () => stopRecording())
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop()
    }
  }

  function handleNext() {
    if (isLastQ) {
      handleSubmit()
    } else {
      beginThinking(qIdx + 1, streamRef.current)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Submission
  // ─────────────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setPhase('submitting')
    setSubmitError('')
    setUploadProgress({ done: 0, total: questions.length })

    try {
      for (let i = 0; i < questions.length; i++) {
        const q      = questions[i]
        const answer = answers[i]
        if (!answer?.blob) continue

        const ext  = answer.mimeType.includes('mp4') ? 'mp4' : 'webm'
        const path = `${interview.id}/${q.id}.${ext}`

        const { error: upErr } = await supabase.storage
          .from('responses')
          .upload(path, answer.blob, { contentType: answer.mimeType, upsert: true })
        if (upErr) throw upErr

        const { data: { publicUrl } } = supabase.storage
          .from('responses')
          .getPublicUrl(path)

        const { error: rErr } = await supabase.from('responses').insert({
          interview_id:  interview.id,
          question_id:   q.id,
          video_url:     publicUrl,
          upload_status: 'uploaded',
          duration:      answer.duration,
        })
        if (rErr) throw rErr

        setUploadProgress({ done: i + 1, total: questions.length })
      }

      const { error: iErr } = await supabase
        .from('interviews')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', interview.id)
      if (iErr) throw iErr

      navigate('/submitted', { replace: true })
    } catch (err) {
      console.error(err)
      setSubmitError('Something went wrong while uploading your responses. Please try again.')
      setPhase('submit_error')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex items-center justify-center">
        <Spinner />
      </div>
    )
  }
  if (pageState === 'error') return <ErrorPage type={errorType} />

  // ── Welcome screen ────────────────────────────────────────────────────────
  if (phase === 'welcome') {
    const estMins = estimatedMinutes(questions)
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg flex flex-col gap-6">

          <div className="flex justify-center">
            <Logo />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7 flex flex-col gap-5">
            {/* Greeting */}
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                Hi {interview.candidate.name}, you've been invited to interview for{' '}
                <span className="text-[#005ea4]">{interview.template.title}</span>.
              </h1>
            </div>

            {/* Stats */}
            <div className="flex gap-4">
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-2xl font-bold text-slate-900">{questions.length}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {questions.length === 1 ? 'Question' : 'Questions'}
                </p>
              </div>
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-2xl font-bold text-slate-900">~{estMins}</p>
                <p className="text-xs text-slate-500 mt-0.5">Minutes</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-[#e6f0f9] border border-[#005ea4]/20 rounded-xl p-4 flex flex-col gap-2.5">
              <p className="text-xs font-bold text-[#005ea4] uppercase tracking-wider">
                Before you begin
              </p>
              {[
                'Questions appear one at a time. You\'ll have thinking time to prepare before recording.',
                'Once you start recording, you cannot stop and redo your answer.',
                'Take your thinking time seriously — use it to plan your response.',
                'Once you submit, you cannot re-attempt this interview.',
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#005ea4] mt-1.5 shrink-0" />
                  <p className="text-sm text-slate-700 leading-relaxed">{line}</p>
                </div>
              ))}
            </div>

            {/* Camera state */}
            {cameraState === 'error' && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl p-4">
                <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-relaxed">{cameraErrorMsg}</p>
              </div>
            )}

            <button
              onClick={handleStartInterview}
              disabled={cameraState === 'requesting'}
              className="w-full py-3.5 rounded-xl bg-[#005ea4] hover:bg-[#004d8a] active:bg-[#003d6e]
                text-white font-semibold text-base transition-colors shadow-sm
                disabled:opacity-60 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {cameraState === 'requesting' ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Requesting camera…
                </>
              ) : (
                <>
                  Start interview
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">
            Powered by RoundOne
          </p>
        </div>
      </div>
    )
  }

  // ── Submitting screen ─────────────────────────────────────────────────────
  if (phase === 'submitting') {
    const { done, total } = uploadProgress
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
          <Spinner />
          <div>
            <p className="font-semibold text-slate-900">Uploading your responses…</p>
            <p className="mt-1 text-sm text-slate-500">
              {done} of {total} uploaded — please don't close this tab.
            </p>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-[#005ea4] transition-all duration-500 rounded-full"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  // ── Submit error screen ────────────────────────────────────────────────────
  if (phase === 'submit_error') {
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm text-center flex flex-col items-center gap-5">
          <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center
            justify-center">
            <AlertCircle size={22} className="text-red-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Upload failed</p>
            <p className="mt-1 text-sm text-slate-500">{submitError}</p>
          </div>
          <button
            onClick={handleSubmit}
            className="px-6 py-3 rounded-xl bg-[#005ea4] hover:bg-[#004d8a] text-white
              font-semibold text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // ── Question screens (thinking | recording | preview) ────────────────────
  return (
    <div className="min-h-screen flex flex-col bg-[#f5f7fa]">
      <ProgressBar current={qIdx + (phase === 'preview' ? 1 : 0)} total={questions.length} />

      {/* Header */}
      <header className="pt-3 px-4 flex items-center justify-between max-w-lg mx-auto w-full">
        <Logo />
        <span className="text-xs font-semibold text-slate-400">
          {qIdx + 1} / {questions.length}
        </span>
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col justify-center px-4 py-6 max-w-lg mx-auto w-full">

        {/* ── Thinking phase ─────────────────────────────────────────────── */}
        {phase === 'thinking' && (
          <div className="flex flex-col gap-6">
            {/* Phase label */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#005ea4]" />
              <span className="text-xs font-bold text-[#005ea4] uppercase tracking-wider">
                Thinking time
              </span>
            </div>

            {/* Question text */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Question {qIdx + 1}
              </p>
              <p className="text-lg font-semibold text-slate-900 leading-snug">
                {currentQ.text}
              </p>
            </div>

            {/* Countdown */}
            <div className="flex flex-col items-center gap-3 py-2">
              <CountdownDisplay value={countdown} max={currentQ.thinking_time} />
              <p className="text-sm text-slate-500">Take a moment to think about your answer</p>
            </div>

            {/* Skip button */}
            <button
              onClick={handleSkipThinking}
              className="w-full py-4 rounded-xl bg-[#005ea4] hover:bg-[#004d8a] active:bg-[#003d6e]
                text-white font-semibold text-base transition-colors shadow-sm
                flex items-center justify-center gap-2"
            >
              <Mic size={18} />
              I'm ready — start recording
            </button>

            <p className="text-center text-xs text-slate-400">
              Recording starts automatically when the timer ends.
            </p>
          </div>
        )}

        {/* ── Recording phase ────────────────────────────────────────────── */}
        {phase === 'recording' && (
          <div className="flex flex-col gap-5">
            {/* Phase label */}
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
                Recording
              </span>
            </div>

            {/* Question text — compact during recording */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-700 leading-snug">
                {currentQ.text}
              </p>
            </div>

            {/* Live camera preview */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video w-full shadow-md">
              <video
                ref={liveVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              {/* Recording badge */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5
                bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-white text-xs font-semibold">REC</span>
              </div>
              {/* Countdown in corner */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm
                rounded-full px-3 py-1.5">
                <span className={`text-xs font-bold tabular-nums
                  ${countdown <= 10 ? 'text-red-400' : 'text-white'}`}>
                  {formatTime(countdown)}
                </span>
              </div>
            </div>

            {/* Countdown ring below video */}
            <div className="flex justify-center">
              <CountdownDisplay value={countdown} max={currentQ.answer_time} accent />
            </div>

            {/* Stop button */}
            <button
              onClick={stopRecording}
              className="w-full py-4 rounded-xl bg-slate-800 hover:bg-slate-900
                text-white font-semibold text-base transition-colors shadow-sm
                flex items-center justify-center gap-2"
            >
              Stop &amp; save answer
            </button>

            <p className="text-center text-xs text-slate-400">
              Recording stops automatically when the timer ends.
            </p>
          </div>
        )}

        {/* ── Preview phase ──────────────────────────────────────────────── */}
        {phase === 'preview' && (
          <div className="flex flex-col gap-5">
            {/* Status */}
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-green-600" />
              <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                Answer saved
              </span>
            </div>

            {/* Question text */}
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 mb-1">Question {qIdx + 1}</p>
              <p className="text-sm font-semibold text-slate-700 leading-snug">
                {currentQ.text}
              </p>
            </div>

            {/* Recorded video preview */}
            {answers[qIdx]?.objectUrl && (
              <div className="rounded-2xl overflow-hidden bg-black aspect-video w-full shadow-md">
                <video
                  src={answers[qIdx].objectUrl}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* No re-record notice */}
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                This answer is final. You cannot re-record.
              </p>
            </div>

            {/* Next / Submit */}
            <button
              onClick={handleNext}
              className="w-full py-4 rounded-xl bg-[#005ea4] hover:bg-[#004d8a] active:bg-[#003d6e]
                text-white font-semibold text-base transition-colors shadow-sm
                flex items-center justify-center gap-2"
            >
              {isLastQ ? (
                <>
                  <CheckCircle2 size={18} />
                  Submit my answers
                </>
              ) : (
                <>
                  Next question
                  <ChevronRight size={18} />
                </>
              )}
            </button>

            {isLastQ && (
              <p className="text-center text-xs text-slate-400">
                You won't be able to re-attempt after submitting.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
