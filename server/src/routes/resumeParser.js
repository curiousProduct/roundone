import express  from 'express'
import multer   from 'multer'
import { PDFParse } from 'pdf-parse'
import supabase from '../lib/supabase.js'

const router = express.Router()

// ── Multer: in-memory, 5 MB limit, PDF only ──────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (file.mimetype === 'application/pdf') return cb(null, true)
    const err = new Error('Only PDF files are accepted')
    err.status = 400
    cb(err)
  },
})

function handleUpload(req, res, next) {
  upload.single('file')(req, res, err => {
    if (!err) return next()
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(413).json({ error: 'File too large. Maximum size is 5 MB.' })
    return res.status(err.status || 400).json({ error: err.message || 'Upload error' })
  })
}

// ── Text cleaning ─────────────────────────────────────────────────────────────

function cleanText(raw) {
  return raw
    // Remove emoji and symbol ranges
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, ' ')
    .replace(/[\u{2600}-\u{26FF}]/gu, ' ')
    .replace(/[\u{2700}-\u{27BF}]/gu, ' ')
    .replace(/[\u{FE00}-\u{FE0F}]/gu, '')    // variation selectors
    .replace(/[\u{200B}-\u{200D}\u{FEFF}]/gu, '') // zero-width chars
    // Remove null bytes
    .replace(/\0/g, '')
    // Collapse multiple spaces/tabs on each line but preserve newlines
    .replace(/[^\S\n]+/g, ' ')
    .trim()
}

// ── Extraction helpers ────────────────────────────────────────────────────────

function toTitleCase(str) {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function extractEmail(text) {
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g)
  if (!m) return { value: null, confidence: null }
  // Prefer the first match that doesn't look like a domain typo
  const valid = m.find(e => e.includes('@') && e.split('@')[1].includes('.'))
  if (!valid) return { value: null, confidence: null }
  return { value: valid.toLowerCase(), confidence: 'high' }
}

function extractPhone(text) {
  // Pattern 1 — +91 with optional space/dash, then 10 digit starting 6-9
  let m = text.match(/\+91[\s\-]?([6-9]\d{9})/)
  if (m) return { value: `+91${m[1]}`, confidence: 'high' }

  // Pattern 2 — 10-digit Indian mobile standalone
  m = text.match(/(?<!\d)([6-9]\d{9})(?!\d)/)
  if (m) return { value: m[1], confidence: 'medium' }

  // Pattern 3 — Generic XXX-XXX-XXXX / XXX XXX XXXX
  m = text.match(/\b(\d{3}[\s\-]\d{3}[\s\-]\d{4})\b/)
  if (m) return { value: m[1], confidence: 'low' }

  return { value: null, confidence: null }
}

function extractName(text) {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean)
  const emailRe = /[a-zA-Z0-9._%+\-]+@/
  const phoneRe = /[6-9]\d{9}|\+91|\d{3}[\s\-]\d{3}/
  const urlRe   = /https?:|www\.|linkedin|github|twitter/i
  const junkRe  = /resume|curriculum|vitae|cv\b|page \d|@/i

  // Strategy 1: First clean line that looks like a human name (2–4 words)
  for (const line of lines.slice(0, 8)) {
    if (emailRe.test(line) || phoneRe.test(line) || urlRe.test(line) || junkRe.test(line)) continue
    // Accept all-caps names like "MUKUL SHARMA"
    const stripped = line.replace(/[.,\-|]/g, '').trim()
    const words    = stripped.split(/\s+/).filter(Boolean)
    if (words.length >= 2 && words.length <= 4 && /^[a-zA-Z\s]+$/.test(stripped)) {
      return { value: toTitleCase(stripped), confidence: 'high' }
    }
  }

  // Strategy 2: Line immediately before first email
  const emailIdx = text.search(/[a-zA-Z0-9._%+\-]+@/)
  if (emailIdx > 0) {
    const before   = text.slice(0, emailIdx).trim().split('\n').filter(Boolean)
    const lastLine = before[before.length - 1]?.trim()
    if (lastLine) {
      const stripped = lastLine.replace(/[.,\-|]/g, '').trim()
      const words    = stripped.split(/\s+/).filter(Boolean)
      if (words.length >= 2 && words.length <= 5 && /^[a-zA-Z\s]+$/.test(stripped)) {
        return { value: toTitleCase(stripped), confidence: 'medium' }
      }
    }
  }

  // Strategy 3: Longest plausible all-caps or title-case phrase in first 10 lines
  let best = null
  for (const line of lines.slice(0, 10)) {
    if (emailRe.test(line) || phoneRe.test(line) || urlRe.test(line)) continue
    const stripped = line.replace(/[.,\-|]/g, '').trim()
    const words    = stripped.split(/\s+/).filter(Boolean)
    if (words.length >= 2 && words.length <= 4 && /^[A-Za-z\s]+$/.test(stripped)) {
      if (!best || stripped.length > best.length) best = stripped
    }
  }
  if (best) return { value: toTitleCase(best), confidence: 'low' }

  return { value: null, confidence: null }
}

