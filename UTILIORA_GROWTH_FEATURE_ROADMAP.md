# Utiliora Growth Feature Roadmap

This file defines the feature set we will implement to maximize:
- repeat usage
- search traffic growth
- session depth
- monetization quality without degrading UX

## North-Star Metrics

- Monthly organic sessions
- Return user rate (7-day, 30-day)
- Pages per session
- Tool completion rate
- Affiliate click-through rate by page
- Revenue per 1,000 sessions

## Priority Stack

## P0: High-Intent Traffic + Utility Depth (Immediate)

Status: `In progress`

1. SEO Publishing Toolkit
- HTML Beautifier
- XML Sitemap Generator
- Robots.txt Generator
- Structured data validator (next)
- Internal-link map helper (next)

2. PDF Power Suite
- Image to PDF
- PDF to JPG
- PDF merge/split
- PDF compress
- Watermark + page reorder

3. Image Workflow Suite
- Image cropper
- Background remover
- Batch resize/compress/convert
- Barcode generator

4. Developer Diagnostics Cluster
- DNS lookup
- SSL certificate checker
- WHOIS quick lookup
- DNS propagation checker

5. Workflow Chaining
- Tool-to-tool handoff (example: resize -> compress -> webp)
- Save reusable workflows
- One-click rerun from history

## P1: Retention + Shareability

Status: `Planned`

1. Personal workspace layer (local-first)
- Saved presets for all major tools
- Recent files and recent runs
- Shareable output links where safe

2. Team-ready productivity upgrades
- Resume Builder template packs
- Invoice templates + reminders + status tags
- Notes template gallery + quick export formats

3. Viral loops
- "Copy link with prefilled config" across key tools
- "Open in next tool" suggestions after results
- Comparison mode for before/after outputs

## P2: Monetization That Preserves UX

Status: `Planned`

1. Ad quality rollout
- Replace placeholders with measured placements
- Tune density per category using Core Web Vitals guardrails

2. Affiliate optimization
- Contextual offers on all relevant tool pages
- Per-page CTR tracking
- Offer rotation every 2 weeks based on EPC

3. Premium tier (optional)
- Ad-free experience
- Batch processing limits raised
- API access + faster processing queue

## Platform-Level Enhancements

Status: `Planned`

1. Analytics + admin
- Page-level tool usage
- Search queries and no-result searches
- Bounce/engagement by tool
- Affiliate and ad performance by page

2. SEO scale engine
- Programmatic supporting pages per tool intent
- Unique long-form content blocks on priority tools
- FAQ + schema enrichment

3. Trust and quality
- Visible privacy stance per tool
- Better error states and fallback UX
- Automated logic tests for calculators/converters

## Execution Order (Current Sprint -> Next)

1. Implement `HTML Beautifier`, `XML Sitemap Generator`, `Robots.txt Generator` in SEO tools.
2. Implement `DNS Lookup` and `SSL Checker` in developer tools.
3. Implement `Image Cropper` and `Barcode Generator` in image tools.
4. Implement `Image to PDF` and `PDF to JPG` converters.
5. Implement workflow chaining across image + document tools.
6. Integrate analytics + monetization instrumentation upgrades.

## Current Sprint Log

- Added this roadmap file.
- Started implementation of the first P0 SEO toolkit tools.
- Shipped `HTML Beautifier`, `XML Sitemap Generator`, and `Robots.txt Generator`.
- Shipped `DNS Lookup` with multi-record queries, resolver selection, DMARC/SPF insights, history, and CSV/JSON export.
- Shipped `SSL Checker` with TLS protocol/cipher details, certificate chain analysis, SAN visibility, expiry risk status, and export support.
- Enhanced `DNS Lookup` with cross-resolver comparison (Google vs Cloudflare) and difference reporting per record type.
- Enhanced `SSL Checker` with hostname coverage validation (SAN/CN), TLS risk scoring (`A-F`), and AIA/extended-key-usage visibility.
- Shipped `Image Cropper` with ratio presets, locked aspect controls, scaling, output format/quality tuning, and live preview/download.
- Shipped `Barcode Generator` with multi-format support (CODE128/CODE39/EAN/UPC/ITF), batch values, styling controls, and CSV/PNG export.
- Shipped `Image to PDF Converter` with multi-image ordering, page size modes (A4/Letter/Legal/fit), margin and quality controls, and direct PDF download.
- Shipped `PDF to JPG Converter` with page-range parsing, scale/quality tuning, per-page previews, and single/all-page JPG download.
- Started `Workflow Chaining` with image handoff between tools (resize/compress/convert/crop/pdf) using one-click "Send to next tool" actions.
- Shipped `Structured Data Validator` for JSON-LD/schema checks with required-field warnings, block-level issue reports, and formatted export.
- Shipped `Internal Link Map Helper` to parse HTML anchors, classify internal vs external links, and export internal-link CSV maps.
- Shipped `WHOIS Lookup` with registrar/contact extraction, domain lifecycle dates, DNSSEC/status insights, and RDAP-backed history/export.
- Shipped `DNS Propagation Checker` comparing major public resolvers with consensus scoring, mismatch surfacing, and check history.
- Deepened `Workflow Chaining` with saved reusable multi-step workflows, workflow run history, and one-click rerun from history in image processing tools.
