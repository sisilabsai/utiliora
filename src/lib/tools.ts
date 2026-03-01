import { getCategory } from "@/lib/categories";
import type { ToolDefinition, ToolFaq, ToolCategorySlug } from "@/lib/types";

function baseFaq(title: string): ToolFaq[] {
  return [
    {
      question: `Is ${title} free to use?`,
      answer: `${title} is available for free and works directly in your browser.`,
    },
    {
      question: `Does ${title} store my input data?`,
      answer:
        "Inputs are processed client-side whenever possible. Server-side checks are only used for network diagnostics and are not stored.",
    },
    {
      question: `Can I use ${title} on mobile?`,
      answer: "Yes. The interface is responsive and optimized for phones, tablets, and desktop devices.",
    },
  ];
}

const calculators: ToolDefinition[] = [
  {
    slug: "loan-emi-calculator",
    category: "calculators",
    title: "Loan EMI Calculator",
    summary: "Calculate monthly loan installments, total interest, and total repayment.",
    description:
      "Estimate monthly EMI for personal, home, or business loans with accurate principal, tenure, and interest inputs.",
    keywords: ["loan emi calculator", "monthly emi", "loan repayment calculator"],
    engine: { kind: "calculator", id: "loan-emi-calculator" },
    faq: baseFaq("Loan EMI Calculator"),
  },
  {
    slug: "auto-loan-calculator",
    category: "calculators",
    title: "Auto Loan Calculator",
    summary: "Estimate monthly car payments with tax, trade-in, fees, and total financing cost.",
    description:
      "Calculate realistic auto-loan payments by combining vehicle price, down payment, trade-in credit, taxes, dealer fees, APR, and term.",
    keywords: ["auto loan calculator", "car payment calculator", "vehicle financing calculator"],
    engine: { kind: "calculator", id: "auto-loan-calculator" },
    faq: baseFaq("Auto Loan Calculator"),
  },
  {
    slug: "refinance-calculator",
    category: "calculators",
    title: "Refinance Calculator",
    summary: "Compare current loan vs refinance terms with break-even timing and lifetime savings.",
    description:
      "Evaluate refinancing by comparing payment, total remaining cost, closing costs, and break-even period under new rate and term assumptions.",
    keywords: ["refinance calculator", "mortgage refinance", "loan refinance break even"],
    engine: { kind: "calculator", id: "refinance-calculator" },
    faq: baseFaq("Refinance Calculator"),
  },
  {
    slug: "mortgage-calculator",
    category: "calculators",
    title: "Mortgage Calculator",
    summary: "Plan monthly mortgage payments including taxes, insurance, and HOA.",
    description:
      "Estimate principal and interest payments plus housing extras to see your all-in monthly mortgage cost.",
    keywords: ["mortgage calculator", "home loan payment", "monthly mortgage payment"],
    engine: { kind: "calculator", id: "mortgage-calculator" },
    faq: baseFaq("Mortgage Calculator"),
  },
  {
    slug: "debt-to-income-calculator",
    category: "calculators",
    title: "Debt-to-Income (DTI) Calculator",
    summary: "Calculate front-end and back-end DTI ratios with lender-style affordability thresholds.",
    description:
      "Estimate debt-to-income ratio using housing and monthly debt obligations, then compare against common underwriting limits.",
    keywords: ["debt-to-income calculator", "dti calculator", "mortgage dti", "loan affordability calculator"],
    engine: { kind: "calculator", id: "debt-to-income-calculator" },
    faq: baseFaq("Debt-to-Income (DTI) Calculator"),
  },
  {
    slug: "compound-interest-calculator",
    category: "calculators",
    title: "Compound Interest Calculator",
    summary: "Forecast investment growth with compounding frequency and annual return.",
    description:
      "Model long-term savings outcomes by adjusting initial principal, rate, years, and compounding periods.",
    keywords: ["compound interest", "investment growth calculator", "future value"],
    engine: { kind: "calculator", id: "compound-interest-calculator" },
    faq: baseFaq("Compound Interest Calculator"),
  },
  {
    slug: "simple-interest-calculator",
    category: "calculators",
    title: "Simple Interest Calculator",
    summary: "Compute total simple interest and maturity amount in seconds.",
    description: "Quickly calculate simple interest based on principal, annual rate, and time period.",
    keywords: ["simple interest calculator", "interest formula"],
    engine: { kind: "calculator", id: "simple-interest-calculator" },
    faq: baseFaq("Simple Interest Calculator"),
  },
  {
    slug: "inflation-calculator",
    category: "calculators",
    title: "Inflation Calculator",
    summary: "See how inflation changes future costs and purchasing power over time.",
    description:
      "Project future price impact from annual inflation and understand how much buying power is lost.",
    keywords: ["inflation calculator", "future value inflation", "purchasing power calculator"],
    engine: { kind: "calculator", id: "inflation-calculator" },
    faq: baseFaq("Inflation Calculator"),
  },
  {
    slug: "currency-converter-calculator",
    category: "calculators",
    title: "Currency Converter Calculator",
    summary: "Convert values between major currencies using your selected exchange rate.",
    description:
      "Estimate converted values with a manual rate and optional conversion fee for transparent planning.",
    keywords: ["currency converter calculator", "fx calculator", "exchange rate calculator"],
    engine: { kind: "calculator", id: "currency-converter-calculator" },
    faq: baseFaq("Currency Converter Calculator"),
  },
  {
    slug: "crypto-profit-calculator",
    category: "calculators",
    title: "Crypto Profit Calculator",
    summary: "Calculate crypto trade profit, ROI, and break-even sell price after fees.",
    description:
      "Model entry and exit prices with trading fees to evaluate profitability before placing trades.",
    keywords: ["crypto profit calculator", "bitcoin roi calculator", "trading profit calculator"],
    engine: { kind: "calculator", id: "crypto-profit-calculator" },
    faq: baseFaq("Crypto Profit Calculator"),
  },
  {
    slug: "credit-card-payoff-calculator",
    category: "calculators",
    title: "Credit Card Payoff Calculator",
    summary: "Estimate debt payoff time, total paid, and interest cost from your payment amount.",
    description:
      "See how long it takes to clear credit card debt and how payment size impacts total interest.",
    keywords: ["credit card payoff calculator", "debt payoff", "credit card interest calculator"],
    engine: { kind: "calculator", id: "credit-card-payoff-calculator" },
    faq: baseFaq("Credit Card Payoff Calculator"),
  },
  {
    slug: "salary-after-tax-calculator",
    category: "calculators",
    title: "Salary After Tax Calculator",
    summary: "Estimate annual and monthly take-home pay after tax, retirement, and deductions.",
    description:
      "Plan personal budgets with net salary projections using federal/state tax and recurring deductions.",
    keywords: ["salary after tax calculator", "take home pay", "net salary calculator"],
    engine: { kind: "calculator", id: "salary-after-tax-calculator" },
    faq: baseFaq("Salary After Tax Calculator"),
  },
  {
    slug: "roi-calculator",
    category: "calculators",
    title: "ROI Calculator",
    summary: "Measure return on investment and net profit for any campaign or project.",
    description: "Compare invested capital against returns and track profitability with a clean ROI output.",
    keywords: ["roi calculator", "return on investment", "profitability calculator"],
    engine: { kind: "calculator", id: "roi-calculator" },
    faq: baseFaq("ROI Calculator"),
  },
  {
    slug: "profit-margin-calculator",
    category: "calculators",
    title: "Profit Margin Calculator",
    summary: "Calculate margin and markup based on cost and selling price.",
    description: "Use this tool to set pricing with clear profit, margin percentage, and markup visibility.",
    keywords: ["profit margin calculator", "markup calculator", "pricing calculator"],
    engine: { kind: "calculator", id: "profit-margin-calculator" },
    faq: baseFaq("Profit Margin Calculator"),
  },
  {
    slug: "markup-calculator",
    category: "calculators",
    title: "Markup Calculator",
    summary: "Set selling price from cost and target markup percentage.",
    description:
      "Calculate selling price, profit per unit, and resulting margin from a chosen markup target.",
    keywords: ["markup calculator", "selling price calculator", "retail pricing"],
    engine: { kind: "calculator", id: "markup-calculator" },
    faq: baseFaq("Markup Calculator"),
  },
  {
    slug: "vat-calculator",
    category: "calculators",
    title: "VAT Calculator",
    summary: "Add VAT to base prices and instantly view tax-inclusive totals.",
    description: "Useful for invoicing, e-commerce pricing, and tax estimation in VAT-enabled regions.",
    keywords: ["vat calculator", "value added tax", "tax inclusive"],
    engine: { kind: "calculator", id: "vat-calculator" },
    faq: baseFaq("VAT Calculator"),
  },
  {
    slug: "bmi-calculator",
    category: "calculators",
    title: "BMI Calculator",
    summary: "Calculate Body Mass Index and receive weight category guidance.",
    description: "Enter weight and height to compute BMI with a standard health category interpretation.",
    keywords: ["bmi calculator", "body mass index", "weight category"],
    engine: { kind: "calculator", id: "bmi-calculator" },
    faq: baseFaq("BMI Calculator"),
  },
  {
    slug: "body-fat-calculator",
    category: "calculators",
    title: "Body Fat Calculator",
    summary: "Estimate body fat percentage and lean mass using body measurements.",
    description:
      "Use the U.S. Navy method to estimate body-fat percentage from waist, neck, height, and weight metrics.",
    keywords: ["body fat calculator", "navy body fat", "body composition calculator"],
    engine: { kind: "calculator", id: "body-fat-calculator" },
    faq: baseFaq("Body Fat Calculator"),
  },
  {
    slug: "calorie-needs-calculator",
    category: "calculators",
    title: "Calorie Needs Calculator",
    summary: "Estimate BMR and maintenance calories by age, weight, and activity level.",
    description: "Plan nutrition targets using a practical calorie estimator based on activity and body metrics.",
    keywords: ["calorie calculator", "bmr calculator", "maintenance calories"],
    engine: { kind: "calculator", id: "calorie-needs-calculator" },
    faq: baseFaq("Calorie Needs Calculator"),
  },
  {
    slug: "water-intake-calculator",
    category: "calculators",
    title: "Water Intake Calculator",
    summary: "Estimate daily hydration needs using body weight and activity.",
    description: "Get a daily water target in ml and liters to support health and performance habits.",
    keywords: ["water intake calculator", "hydration calculator", "daily water needs"],
    engine: { kind: "calculator", id: "water-intake-calculator" },
    faq: baseFaq("Water Intake Calculator"),
  },
  {
    slug: "age-calculator",
    category: "calculators",
    title: "Age Calculator",
    summary: "Calculate exact age in years, months, weeks, and days from date of birth.",
    description:
      "Find current age, total days lived, and next birthday details from your birth date and optional target date.",
    keywords: ["age calculator", "calculate age", "date of birth age", "how old am i"],
    engine: { kind: "calculator", id: "age-calculator" },
    faq: baseFaq("Age Calculator"),
  },
  {
    slug: "date-difference-calculator",
    category: "calculators",
    title: "Date Difference Calculator",
    summary: "Calculate exact time difference between two dates with day, week, month, and business-day totals.",
    description:
      "Compare start and end dates with inclusive/exclusive options and get precise calendar differences for planning and deadlines.",
    keywords: ["date difference calculator", "days between dates", "date duration calculator", "business days calculator"],
    engine: { kind: "calculator", id: "date-difference-calculator" },
    faq: baseFaq("Date Difference Calculator"),
  },
  {
    slug: "pregnancy-due-date-calculator",
    category: "calculators",
    title: "Pregnancy Due Date Calculator",
    summary: "Estimate due date and current pregnancy week from LMP and cycle length.",
    description:
      "Calculate an estimated due date and gestational progress using your last menstrual period details.",
    keywords: ["pregnancy due date calculator", "lmp due date", "gestational age calculator"],
    engine: { kind: "calculator", id: "pregnancy-due-date-calculator" },
    faq: baseFaq("Pregnancy Due Date Calculator"),
  },
  {
    slug: "savings-goal-calculator",
    category: "calculators",
    title: "Savings Goal Calculator",
    summary: "Find the monthly amount needed to hit your future savings target.",
    description:
      "Set a target amount, timeline, and expected return to compute the monthly contribution needed.",
    keywords: ["savings goal calculator", "monthly savings", "financial planning"],
    engine: { kind: "calculator", id: "savings-goal-calculator" },
    faq: baseFaq("Savings Goal Calculator"),
  },
  {
    slug: "break-even-calculator",
    category: "calculators",
    title: "Break-even Calculator",
    summary: "Calculate units and revenue required to break even.",
    description:
      "Use fixed costs, variable costs, and pricing to understand when your business becomes profitable.",
    keywords: ["break-even calculator", "break even point", "business calculator"],
    engine: { kind: "calculator", id: "break-even-calculator" },
    faq: baseFaq("Break-even Calculator"),
  },
  {
    slug: "startup-cost-estimator",
    category: "calculators",
    title: "Startup Cost Estimator",
    summary: "Estimate launch budget using one-time costs, monthly burn, and runway.",
    description:
      "Project total capital needed to launch and operate through your planned runway with contingency.",
    keywords: ["startup cost estimator", "startup budget calculator", "runway calculator"],
    engine: { kind: "calculator", id: "startup-cost-estimator" },
    faq: baseFaq("Startup Cost Estimator"),
  },
  {
    slug: "freelance-rate-calculator",
    category: "calculators",
    title: "Freelance Rate Calculator",
    summary: "Determine a sustainable hourly rate from income goals and billable hours.",
    description: "Set realistic pricing for freelance services based on expenses, profit target, and capacity.",
    keywords: ["freelance rate calculator", "hourly pricing", "consulting rate"],
    engine: { kind: "calculator", id: "freelance-rate-calculator" },
    faq: baseFaq("Freelance Rate Calculator"),
  },
];

