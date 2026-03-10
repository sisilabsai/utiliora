import { getToolByCategoryAndSlug } from "@/lib/tools";
import type { ToolCategorySlug, ToolDefinition } from "@/lib/types";

interface ToolKey {
  category: ToolCategorySlug;
  slug: string;
}

export interface WorkflowBundleDefinition {
  slug: string;
  title: string;
  summary: string;
  audience: string;
  outcome: string;
  toolKeys: readonly ToolKey[];
}

export interface ResolvedWorkflowBundle extends WorkflowBundleDefinition {
  tools: ToolDefinition[];
}

const HERO_TOOL_KEYS: readonly ToolKey[] = [
  { category: "calculators", slug: "age-calculator" },
  { category: "calculators", slug: "bmi-calculator" },
  { category: "calculators", slug: "body-fat-calculator" },
  { category: "calculators", slug: "water-intake-calculator" },
  { category: "seo-tools", slug: "meta-tag-generator" },
  { category: "seo-tools", slug: "adsense-readiness-auditor" },
  { category: "developer-tools", slug: "accessibility-auditor-fix-planner" },
  { category: "image-tools", slug: "background-remover" },
  { category: "branding-tools", slug: "business-cards-design" },
  { category: "productivity-tools", slug: "bank-statement-normalizer-expense-intelligence" },
] as const;

const TOOL_NEXT_STEP_MAP: Readonly<Record<string, ToolKey>> = {
  "seo-tools/meta-tag-generator": { category: "seo-tools", slug: "adsense-readiness-auditor" },
  "seo-tools/adsense-readiness-auditor": { category: "developer-tools", slug: "accessibility-auditor-fix-planner" },
  "developer-tools/accessibility-auditor-fix-planner": { category: "seo-tools", slug: "meta-tag-generator" },
  "image-tools/background-remover": { category: "branding-tools", slug: "business-cards-design" },
  "branding-tools/business-cards-design": { category: "image-tools", slug: "barcode-generator" },
  "productivity-tools/bank-statement-normalizer-expense-intelligence": {
    category: "productivity-tools",
    slug: "csv-cleanup-mapping-studio",
  },
  "productivity-tools/csv-cleanup-mapping-studio": {
    category: "productivity-tools",
    slug: "bank-statement-normalizer-expense-intelligence",
  },
  "productivity-tools/document-compare-redline": {
    category: "productivity-tools",
    slug: "pdf-form-filler-signature-pack",
  },
  "productivity-tools/pdf-form-filler-signature-pack": {
    category: "productivity-tools",
    slug: "document-compare-redline",
  },
  "calculators/body-fat-calculator": { category: "calculators", slug: "water-intake-calculator" },
  "calculators/bmi-calculator": { category: "calculators", slug: "body-fat-calculator" },
  "calculators/age-calculator": { category: "calculators", slug: "date-difference-calculator" },
} as const;

