export const CATEGORY_ORDER = [
  "calculators",
  "converters",
  "seo-tools",
  "image-tools",
  "developer-tools",
  "productivity-tools",
] as const;

export type ToolCategorySlug = (typeof CATEGORY_ORDER)[number];

export interface ToolCategory {
  slug: ToolCategorySlug;
  title: string;
  shortTitle: string;
  description: string;
}

export interface ToolFaq {
  question: string;
  answer: string;
}

export interface AffiliateOffer {
  label: string;
  headline?: string;
  description: string;
  ctaLabel?: string;
  url: string;
}

export type CalculatorId =
  | "loan-emi-calculator"
  | "auto-loan-calculator"
  | "refinance-calculator"
  | "mortgage-calculator"
  | "debt-to-income-calculator"
  | "compound-interest-calculator"
  | "simple-interest-calculator"
  | "inflation-calculator"
  | "currency-converter-calculator"
  | "crypto-profit-calculator"
  | "credit-card-payoff-calculator"
  | "salary-after-tax-calculator"
  | "roi-calculator"
  | "profit-margin-calculator"
  | "markup-calculator"
  | "vat-calculator"
  | "bmi-calculator"
  | "body-fat-calculator"
  | "calorie-needs-calculator"
  | "water-intake-calculator"
  | "age-calculator"
  | "date-difference-calculator"
  | "pregnancy-due-date-calculator"
  | "savings-goal-calculator"
  | "break-even-calculator"
  | "startup-cost-estimator"
  | "freelance-rate-calculator";

export type UnitQuantity =
  | "length"
  | "weight"
  | "temperature"
  | "area"
  | "volume"
  | "speed"
  | "time"
  | "data-storage"
  | "pressure"
  | "energy";

export type NumberConverterMode =
  | "binary-decimal"
  | "decimal-hex"
  | "roman"
  | "number-to-words";

export type TextToolId =
  | "word-counter"
  | "character-counter"
  | "keyword-density-checker"
  | "slug-generator"
  | "meta-tag-generator"
  | "open-graph-generator"
  | "html-beautifier"
  | "json-formatter"
  | "xml-sitemap-generator"
  | "robots-txt-generator"
  | "structured-data-validator"
  | "internal-link-map-helper"
  | "css-minifier"
  | "js-minifier"
  | "base64-encoder-decoder"
  | "policy-generator-suite"
  | "adsense-readiness-auditor"
  | "keyword-clustering-tool"
  | "resume-checker"
  | "ai-detector"
  | "ai-humanizer"
  | "paraphrasing-tool"
  | "plagiarism-checker"
  | "password-generator"
  | "lorem-ipsum-generator";

export type DeveloperToolId =
  | "uuid-generator"
  | "url-encoder-decoder"
  | "timestamp-converter"
  | "time-zone-converter"
  | "internet-speed-test"
  | "markdown-to-html"
  | "user-agent-checker"
  | "ip-address-checker"
  | "cron-expression-generator"
  | "http-status-checker"
  | "dns-lookup"
  | "ssl-checker"
  | "whois-lookup"
  | "dns-propagation-checker";

export type ImageToolId =
  | "qr-code-generator"
  | "color-picker"
  | "hex-rgb-converter"
  | "background-remover"
  | "image-resizer"
  | "image-compressor"
  | "jpg-to-png"
  | "png-to-webp"
  | "image-cropper"
  | "barcode-generator"
  | "image-to-pdf"
  | "pdf-editor"
  | "pdf-merge"
  | "pdf-split"
  | "pdf-compressor"
  | "pdf-to-word"
  | "word-to-pdf"
  | "pdf-to-jpg";

export type ProductivityToolId =
  | "pomodoro-timer"
  | "meeting-time-planner"
  | "simple-todo-list"
  | "notes-pad"
  | "text-translator"
  | "document-translator"
  | "resume-builder"
  | "job-application-kit-builder"
  | "ocr-workbench"
  | "invoice-generator";

export type ToolEngine =
  | { kind: "calculator"; id: CalculatorId }
  | { kind: "unit-converter"; quantity: UnitQuantity }
  | { kind: "number-converter"; mode: NumberConverterMode }
  | { kind: "text-tool"; id: TextToolId }
  | { kind: "developer-tool"; id: DeveloperToolId }
  | { kind: "image-tool"; id: ImageToolId }
  | { kind: "productivity-tool"; id: ProductivityToolId };

export interface ToolDefinition {
  slug: string;
  category: ToolCategorySlug;
  title: string;
  summary: string;
  description: string;
  keywords: string[];
  engine: ToolEngine;
  faq: ToolFaq[];
  affiliate?: AffiliateOffer;
}
