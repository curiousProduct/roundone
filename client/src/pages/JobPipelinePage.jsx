import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft, UserPlus,
  Copy, Check, MoreHorizontal,
  Eye, ArrowRight, X, Link2, RotateCcw, Award, Calendar,
  UploadCloud, FileText, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import supabase from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import NavBar from '../components/NavBar'

const APP_BASE_URL = 'https://app.roundone.work'
const API_BASE     = import.meta.env.VITE_API_URL || ''
const DESC_LIMIT   = 120

function randomToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let t = ''
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)]
  return t
}

// ── Confirm modal ──────────────────────────────────────────────────────────────

function ConfirmModal({ title, body, confirmLabel, variant = 'danger', onConfirm, onCancel, loading }) {
  const btnCls = variant === 'warning'
    ? 'bg-amber-500 hover:bg-amber-600'
    : 'bg-red-500 hover:bg-red-600'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl p-6 flex flex-col gap-5">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">{title}</h3>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">{body}</p>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} disabled={loading}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
              text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={loading}
            className={`flex-1 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors
              shadow-sm disabled:opacity-60 disabled:cursor-not-allowed
              flex items-center justify-center gap-2 ${btnCls}`}>
            {loading
              ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Working…</>
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toggle switch (identical to Dashboard) ─────────────────────────────────────

function ToggleSwitch({ isActive, onToggle, disabled }) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-label={isActive ? 'Close job' : 'Reopen job'}
        style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0 }}
        className={`relative transition-colors duration-200 focus:outline-none
          ${isActive ? 'bg-[#1D9E75]' : 'bg-[#9CA3AF]'}
          ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:opacity-90'}`}
      >
        <span style={{
          position: 'absolute', top: 2, width: 20, height: 20,
          borderRadius: '50%', background: 'white',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s', left: isActive ? 22 : 2,
        }} />
      </button>
      <span className="text-xs font-semibold transition-colors duration-200"
        style={{ color: isActive ? '#1D9E75' : '#6B7280', whiteSpace: 'nowrap' }}>
        {isActive ? 'Active' : 'Closed'}
      </span>
    </div>
  )
}

// ── Share link panel ───────────────────────────────────────────────────────────