const converterDefinitions: ToolDefinition[] = [
  {
    slug: "length-converter",
    category: "converters",
    title: "Length Converter",
    summary: "Convert meters, kilometers, feet, miles, and inches.",
    description: "Convert length units instantly with high precision output.",
    keywords: ["length converter", "meter to feet", "mile to kilometer"],
    engine: { kind: "unit-converter", quantity: "length" },
    faq: baseFaq("Length Converter"),
  },
  {
    slug: "weight-converter",
    category: "converters",
    title: "Weight Converter",
    summary: "Convert kilograms, grams, pounds, and ounces with precision control and live comparison.",
    description:
      "Advanced weight conversion workflow with instant results, all-unit output table, reusable history, and CSV export.",
    keywords: ["weight converter", "kg to lbs", "grams to ounces"],
    engine: { kind: "unit-converter", quantity: "weight" },
    faq: baseFaq("Weight Converter"),
  },
  {
    slug: "temperature-converter",
    category: "converters",
    title: "Temperature Converter",
    summary: "Convert Celsius, Fahrenheit, and Kelvin.",
    description: "Instant temperature conversion with correct scale formulas.",
    keywords: ["temperature converter", "celsius to fahrenheit", "kelvin conversion"],
    engine: { kind: "unit-converter", quantity: "temperature" },
    faq: baseFaq("Temperature Converter"),
  },
  {
    slug: "area-converter",
    category: "converters",
    title: "Area Converter",
    summary: "Convert area between square meters, acres, hectares, and more.",
    description: "Useful for real estate, agriculture, and construction planning.",
    keywords: ["area converter", "acre to sqm", "hectare conversion"],
    engine: { kind: "unit-converter", quantity: "area" },
    faq: baseFaq("Area Converter"),
  },
  {
    slug: "volume-converter",
    category: "converters",
    title: "Volume Converter",
    summary: "Convert liters, gallons, milliliters, cups, and cubic meters.",
    description: "Reliable volume conversions for kitchen, lab, and engineering tasks.",
    keywords: ["volume converter", "liter to gallon", "ml conversion"],
    engine: { kind: "unit-converter", quantity: "volume" },
    faq: baseFaq("Volume Converter"),
  },
  {
    slug: "speed-converter",
    category: "converters",
    title: "Speed Converter",
    summary: "Convert mph, kph, knots, and meters per second.",
    description: "Compare speed values across transportation and physics units.",
    keywords: ["speed converter", "mph to kph", "knot converter"],
    engine: { kind: "unit-converter", quantity: "speed" },
    faq: baseFaq("Speed Converter"),
  },
  {
    slug: "time-converter",
    category: "converters",
    title: "Time Converter",
    summary: "Convert seconds, minutes, hours, days, and weeks.",
    description: "Fast conversions for scheduling, productivity, and engineering calculations.",
    keywords: ["time converter", "minutes to hours", "seconds converter"],
    engine: { kind: "unit-converter", quantity: "time" },
    faq: baseFaq("Time Converter"),
  },
  {
    slug: "data-storage-converter",
    category: "converters",
    title: "Data Storage Converter",
    summary: "Convert bytes, KB, MB, GB, and TB.",
    description: "Accurate binary-based storage conversion for files and infrastructure planning.",
    keywords: ["storage converter", "mb to gb", "byte converter"],
    engine: { kind: "unit-converter", quantity: "data-storage" },
    faq: baseFaq("Data Storage Converter"),
  },
  {
    slug: "pressure-converter",
    category: "converters",
    title: "Pressure Converter",
    summary: "Convert Pa, kPa, bar, atm, and PSI values.",
    description: "Pressure conversion tool for automotive, industrial, and scientific use.",
    keywords: ["pressure converter", "psi to bar", "atm converter"],
    engine: { kind: "unit-converter", quantity: "pressure" },
    faq: baseFaq("Pressure Converter"),
  },
  {
    slug: "energy-converter",
    category: "converters",
    title: "Energy Converter",
    summary: "Convert joules, kilojoules, calories, BTU, and kWh.",
    description: "Convert energy units for appliance, nutrition, and scientific calculations.",
    keywords: ["energy converter", "joule to calorie", "kwh converter"],
    engine: { kind: "unit-converter", quantity: "energy" },
    faq: baseFaq("Energy Converter"),
  },
  {
    slug: "binary-decimal-converter",
    category: "converters",
    title: "Binary-Decimal Converter",
    summary: "Convert between binary and decimal formats.",
    description: "Switch between base-2 and base-10 formats for development workflows.",
    keywords: ["binary to decimal", "decimal to binary", "number base converter"],
    engine: { kind: "number-converter", mode: "binary-decimal" },
    faq: baseFaq("Binary-Decimal Converter"),
  },
  {
    slug: "decimal-hex-converter",
    category: "converters",
    title: "Decimal-Hex Converter",
    summary: "Convert decimal numbers to hexadecimal and back.",
    description: "Useful for programming, color values, and systems work.",
    keywords: ["decimal to hex", "hex to decimal", "hex converter"],
    engine: { kind: "number-converter", mode: "decimal-hex" },
    faq: baseFaq("Decimal-Hex Converter"),
  },
  {
    slug: "roman-numeral-converter",
    category: "converters",
    title: "Roman Numeral Converter",
    summary: "Convert integers to Roman numerals and Roman numerals to integers.",
    description: "Clean conversion for education, publishing, and formatting needs.",
    keywords: ["roman numeral converter", "number to roman", "roman to number"],
    engine: { kind: "number-converter", mode: "roman" },
    faq: baseFaq("Roman Numeral Converter"),
  },
  {
    slug: "number-to-words-converter",
    category: "converters",
    title: "Number to Words Converter",
    summary: "Spell out whole numbers in plain English text.",
    description: "Convert numbers into readable words for checks, invoices, and documents.",
    keywords: ["number to words", "spell number", "numeric to text"],
    engine: { kind: "number-converter", mode: "number-to-words" },
    faq: baseFaq("Number to Words Converter"),
  },
];

