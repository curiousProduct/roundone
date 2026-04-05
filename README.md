# RoundOne

B2B async video interview screening tool for HR teams in India.

HR teams post job openings, invite candidates to record video answers to preset questions, then review and shortlist — no scheduling required.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite + Tailwind CSS |
| Backend | Node.js + Express |
| Database | PostgreSQL via Supabase |
| Auth | Supabase Auth |
| Video Storage | Cloudflare R2 |
| Email | Resend |
| Payments | Razorpay |
| Frontend Hosting | Vercel |
| Backend Hosting | Railway |

## Project Structure

```
roundone/
├── client/          # React frontend (Vite)
├── server/          # Node/Express backend
├── .env.example     # Environment variable template
├── .gitignore
└── README.md
```

## Getting Started

### 1. Clone & install

```bash
git clone <repo-url>
cd roundone
npm run install:all
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Fill in all values in .env
```

Also copy `.env.example` into `server/.env` for the backend.

### 3. Run in development

```bash
npm run dev          # Starts both client (port 5173) and server (port 5000)
npm run dev:client   # Client only
npm run dev:server   # Server only
```

### 4. Build for production

```bash
npm run build        # Builds the React client to client/dist/
```

## Deployment

- **Frontend**: Deploy `client/` to Vercel — set `VITE_*` env vars in Vercel dashboard.
- **Backend**: Deploy `server/` to Railway — set server env vars in Railway dashboard.

## Landing Page

The marketing landing page lives separately at [roundone-theta.vercel.app](https://roundone-theta.vercel.app) as a standalone HTML file and is not part of this codebase.
