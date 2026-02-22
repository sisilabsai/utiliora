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

## Project Strategy

The go-to execution strategy and roadmap lives in:

- `UTILIORA_PHASED_APPROACH.md`