const seoTools: ToolDefinition[] = [
  {
    slug: "word-counter",
    category: "seo-tools",
    title: "Word Counter",
    summary: "Count words, sentences, and reading length instantly.",
    description: "Analyze text length for SEO writing, blogs, ads, and product descriptions.",
    keywords: ["word counter", "count words online", "seo word count"],
    engine: { kind: "text-tool", id: "word-counter" },
    faq: baseFaq("Word Counter"),
  },
  {
    slug: "character-counter",
    category: "seo-tools",
    title: "Character Counter",
    summary: "Count characters with or without spaces.",
    description: "Perfect for social posts, metadata limits, and form field constraints.",
    keywords: ["character counter", "count characters", "meta description length"],
    engine: { kind: "text-tool", id: "character-counter" },
    faq: baseFaq("Character Counter"),
  },
  {
    slug: "keyword-density-checker",
    category: "seo-tools",
    title: "Keyword Density Checker",
    summary: "Find top terms and keyword density from any content block.",
    description: "Check lexical frequency to optimize content naturally without overstuffing.",
    keywords: ["keyword density checker", "seo keyword analysis", "content optimization"],
    engine: { kind: "text-tool", id: "keyword-density-checker" },
    faq: baseFaq("Keyword Density Checker"),
  },
  {
    slug: "slug-generator",
    category: "seo-tools",
    title: "Slug Generator",
    summary: "Generate clean URL slugs from titles and headlines.",
    description: "Create search-friendly URLs by normalizing case, spacing, and punctuation.",
    keywords: ["slug generator", "url slug tool", "seo url builder"],
    engine: { kind: "text-tool", id: "slug-generator" },
    faq: baseFaq("Slug Generator"),
  },
  {
    slug: "meta-tag-generator",
    category: "seo-tools",
    title: "Meta Tag Generator",
    summary: "Generate HTML title and meta description tags.",
    description: "Create foundational SEO tags for pages and landing content quickly.",
    keywords: ["meta tag generator", "seo title generator", "meta description tool"],
    engine: { kind: "text-tool", id: "meta-tag-generator" },
    faq: baseFaq("Meta Tag Generator"),
  },
  {
    slug: "open-graph-generator",
    category: "seo-tools",
    title: "Open Graph Generator",
    summary: "Create Open Graph social preview meta tags.",
    description: "Generate OG tags for better link previews on social platforms.",
    keywords: ["open graph generator", "og tags", "social meta tags"],
    engine: { kind: "text-tool", id: "open-graph-generator" },
    faq: baseFaq("Open Graph Generator"),
  },
  {
    slug: "html-beautifier",
    category: "seo-tools",
    title: "HTML Beautifier",
    summary: "Format messy HTML into clean, readable code with adjustable indentation.",
    description:
      "Beautify raw HTML markup for easier debugging, collaboration, and publishing workflows.",
    keywords: ["html beautifier", "format html", "html formatter"],
    engine: { kind: "text-tool", id: "html-beautifier" },
    faq: baseFaq("HTML Beautifier"),
  },
  {
    slug: "json-formatter",
    category: "seo-tools",
    title: "JSON Formatter",
    summary: "Validate and format JSON with readable indentation.",
    description: "Paste raw JSON and output prettified structure for debugging and publishing.",
    keywords: ["json formatter", "json pretty print", "json validator"],
    engine: { kind: "text-tool", id: "json-formatter" },
    faq: baseFaq("JSON Formatter"),
  },
  {
    slug: "xml-sitemap-generator",
    category: "seo-tools",
    title: "XML Sitemap Generator",
    summary: "Generate XML sitemaps from page paths or full URLs in seconds.",
    description:
      "Build valid sitemap.xml files with lastmod, changefreq, and priority controls for technical SEO.",
    keywords: ["xml sitemap generator", "sitemap.xml tool", "seo sitemap builder"],
    engine: { kind: "text-tool", id: "xml-sitemap-generator" },
    faq: baseFaq("XML Sitemap Generator"),
  },
  {
    slug: "robots-txt-generator",
    category: "seo-tools",
    title: "Robots.txt Generator",
    summary: "Create robots.txt rules with allow/disallow, host, and sitemap directives.",
    description:
      "Generate production-ready robots.txt files for crawler control and indexing workflows.",
    keywords: ["robots.txt generator", "robots file builder", "seo crawl control"],
    engine: { kind: "text-tool", id: "robots-txt-generator" },
    faq: baseFaq("Robots.txt Generator"),
  },
  {
    slug: "structured-data-validator",
    category: "seo-tools",
    title: "Structured Data Validator",
    summary: "Validate JSON-LD schema markup with targeted SEO issue checks.",
    description:
      "Paste JSON-LD or script tags to validate schema.org structure, detect missing required fields, and export cleaned markup.",
    keywords: ["structured data validator", "json-ld validator", "schema markup checker"],
    engine: { kind: "text-tool", id: "structured-data-validator" },
    faq: baseFaq("Structured Data Validator"),
  },
  {
    slug: "internal-link-map-helper",
    category: "seo-tools",
    title: "Internal Link Map Helper",
    summary: "Extract and analyze internal/external links from page HTML.",
    description:
      "Parse anchor links, classify internal vs external URLs, detect duplicates, and export internal-link maps for SEO audits.",
    keywords: ["internal link checker", "link map tool", "seo internal links"],
    engine: { kind: "text-tool", id: "internal-link-map-helper" },
    faq: baseFaq("Internal Link Map Helper"),
  },
  {
    slug: "css-minifier",
    category: "seo-tools",
    title: "CSS Minifier",
    summary: "Minify CSS for faster loading and reduced file size.",
    description: "Compress style sheets by removing comments and extra whitespace.",
    keywords: ["css minifier", "compress css", "optimize css"],
    engine: { kind: "text-tool", id: "css-minifier" },
    faq: baseFaq("CSS Minifier"),
  },
  {
    slug: "js-minifier",
    category: "seo-tools",
    title: "JS Minifier",
    summary: "Reduce JavaScript payload size with instant minification.",
    description: "Quickly trim comments and unnecessary spaces for lighter script output.",
    keywords: ["js minifier", "javascript compressor", "minify js"],
    engine: { kind: "text-tool", id: "js-minifier" },
    faq: baseFaq("JS Minifier"),
  },
  {
    slug: "base64-encoder-decoder",
    category: "seo-tools",
    title: "Base64 Encoder/Decoder",
    summary: "Encode text to Base64 and decode Base64 strings.",
    description: "Fast conversion utility for data handling and transfer formats.",
    keywords: ["base64 encoder", "base64 decoder", "text encode decode"],
    engine: { kind: "text-tool", id: "base64-encoder-decoder" },
    faq: baseFaq("Base64 Encoder/Decoder"),
  },
  {
    slug: "policy-generator-suite",
    category: "seo-tools",
    title: "Policy Generator Suite",
    summary: "Generate Privacy Policy, Terms, Cookie Policy, and Disclaimer pages in one workflow.",
    description:
      "Create production-ready website policy pages with editable business details, compliance toggles, and instant export to HTML, Markdown, or text.",
    keywords: [
      "privacy policy generator",
      "terms and conditions generator",
      "cookie policy generator",
      "disclaimer generator",
      "website policy template",
    ],
    engine: { kind: "text-tool", id: "policy-generator-suite" },
    faq: baseFaq("Policy Generator Suite"),
  },
  {
    slug: "adsense-readiness-auditor",
    category: "seo-tools",
    title: "AdSense Readiness Auditor",
    summary: "Audit your site for trust pages, indexability, and technical essentials before AdSense review.",
    description:
      "Run a practical pre-submission audit for About/Contact/Privacy/Terms coverage, robots/sitemap/ads.txt availability, and page quality signals with prioritized fixes.",
    keywords: [
      "adsense readiness checker",
      "adsense approval checklist",
      "adsense rejection fix",
      "ads.txt checker",
      "site quality audit tool",
    ],
    engine: { kind: "text-tool", id: "adsense-readiness-auditor" },
    faq: baseFaq("AdSense Readiness Auditor"),
  },
  {
    slug: "keyword-clustering-tool",
    category: "seo-tools",
    title: "Keyword Clustering Tool",
    summary: "Group keywords into intent-based topical clusters for faster SEO content planning.",
    description:
      "Paste keyword lists to auto-cluster related terms, identify search intent, and generate pillar-topic plans with CSV and markdown exports.",
    keywords: [
      "keyword clustering tool",
      "seo keyword grouping",
      "keyword intent clustering",
      "topic cluster generator",
      "content hub planning tool",
    ],
    engine: { kind: "text-tool", id: "keyword-clustering-tool" },
    faq: baseFaq("Keyword Clustering Tool"),
  },
  {
    slug: "utm-link-builder",
    category: "seo-tools",
    title: "UTM Link Builder",
    summary: "Create campaign-tagged URLs for analytics with bulk generation and CSV export.",
    description:
      "Build clean UTM links for ads, email, and social campaigns, validate destination URLs, and export bulk tagged links for reporting workflows.",
    keywords: [
      "utm builder",
      "campaign url builder",
      "google analytics utm generator",
      "utm link generator",
      "bulk utm builder",
    ],
    engine: { kind: "text-tool", id: "utm-link-builder" },
    faq: baseFaq("UTM Link Builder"),
  },
  {
    slug: "readability-grade-checker",
    category: "seo-tools",
    title: "Readability & Grade Checker",
    summary: "Analyze text readability with grade-level metrics, passive voice detection, and hard-sentence diagnostics.",
    description:
      "Measure reading ease, education-grade complexity, sentence difficulty, and passive voice patterns with practical rewrite priorities and export-ready reports.",
    keywords: [
      "readability checker",
      "flesch reading ease score",
      "grade level checker",
      "passive voice checker",
      "sentence complexity analyzer",
    ],
    engine: { kind: "text-tool", id: "readability-grade-checker" },
    faq: baseFaq("Readability & Grade Checker"),
  },
  {
    slug: "keyword-cannibalization-checker",
    category: "seo-tools",
    title: "Keyword Cannibalization Checker",
    summary: "Detect competing pages targeting the same or overlapping keywords and fix ranking conflicts.",
    description:
      "Analyze URL-keyword maps to surface cannibalization risk, identify overlapping search intent, and prioritize canonical pages with export-ready remediation plans.",
    keywords: [
      "keyword cannibalization checker",
      "seo cannibalization tool",
      "keyword overlap checker",
      "page intent conflict analysis",
      "url keyword mapping audit",
    ],
    engine: { kind: "text-tool", id: "keyword-cannibalization-checker" },
    faq: baseFaq("Keyword Cannibalization Checker"),
  },
  {
    slug: "faq-schema-generator",
    category: "seo-tools",
    title: "FAQ Schema Generator",
    summary: "Generate valid FAQPage JSON-LD markup with copy, validation, and export tools.",
    description:
      "Build structured FAQ schema for SEO rich results by creating question-answer pairs, validating required fields, and exporting clean JSON-LD or HTML script tags.",
    keywords: [
      "faq schema generator",
      "json-ld faq builder",
      "faqpage structured data",
      "schema markup generator",
      "rich results faq schema",
    ],
    engine: { kind: "text-tool", id: "faq-schema-generator" },
    faq: baseFaq("FAQ Schema Generator"),
  },
  {
    slug: "programmatic-meta-description-generator",
    category: "seo-tools",
    title: "Programmatic Meta Description Generator",
    summary: "Generate high-performing meta description variants in bulk with length and keyword scoring.",
    description:
      "Create SEO-focused meta descriptions using page titles, keywords, value propositions, and CTAs with template-based variant generation, quality scoring, and CSV export.",
    keywords: [
      "meta description generator",
      "bulk meta description tool",
      "programmatic seo meta descriptions",
      "serp snippet generator",
      "meta description optimizer",
    ],
    engine: { kind: "text-tool", id: "programmatic-meta-description-generator" },
    faq: baseFaq("Programmatic Meta Description Generator"),
  },
  {
    slug: "resume-checker",
    category: "seo-tools",
    title: "Resume Checker",
    summary: "Score resume ATS readiness, identify weak sections, and get job-targeted improvements.",
    description:
      "Upload or paste your resume to run ATS-focused checks, benchmark keyword alignment against a target job description, and generate stronger role-specific application copy.",
    keywords: [
      "resume checker",
      "ats resume checker",
      "resume score",
      "resume keyword match",
      "resume analyzer",
      "cv checker",
    ],
    engine: { kind: "text-tool", id: "resume-checker" },
    faq: [
      {
        question: "How does the resume checker score ATS readiness?",
        answer:
          "The score combines critical checks like contact completeness, experience bullet quality, keyword alignment, and structure consistency.",
      },
      {
        question: "Can I compare my resume against a specific job description?",
        answer:
          "Yes. Paste a target job description to see matched keywords, missing terms, and improvement opportunities.",
      },
      {
        question: "Can I move the checked resume into the builder for editing?",
        answer:
          "Yes. Use the handoff action to open your analyzed or tailored resume directly in the Resume Builder.",
      },
    ],
  },
  {
    slug: "ai-detector",
    category: "seo-tools",
    title: "AI Detector",
    summary: "Analyze text patterns and estimate AI-likeness using burstiness and repetition signals.",
    description:
      "Run a heuristic AI-writing risk check across sentence variation, lexical diversity, repetition, and punctuation rhythm with actionable rewrite cues.",
    keywords: ["ai detector", "ai content detector", "detect ai writing", "ai text checker"],
    engine: { kind: "text-tool", id: "ai-detector" },
    faq: baseFaq("AI Detector"),
  },
  {
    slug: "ai-humanizer",
    category: "seo-tools",
    title: "AI Human Rewrite Assistant",
    summary:
      "Humanize AI-like drafts with ranked rewrite variants, meaning-preservation scoring, and sentence-level refinement.",
    description:
      "Generate and compare multiple humanized rewrites with style/tone controls, keyword locks, trust metrics, detector-aware auto-fixes, and optional cloud orchestration with local fallback.",
    keywords: [
      "ai humanizer",
      "human rewrite assistant",
      "humanize ai text",
      "rewrite ai content",
      "ai text rewriter",
      "ai humanizer free",
      "humanize ai content online",
      "ai rewrite tool",
    ],
    engine: { kind: "text-tool", id: "ai-humanizer" },
    faq: [
      {
        question: "How is this AI humanizer different from a basic synonym replacer?",
        answer:
          "It generates multiple rewrite variants, scores meaning retention, compares detector signals before/after, and supports sentence-level manual corrections.",
      },
      {
        question: "Will important numbers, links, and quoted text be preserved?",
        answer:
          "Yes. The workflow tracks critical tokens and surfaces a retention score so you can quickly verify sensitive details stayed intact.",
      },
      {
        question: "Can I lock keywords for SEO while rewriting?",
        answer:
          "Yes. In advanced mode you can set keyword locks so exact terms remain unchanged across rewrite variants.",
      },
      {
        question: "Is cloud rewriting required?",
        answer:
          "No. The tool runs with a local rewrite pipeline by default and automatically falls back to local processing if cloud orchestration is unavailable.",
      },
    ],
  },
  {
    slug: "paraphrasing-tool",
    category: "seo-tools",
    title: "Paraphrasing Tool",
    summary: "Generate multiple high-quality rewrites with tone control, keyword locks, and detector-aware quality signals.",
    description:
      "Rewrite drafts into clearer alternatives with adjustable tone, strength, and length while preserving critical terms and comparing before/after quality metrics.",
    keywords: [
      "paraphrasing tool",
      "paraphrase text",
      "rewrite sentence",
      "reword paragraph",
      "text rewriter",
    ],
    engine: { kind: "text-tool", id: "paraphrasing-tool" },
    faq: baseFaq("Paraphrasing Tool"),
  },
  {
    slug: "plagiarism-checker",
    category: "seo-tools",
    title: "Plagiarism Checker",
    summary: "Compare text against multiple sources with phrase-overlap and similarity scoring.",
    description:
      "Check copied or near-copied sections by analyzing n-gram overlap, source-level match percentages, and repeated phrase evidence.",
    keywords: ["plagiarism checker", "duplicate content checker", "content similarity checker", "copied text detector"],
    engine: { kind: "text-tool", id: "plagiarism-checker" },
    faq: baseFaq("Plagiarism Checker"),
  },
  {
    slug: "password-generator",
    category: "seo-tools",
    title: "Password Generator",
    summary: "Create strong random passwords with custom length and symbols.",
    description: "Generate secure passwords for personal, team, and business account security.",
    keywords: ["password generator", "strong password", "random password"],
    engine: { kind: "text-tool", id: "password-generator" },
    faq: baseFaq("Password Generator"),
  },
  {
    slug: "lorem-ipsum-generator",
    category: "seo-tools",
    title: "Lorem Ipsum Generator",
    summary: "Generate clean placeholder text paragraphs for design and drafts.",
    description: "Produce quick Lorem Ipsum content for prototypes and publishing layouts.",
    keywords: ["lorem ipsum generator", "placeholder text", "dummy text"],
    engine: { kind: "text-tool", id: "lorem-ipsum-generator" },
    faq: baseFaq("Lorem Ipsum Generator"),
  },
];

