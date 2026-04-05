import { useEffect, useRef, useState } from 'react'
import { Camera, Square, RotateCcw, VideoOff } from 'lucide-react'

// States: idle → requesting → recording → preview
const IDLE = 'idle'
const REQUESTING = 'requesting'
const RECORDING = 'recording'
const PREVIEW = 'preview'

function formatSeconds(s) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  const sec = (s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

export default function VideoRecorder({ onVideoReady }) {
  const [status, setStatus] = useState(IDLE)
  const [elapsed, setElapsed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [permissionError, setPermissionError] = useState('')

  const liveVideoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  // Attach live stream to video element once recording starts
  useEffect(() => {
    if (status === RECORDING && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current
    }
  }, [status])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream()
      clearInterval(timerRef.current)
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [])

  function stopStream() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  async function startRecording() {
    setPermissionError('')
    setStatus(REQUESTING)

    let stream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    } catch {
      setPermissionError('Camera access was denied. Please allow camera access in your browser settings.')
      setStatus(IDLE)
      return
    }

    streamRef.current = stream
    chunksRef.current = []

    const recorder = new MediaRecorder(stream, { mimeType: getSupportedMimeType() })
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      onVideoReady?.(blob)
      stopStream()
      setStatus(PREVIEW)
    }

    recorderRef.current = recorder
    recorder.start(250) // collect data every 250ms

    setElapsed(0)
    setStatus(RECORDING)
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
  }

  function stopRecording() {
    clearInterval(timerRef.current)
    recorderRef.current?.stop()
  }

  function reRecord() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    onVideoReady?.(null)
    setElapsed(0)
    setStatus(IDLE)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (status === IDLE || status === REQUESTING) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200
          bg-slate-50 px-4 py-3 gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <VideoOff size={15} className="text-slate-400 shrink-0" />
            <span className="text-xs text-slate-400 truncate">
              No video added — candidates will see text only
            </span>
          </div>
          <button
            type="button"
            onClick={startRecording}
            disabled={status === REQUESTING}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#005ea4]
              text-[#005ea4] text-xs font-semibold hover:bg-[#005ea4] hover:text-white
              transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === REQUESTING ? (
              <>
                <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                Requesting…
              </>
            ) : (
              <>
                <Camera size={13} />
                Record video
              </>
            )}
          </button>
        </div>
        {permissionError && (
          <p className="text-xs text-red-500">{permissionError}</p>
        )}
      </div>
    )
  }

  if (status === RECORDING) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full">
          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover"
          />
          {/* Recording indicator */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 rounded-full
            px-2.5 py-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-medium tabular-nums">{formatSeconds(elapsed)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg
            bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
        >
          <Square size={14} fill="currentColor" />
          Stop recording
        </button>
      </div>
    )
  }

  if (status === PREVIEW) {
    return (
      <div className="flex flex-col gap-2">
        <div className="relative rounded-xl overflow-hidden bg-black aspect-video w-full">
          <video
            src={previewUrl}
            controls
            playsInline
            className="w-full h-full object-cover"
          />
        </div>
        <button
          type="button"
          onClick={reRecord}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-lg
            border border-slate-200 bg-white text-slate-600 text-sm font-medium
            hover:border-slate-300 hover:bg-slate-50 transition-all"
        >
          <RotateCcw size={13} />
          Re-record
        </button>
      </div>
    )
  }

  return null
}

function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
}
