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
| 7 | PDF Compressor | Image/PDF | Very high utility demand | Planned |
| 8 | PDF to Word Converter | Image/PDF | Very high conversion intent | Planned |
| 9 | Word to PDF Converter | Image/PDF | Very high conversion intent | Planned |
| 10 | Internet Speed Test | Developer/Utility | Massive evergreen demand | Planned |
| 11 | AI Detector | SEO/Content | Strong current demand | Planned |
| 12 | Plagiarism Checker | SEO/Content | Strong student/content demand | Planned |
| 13 | Background Remover | Image Tools | Very high creator/ecommerce demand | Planned |
| 14 | Text Translator | Productivity/SEO | Massive multilingual demand | Planned |
| 15 | Document Translator | Productivity | High practical workflow demand | Planned |
| 16 | Auto Loan Calculator | Calculators | High financial intent traffic | Planned |
| 17 | Debt-to-Income (DTI) Calculator | Calculators | Mortgage/loan funnel demand | Planned |
| 18 | Refinance Calculator | Calculators | High-value finance traffic | Planned |

## Current Build Sprint
- Completed feature: `Age Calculator` (`/calculators/age-calculator`)
- Completed feature: `Date Difference Calculator` (`/calculators/date-difference-calculator`)
- Completed feature: `Time Zone Converter` (`/developer-tools/time-zone-converter`)
- Completed feature: `Meeting Time Planner` (`/productivity-tools/meeting-time-planner`)
- Completed feature: `PDF Merge` (`/image-tools/pdf-merge`)
- Completed feature: `PDF Split` (`/image-tools/pdf-split`)
- Active next feature: `PDF Compressor`