const imageTools: ToolDefinition[] = [
  {
    slug: "qr-code-generator",
    category: "image-tools",
    title: "QR Code Generator",
    summary: "Generate QR codes for links, text, or contact information.",
    description: "Create scannable QR codes with instant download for print and digital use.",
    keywords: ["qr code generator", "qr maker", "generate qr code"],
    engine: { kind: "image-tool", id: "qr-code-generator" },
    faq: baseFaq("QR Code Generator"),
  },
  {
    slug: "color-picker",
    category: "image-tools",
    title: "Color Picker",
    summary: "Pick colors and get instant HEX values.",
    description: "Simple browser-native color picker for designers and front-end teams.",
    keywords: ["color picker", "hex color tool", "select color"],
    engine: { kind: "image-tool", id: "color-picker" },
    faq: baseFaq("Color Picker"),
  },
  {
    slug: "hex-rgb-converter",
    category: "image-tools",
    title: "HEX-RGB Converter",
    summary: "Convert colors between HEX and RGB formats.",
    description: "Convert brand colors across CSS and design tool conventions.",
    keywords: ["hex to rgb", "rgb to hex", "color converter"],
    engine: { kind: "image-tool", id: "hex-rgb-converter" },
    faq: baseFaq("HEX-RGB Converter"),
  },
  {
    slug: "background-remover",
    category: "image-tools",
    title: "Background Remover",
    summary: "Remove image backgrounds in-browser with AI edge segmentation and transparent export.",
    description:
      "Use open-source in-browser background removal to isolate subjects, export transparent PNG/WebP output, and continue editing workflows without server uploads.",
    keywords: ["background remover", "remove background from image", "transparent png", "ai background removal"],
    engine: { kind: "image-tool", id: "background-remover" },
    faq: baseFaq("Background Remover"),
  },
  {
    slug: "image-resizer",
    category: "image-tools",
    title: "Image Resizer",
    summary: "Resize images by width while preserving aspect ratio.",
    description: "Client-side image resizing with downloadable output and no server upload required.",
    keywords: ["image resizer", "resize photo online", "client-side image resize"],
    engine: { kind: "image-tool", id: "image-resizer" },
    faq: baseFaq("Image Resizer"),
    affiliate: {
      label: "Canva Pro",
      description: "Need advanced editing templates and collaborative design workflows?",
      url: "https://www.canva.com/",
    },
  },
  {
    slug: "image-compressor",
    category: "image-tools",
    title: "Image Compressor",
    summary: "Compress image files client-side using quality controls.",
    description: "Reduce image size for faster websites, better SEO, and improved upload speeds.",
    keywords: ["image compressor", "compress image online", "reduce image size"],
    engine: { kind: "image-tool", id: "image-compressor" },
    faq: baseFaq("Image Compressor"),
  },
  {
    slug: "jpg-to-png-converter",
    category: "image-tools",
    title: "JPG to PNG Converter",
    summary: "Convert JPG files to PNG format in-browser.",
    description: "Quick conversion workflow for assets requiring PNG output.",
    keywords: ["jpg to png", "image format converter", "convert jpeg png"],
    engine: { kind: "image-tool", id: "jpg-to-png" },
    faq: baseFaq("JPG to PNG Converter"),
  },
  {
    slug: "png-to-webp-converter",
    category: "image-tools",
    title: "PNG to WebP Converter",
    summary: "Convert PNG images to lightweight WebP format.",
    description: "Optimize images for performance and SEO by reducing transfer size with WebP.",
    keywords: ["png to webp", "convert webp", "image optimization"],
    engine: { kind: "image-tool", id: "png-to-webp" },
    faq: baseFaq("PNG to WebP Converter"),
  },
  {
    slug: "image-cropper",
    category: "image-tools",
    title: "Image Cropper",
    summary: "Crop images with aspect presets, precision controls, and live output preview.",
    description:
      "Crop image regions client-side with fixed ratio presets, scaling options, output format control, and instant download.",
    keywords: ["image cropper", "crop image online", "photo crop tool"],
    engine: { kind: "image-tool", id: "image-cropper" },
    faq: baseFaq("Image Cropper"),
  },
  {
    slug: "barcode-generator",
    category: "image-tools",
    title: "Barcode Generator",
    summary: "Generate barcodes in multiple formats with batch input and export controls.",
    description:
      "Create production-ready barcodes for products, labels, and logistics with format options, styling controls, and downloadable PNG output.",
    keywords: ["barcode generator", "code128 generator", "ean13 barcode", "upc barcode"],
    engine: { kind: "image-tool", id: "barcode-generator" },
    faq: baseFaq("Barcode Generator"),
  },
  {
    slug: "image-to-pdf-converter",
    category: "image-tools",
    title: "Image to PDF Converter",
    summary: "Combine one or many images into a downloadable PDF document.",
    description:
      "Build polished PDF files from JPG, PNG, or WebP images with page-size controls, margins, ordering, and quick export.",
    keywords: ["image to pdf", "jpg to pdf", "png to pdf", "convert image to pdf"],
    engine: { kind: "image-tool", id: "image-to-pdf" },
    faq: baseFaq("Image to PDF Converter"),
  },
  {
    slug: "pdf-editor",
    category: "image-tools",
    title: "PDF Editor",
    summary: "Edit PDF page order, rotation, and overlays, then export an updated PDF.",
    description:
      "Reorder, rotate, duplicate, remove, watermark, and number PDF pages with in-browser processing and downloadable output.",
    keywords: ["pdf editor", "edit pdf pages", "reorder pdf pages", "rotate pdf pages", "watermark pdf"],
    engine: { kind: "image-tool", id: "pdf-editor" },
    faq: baseFaq("PDF Editor"),
  },
  {
    slug: "pdf-merge",
    category: "image-tools",
    title: "PDF Merge",
    summary: "Merge multiple PDF files into one downloadable PDF in your browser.",
    description:
      "Combine PDF documents in your preferred order with page-count validation and client-side export.",
    keywords: ["pdf merge", "merge pdf files", "combine pdf", "pdf merger"],
    engine: { kind: "image-tool", id: "pdf-merge" },
    faq: baseFaq("PDF Merge"),
  },
  {
    slug: "pdf-split",
    category: "image-tools",
    title: "PDF Split",
    summary: "Split PDFs by custom page range, chunk size, or single-page exports.",
    description:
      "Extract selected pages or split a PDF into multiple files with range, single-page, and fixed-chunk modes.",
    keywords: ["pdf split", "split pdf pages", "extract pages from pdf", "pdf page splitter"],
    engine: { kind: "image-tool", id: "pdf-split" },
    faq: baseFaq("PDF Split"),
  },
  {
    slug: "pdf-compressor",
    category: "image-tools",
    title: "PDF Compressor",
    summary: "Compress PDF files in-browser with quality and scale controls.",
    description:
      "Reduce PDF file size by re-rendering pages with adjustable quality, scale, and grayscale options before downloading a compressed copy.",
    keywords: ["pdf compressor", "compress pdf", "reduce pdf size", "pdf optimization"],
    engine: { kind: "image-tool", id: "pdf-compressor" },
    faq: baseFaq("PDF Compressor"),
  },
  {
    slug: "pdf-to-word-converter",
    category: "image-tools",
    title: "PDF to Word Converter",
    summary: "Convert PDF text into an editable Word-compatible document.",
    description:
      "Extract text from selected PDF pages and export a Word-compatible .doc file with page sections for quick editing.",
    keywords: ["pdf to word", "convert pdf to doc", "pdf text extraction", "pdf word converter"],
    engine: { kind: "image-tool", id: "pdf-to-word" },
    faq: baseFaq("PDF to Word Converter"),
  },
  {
    slug: "word-to-pdf-converter",
    category: "image-tools",
    title: "Word to PDF Converter",
    summary: "Convert Word, DOCX, DOC, TXT, or HTML documents into a downloadable PDF.",
    description:
      "Import Word-compatible files, adjust page layout and typography settings, and export a clean PDF directly in your browser.",
    keywords: ["word to pdf", "docx to pdf", "doc to pdf", "convert word document to pdf"],
    engine: { kind: "image-tool", id: "word-to-pdf" },
    faq: baseFaq("Word to PDF Converter"),
  },
  {
    slug: "html-to-pdf-converter",
    category: "image-tools",
    title: "HTML to PDF Converter",
    summary: "Convert HTML/HTM files into clean PDF documents with page sizing and typography controls.",
    description:
      "Upload HTML files and convert extracted text into downloadable PDFs with configurable page size, margins, line height, and output naming.",
    keywords: ["html to pdf", "convert html to pdf", "htm to pdf", "html pdf converter"],
    engine: { kind: "image-tool", id: "word-to-pdf" },
    faq: baseFaq("HTML to PDF Converter"),
  },
  {
    slug: "pdf-to-jpg-converter",
    category: "image-tools",
    title: "PDF to JPG Converter",
    summary: "Convert PDF pages into high-quality JPG images in-browser.",
    description:
      "Extract single or multiple PDF pages to JPG with page-range control, quality tuning, and per-page downloads.",
    keywords: ["pdf to jpg", "pdf page to image", "convert pdf to jpg"],
    engine: { kind: "image-tool", id: "pdf-to-jpg" },
    faq: baseFaq("PDF to JPG Converter"),
  },
];

