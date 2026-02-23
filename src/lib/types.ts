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
  description: string;
  url: string;
}

export type CalculatorId =
  | "loan-emi-calculator"
  | "mortgage-calculator"
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
  | "css-minifier"
  | "js-minifier"
  | "base64-encoder-decoder"
  | "password-generator"
  | "lorem-ipsum-generator";

export type DeveloperToolId =
  | "uuid-generator"
  | "url-encoder-decoder"
  | "timestamp-converter"
  | "markdown-to-html"
  | "user-agent-checker"
  | "ip-address-checker"
  | "cron-expression-generator"
  | "http-status-checker"
  | "dns-lookup"
  | "ssl-checker";

export type ImageToolId =
  | "qr-code-generator"
  | "color-picker"
  | "hex-rgb-converter"
  | "image-resizer"
  | "image-compressor"
  | "jpg-to-png"
  | "png-to-webp"
  | "image-cropper"
  | "barcode-generator"
  | "image-to-pdf"
  | "pdf-to-jpg";

export type ProductivityToolId =
  | "pomodoro-timer"
  | "simple-todo-list"
  | "notes-pad"
  | "resume-builder"
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