const JOB_TITLE_RE = /engineer|manager|analyst|developer|designer|lead|senior|junior|associate|director|vp\b|consultant|executive|intern|specialist|architect|scientist|officer|head|founder|product|program|coordinator/i

const SECTION_BOUNDARY_RE = /^(experience|work experience|employment|professional experience|education|projects?|achievements?|certifications?|awards?|languages?|interests?|hobbies|objective|summary|profile|about|references?|publications?|volunteer)/i

function extractCurrentWork(text) {
  const presentRe = /\b(Present|Current|Till\s*[Dd]ate|2024|2025|2026)\b/i
  const lines     = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!presentRe.test(line)) continue

    // Strip date ranges (e.g. "Jan 2022 – Present", "2022 - Present")
    let cleaned = line
      .replace(/\(?\b\w+\.?\s+\d{4}\s*[-–—]\s*(Present|Current|Till\s*Date|2025|2026)\b\)?/gi, '')
      .replace(/\(?\d{4}\s*[-–—]\s*(Present|Current|Till\s*Date|2025|2026)\b\)?/gi, '')
      .replace(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s*\d{0,4}/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

    if (!cleaned || cleaned.length < 3) continue

    let company = null
    let role    = null

    // "Role at Company"
    if (/ at /i.test(cleaned)) {
      const [r, c] = cleaned.split(/ at /i).map(p => p.trim())
      if (r && c) return { company: c, role: r }
    }

    // Pipe-separated: "Company | City" or "Company | Role" or "Role | Company"
    if (cleaned.includes('|')) {
      const parts = cleaned.split('|').map(p => p.trim()).filter(p => p.length > 1)
      for (const part of parts) {
        if (JOB_TITLE_RE.test(part) && !role) role = part
        else if (!company && !JOB_TITLE_RE.test(part)) company = part
      }
      // If no role found on this line, check the next non-empty line
      if (company && !role) {
        const nextLine = lines[i + 1]?.trim()
        if (nextLine && JOB_TITLE_RE.test(nextLine) && !nextLine.includes('|')) {
          role = nextLine
        }
      }
      if (company || role) return { company: company || null, role: role || null }
    }

    // Comma-separated
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map(p => p.trim()).filter(p => p.length > 1)
      for (const part of parts) {
        if (JOB_TITLE_RE.test(part) && !role) role = part
        else if (!company) company = part
      }
      if (company || role) return { company: company || null, role: role || null }
    }

    // Single value — classify by keywords; look at next line for the other
    if (JOB_TITLE_RE.test(cleaned)) {
      role = cleaned
      const nextLine = lines[i + 1]?.trim()
      if (nextLine && !JOB_TITLE_RE.test(nextLine) && !presentRe.test(nextLine)) {
        company = nextLine
      }
    } else {
      company = cleaned
      const nextLine = lines[i + 1]?.trim()
      if (nextLine && JOB_TITLE_RE.test(nextLine)) role = nextLine
    }
    if (company || role) return { company: company || null, role: role || null }
  }

  return { company: null, role: null }
}