const developerTools: ToolDefinition[] = [
  {
    slug: "uuid-generator",
    category: "developer-tools",
    title: "UUID Generator",
    summary: "Generate batch UUID v4 identifiers with format options and quick export.",
    description:
      "Create unique IDs for database keys, event tracking, and distributed systems with batch generation and copy/download support.",
    keywords: ["uuid generator", "uuid v4", "unique id generator"],
    engine: { kind: "developer-tool", id: "uuid-generator" },
    faq: baseFaq("UUID Generator"),
  },
  {
    slug: "url-encoder-decoder",
    category: "developer-tools",
    title: "URL Encoder/Decoder",
    summary: "Encode/decode URL strings with mode control and query parameter inspection.",
    description:
      "Convert URL components or full URLs safely for APIs, redirects, and query parameter debugging with parsed output previews.",
    keywords: ["url encoder", "url decoder", "encode uri"],
    engine: { kind: "developer-tool", id: "url-encoder-decoder" },
    faq: baseFaq("URL Encoder/Decoder"),
  },
  {
    slug: "timestamp-converter",
    category: "developer-tools",
    title: "Timestamp Converter",
    summary: "Convert Unix seconds/milliseconds to readable date formats and back.",
    description:
      "Debug logs and API payloads with UTC, local, ISO, and relative time conversions in one interactive tool.",
    keywords: ["timestamp converter", "unix time converter", "epoch converter"],
    engine: { kind: "developer-tool", id: "timestamp-converter" },
    faq: baseFaq("Timestamp Converter"),
  },
  {
    slug: "time-zone-converter",
    category: "developer-tools",
    title: "Time Zone Converter",
    summary: "Convert date and time between global time zones with offset and day-shift details.",
    description:
      "Plan cross-region work by converting one source timezone time into target timezone values, UTC, and global comparison slots.",
    keywords: ["time zone converter", "timezone converter", "convert time zone", "world clock converter"],
    engine: { kind: "developer-tool", id: "time-zone-converter" },
    faq: baseFaq("Time Zone Converter"),
  },
  {
    slug: "internet-speed-test",
    category: "developer-tools",
    title: "Internet Speed Test",
    summary: "Measure download speed, latency, and consistency directly in your browser.",
    description:
      "Run a multi-sample network test with configurable payload size and iterations to estimate throughput, ping latency, and stability score.",
    keywords: ["internet speed test", "network speed test", "download speed test", "ping test"],
    engine: { kind: "developer-tool", id: "internet-speed-test" },
    faq: baseFaq("Internet Speed Test"),
  },
  {
    slug: "markdown-to-html",
    category: "developer-tools",
    title: "Markdown to HTML",
    summary: "Convert Markdown syntax into previewable and exportable HTML output.",
    description:
      "Write markdown, inspect rendered HTML, and export output for docs, CMS entries, and blog workflows.",
    keywords: ["markdown to html", "markdown converter", "md parser"],
    engine: { kind: "developer-tool", id: "markdown-to-html" },
    faq: baseFaq("Markdown to HTML"),
  },
  {
    slug: "user-agent-checker",
    category: "developer-tools",
    title: "User Agent Checker",
    summary: "Inspect user agent, browser engine, OS, and device context details.",
    description:
      "Debug browser compatibility and analytics filtering with parsed user-agent details and environment diagnostics.",
    keywords: ["user agent checker", "browser user agent", "ua string"],
    engine: { kind: "developer-tool", id: "user-agent-checker" },
    faq: baseFaq("User Agent Checker"),
  },
  {
    slug: "ip-address-checker",
    category: "developer-tools",
    title: "IP Address Checker",
    summary: "View current public IP with connection diagnostics and source details.",
    description:
      "Fetch public IP and network context for debugging deployment, firewall rules, and request routing behavior.",
    keywords: ["ip checker", "what is my ip", "public ip address"],
    engine: { kind: "developer-tool", id: "ip-address-checker" },
    faq: baseFaq("IP Address Checker"),
  },
  {
    slug: "cron-expression-generator",
    category: "developer-tools",
    title: "Cron Expression Generator",
    summary: "Build cron schedules with validation, presets, and next-run previews.",
    description:
      "Generate cron strings for Linux jobs, workflow automation, and server tasks with simulation and readable summaries.",
    keywords: ["cron generator", "cron expression", "schedule builder"],
    engine: { kind: "developer-tool", id: "cron-expression-generator" },
    faq: baseFaq("Cron Expression Generator"),
  },
  {
    slug: "http-status-checker",
    category: "developer-tools",
    title: "HTTP Status Checker",
    summary: "Run single or batch HTTP status checks with timing and redirect insight.",
    description:
      "Validate endpoint accessibility with method control, response timing, final URL tracking, and reusable check history.",
    keywords: ["http status checker", "url status code", "website status"],
    engine: { kind: "developer-tool", id: "http-status-checker" },
    faq: baseFaq("HTTP Status Checker"),
  },
  {
    slug: "dns-lookup",
    category: "developer-tools",
    title: "DNS Lookup",
    summary: "Run deep DNS queries across major record types with resolver controls and diagnostics.",
    description:
      "Inspect A, AAAA, CNAME, MX, TXT, NS, SOA, and CAA records with DNSSEC indicators, response metadata, and exportable lookup history.",
    keywords: ["dns lookup", "dns checker", "dns records", "mx lookup", "txt lookup"],
    engine: { kind: "developer-tool", id: "dns-lookup" },
    faq: baseFaq("DNS Lookup"),
  },
  {
    slug: "ssl-checker",
    category: "developer-tools",
    title: "SSL Checker",
    summary: "Inspect TLS certificates, chain details, expiry risk, and handshake metadata.",
    description:
      "Validate certificate trust, SAN coverage, expiry windows, protocol/cipher negotiation, and chain structure for production endpoints.",
    keywords: ["ssl checker", "tls certificate checker", "certificate expiry", "https certificate"],
    engine: { kind: "developer-tool", id: "ssl-checker" },
    faq: baseFaq("SSL Checker"),
  },
  {
    slug: "whois-lookup",
    category: "developer-tools",
    title: "WHOIS Lookup",
    summary: "Inspect domain registration, registrar details, statuses, and key lifecycle dates.",
    description:
      "Run RDAP-powered WHOIS lookups to view registrar identity, expiration timeline, nameserver delegation, DNSSEC flags, and contact role metadata.",
    keywords: ["whois lookup", "domain whois", "domain registrar checker", "domain expiry lookup"],
    engine: { kind: "developer-tool", id: "whois-lookup" },
    faq: baseFaq("WHOIS Lookup"),
  },
  {
    slug: "dns-propagation-checker",
    category: "developer-tools",
    title: "DNS Propagation Checker",
    summary: "Compare record propagation across global DNS resolvers with consensus analysis.",
    description:
      "Check how A, AAAA, CNAME, MX, TXT, NS, SOA, or CAA values resolve across major resolvers and quantify propagation consistency.",
    keywords: ["dns propagation checker", "dns propagation", "global dns check", "dns resolver compare"],
    engine: { kind: "developer-tool", id: "dns-propagation-checker" },
    faq: baseFaq("DNS Propagation Checker"),
  },
];

