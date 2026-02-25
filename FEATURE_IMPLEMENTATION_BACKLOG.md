# Utiliora Feature Implementation Backlog

## Goal
Ship high-traffic tools in a strict one-by-one sequence, starting with the fastest wins and then moving to heavier engineering features.

## Delivery Rules
1. Build one feature fully before starting the next.
2. Each feature must include:
   - Tool definition (`src/lib/tools.ts`)
   - Type wiring (`src/lib/types.ts`)
   - Tool UI wiring (`src/components/ToolRenderer.tsx`)
   - Core logic (`src/lib/*`)
   - Mobile check and route validation
3. After each feature: run build, verify route, then commit.

## Priority Queue
| # | Feature | Category | Traffic Intent | Status |
|---|---|---|---|---|
| 1 | Age Calculator | Calculators | Very high long-tail search demand | Done |
| 2 | Date Difference Calculator | Calculators | High recurring search demand | Done |
| 3 | Time Zone Converter | Productivity/Developer | High global remote-work demand | Done |
| 4 | Meeting Time Planner | Productivity | Team scheduling demand | Done |
| 5 | PDF Merge | Image/PDF | Very high utility demand | Done |
| 6 | PDF Split | Image/PDF | Very high utility demand | Done |
| 7 | PDF Compressor | Image/PDF | Very high utility demand | Done |
| 8 | PDF to Word Converter | Image/PDF | Very high conversion intent | Done |
| 9 | Word to PDF Converter | Image/PDF | Very high conversion intent | Done |
| 10 | Internet Speed Test | Developer/Utility | Massive evergreen demand | Done |
| 11 | AI Detector | SEO/Content | Strong current demand | Done |
| 12 | Plagiarism Checker | SEO/Content | Strong student/content demand | Done |
| 13 | Background Remover | Image Tools | Very high creator/ecommerce demand | Planned |
| 14 | Text Translator | Productivity/SEO | Massive multilingual demand | Planned |
| 15 | Document Translator | Productivity | High practical workflow demand | Planned |
| 16 | Auto Loan Calculator | Calculators | High financial intent traffic | Planned |
| 17 | Debt-to-Income (DTI) Calculator | Calculators | Mortgage/loan funnel demand | Done |
| 18 | Refinance Calculator | Calculators | High-value finance traffic | Planned |

## Current Build Sprint
- Completed feature: `Age Calculator` (`/calculators/age-calculator`)
- Completed feature: `Date Difference Calculator` (`/calculators/date-difference-calculator`)
- Completed feature: `Time Zone Converter` (`/developer-tools/time-zone-converter`)
- Completed feature: `Meeting Time Planner` (`/productivity-tools/meeting-time-planner`)
- Completed feature: `PDF Merge` (`/image-tools/pdf-merge`)
- Completed feature: `PDF Split` (`/image-tools/pdf-split`)
- Completed feature: `PDF Compressor` (`/image-tools/pdf-compressor`)
- Completed feature: `PDF to Word Converter` (`/image-tools/pdf-to-word-converter`)
- Completed feature: `Word to PDF Converter` (`/image-tools/word-to-pdf-converter`)
- Completed feature: `Internet Speed Test` (`/developer-tools/internet-speed-test`)
- Completed feature: `AI Detector` (`/seo-tools/ai-detector`)
- Completed feature: `Plagiarism Checker` (`/seo-tools/plagiarism-checker`)
- Completed feature: `Debt-to-Income (DTI) Calculator` (`/calculators/debt-to-income-calculator`)
- Active next feature: `Background Remover`