function ShareLinkPanel({ link, candidateName, onClose }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const waText = encodeURIComponent(
    `Hi ${candidateName}, you've been invited to complete a video screening.\n\nRecord your answers here: ${link}`
  )
  const emailSubject = encodeURIComponent('Video screening invitation')
  const emailBody    = encodeURIComponent(
    `Hi ${candidateName},\n\nYou've been invited to complete a video screening.\n\nClick the link to record your responses:\n${link}\n\nThis link expires in 7 days.`
  )

  return (
    <div className="mt-5 border-t border-slate-100 pt-5 flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Screening link
        </p>
        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
          <span className="flex-1 text-xs text-slate-700 font-mono truncate">{link}</span>
          <button type="button" onClick={handleCopy}
            className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors
              ${copied
                ? 'bg-[#1D9E75] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {copied ? <><Check size={11} />Copied</> : <><Copy size={11} />Copy</>}
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${waText}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
            bg-[#25D366] hover:bg-[#1da851] text-white text-xs font-semibold transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </a>
        <a
          href={`mailto:?subject=${emailSubject}&body=${emailBody}`}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg
            border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          Email
        </a>
      </div>

      <button type="button" onClick={onClose}
        className="w-full py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
          text-slate-600 hover:bg-slate-50 transition-colors">
        Done
      </button>
    </div>
  )
}

// ── Add candidate modal ────────────────────────────────────────────────────────

const INPUT_BASE = `px-3 py-2.5 rounded-lg border text-sm text-slate-900
  placeholder:text-slate-400 focus:outline-none focus:ring-2
  focus:ring-[#005ea4]/30 focus:border-[#005ea4] transition-colors w-full`

function parsedStyle(isParsed) {
  return isParsed
    ? { borderLeft: '3px solid #005ea4', backgroundColor: 'rgba(0,94,164,0.025)' }
    : {}
}

function LowConfWarning() {
  return (
    <span title="Please verify this field — auto-fill may be inaccurate"
      className="shrink-0 text-amber-500 cursor-help">
      <AlertTriangle size={13} />
    </span>
  )
}

function FieldLabel({ children, optional, lowConf }) {
  return (
    <div className="flex items-center gap-1.5">
      <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
        {children}
      </label>
      {optional && <span className="text-xs text-slate-400 font-normal">(optional)</span>}
      {lowConf && <LowConfWarning />}
    </div>
  )
}

function AddCandidateModal({ job, stages, user, onClose, onAdded }) {
  // Core form
  const [name,           setName]           = useState('')
  const [email,          setEmail]          = useState('')
  const [phone,          setPhone]          = useState('')
  const [currentRole,    setCurrentRole]    = useState('')
  const [currentCompany, setCurrentCompany] = useState('')
  const [yearsExp,       setYearsExp]       = useState('')
  const [skills,         setSkills]         = useState([])
  const [skillInput,     setSkillInput]     = useState('')
  const [education,      setEducation]      = useState('')

  // Resume state
  const [resumeFile,   setResumeFile]   = useState(null)
  const [parsing,      setParsing]      = useState(false)
  const [parseError,   setParseError]   = useState(false)
  const [parsedFields, setParsedFields] = useState(new Set())
  const [nameConf,     setNameConf]     = useState(null)
  const [emailConf,    setEmailConf]    = useState(null)
  const [phoneConf,    setPhoneConf]    = useState(null)
  const [dragOver,     setDragOver]     = useState(false)
  const fileInputRef = useRef(null)

  // Submission
  const [saving,     setSaving]     = useState(false)
  const [shareLink,  setShareLink]  = useState(null)
  const [addedName,  setAddedName]  = useState('')

  const stage1 = stages.find(s => s.order_index === 1)

  // ── Resume handling ──────────────────────────────────────────────────────

  async function handleFile(file) {
    if (!file) return
    if (file.type !== 'application/pdf') { toast.error('Please select a PDF file.'); return }
    if (file.size > 5 * 1024 * 1024)    { toast.error('File too large. Max 5 MB.'); return }

    setResumeFile(file)
    setParsing(true)
    setParseError(false)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res  = await fetch(`${API_BASE}/api/parse-resume`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error('parse failed')
      const data = await res.json()

      const filled = new Set()
      if (data.name)                     { setName(data.name);                       filled.add('name') }
      if (data.email)                    { setEmail(data.email);                     filled.add('email') }
      if (data.phone)                    { setPhone(data.phone);                     filled.add('phone') }
      if (data.current_role)             { setCurrentRole(data.current_role);        filled.add('currentRole') }
      if (data.current_company)          { setCurrentCompany(data.current_company);  filled.add('currentCompany') }
      if (data.years_of_experience != null) { setYearsExp(String(data.years_of_experience)); filled.add('yearsExp') }
      if (data.skills?.length)           { setSkills(data.skills);                  filled.add('skills') }
      if (data.education)                { setEducation(data.education);             filled.add('education') }

      setParsedFields(filled)
      setNameConf(data.confidence?.name)
      setEmailConf(data.confidence?.email)
      setPhoneConf(data.confidence?.phone)
    } catch {
      setParseError(true)
      setParsedFields(new Set())
    } finally {
      setParsing(false)
    }
  }

  function removeFile() {
    setResumeFile(null)
    setParsing(false)
    setParseError(false)
    setParsedFields(new Set())
    setNameConf(null); setEmailConf(null); setPhoneConf(null)
    // Reset all parsed fields
    setName(''); setEmail(''); setPhone('')
    setCurrentRole(''); setCurrentCompany(''); setYearsExp('')
    setSkills([]); setEducation('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ── Skills tag input ─────────────────────────────────────────────────────

  function commitSkill() {
    const s = skillInput.replace(/,/g, '').trim()
    if (s && skills.length < 15 && !skills.some(x => x.toLowerCase() === s.toLowerCase())) {
      setSkills(prev => [...prev, s])
    }
    setSkillInput('')
  }

  function handleSkillKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitSkill() }
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e) {
    e.preventDefault()
    if (!stage1?.template_id) { toast.error('Stage 1 has no template assigned.'); return }
    setSaving(true)
    try {
      // 1. Upload resume if present (non-blocking — failure doesn't abort save)
      let resumeUrl       = null
      let resumeUploadErr = false
      if (resumeFile) {
        try {
          const fd  = new FormData()
          fd.append('file', resumeFile)
          const res = await fetch(`${API_BASE}/api/upload-resume`, { method: 'POST', body: fd })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error || `HTTP ${res.status}`)
          }
          const { url } = await res.json()
          resumeUrl = url
        } catch (uploadErr) {
          console.error('[add-candidate] resume upload failed:', uploadErr.message)
          resumeUploadErr = true
        }
      }

      // 2. Create candidate with all fields
      const phoneVal = phone.trim() || null
      const { data: cand, error: candErr } = await supabase
        .from('candidates')
        .insert({
          name:                name.trim(),
          email:               email.trim().toLowerCase(),
          phone:               phoneVal,
          current_role:        currentRole.trim()    || null,
          current_company:     currentCompany.trim() || null,
          years_of_experience: yearsExp ? parseInt(yearsExp, 10) : null,
          skills:              skills.length ? skills : [],
          education:           education.trim() || null,
          resume_url:          resumeUrl,
          resume_parsed:       Boolean(resumeFile),
          company_id:          user.id,
        })
        .select('id')
        .single()
      if (candErr) {
        console.error('[add-candidate] candidates insert failed:', candErr.code, candErr.message, candErr.details)
        throw candErr
      }

      // 3. Create application
      const { data: app, error: appErr } = await supabase
        .from('candidate_applications')
        .insert({
          job_opening_id:      job.id,
          candidate_id:        cand.id,
          company_id:          user.id,
          current_stage_index: 1,
        })
        .select('id')
        .single()
      if (appErr) {
        console.error('[add-candidate] application insert failed:', appErr.code, appErr.message)
        throw appErr
      }

      // 4. Create interview (Stage 1 async video)
      const token     = randomToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const { data: interview, error: intErr } = await supabase
        .from('interviews')
        .insert({
          candidate_id: cand.id,
          template_id:  stage1.template_id,
          company_id:   user.id,
          token,
          status:     'pending',
          expires_at: expiresAt,
        })
        .select('id')
        .single()
      if (intErr) {
        console.error('[add-candidate] interview insert failed:', intErr.code, intErr.message)
        throw intErr
      }

      // 5. Create stage result
      const { error: srErr } = await supabase
        .from('stage_results')
        .insert({
          application_id: app.id,
          stage_id:       stage1.id,
          status:         'pending',
          interview_id:   interview.id,
        })
      if (srErr) {
        console.error('[add-candidate] stage_result insert failed:', srErr.code, srErr.message)
        throw srErr
      }

      setAddedName(name.trim())
      setShareLink(`${APP_BASE_URL}/i/${token}`)
      if (resumeUploadErr) {
        toast('Candidate saved — resume could not be uploaded. You can add it later.', { icon: '⚠️' })
      }
      onAdded()
    } catch (err) {
      console.error('[add-candidate] unhandled error:', err)
      const msg = err?.message || 'Unknown error'
      toast.error(`Failed to add candidate: ${msg}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl
        flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            {shareLink ? 'Candidate added' : 'Add candidate'}
          </h3>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400
              hover:text-slate-600 hover:bg-slate-100 transition-colors text-xl leading-none font-light">
            ×
          </button>
        </div>

        {!shareLink ? (
          <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
            <div className="px-6 pb-6 flex flex-col gap-5">

              {/* ── Resume upload ─────────────────────────────────────────── */}
              <div className="flex flex-col gap-2">
                <FieldLabel optional>Upload resume</FieldLabel>

                {!resumeFile && !parsing ? (
                  /* Drag-drop zone */
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border:          `2px dashed rgba(0,94,164,${dragOver ? 1 : 0.35})`,
                      backgroundColor: `rgba(0,94,164,${dragOver ? 0.07 : 0.025})`,
                      transition:      'all 0.2s',
                    }}
                    className="rounded-xl p-6 flex flex-col items-center gap-2
                      cursor-pointer select-none"
                  >
                    <UploadCloud size={22} className="text-[#005ea4]/60" />
                    <p className="text-sm font-semibold text-slate-600">Drop PDF resume here</p>
                    <p className="text-xs text-slate-400">or click to browse · PDF only · Max 5 MB</p>
                  </div>
                ) : parsing ? (
                  /* Parsing state */
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl
                    border border-slate-200 bg-slate-50">
                    <span className="w-4 h-4 border-2 border-[#005ea4]/30 border-t-[#005ea4]
                      rounded-full animate-spin shrink-0" />
                    <span className="text-sm text-slate-600">Reading resume…</span>
                  </div>
                ) : (
                  /* File info */
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl
                      border border-slate-200 bg-slate-50">
                      <FileText size={16} className="text-[#005ea4] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{resumeFile.name}</p>
                        <p className="text-[11px] text-slate-400">{(resumeFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                      <button type="button" onClick={removeFile}
                        className="text-xs text-slate-400 hover:text-red-500 transition-colors
                          font-medium shrink-0 flex items-center gap-1">
                        <X size={12} />Remove
                      </button>
                    </div>

                    {/* Parse success / error banners */}
                    {parsedFields.size > 0 && !parseError && (
                      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl
                        bg-[#e6f5ef] border border-[#b3dece]">
                        <Check size={14} className="text-[#1D9E75] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#1a6646] leading-relaxed">
                          <span className="font-semibold">Resume parsed</span> — fields have been
                          pre-filled. Please review and edit if needed.
                        </p>
                      </div>
                    )}
                    {parseError && (
                      <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl
                        bg-amber-50 border border-amber-200">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                          Couldn't read all details — please fill in the form manually.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={e => handleFile(e.target.files?.[0])}
                />
              </div>

              {/* ── Divider ──────────────────────────────────────────────── */}
              <div className="border-t border-slate-100" />

              {/* ── Required fields ───────────────────────────────────────── */}
              <div className="flex flex-col gap-4">

                <div className="flex flex-col gap-1.5">
                  <FieldLabel lowConf={nameConf === 'low' && parsedFields.has('name')}>
                    Full name <span className="text-red-500">*</span>
                  </FieldLabel>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    required autoFocus
                    placeholder="Candidate's full name"
                    style={parsedStyle(parsedFields.has('name'))}
                    className={`${INPUT_BASE} border-slate-200`} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FieldLabel lowConf={emailConf === 'low' && parsedFields.has('email')}>
                    Email <span className="text-red-500">*</span>
                  </FieldLabel>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="candidate@email.com"
                    style={parsedStyle(parsedFields.has('email'))}
                    className={`${INPUT_BASE} border-slate-200`} />
                </div>
              </div>

              {/* ── Optional fields ───────────────────────────────────────── */}
              <div className="flex flex-col gap-4">

                <div className="flex flex-col gap-1.5">
                  <FieldLabel optional lowConf={phoneConf === 'low' && parsedFields.has('phone')}>
                    Phone
                  </FieldLabel>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    style={parsedStyle(parsedFields.has('phone'))}
                    className={`${INPUT_BASE} border-slate-200`} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel optional>Current role</FieldLabel>
                    <input type="text" value={currentRole} onChange={e => setCurrentRole(e.target.value)}
                      placeholder="e.g. Senior PM"
                      style={parsedStyle(parsedFields.has('currentRole'))}
                      className={`${INPUT_BASE} border-slate-200`} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <FieldLabel optional>Current company</FieldLabel>
                    <input type="text" value={currentCompany} onChange={e => setCurrentCompany(e.target.value)}
                      placeholder="e.g. Flipkart"
                      style={parsedStyle(parsedFields.has('currentCompany'))}
                      className={`${INPUT_BASE} border-slate-200`} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <FieldLabel optional>Years of experience</FieldLabel>
                  <input type="number" value={yearsExp} onChange={e => setYearsExp(e.target.value)}
                    min={0} max={40}
                    placeholder="e.g. 4"
                    style={parsedStyle(parsedFields.has('yearsExp'))}
                    className={`${INPUT_BASE} border-slate-200 w-32`} />
                </div>

                {/* Skills tags */}
                <div className="flex flex-col gap-1.5">
                  <FieldLabel optional>Skills</FieldLabel>
                  <div
                    style={parsedStyle(parsedFields.has('skills') && skills.length > 0)}
                    className="rounded-lg border border-slate-200 px-3 py-2.5 flex flex-wrap gap-1.5
                      focus-within:ring-2 focus-within:ring-[#005ea4]/30 focus-within:border-[#005ea4]
                      transition-colors min-h-[42px]">
                    {skills.map(skill => (
                      <span key={skill}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full
                          bg-[#e6f0f9] text-[#005ea4] text-xs font-semibold border border-[#b3d0ea]">
                        {skill}
                        <button type="button" onClick={() => setSkills(prev => prev.filter(s => s !== skill))}
                          className="hover:text-red-500 transition-colors">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    {skills.length < 15 && (
                      <input
                        type="text"
                        value={skillInput}
                        onChange={e => setSkillInput(e.target.value)}
                        onKeyDown={handleSkillKeyDown}
                        onBlur={commitSkill}
                        placeholder={skills.length === 0 ? 'Add a skill… (press Enter or comma)' : ''}
                        className="flex-1 min-w-[120px] text-xs text-slate-700 outline-none
                          placeholder:text-slate-400 bg-transparent py-0.5"
                      />
                    )}
                  </div>
                  {skills.length >= 15 && (
                    <p className="text-[11px] text-slate-400">Maximum 15 skills</p>
                  )}
                </div>

                {/* Education */}
                <div className="flex flex-col gap-1.5">
                  <FieldLabel optional>Education</FieldLabel>
                  <textarea value={education} onChange={e => setEducation(e.target.value)}
                    rows={2}
                    placeholder="e.g. B.Tech, IIT Delhi, 2019"
                    style={parsedStyle(parsedFields.has('education'))}
                    className={`${INPUT_BASE} border-slate-200 resize-none`} />
                </div>
              </div>

              {/* Warning when Stage 1 has no template */}
              {!stage1?.template_id && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-700 leading-relaxed">
                    Stage 1 has no template assigned.{' '}
                    <Link to={`/jobs/${job.id}/edit`} onClick={onClose}
                      className="font-semibold underline">
                      Edit the job opening
                    </Link>{' '}
                    to add one before adding candidates.
                  </p>
                </div>
              )}

            </div>

            {/* Footer buttons — sticky */}
            <div className="flex gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-semibold
                  text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving || !stage1?.template_id || parsing}
                className="flex-1 py-2.5 rounded-lg bg-[#005ea4] hover:bg-[#004d8a] text-white
                  text-sm font-semibold transition-colors shadow-sm
                  disabled:opacity-60 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2">
                {saving
                  ? <><span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Adding…</>
                  : 'Add candidate'}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 pb-6">
            <div className="flex items-center gap-2.5 text-sm text-slate-600 mb-0">
              <span className="w-7 h-7 rounded-full bg-[#e6f5ef] flex items-center justify-center shrink-0">
                <Check size={14} className="text-[#1D9E75]" />
              </span>
              <span>
                <span className="font-semibold text-slate-900">{addedName}</span>
                {' '}has been added to Stage 1.
              </span>
            </div>
            <ShareLinkPanel
              link={shareLink}
              candidateName={addedName}
              onClose={onClose}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ stageStatus, interviewStatus, overallStatus }) {
  if (overallStatus === 'rejected') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
        bg-red-50 text-red-600 border border-red-200">
        Rejected
      </span>
    )
  }
  if (overallStatus === 'hired') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
        bg-emerald-50 text-emerald-700 border border-emerald-200">
        Hired
      </span>
    )
  }
  if (stageStatus === 'passed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
        bg-[#e6f5ef] text-[#1D9E75] border border-[#b3dece]">
        Passed
      </span>
    )
  }
  if (stageStatus === 'failed') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
        bg-red-50 text-red-600 border border-red-200">
        Failed
      </span>
    )
  }
  if (interviewStatus === 'submitted') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
        bg-[#e6f0f9] text-[#005ea4] border border-[#b3d0ea]">
        Submitted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
      bg-slate-100 text-slate-500 border border-slate-200">
      Pending
    </span>
  )
}

// ── Candidate row ──────────────────────────────────────────────────────────────

function CandidateRow({ app, stages, jobId, onReject, onRestore, onConfirmMoveNext, onConfirmHire }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const currentStage    = stages.find(s => s.order_index === app.current_stage_index)
  const currentResult   = app.stage_results?.find(sr => sr.stage_id === currentStage?.id)
  const stageStatus     = currentResult?.status ?? 'pending'
  const interviewStatus = currentResult?.interviews?.status
  const isLastStage     = app.current_stage_index >= stages.length
  const nextStage       = stages.find(s => s.order_index === app.current_stage_index + 1)
  const isStage2Plus    = (currentStage?.order_index ?? 1) > 1
  const isScheduled     = Boolean(currentResult?.scheduled_at)

  // Unified display status drives both badge and menu
  const displayStatus =
    app.overall_status === 'rejected' ? 'rejected'    :
    app.overall_status === 'hired'    ? 'hired'       :
    stageStatus === 'passed'          ? 'passed'      :
    stageStatus === 'failed'          ? 'failed'      :
    stageStatus === 'in_progress'     ? 'in_progress' :
    interviewStatus === 'submitted'   ? 'submitted'   : 'pending'

  // Review URL always includes the current stage so the page opens on the right tab
  const reviewUrl = `/jobs/${jobId}/candidates/${app.id}?stage=${app.current_stage_index}`

  // Prominent review button shown outside the menu:
  // - Stage 1: when candidate has submitted
  // - Stage 2+: whenever the candidate is active (not rejected/hired)
  const showReviewBtn =
    displayStatus === 'submitted' ||
    (isStage2Plus && app.overall_status === 'active')

  // When Review button is not shown, show View Candidate as the prominent CTA instead
  const showViewCandidateBtn = !showReviewBtn

  // Review button label varies by context
  const reviewBtnLabel =
    isStage2Plus && stageStatus === 'pending' && !isScheduled ? 'Schedule' : 'Review'

  // Resend link: copy Stage 1 screening URL from interview token
  function handleResendLink() {
    const token = currentResult?.interviews?.token
    if (!token) { toast.error('No screening link found.'); return }
    navigator.clipboard.writeText(`${APP_BASE_URL}/i/${token}`)
      .then(() => toast.success('Screening link copied.'))
      .catch(() => toast.error('Could not copy link.'))
    setMenuOpen(false)
  }

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  function close() { setMenuOpen(false) }

  // Shared review link item used in multiple menu branches
  function ReviewMenuItem({ label, icon: Icon = Eye }) {
    return (
      <Link
        to={reviewUrl}
        onClick={close}
        className="flex items-center gap-2.5 px-3.5 py-2.5 text-sm
          text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <Icon size={14} className="text-slate-400 shrink-0" />
        {label}
      </Link>
    )
  }

  // Build menu items based on displayStatus + stage type
  function MenuItems() {

    // ── Hired ──────────────────────────────────────────────────────────────────
    if (displayStatus === 'hired') {
      return <ReviewMenuItem label="View review" />
    }

    // ── Rejected ───────────────────────────────────────────────────────────────
    if (displayStatus === 'rejected') {
      return (
        <>
          <ReviewMenuItem label="View review" />
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { close(); onRestore(app) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
              text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <RotateCcw size={14} className="text-slate-400 shrink-0" />
            Restore candidate
          </button>
        </>
      )
    }

    // ── Stage 2+ live interview ────────────────────────────────────────────────
    if (isStage2Plus) {
      const menuLabel =
        stageStatus === 'in_progress'              ? 'Review and add notes' :
        stageStatus === 'passed'                   ? 'View review'          :
        (stageStatus === 'pending' && isScheduled) ? 'Review and add notes' :
                                                     'Schedule interview'
      const MenuIcon = stageStatus === 'pending' && !isScheduled ? Calendar : Eye

      return (
        <>
          <ReviewMenuItem label={menuLabel} icon={MenuIcon} />
          <div className="my-1 border-t border-slate-100" />
          <ReviewMenuItem label="View candidate" />
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { close(); onReject(app) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
              text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <X size={14} className="shrink-0" />
            Reject candidate
          </button>
        </>
      )
    }

    // ── Stage 1 — pending (not yet submitted) ──────────────────────────────────
    if (displayStatus === 'pending') {
      return (
        <>
          <button
            type="button"
            onClick={handleResendLink}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
              text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <Link2 size={14} className="text-slate-400 shrink-0" />
            Resend link
          </button>
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { close(); onReject(app) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
              text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <X size={14} className="shrink-0" />
            Reject candidate
          </button>
        </>
      )
    }

    // ── Stage 1 — submitted ────────────────────────────────────────────────────
    if (displayStatus === 'submitted') {
      return (
        <>
          <ReviewMenuItem label="Review" />
          <div className="my-1 border-t border-slate-100" />
          <ReviewMenuItem label="View candidate" />
          {!isLastStage && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { close(); onConfirmMoveNext(app, nextStage) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
                  text-slate-700 hover:bg-slate-50 transition-colors text-left"
              >
                <ArrowRight size={14} className="text-slate-400 shrink-0" />
                Move to Stage {app.current_stage_index + 1}
              </button>
            </>
          )}
          {isLastStage && (
            <>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => { close(); onConfirmHire(app) }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
                  text-[#1D9E75] font-semibold hover:bg-[#e6f5ef] transition-colors text-left"
              >
                <Award size={14} className="shrink-0" />
                Mark as hired
              </button>
            </>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button
            type="button"
            onClick={() => { close(); onReject(app) }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
              text-red-600 hover:bg-red-50 transition-colors text-left"
          >
            <X size={14} className="shrink-0" />
            Reject candidate
          </button>
        </>
      )
    }

    // ── passed / failed / in_progress (Stage 1 after move) ────────────────────
    return (
      <>
        <ReviewMenuItem label="View review" />
        {displayStatus === 'passed' && isLastStage && (
          <>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={() => { close(); onConfirmHire(app) }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
                text-[#1D9E75] font-semibold hover:bg-[#e6f5ef] transition-colors text-left"
            >
              <Award size={14} className="shrink-0" />
              Mark as hired
            </button>
          </>
        )}
        <div className="my-1 border-t border-slate-100" />
        <button
          type="button"
          onClick={() => { close(); onReject(app) }}
          className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm
            text-red-600 hover:bg-red-50 transition-colors text-left"
        >
          <X size={14} className="shrink-0" />
          Reject candidate
        </button>
      </>
    )
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-4
      hover:border-slate-300 hover:shadow-md transition-all
      flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">

      {/* Candidate info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-slate-900 text-sm leading-tight">
            {app.candidates?.name}
          </span>
          <StatusBadge
            stageStatus={stageStatus}
            interviewStatus={interviewStatus}
            overallStatus={app.overall_status}
          />
        </div>
        <div className="mt-0.5 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-400">{app.candidates?.email}</span>
          {app.candidates?.phone && (
            <span className="text-xs text-slate-400">{app.candidates.phone}</span>
          )}
        </div>
        {/* Profile snippet */}
        {(() => {
          const parts = [
            app.candidates?.current_role,
            app.candidates?.current_company,
            app.candidates?.years_of_experience != null
              ? `${app.candidates.years_of_experience} yrs exp`
              : null,
          ].filter(Boolean)
          return parts.length > 0 ? (
            <p className="text-xs text-slate-400 leading-snug">{parts.join(' · ')}</p>
          ) : null
        })()}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {currentStage && (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
              ${currentStage.type === 'async_video'
                ? 'bg-[#e6f0f9] text-[#005ea4]'
                : 'bg-violet-50 text-violet-700'}`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0
                ${currentStage.type === 'async_video' ? 'bg-[#005ea4]' : 'bg-violet-500'}`} />
              Stage {currentStage.order_index} — {currentStage.name}
            </span>
          )}
          {currentResult?.interviews?.submitted_at && (
            <span className="text-xs text-slate-400">
              Submitted{' '}
              {new Date(currentResult.interviews.submitted_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          )}
          {isStage2Plus && isScheduled && currentResult?.scheduled_at && (
            <span className="text-xs text-slate-400">
              Scheduled{' '}
              {new Date(currentResult.scheduled_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Prominent review / schedule button */}
        {showReviewBtn && (
          <Link
            to={reviewUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200
              bg-white text-slate-700 text-xs font-semibold
              hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            {isStage2Plus && stageStatus === 'pending' && !isScheduled
              ? <Calendar size={12} />
              : <Eye size={12} />}
            {reviewBtnLabel}
          </Link>
        )}

        {/* View candidate CTA — shown when Review button is not available */}
        {showViewCandidateBtn && (
          <Link
            to={reviewUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200
              bg-white text-slate-700 text-xs font-semibold
              hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <Eye size={12} />
            View candidate
          </Link>
        )}

        {/* Three-dot menu — always shown */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors
              ${menuOpen
                ? 'bg-slate-100 text-slate-700'
                : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
            aria-label="Candidate actions"
          >
            <MoreHorizontal size={16} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl
              border border-slate-200 shadow-lg z-20 overflow-hidden py-1">
              <MenuItems />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton({ className }) {
  return <div className={`bg-slate-200 rounded animate-pulse ${className}`} />
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function JobPipelinePage() {
  const { id: jobId } = useParams()
  const { user }      = useAuth()

  const [job,          setJob]          = useState(null)
  const [stages,       setStages]       = useState([])
  const [applications, setApplications] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [notFound,     setNotFound]     = useState(false)
  const [showFullDesc, setShowFullDesc] = useState(false)

  // Modals / actions
  const [showAddCandidate, setShowAddCandidate] = useState(false)
  const [rejectTarget,     setRejectTarget]     = useState(null)   // app | null
  const [rejecting,        setRejecting]        = useState(false)
  const [confirmMoveNext,  setConfirmMoveNext]  = useState(null)   // { app, nextStage } | null
  const [executingMove,    setExecutingMove]    = useState(false)
  const [confirmHire,      setConfirmHire]      = useState(null)   // app | null
  const [executingHire,    setExecutingHire]    = useState(false)

  // Toggle
  const [confirmToggle, setConfirmToggle] = useState(false)
  const [toggling,      setToggling]      = useState(false)

  // Stage filter: null = all, number = stage order_index
  const [filterStage, setFilterStage] = useState(null)

  useEffect(() => { fetchAll() }, [jobId])   // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchAll() {
    setLoading(true)
    try {
      const { data: jobData, error: jobErr } = await supabase
        .from('job_openings')
        .select('id, title, description, is_active, created_at')
        .eq('id', jobId)
        .eq('created_by', user.id)
        .single()

      if (jobErr || !jobData) {
        setNotFound(true)
        return
      }
      setJob(jobData)

      const [stagesRes, appsRes] = await Promise.all([
        supabase
          .from('pipeline_stages')
          .select('id, order_index, name, type, template_id')
          .eq('job_opening_id', jobId)
          .order('order_index', { ascending: true }),
        supabase
          .from('candidate_applications')
          .select(`
            id, current_stage_index, overall_status, created_at,
            candidates ( id, name, email, phone, current_role, current_company, years_of_experience ),
            stage_results (
              id, stage_id, status, interview_id, scheduled_at,
              interviews ( id, status, token, submitted_at )
            )
          `)
          .eq('job_opening_id', jobId)
          .order('created_at', { ascending: false }),
      ])

      if (stagesRes.error) throw stagesRes.error
      if (appsRes.error)   throw appsRes.error

      setStages(stagesRes.data ?? [])
      setApplications(appsRes.data ?? [])
    } catch (err) {
      console.error(err)
      toast.error('Failed to load pipeline.')
    } finally {
      setLoading(false)
    }
  }

  // ── Toggle active/closed ────────────────────────────────────────────────────

  function handleToggle() {
    if (job.is_active) setConfirmToggle(true)
    else executeToggle()
  }

  async function executeToggle() {
    const newValue = !job.is_active
    setToggling(true)
    try {
      const { error } = await supabase
        .from('job_openings')
        .update({ is_active: newValue })
        .eq('id', jobId)
        .eq('created_by', user.id)
      if (error) throw error
      setJob(prev => ({ ...prev, is_active: newValue }))
      toast.success(newValue ? 'Job reopened.' : 'Job closed.')
    } catch {
      toast.error('Failed to update job status.')
    } finally {
      setToggling(false)
      setConfirmToggle(false)
    }
  }

  // ── Reject ──────────────────────────────────────────────────────────────────

  async function executeReject() {
    if (!rejectTarget) return
    setRejecting(true)
    try {
      const { error } = await supabase
        .from('candidate_applications')
        .update({ overall_status: 'rejected' })
        .eq('id', rejectTarget.id)
      if (error) throw error
      setApplications(prev =>
        prev.map(a => a.id === rejectTarget.id ? { ...a, overall_status: 'rejected' } : a)
      )
      toast.success('Candidate rejected.')
    } catch {
      toast.error('Failed to reject candidate.')
    } finally {
      setRejecting(false)
      setRejectTarget(null)
    }
  }

  // ── Move to next stage ──────────────────────────────────────────────────────

  async function executeMoveNext() {
    if (!confirmMoveNext) return
    const { app, nextStage } = confirmMoveNext
    setExecutingMove(true)
    try {
      const { error: updateErr } = await supabase
        .from('candidate_applications')
        .update({ current_stage_index: app.current_stage_index + 1 })
        .eq('id', app.id)
      if (updateErr) throw updateErr

      const { error: srErr } = await supabase
        .from('stage_results')
        .insert({ application_id: app.id, stage_id: nextStage.id, status: 'pending' })
      if (srErr) throw srErr

      await fetchAll()
      toast.success(`Moved to Stage ${app.current_stage_index + 1}.`)
    } catch {
      toast.error('Failed to move candidate.')
    } finally {
      setExecutingMove(false)
      setConfirmMoveNext(null)
    }
  }

  // ── Restore rejected candidate ──────────────────────────────────────────────

  async function handleRestore(app) {
    try {
      const { error } = await supabase
        .from('candidate_applications')
        .update({ overall_status: 'active' })
        .eq('id', app.id)
      if (error) throw error
      setApplications(prev =>
        prev.map(a => a.id === app.id ? { ...a, overall_status: 'active' } : a)
      )
      toast.success('Candidate restored.')
    } catch {
      toast.error('Failed to restore candidate.')
    }
  }

  // ── Mark as hired ───────────────────────────────────────────────────────────

  async function executeHire() {
    if (!confirmHire) return
    setExecutingHire(true)
    try {
      const { error } = await supabase
        .from('candidate_applications')
        .update({ overall_status: 'hired' })
        .eq('id', confirmHire.id)
      if (error) throw error
      setApplications(prev =>
        prev.map(a => a.id === confirmHire.id ? { ...a, overall_status: 'hired' } : a)
      )
      toast.success('Candidate marked as hired!')
    } catch {
      toast.error('Failed to update status.')
    } finally {
      setExecutingHire(false)
      setConfirmHire(null)
    }
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const filteredApps = filterStage === null
    ? applications
    : applications.filter(a => a.current_stage_index === filterStage)

  const stageCounts = stages.reduce((acc, s) => {
    acc[s.order_index] = applications.filter(a => a.current_stage_index === s.order_index).length
    return acc
  }, {})

  const desc     = job?.description ?? ''
  const descLong = desc.length > DESC_LIMIT

  // ── Not found ───────────────────────────────────────────────────────────────

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-[#f5f7fa]">
        <NavBar />
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-20 flex flex-col items-center text-center gap-4">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Job not found</h2>
          <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
            This job opening doesn't exist or you don't have access to it.
          </p>
          <Link
            to="/dashboard"
            className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
              bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
              transition-colors shadow-sm"
          >
            Back to dashboard
          </Link>
        </main>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f5f7fa]">
      <NavBar />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 flex flex-col gap-4">

          {/* Top row: back + toggle + add button */}
          <div className="flex items-center justify-between gap-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-sm text-slate-500
                hover:text-slate-900 transition-colors"
            >
              <ArrowLeft size={15} />
              Dashboard
            </Link>
            <div className="flex items-center gap-3">
              {loading
                ? <Skeleton className="w-24 h-6" />
                : <ToggleSwitch isActive={job.is_active} onToggle={handleToggle} disabled={toggling} />
              }
              <button
                type="button"
                onClick={() => setShowAddCandidate(true)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg
                  bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
                  transition-colors shadow-sm disabled:opacity-50"
              >
                <UserPlus size={14} />
                Add candidate
              </button>
            </div>
          </div>

          {/* Job title + description */}
          {loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-7 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight leading-snug">
                {job.title}
              </h1>
              {desc && (
                <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">
                  {!showFullDesc && descLong ? (
                    <>
                      {desc.slice(0, DESC_LIMIT)}…{' '}
                      <button type="button" onClick={() => setShowFullDesc(true)}
                        className="text-[#005ea4] text-xs font-semibold hover:underline">
                        Show more
                      </button>
                    </>
                  ) : (
                    <>
                      {desc}
                      {descLong && (
                        <>{' '}
                          <button type="button" onClick={() => setShowFullDesc(false)}
                            className="text-[#005ea4] text-xs font-semibold hover:underline">
                            Show less
                          </button>
                        </>
                      )}
                    </>
                  )}
                </p>
              )}
            </div>
          )}
        </div>

        {/* ── Stage filter bar ─────────────────────────────────────────────── */}
        {!loading && stages.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {/* All tab */}
            <button
              type="button"
              onClick={() => setFilterStage(null)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors
                ${filterStage === null
                  ? 'bg-[#005ea4] text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              All
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                ${filterStage === null ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                {applications.length}
              </span>
            </button>

            {stages.map(stage => {
              const active = filterStage === stage.order_index
              const count  = stageCounts[stage.order_index] ?? 0
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => setFilterStage(stage.order_index)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold transition-colors
                    ${active
                      ? 'bg-[#005ea4] text-white shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0
                    ${stage.type === 'async_video'
                      ? (active ? 'bg-white/70' : 'bg-[#005ea4]')
                      : (active ? 'bg-white/70' : 'bg-violet-500')}`}
                  />
                  Stage {stage.order_index} — {stage.name}
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold
                    ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Candidate list ───────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48" />
                <Skeleton className="h-5 w-28 rounded-full" />
              </div>
            ))}
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#e6f0f9] flex items-center justify-center mb-4">
                <Users size={22} className="text-[#005ea4]" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                {filterStage !== null ? 'No candidates in this stage' : 'No candidates yet'}
              </h3>
              <p className="mt-1.5 text-sm text-slate-500 max-w-xs leading-relaxed">
                {filterStage !== null
                  ? 'Try selecting a different stage or view all candidates.'
                  : 'Add your first candidate to get started.'}
              </p>
              {filterStage === null && (
                <button
                  type="button"
                  onClick={() => setShowAddCandidate(true)}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg
                    bg-[#005ea4] hover:bg-[#004d8a] text-white text-sm font-semibold
                    transition-colors shadow-sm"
                >
                  <UserPlus size={14} />
                  Add candidate
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredApps.map(app => (
              <CandidateRow
                key={app.id}
                app={app}
                stages={stages}
                jobId={jobId}
                onReject={setRejectTarget}
                onRestore={handleRestore}
                onConfirmMoveNext={(a, s) => setConfirmMoveNext({ app: a, nextStage: s })}
                onConfirmHire={setConfirmHire}
              />
            ))}
          </div>
        )}

      </main>

      {/* ── Add candidate modal ──────────────────────────────────────────── */}
      {showAddCandidate && job && (
        <AddCandidateModal
          job={job}
          stages={stages}
          user={user}
          onClose={() => setShowAddCandidate(false)}
          onAdded={fetchAll}
        />
      )}

      {/* ── Reject confirm ───────────────────────────────────────────────── */}
      {rejectTarget && (
        <ConfirmModal
          title={`Reject ${rejectTarget.candidates?.name}?`}
          body="This will end their application. This action cannot be undone."
          confirmLabel="Reject candidate"
          variant="danger"
          loading={rejecting}
          onConfirm={executeReject}
          onCancel={() => setRejectTarget(null)}
        />
      )}

      {/* ── Move to next stage confirm ───────────────────────────────────── */}
      {confirmMoveNext && (
        <ConfirmModal
          title={`Move ${confirmMoveNext.app.candidates?.name} to Stage ${confirmMoveNext.app.current_stage_index + 1}?`}
          body={`They will be moved to "${confirmMoveNext.nextStage?.name}". A new stage record will be created.`}
          confirmLabel="Move candidate"
          variant="warning"
          loading={executingMove}
          onConfirm={executeMoveNext}
          onCancel={() => setConfirmMoveNext(null)}
        />
      )}

      {/* ── Mark as hired confirm ────────────────────────────────────────── */}
      {confirmHire && (
        <ConfirmModal
          title={`Mark ${confirmHire.candidates?.name} as hired?`}
          body="Their application will be marked as hired. This can be reviewed later if needed."
          confirmLabel="Mark as hired"
          variant="warning"
          loading={executingHire}
          onConfirm={executeHire}
          onCancel={() => setConfirmHire(null)}
        />
      )}

      {/* ── Confirm close toggle ─────────────────────────────────────────── */}
      {confirmToggle && (
        <ConfirmModal
          title="Close this job opening?"
          body="Candidates won't be able to be added to new stages. You can reopen it at any time."
          confirmLabel="Close job"
          variant="warning"
          loading={toggling}
          onConfirm={executeToggle}
          onCancel={() => setConfirmToggle(false)}
        />
      )}
    </div>
  )
}