const productivityTools: ToolDefinition[] = [
  {
    slug: "pomodoro-timer",
    category: "productivity-tools",
    title: "Pomodoro Timer",
    summary: "Advanced focus timer with presets, alerts, mini window mode, and daily productivity stats.",
    description:
      "Run structured focus and break cycles with custom durations, auto-start options, warning alerts, system notifications, wake-lock support, and local progress tracking.",
    keywords: ["pomodoro timer", "focus timer", "productivity timer"],
    engine: { kind: "productivity-tool", id: "pomodoro-timer" },
    faq: baseFaq("Pomodoro Timer"),
  },
  {
    slug: "meeting-time-planner",
    category: "productivity-tools",
    title: "Meeting Time Planner",
    summary: "Find the best meeting slots across multiple time zones with overlap scoring.",
    description:
      "Plan cross-timezone meetings by comparing candidate slots against participant business-hour windows and selecting the best overlap.",
    keywords: ["meeting time planner", "timezone meeting planner", "meeting scheduler", "global meeting time"],
    engine: { kind: "productivity-tool", id: "meeting-time-planner" },
    faq: baseFaq("Meeting Time Planner"),
  },
  {
    slug: "simple-todo-list",
    category: "productivity-tools",
    title: "Simple To-do List",
    summary: "Task manager with priorities, due dates, filters, search, and CSV export.",
    description:
      "Capture and organize tasks with local persistence, overdue tracking, completion workflows, and productivity-focused task insights.",
    keywords: ["todo list", "task list", "simple todo app"],
    engine: { kind: "productivity-tool", id: "simple-todo-list" },
    faq: baseFaq("Simple To-do List"),
  },
  {
    slug: "notes-pad",
    category: "productivity-tools",
    title: "Notes Pad",
    summary: "Modern markdown notes with shortcuts, templates, sharing links, and local autosave.",
    description:
      "Capture ideas and work docs with markdown formatting tools, keyboard shortcuts, tagging, pinning, previews, import/export, and link-based sharing.",
    keywords: ["notes pad", "online notes", "quick note app"],
    engine: { kind: "productivity-tool", id: "notes-pad" },
    faq: baseFaq("Notes Pad"),
  },
  {
    slug: "text-translator",
    category: "productivity-tools",
    title: "Text Translator",
    summary: "Translate text across major languages with auto-detect, provider fallback, and saved workspace history.",
    description:
      "Translate paragraphs or long-form content with language auto-detection, reliable provider failover, and local session persistence for repeated multilingual workflows.",
    keywords: [
      "text translator",
      "language translator",
      "translate text online",
      "auto detect language",
      "multilingual translation tool",
    ],
    engine: { kind: "productivity-tool", id: "text-translator" },
    faq: baseFaq("Text Translator"),
  },
  {
    slug: "document-translator",
    category: "productivity-tools",
    title: "Document Translator",
    summary: "Translate DOCX, PDF, HTML, and text files with chunked processing, glossary locking, and export-ready output.",
    description:
      "Import documents, extract readable text, translate large files safely with chunk-level progress, preserve critical terms via glossary locking, and export translated docs.",
    keywords: [
      "document translator",
      "pdf translator",
      "docx translator",
      "translate file online",
      "multilingual document translation",
    ],
    engine: { kind: "productivity-tool", id: "document-translator" },
    faq: baseFaq("Document Translator"),
  },
  {
    slug: "resume-builder",
    category: "productivity-tools",
    title: "Resume Builder",
    summary: "Build ATS-friendly resumes with profile photos, modern templates, smart recommendations, and multi-format export.",
    description:
      "Create polished resumes with role-based starter templates, profile-picture support, one-click improvement actions, ATS keyword alignment checks, and export to PDF, DOC, HTML, Markdown, and TXT.",
    keywords: ["resume builder", "cv builder", "resume template", "resume pdf", "resume doc export", "ats resume"],
    engine: { kind: "productivity-tool", id: "resume-builder" },
    faq: baseFaq("Resume Builder"),
  },
  {
    slug: "job-application-kit-builder",
    category: "productivity-tools",
    title: "Job Application Kit Builder",
    summary: "Generate ATS match insights, tailored cover letters, and follow-up email templates from one job post.",
    description:
      "Turn your resume and a target job description into a practical apply-ready kit with keyword gap analysis, priority fixes, structured bullet rewrites, cover letter draft, and follow-up outreach emails.",
    keywords: [
      "ats resume match",
      "job application kit",
      "cover letter generator",
      "job description keyword matcher",
      "follow up email after applying",
    ],
    engine: { kind: "productivity-tool", id: "job-application-kit-builder" },
    faq: baseFaq("Job Application Kit Builder"),
  },
  {
    slug: "ocr-workbench",
    category: "productivity-tools",
    title: "OCR Workbench",
    summary: "Extract text from images and PDFs with confidence insights and export-ready output.",
    description:
      "Run browser-based OCR on screenshots, scanned docs, and PDF pages, then clean text, inspect confidence, extract table-like rows, and export results instantly.",
    keywords: [
      "ocr online free",
      "image to text converter",
      "pdf scan to text",
      "extract text from screenshot",
      "ocr workbench",
    ],
    engine: { kind: "productivity-tool", id: "ocr-workbench" },
    faq: baseFaq("OCR Workbench"),
  },
  {
    slug: "invoice-generator",
    category: "productivity-tools",
    title: "Invoice Generator",
    summary: "Generate branded invoices with global currencies, workspace history, taxes, and PDF export.",
    description:
      "Create client-ready invoices with logo branding, multiple saved invoice workspaces, full currency selection including African currencies, and robust billing/export workflows.",
    keywords: ["invoice generator", "invoice template", "invoice pdf", "billing tool"],
    engine: { kind: "productivity-tool", id: "invoice-generator" },
    faq: baseFaq("Invoice Generator"),
  },
];