const EXP_HEADER_RE  = /^(experience|work experience|professional experience|employment history|employment|work history|career history)/i

function extractYearsOfExperience(text) {
  const CURRENT_YEAR = 2026

  // ── Step 1: isolate the experience section ────────────────────────────────
  const lines = text.split('\n').map(l => l.trim())
  let inExp     = false
  const expLines = []

  for (const line of lines) {
    if (!line) continue
    if (EXP_HEADER_RE.test(line))          { inExp = true;  continue }
    if (inExp && SECTION_BOUNDARY_RE.test(line)) { inExp = false; continue }
    if (inExp) expLines.push(line)
  }

  // ── Step 2: extract years from experience section ─────────────────────────
  const scopedText = expLines.length > 0 ? expLines.join('\n') : null

  if (scopedText) {
    const matches = scopedText.match(/\b(200\d|201\d|202[0-6])\b/g)
    if (matches) {
      const years   = [...new Set(matches.map(Number))].filter(y => y >= 2000 && y <= CURRENT_YEAR)
      if (years.length) {
        const earliest = Math.min(...years)
        const exp      = Math.min(CURRENT_YEAR - earliest, 30)
        if (exp > 0) return exp
      }
    }
  }

  // ── Step 3: fallback — find years near job-entry patterns in full text ────
  // Match lines that look like date ranges: "Company | City  Oct 2022 – Present"
  const dateLineRe = /\b(200\d|201\d|202[0-6])\b.*(?:–|-|to)\s*(?:Present|Current|\d{4})/gi
  const fallbackYears = []
  let m
  while ((m = dateLineRe.exec(text)) !== null) {
    const y = parseInt(m[1], 10)
    if (y >= 2000 && y <= CURRENT_YEAR) fallbackYears.push(y)
  }
  if (fallbackYears.length) {
    const earliest = Math.min(...fallbackYears)
    const exp      = Math.min(CURRENT_YEAR - earliest, 30)
    if (exp > 0) return exp
  }

  return null
}

const SKILLS_HEADER_RE    = /^(skills|technical skills|key skills|core competencies|technologies|tools|expertise|proficiencies|tech stack|technical expertise)/i

function extractSkills(text) {
  const lines = text.split('\n').map(l => l.trim())
  let inSection = false
  const collected = []

  for (const line of lines) {
    if (!line) continue
    if (SKILLS_HEADER_RE.test(line)) { inSection = true; continue }
    if (inSection) {
      if (SECTION_BOUNDARY_RE.test(line)) break
      collected.push(line)
      if (collected.length >= 15) break
    }
  }

  if (!collected.length) return []

  return collected
    .join(', ')
    .split(/[,\n•·|▪▸–\-\/]/)
    .map(s => s.replace(/^[\s\-–•·▪▸]+/, '').replace(/[:]+$/, '').trim())
    .filter(s => s.length > 1 && s.length < 60 && !/^\d+$/.test(s))
    .filter((s, i, arr) => arr.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i)
    .slice(0, 15)
}

const EDU_HEADER_RE = /^(education|educational qualifications?|qualifications?|academic background|academic qualifications?)/i

function extractEducation(text) {
  const lines = text.split('\n').map(l => l.trim())
  let inSection = false
  const collected = []

  for (const line of lines) {
    if (!line) continue
    if (EDU_HEADER_RE.test(line)) { inSection = true; continue }
    if (inSection) {
      if (SECTION_BOUNDARY_RE.test(line) && collected.length) break
      collected.push(line)
      if (collected.length >= 3) break
    }
  }

  return collected.length ? collected.join(' · ') : null
}

