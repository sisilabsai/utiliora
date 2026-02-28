# Utiliora

Utiliora is a fast, mobile-first utility platform built with Next.js App Router.  
It provides browser-based calculators, converters, SEO/text tools, image utilities, developer helpers, and productivity tools with no login required.

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Vercel-ready deployment

## Current Scope

- 50+ tools with static SEO routes
- Category index pages
- Dynamic tool pages with metadata + structured data
- Tool search across the full catalog
- Client-side processing for most utilities
- HTTP status checker API route (`/api/http-status`)

## Categories

- `/calculators`
- `/converters`
- `/seo-tools`
- `/image-tools`
- `/developer-tools`
- `/productivity-tools`

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production Checks

```bash
npm run lint
npm run build
```

## Deployment

The repository is set up for Vercel.  
Push to the connected branch and Vercel will build/deploy automatically.

## Newsletter + Admin Setup

1. Copy `.env.example` to `.env.local`.
2. Add your `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_SESSION_SECRET`.
3. Run SQL in `supabase/setup.sql` inside Supabase SQL editor.
4. Seed admin once:

```bash
npm run admin:seed
```

5. Open `/admin` and sign in.

Default seed credentials:
- Username: `admin@utiliora.cloud`
- Password: `Admin@Cloud2026`

## Project Strategy

The go-to execution strategy and roadmap lives in:

- `UTILIORA_PHASED_APPROACH.md`
