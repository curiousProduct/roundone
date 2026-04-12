import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import resumeParserRouter from './routes/resumeParser.js'

// ── Startup env validation ──────────────────────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
const PLACEHOLDER_RE = /^your-|^\[|^<|^undefined$/i
for (const key of REQUIRED_ENV) {
  const val = process.env[key]
  if (!val || PLACEHOLDER_RE.test(val)) {
    console.warn(`[startup] WARNING: ${key} is missing or still a placeholder. Storage uploads will fail.`)
  }
}

const app = express()
const PORT = process.env.PORT || 5000

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(morgan('dev'))
app.use(express.json())

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'roundone-api' })
})

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/api', resumeParserRouter)

// ── 404 handler ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// ── Error handler ───────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`RoundOne API running on http://localhost:${PORT}`)
})
