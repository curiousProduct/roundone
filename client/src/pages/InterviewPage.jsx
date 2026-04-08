import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ChevronRight, Mic, VideoOff } from 'lucide-react'
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

// ── Audio meter (5-bar VU) ────────────────────────────────────────────────────

function AudioMeter({ level }) {
  const bars = 5
  const lit = Math.round(level * bars)
  return (
    <div className="flex items-end gap-1 h-6">
      {Array.from({ length: bars }, (_, i) => (
        <div
          key={i}
          className={`w-2.5 rounded-sm transition-all duration-100 ${
            i < lit
              ? i < 2 ? 'bg-green-500' : i < 4 ? 'bg-yellow-400' : 'bg-red-500'
              : 'bg-slate-200'
          }`}
          style={{ height: `${((i + 1) / bars) * 100}%` }}
        />
      ))}
    </div>
  )
}

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700
              text-sm font-semibold hover:bg-slate-50 transition-colors"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-[#005ea4] hover:bg-[#004d8a] text-white
              text-sm font-semibold transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
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

  // ── Interview flow
  const [phase, setPhase] = useState('welcome')           // welcome | camera_test | thinking | recording | preview | submitting
  const [qIdx, setQIdx] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [answers, setAnswers] = useState([])              // [{blob, objectUrl, duration, mimeType}]

  // ── Camera
  const [cameraState, setCameraState] = useState('idle')  // idle | requesting | ready | error
  const [cameraErrorMsg, setCameraErrorMsg] = useState('')

  // ── Camera test
  const [cameraTestChecks, setCameraTestChecks] = useState({ canSee: false, micWorks: false })
  const [audioLevel, setAudioLevel] = useState(0)

  // ── Modals
  const [showNextModal, setShowNextModal] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  // ── Submit
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 })
  const [submitError, setSubmitError] = useState('')

  // ── Refs
  const streamRef      = useRef(null)
  const recorderRef    = useRef(null)
  const chunksRef      = useRef([])
  const timerRef       = useRef(null)
  const liveVideoRef   = useRef(null)
  const testVideoRef   = useRef(null)
  const recordStartRef = useRef(null)
  const audioCtxRef    = useRef(null)
  const analyserRef    = useRef(null)
  const animFrameRef   = useRef(null)

  // ── Derived
  const questions = interview?.template?.questions ?? []
  const currentQ  = questions[qIdx]
  const isLastQ   = qIdx === questions.length - 1

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
      cancelAnimationFrame(animFrameRef.current)
      audioCtxRef.current?.close()
      streamRef.current?.getTracks().forEach(t => t.stop())
      answers.forEach(a => { if (a?.objectUrl) URL.revokeObjectURL(a.objectUrl) })
    }
  }, [])

  // Attach live stream to video elements when phase changes
  useEffect(() => {
    if (phase === 'camera_test' && testVideoRef.current && streamRef.current) {
      testVideoRef.current.srcObject = streamRef.current
    }
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
  // Camera test
  // ─────────────────────────────────────────────────────────────────────────

  async function startTestCamera() {
    setCameraState('requesting')
    setCameraErrorMsg('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = s
      setCameraState('ready')
      if (testVideoRef.current) testVideoRef.current.srcObject = s
      startAudioAnalysis(s)
    } catch (err) {
      const msg = err.name === 'NotAllowedError'
        ? 'Camera access was denied. Please allow camera and microphone access to continue.'
        : 'Could not access your camera. Please check your device settings and try again.'
      setCameraErrorMsg(msg)
      setCameraState('error')
    }
  }

  function startAudioAnalysis(stream) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      audioCtxRef.current = ctx
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)
      const data = new Uint8Array(analyser.frequencyBinCount)
      function tick() {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((s, v) => s + v, 0) / data.length
        setAudioLevel(Math.min(avg / 80, 1))
        animFrameRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch (_) {
      // audio analysis not critical, ignore
    }
  }

  function stopTestStream() {
    cancelAnimationFrame(animFrameRef.current)
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setAudioLevel(0)
  }

  function handleWelcomeStart() {
    setCameraTestChecks({ canSee: false, micWorks: false })
    setPhase('camera_test')
    startTestCamera()
  }

  async function handleCameraTestProceed() {
    stopTestStream()
    const s = await requestCamera()
    if (!s) return
    beginThinking(0, s)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Interview flow
  // ─────────────────────────────────────────────────────────────────────────

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

  function handleReRecord() {
    const prev = answers[qIdx]
    if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl)
    setAnswers(prev => {
      const next = [...prev]
      next[qIdx] = null
      return next
    })
    beginThinking(qIdx, streamRef.current)
  }

  function handleNextConfirmed() {
    setShowNextModal(false)
    beginThinking(qIdx + 1, streamRef.current)
  }

  function handleSubmitConfirmed() {
    setShowSubmitModal(false)
    handleSubmit()
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
  // Render
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
                "Questions appear one at a time. You'll have thinking time to prepare before recording.",
                "After recording, you can re-record your answer before moving to the next question.",
                "Take your thinking time seriously — use it to plan your response.",
                "Once you submit, you cannot re-attempt this interview.",
              ].map((line, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#005ea4] mt-1.5 shrink-0" />
                  <p className="text-sm text-slate-700 leading-relaxed">{line}</p>
                </div>
              ))}
            </div>

            <button
              onClick={handleWelcomeStart}
              className="w-full py-3.5 rounded-xl bg-[#005ea4] hover:bg-[#004d8a] active:bg-[#003d6e]
                text-white font-semibold text-base transition-colors shadow-sm
                flex items-center justify-center gap-2"
            >
              Start interview
              <ChevronRight size={18} />
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">
            Powered by RoundOne
          </p>
        </div>
      </div>
    )
  }

  // ── Camera & mic test screen ───────────────────────────────────────────────
  if (phase === 'camera_test') {
    const canProceed = cameraTestChecks.canSee && cameraTestChecks.micWorks && cameraState === 'ready'
    return (
      <div className="min-h-screen bg-[#f5f7fa] flex flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg flex flex-col gap-6">

          <div className="flex justify-center">
            <Logo />
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-7 flex flex-col gap-5">
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                Camera &amp; mic check
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Make sure everything looks good before your interview starts.
              </p>
            </div>

            {/* Live camera preview */}
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-video w-full shadow-sm">
              {cameraState === 'ready' ? (
                <video
                  ref={testVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : cameraState === 'requesting' ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner />
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <VideoOff size={28} className="text-slate-400" />
                  <p className="text-sm text-slate-400">Camera unavailable</p>
                </div>
              )}

              {cameraState === 'ready' && (
                <div className="absolute bottom-3 left-3 right-3">
                  <div className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 inline-block">
                    <span className="text-white text-xs">
                      Your camera is live — nothing is being recorded yet
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Mic level */}
            {cameraState === 'ready' && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <Mic size={14} className="text-slate-400 shrink-0" />
                <span className="text-sm text-slate-500">Microphone</span>
                <div className="ml-auto">
                  <AudioMeter level={audioLevel} />
                </div>
              </div>
            )}

            {/* Error state */}
            {cameraState === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 leading-relaxed">{cameraErrorMsg}</p>
                </div>
                <button
                  onClick={() => {
                    setCameraTestChecks({ canSee: false, micWorks: false })
                    startTestCamera()
                  }}
                  className="self-start text-sm font-semibold text-[#005ea4] hover:underline"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Confirmation checkboxes */}
            {cameraState === 'ready' && (
              <div className="flex flex-col gap-3">
                {[
                  { key: 'canSee', label: 'I can see myself clearly in the preview' },
                  { key: 'micWorks', label: 'I can see the mic meter responding to my voice' },
                ].map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 cursor-pointer"
                    onClick={() => setCameraTestChecks(p => ({ ...p, [key]: !p[key] }))}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center
                      transition-colors shrink-0
                      ${cameraTestChecks[key]
                        ? 'bg-[#005ea4] border-[#005ea4]'
                        : 'border-slate-300 hover:border-[#005ea4]/50'
                      }`}
                    >
                      {cameraTestChecks[key] && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4l3 3 6-6" stroke="white" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <span className="text-sm text-slate-700 select-none">{label}</span>
                  </label>
                ))}
              </div>
            )}

            <button
              onClick={handleCameraTestProceed}
              disabled={!canProceed}
              className="w-full py-3.5 rounded-xl bg-[#005ea4] hover:bg-[#004d8a] active:bg-[#003d6e]
                text-white font-semibold text-base transition-colors shadow-sm
                disabled:opacity-40 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {cameraState === 'requesting' ? (
                <>
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  Start interview
                  <ChevronRight size={18} />
                </>
              )}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400">Powered by RoundOne</p>
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
    <>
      {/* Confirmation modals */}
      {showNextModal && (
        <ConfirmModal
          title="Move to the next question?"
          body="You won't be able to come back to this answer once you proceed."
          confirmLabel="Next question"
          onConfirm={handleNextConfirmed}
          onCancel={() => setShowNextModal(false)}
        />
      )}
      {showSubmitModal && (
        <ConfirmModal
          title="Submit your interview?"
          body="This will send all your answers to the employer. You can't redo the interview after submitting."
          confirmLabel="Submit"
          onConfirm={handleSubmitConfirmed}
          onCancel={() => setShowSubmitModal(false)}
        />
      )}

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
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#005ea4]" />
                <span className="text-xs font-bold text-[#005ea4] uppercase tracking-wider">
                  Thinking time
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Question {qIdx + 1}
                </p>
                <p className="text-lg font-semibold text-slate-900 leading-snug">
                  {currentQ.text}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 py-2">
                <CountdownDisplay value={countdown} max={currentQ.thinking_time} />
                <p className="text-sm text-slate-500">Take a moment to think about your answer</p>
              </div>

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
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
                  Recording
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                <p className="text-sm font-semibold text-slate-700 leading-snug">
                  {currentQ.text}
                </p>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black aspect-video w-full shadow-md">
                <video
                  ref={liveVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5
                  bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-white text-xs font-semibold">REC</span>
                </div>
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm
                  rounded-full px-3 py-1.5">
                  <span className={`text-xs font-bold tabular-nums
                    ${countdown <= 10 ? 'text-red-400' : 'text-white'}`}>
                    {formatTime(countdown)}
                  </span>
                </div>
              </div>

              <div className="flex justify-center">
                <CountdownDisplay value={countdown} max={currentQ.answer_time} accent />
              </div>

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
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="text-xs font-bold text-green-600 uppercase tracking-wider">
                  Answer saved
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
                <p className="text-xs font-semibold text-slate-400 mb-1">Question {qIdx + 1}</p>
                <p className="text-sm font-semibold text-slate-700 leading-snug">
                  {currentQ.text}
                </p>
              </div>

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

              {/* Re-record */}
              <button
                onClick={handleReRecord}
                className="w-full py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50
                  text-slate-700 font-semibold text-sm transition-colors
                  flex items-center justify-center gap-2"
              >
                Re-record this answer
              </button>

              {/* Next / Submit */}
              <button
                onClick={() => isLastQ ? setShowSubmitModal(true) : setShowNextModal(true)}
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
            </div>
          )}
        </main>
      </div>
    </>
  )
}