// ── Route 1: POST /api/parse-resume ──────────────────────────────────────────

router.post('/parse-resume', handleUpload, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  // Initialise result with nulls — always return 200 with whatever we found
  const result = {
    name:                null,
    email:               null,
    phone:               null,
    current_company:     null,
    current_role:        null,
    years_of_experience: null,
    skills:              [],
    education:           null,
    confidence: { name: null, email: null, phone: null },
  }

  // ── Extract raw text from PDF ─────────────────────────────────────────────
  let text = ''
  try {
    const parser = new PDFParse({ data: req.file.buffer })
    await parser.load()
    const parsed = await parser.getText()
    await parser.destroy()
    text = cleanText(parsed.text ?? '')
    console.log('[parse-resume] raw text length:', text.length)
  } catch (err) {
    console.error('[parse-resume] PDF extraction failed:', err.message)
    console.error(err.stack)
    // Can't extract text — return empty result, not an error
    return res.json(result)
  }

  if (!text.trim()) {
    console.warn('[parse-resume] Extracted text is empty')
    return res.json(result)
  }

  // ── Run each extractor independently ─────────────────────────────────────

  try {
    const r = extractEmail(text)
    result.email               = r.value
    result.confidence.email    = r.confidence
  } catch (e) { console.error('[parse-resume] email extract failed:', e.message) }

  try {
    const r = extractPhone(text)
    result.phone               = r.value
    result.confidence.phone    = r.confidence
  } catch (e) { console.error('[parse-resume] phone extract failed:', e.message) }

  try {
    const r = extractName(text)
    result.name                = r.value
    result.confidence.name     = r.confidence
  } catch (e) { console.error('[parse-resume] name extract failed:', e.message) }

  try {
    const { company, role } = extractCurrentWork(text)
    result.current_company  = company
    result.current_role     = role
  } catch (e) { console.error('[parse-resume] current work extract failed:', e.message) }

  try {
    result.years_of_experience = extractYearsOfExperience(text)
  } catch (e) { console.error('[parse-resume] years extract failed:', e.message) }

  try {
    result.skills = extractSkills(text)
  } catch (e) { console.error('[parse-resume] skills extract failed:', e.message) }

  try {
    result.education = extractEducation(text)
  } catch (e) { console.error('[parse-resume] education extract failed:', e.message) }

  console.log('[parse-resume] result:', JSON.stringify({ ...result, skills: result.skills?.length }))
  return res.json(result)
})

// ── Route 2: POST /api/upload-resume ─────────────────────────────────────────

router.post('/upload-resume', handleUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    // Ensure the bucket exists (creates it on first deploy if missing)
    const { data: buckets, error: listErr } = await supabase.storage.listBuckets()
    if (listErr) {
      console.error('[upload-resume] listBuckets error:', listErr.message)
    } else {
      const exists = buckets?.some(b => b.name === 'resumes')
      if (!exists) {
        const { error: createErr } = await supabase.storage.createBucket('resumes', {
          public: true,
          fileSizeLimit: 5 * 1024 * 1024,
        })
        if (createErr) console.error('[upload-resume] createBucket error:', createErr.message)
        else console.log('[upload-resume] created "resumes" bucket')
      }
    }

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`

    const { error: uploadErr } = await supabase.storage
      .from('resumes')
      .upload(filename, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })
    if (uploadErr) {
      console.error('[upload-resume] upload error:', JSON.stringify(uploadErr, null, 2))
      throw uploadErr
    }

    const { data: urlData } = supabase.storage
      .from('resumes')
      .getPublicUrl(filename)

    console.log('[upload-resume] uploaded:', filename)
    return res.json({ url: urlData.publicUrl })
  } catch (err) {
    console.error('[upload-resume] fatal error:', err.message, err.statusCode ?? '')
    return res.status(500).json({ error: err.message || 'Failed to upload resume' })
  }
})

export default router