const WORKFLOW_BUNDLE_DEFINITIONS: readonly WorkflowBundleDefinition[] = [
  {
    slug: "website-launch-kit",
    title: "Website Launch Kit",
    summary: "Tighten metadata, trust, accessibility, and crawl readiness before you publish or apply for monetization.",
    audience: "Founders, marketers, indie hackers, publishers",
    outcome: "A launch-ready site with stronger search visibility, trust, and compliance signals.",
    toolKeys: [
      { category: "seo-tools", slug: "meta-tag-generator" },
      { category: "seo-tools", slug: "adsense-readiness-auditor" },
      { category: "developer-tools", slug: "accessibility-auditor-fix-planner" },
      { category: "seo-tools", slug: "xml-sitemap-generator" },
      { category: "seo-tools", slug: "robots-txt-generator" },
    ],
  },
  {
    slug: "creator-visual-kit",
    title: "Creator Visual Kit",
    summary: "Turn raw visuals into clean, publish-ready brand and listing assets without leaving the browser.",
    audience: "Creators, ecommerce sellers, freelancers, social teams",
    outcome: "Cleaner assets, faster social production, and better conversion-ready visuals.",
    toolKeys: [
      { category: "image-tools", slug: "background-remover" },
      { category: "image-tools", slug: "image-resizer" },
      { category: "image-tools", slug: "image-compressor" },
      { category: "branding-tools", slug: "business-cards-design" },
      { category: "image-tools", slug: "barcode-generator" },
    ],
  },
  {
    slug: "freelancer-ops-kit",
    title: "Freelancer Ops Kit",
    summary: "Move from messy client paperwork to cleaner proposals, invoices, and signed documents.",
    audience: "Freelancers, consultants, agencies, service businesses",
    outcome: "A lighter admin workflow with faster quoting, cleaner docs, and less manual cleanup.",
    toolKeys: [
      { category: "productivity-tools", slug: "invoice-generator" },
      { category: "productivity-tools", slug: "receipt-invoice-extractor" },
      { category: "productivity-tools", slug: "document-compare-redline" },
      { category: "productivity-tools", slug: "pdf-form-filler-signature-pack" },
    ],
  },
  {
    slug: "money-clarity-kit",
    title: "Money Clarity Kit",
    summary: "Normalize statements, compare remittance routes, and make spending patterns easier to act on.",
    audience: "Households, operators, finance admins, remote workers",
    outcome: "Clearer money movement, fewer hidden fees, and cleaner records.",
    toolKeys: [
      { category: "productivity-tools", slug: "bank-statement-normalizer-expense-intelligence" },
      { category: "productivity-tools", slug: "csv-cleanup-mapping-studio" },
      { category: "productivity-tools", slug: "remittance-fx-comparator" },
      { category: "calculators", slug: "currency-converter-calculator" },
    ],
  },
  {
    slug: "job-application-kit",
    title: "Job Application Kit",
    summary: "Build the resume, job-fit analysis, and outreach assets needed for a tighter application process.",
    audience: "Job seekers, career switchers, students",
    outcome: "A stronger, faster application workflow with ATS alignment and reusable assets.",
    toolKeys: [
      { category: "productivity-tools", slug: "job-application-kit-builder" },
      { category: "productivity-tools", slug: "resume-builder" },
      { category: "seo-tools", slug: "resume-checker" },
      { category: "productivity-tools", slug: "document-translator" },
    ],
  },
] as const;

function resolveTool(key: ToolKey): ToolDefinition {
  const tool = getToolByCategoryAndSlug(key.category, key.slug);
  if (!tool) {
    throw new Error(`Growth configuration references missing tool: ${key.category}/${key.slug}`);
  }
  return tool;
}

function toCompositeKey(tool: Pick<ToolDefinition, "category" | "slug"> | ToolKey): string {
  return `${tool.category}/${tool.slug}`;
}

export function getHeroTools(): ToolDefinition[] {
  return HERO_TOOL_KEYS.map(resolveTool);
}

export function isHeroTool(tool: Pick<ToolDefinition, "category" | "slug">): boolean {
  const key = toCompositeKey(tool);
  return HERO_TOOL_KEYS.some((entry) => toCompositeKey(entry) === key);
}

export function getToolPrimaryNextStep(tool: Pick<ToolDefinition, "category" | "slug">): ToolDefinition | null {
  const next = TOOL_NEXT_STEP_MAP[toCompositeKey(tool)];
  if (!next) return null;
  return resolveTool(next);
}

export function getWorkflowBundles(): ResolvedWorkflowBundle[] {
  return WORKFLOW_BUNDLE_DEFINITIONS.map((bundle) => ({
    ...bundle,
    tools: bundle.toolKeys.map(resolveTool),
  }));
}

export function getWorkflowBundleBySlug(slug: string): ResolvedWorkflowBundle | null {
  const bundle = WORKFLOW_BUNDLE_DEFINITIONS.find((entry) => entry.slug === slug);
  if (!bundle) return null;
  return {
    ...bundle,
    tools: bundle.toolKeys.map(resolveTool),
  };
}

export function getWorkflowBundlesForTool(tool: Pick<ToolDefinition, "category" | "slug">): ResolvedWorkflowBundle[] {
  const key = toCompositeKey(tool);
  return getWorkflowBundles().filter((bundle) => bundle.tools.some((entry) => toCompositeKey(entry) === key));
}