export const TOOLS: ToolDefinition[] = [
  ...calculators,
  ...converterDefinitions,
  ...seoTools,
  ...imageTools,
  ...developerTools,
  ...productivityTools,
];

const byCategory = new Map<ToolCategorySlug, ToolDefinition[]>();
const byCompositeKey = new Map<string, ToolDefinition>();

for (const tool of TOOLS) {
  const list = byCategory.get(tool.category) ?? [];
  list.push(tool);
  byCategory.set(tool.category, list);
  byCompositeKey.set(`${tool.category}/${tool.slug}`, tool);
}

for (const [key, tools] of byCategory.entries()) {
  byCategory.set(
    key,
    tools.sort((a, b) => a.title.localeCompare(b.title)),
  );
}

export function getAllTools(): ToolDefinition[] {
  return [...TOOLS].sort((a, b) => a.title.localeCompare(b.title));
}

export function getToolsByCategory(category: string): ToolDefinition[] {
  return [...(byCategory.get(category as ToolCategorySlug) ?? [])];
}

export function getToolByCategoryAndSlug(category: string, slug: string): ToolDefinition | null {
  const found = byCompositeKey.get(`${category}/${slug}`) ?? null;
  if (!found) return null;
  return found;
}

export function getRelatedTools(tool: ToolDefinition, limit = 4): ToolDefinition[] {
  const sameCategory = getToolsByCategory(tool.category).filter((candidate) => candidate.slug !== tool.slug);
  if (sameCategory.length >= limit) return sameCategory.slice(0, limit);

  const extra = getAllTools().filter(
    (candidate) => candidate.slug !== tool.slug && candidate.category !== tool.category,
  );

  return [...sameCategory, ...extra].slice(0, limit);
}

export function searchTools(query: string): ToolDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return getAllTools();
  return getAllTools().filter((tool) => {
    const category = getCategory(tool.category)?.title ?? "";
    const haystack = `${tool.title} ${tool.summary} ${tool.description} ${category} ${tool.keywords.join(" ")}`
      .toLowerCase()
      .trim();
    return haystack.includes(normalized);
  });
}
