"use client";

import NextImage from "next/image";
import type { jsPDF as JsPdfType } from "jspdf";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import {
  Bell,
  BellOff,
  Binary,
  Briefcase,
  Calculator,
  Braces,
  Code2,
  Copy,
  Download,
  FileText,
  GraduationCap,
  Hash,
  Languages,
  Link2,
  MonitorUp,
  Plus,
  Printer,
  RefreshCw,
  Receipt,
  Search,
  Share2,
  Sparkles,
  Tags,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  type LucideIcon,
} from "lucide-react";
import {
  getBreakEvenScenarios,
  getCalculatorInsights,
  getCompoundGrowthTimeline,
  getDtiAffordabilityScenarios,
  getLoanAmortizationSchedule,
  getSavingsGoalTimeline,
  runCalculator,
  type ResultRow,
} from "@/lib/calculations";
import { trackEvent } from "@/lib/analytics";
import { convertNumber, convertUnitValue, getUnitsForQuantity } from "@/lib/converters";
import {
  buildDocumentTranslationWordMarkup,
  DOCUMENT_TRANSLATOR_HISTORY_LIMIT,
  DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH,
  parseGlossaryTerms,
  protectGlossaryTerms,
  restoreGlossaryTokens,
  sanitizeDocumentTranslationText,
  splitDocumentIntoTranslationChunks,
  summarizeProviderCounts,
} from "@/lib/document-translator";
import {
  beautifyHtml,
  countCharacters,
  countWords,
  generateLoremIpsum,
  generateRobotsTxt,
  generateSitemapXml,
  keywordDensity,
  markdownToHtml,
  minifyCss,
  minifyJs,
  safeJsonFormat,
  slugify,
} from "@/lib/text-tools";
import {
  buildTranslationPreview,
  getTranslationLanguageLabel,
  resolveTranslationLanguage,
  TRANSLATION_AUTO_LANGUAGE_CODE,
  TRANSLATION_LANGUAGE_OPTIONS,
} from "@/lib/translation";
import type {
  CalculatorId,
  DeveloperToolId,
  ImageToolId,
  NumberConverterMode,
  ProductivityToolId,
  TextToolId,
  ToolDefinition,
  UnitQuantity,
} from "@/lib/types";

interface ToolRendererProps {
  tool: ToolDefinition;
}

function ResultList({ rows }: { rows: ResultRow[] }) {
  return (
    <div className="result-list" aria-live="polite">
      {rows.map((row) => (
        <div key={`${row.label}-${row.value}`} className="result-row">
          <span>{row.label}</span>
          <strong>{row.value}</strong>
          {row.hint ? <small>{row.hint}</small> : null}
        </div>
      ))}
    </div>
  );
}

interface CalculatorField {
  name: string;
  label: string;
  type?: "number" | "text" | "select" | "date";
  min?: number;
  step?: number;
  defaultValue: string;
  helper?: string;
  options?: Array<{ label: string; value: string }>;
}

const calculatorFields: Record<CalculatorId, CalculatorField[]> = {
  "loan-emi-calculator": [
    {
      name: "principal",
      label: "Loan amount (USD)",
      defaultValue: "100000",
      min: 0,
      step: 100,
      type: "number",
      helper: "Total amount borrowed.",
    },
    {
      name: "annualRate",
      label: "Annual interest rate (%)",
      defaultValue: "8.5",
      min: 0,
      step: 0.1,
      type: "number",
      helper: "Nominal yearly rate from your lender.",
    },
    { name: "months", label: "Loan tenure (months)", defaultValue: "60", min: 1, step: 1, type: "number" },
  ],
  "mortgage-calculator": [
    {
      name: "homePrice",
      label: "Home price (USD)",
      defaultValue: "450000",
      min: 0,
      step: 1000,
      type: "number",
    },
    {
      name: "downPayment",
      label: "Down payment (USD)",
      defaultValue: "90000",
      min: 0,
      step: 500,
      type: "number",
    },
    { name: "annualRate", label: "Interest rate (%)", defaultValue: "6.5", min: 0, step: 0.1, type: "number" },
    { name: "years", label: "Loan term (years)", defaultValue: "30", min: 1, step: 1, type: "number" },
    {
      name: "annualPropertyTaxRate",
      label: "Property tax rate (%)",
      defaultValue: "1.2",
      min: 0,
      step: 0.1,
      type: "number",
    },
    {
      name: "annualHomeInsurance",
      label: "Annual home insurance (USD)",
      defaultValue: "1800",
      min: 0,
      step: 50,
      type: "number",
    },
    { name: "monthlyHoa", label: "Monthly HOA (USD)", defaultValue: "0", min: 0, step: 10, type: "number" },
  ],
  "debt-to-income-calculator": [
    {
      name: "grossMonthlyIncome",
      label: "Gross monthly income (USD)",
      defaultValue: "8500",
      min: 0,
      step: 50,
      type: "number",
      helper: "Income before tax, from salary/wages.",
    },
    {
      name: "coBorrowerMonthlyIncome",
      label: "Co-borrower monthly income (USD)",
      defaultValue: "0",
      min: 0,
      step: 50,
      type: "number",
    },
    {
      name: "otherMonthlyIncome",
      label: "Other recurring income (USD)",
      defaultValue: "0",
      min: 0,
      step: 50,
      type: "number",
      helper: "Only include reliable income you can document.",
    },
    {
      name: "monthlyHousingPayment",
      label: "Housing payment - rent/mortgage P&I (USD)",
      defaultValue: "2200",
      min: 0,
      step: 10,
      type: "number",
    },
    {
      name: "monthlyPropertyTax",
      label: "Monthly property tax (USD)",
      defaultValue: "350",
      min: 0,
      step: 10,
      type: "number",
    },
    {
      name: "monthlyInsuranceHoa",
      label: "Monthly insurance + HOA (USD)",
      defaultValue: "210",
      min: 0,
      step: 10,
      type: "number",
    },
    { name: "monthlyCarPayment", label: "Monthly car loans (USD)", defaultValue: "450", min: 0, step: 10, type: "number" },
    {
      name: "monthlyStudentLoanPayment",
      label: "Monthly student loans (USD)",
      defaultValue: "280",
      min: 0,
      step: 10,
      type: "number",
    },
    {
      name: "monthlyCreditCardPayments",
      label: "Monthly credit card minimums (USD)",
      defaultValue: "150",
      min: 0,
      step: 10,
      type: "number",
    },
    {
      name: "monthlyPersonalLoanPayments",
      label: "Monthly personal loans (USD)",
      defaultValue: "0",
      min: 0,
      step: 10,
      type: "number",
    },
    {
      name: "monthlyChildSupportAlimony",
      label: "Child support / alimony (USD)",
      defaultValue: "0",
      min: 0,
      step: 10,
      type: "number",
    },
    { name: "monthlyOtherDebts", label: "Other monthly debt (USD)", defaultValue: "0", min: 0, step: 10, type: "number" },
    {
      name: "targetFrontEndDti",
      label: "Target front-end ratio (%)",
      defaultValue: "31",
      type: "select",
      options: [
        { label: "25 (Conservative)", value: "25" },
        { label: "28 (Standard)", value: "28" },
        { label: "31 (Flexible)", value: "31" },
        { label: "33 (Aggressive)", value: "33" },
      ],
    },
    {
      name: "targetBackEndDti",
      label: "Target back-end ratio (%)",
      defaultValue: "43",
      type: "select",
      options: [
        { label: "35 (Conservative)", value: "35" },
        { label: "36 (Standard)", value: "36" },
        { label: "43 (Flexible)", value: "43" },
        { label: "50 (Aggressive)", value: "50" },
      ],
    },
  ] satisfies CalculatorField[],
  "compound-interest-calculator": [
    { name: "principal", label: "Initial principal (USD)", defaultValue: "10000", min: 0, step: 10, type: "number" },
    { name: "annualRate", label: "Annual return rate (%)", defaultValue: "7", min: 0, step: 0.1, type: "number" },
    { name: "years", label: "Years", defaultValue: "10", min: 0, step: 0.5, type: "number" },
    {
      name: "compoundsPerYear",
      label: "Compounds per year",
      defaultValue: "12",
      type: "select",
      options: [
        { label: "1 (Yearly)", value: "1" },
        { label: "4 (Quarterly)", value: "4" },
        { label: "12 (Monthly)", value: "12" },
        { label: "365 (Daily)", value: "365" },
      ],
    },
  ],
  "simple-interest-calculator": [
    { name: "principal", label: "Principal (USD)", defaultValue: "5000", min: 0, step: 10, type: "number" },
    { name: "annualRate", label: "Annual rate (%)", defaultValue: "5", min: 0, step: 0.1, type: "number" },
    { name: "years", label: "Years", defaultValue: "3", min: 0, step: 0.5, type: "number" },
  ],
  "inflation-calculator": [
    { name: "amount", label: "Current amount (USD)", defaultValue: "1000", min: 0, step: 10, type: "number" },
    {
      name: "annualInflationRate",
      label: "Annual inflation rate (%)",
      defaultValue: "3",
      min: 0,
      step: 0.1,
      type: "number",
    },
    { name: "years", label: "Years", defaultValue: "10", min: 0, step: 0.5, type: "number" },
  ],
  "currency-converter-calculator": [
    { name: "amount", label: "Amount", defaultValue: "1000", min: 0, step: 0.01, type: "number" },
    {
      name: "fromCurrency",
      label: "From currency",
      defaultValue: "USD",
      type: "select",
      options: [
        { label: "USD", value: "USD" },
        { label: "EUR", value: "EUR" },
        { label: "GBP", value: "GBP" },
        { label: "JPY", value: "JPY" },
        { label: "INR", value: "INR" },
        { label: "CAD", value: "CAD" },
        { label: "AUD", value: "AUD" },
      ],
    },
    {
      name: "toCurrency",
      label: "To currency",
      defaultValue: "EUR",
      type: "select",
      options: [
        { label: "USD", value: "USD" },
        { label: "EUR", value: "EUR" },
        { label: "GBP", value: "GBP" },
        { label: "JPY", value: "JPY" },
        { label: "INR", value: "INR" },
        { label: "CAD", value: "CAD" },
        { label: "AUD", value: "AUD" },
      ],
    },
    {
      name: "exchangeRate",
      label: "Exchange rate (1 from = ? to)",
      defaultValue: "0.92",
      min: 0,
      step: 0.0001,
      type: "number",
    },
    {
      name: "conversionFeePercent",
      label: "Conversion fee (%)",
      defaultValue: "0",
      min: 0,
      step: 0.01,
      type: "number",
    },
  ],
  "crypto-profit-calculator": [
    { name: "buyPrice", label: "Buy price (USD)", defaultValue: "60000", min: 0, step: 0.01, type: "number" },
    { name: "sellPrice", label: "Sell price (USD)", defaultValue: "68000", min: 0, step: 0.01, type: "number" },
    { name: "quantity", label: "Quantity", defaultValue: "0.2", min: 0, step: 0.0001, type: "number" },
    {
      name: "tradingFeePercent",
      label: "Fee per trade (%)",
      defaultValue: "0.25",
      min: 0,
      step: 0.01,
      type: "number",
    },
  ],
  "credit-card-payoff-calculator": [
    { name: "balance", label: "Current balance (USD)", defaultValue: "8500", min: 0, step: 10, type: "number" },
    { name: "apr", label: "APR (%)", defaultValue: "21.9", min: 0, step: 0.1, type: "number" },
    { name: "monthlyPayment", label: "Monthly payment (USD)", defaultValue: "300", min: 1, step: 1, type: "number" },
  ],
  "salary-after-tax-calculator": [
    {
      name: "annualSalary",
      label: "Gross annual salary (USD)",
      defaultValue: "85000",
      min: 0,
      step: 100,
      type: "number",
    },
    {
      name: "federalTaxRate",
      label: "Federal tax rate (%)",
      defaultValue: "18",
      min: 0,
      step: 0.1,
      type: "number",
    },
    {
      name: "stateTaxRate",
      label: "State tax rate (%)",
      defaultValue: "6",
      min: 0,
      step: 0.1,
      type: "number",
    },
    {
      name: "retirementPercent",
      label: "Retirement contribution (%)",
      defaultValue: "6",
      min: 0,
      step: 0.1,
      type: "number",
    },
    {
      name: "monthlyBenefitsCost",
      label: "Monthly deductions (USD)",
      defaultValue: "220",
      min: 0,
      step: 1,
      type: "number",
    },
  ],
  "roi-calculator": [
    { name: "investment", label: "Initial investment (USD)", defaultValue: "2000", min: 0, step: 10, type: "number" },
    { name: "returns", label: "Final returns (USD)", defaultValue: "2600", min: 0, step: 10, type: "number" },
  ],
  "profit-margin-calculator": [
    { name: "revenue", label: "Revenue (USD)", defaultValue: "1000", min: 0, step: 1, type: "number" },
    { name: "cost", label: "Cost (USD)", defaultValue: "650", min: 0, step: 1, type: "number" },
  ],
  "markup-calculator": [
    { name: "cost", label: "Unit cost (USD)", defaultValue: "35", min: 0, step: 0.01, type: "number" },
    { name: "markupPercent", label: "Target markup (%)", defaultValue: "50", min: 0, step: 0.1, type: "number" },
  ],
  "vat-calculator": [
    { name: "amount", label: "Base amount (USD)", defaultValue: "100", min: 0, step: 0.01, type: "number" },
    { name: "vatRate", label: "VAT rate (%)", defaultValue: "20", min: 0, step: 0.1, type: "number" },
  ],
  "bmi-calculator": [
    { name: "weightKg", label: "Weight (kg)", defaultValue: "70", min: 1, step: 0.1, type: "number" },
    { name: "heightCm", label: "Height (cm)", defaultValue: "175", min: 30, step: 0.1, type: "number" },
  ],
  "body-fat-calculator": [
    {
      name: "sex",
      label: "Sex",
      defaultValue: "male",
      type: "select",
      options: [
        { label: "Male", value: "male" },
        { label: "Female", value: "female" },
      ],
    },
    { name: "weightKg", label: "Weight (kg)", defaultValue: "75", min: 1, step: 0.1, type: "number" },
    { name: "heightCm", label: "Height (cm)", defaultValue: "178", min: 100, step: 0.1, type: "number" },
    { name: "neckCm", label: "Neck (cm)", defaultValue: "38", min: 10, step: 0.1, type: "number" },
    { name: "waistCm", label: "Waist (cm)", defaultValue: "86", min: 20, step: 0.1, type: "number" },
    { name: "hipCm", label: "Hip (cm, female)", defaultValue: "98", min: 20, step: 0.1, type: "number" },
  ],
  "calorie-needs-calculator": [
    {
      name: "sex",
      label: "Sex",
      defaultValue: "female",
      type: "select",
      options: [
        { label: "Female", value: "female" },
        { label: "Male", value: "male" },
      ],
    },
    { name: "age", label: "Age", defaultValue: "30", min: 1, step: 1, type: "number" },
    { name: "weightKg", label: "Weight (kg)", defaultValue: "65", min: 1, step: 0.1, type: "number" },
    { name: "heightCm", label: "Height (cm)", defaultValue: "168", min: 30, step: 0.1, type: "number" },
    {
      name: "activityFactor",
      label: "Activity level",
      defaultValue: "1.375",
      type: "select",
      options: [
        { label: "Sedentary", value: "1.2" },
        { label: "Lightly active", value: "1.375" },
        { label: "Moderately active", value: "1.55" },
        { label: "Very active", value: "1.725" },
      ],
    },
  ],
  "water-intake-calculator": [
    { name: "weightKg", label: "Weight (kg)", defaultValue: "70", min: 1, step: 0.1, type: "number" },
    { name: "activityMinutes", label: "Exercise minutes/day", defaultValue: "30", min: 0, step: 1, type: "number" },
  ],
  "age-calculator": [
    { name: "birthDate", label: "Date of birth", defaultValue: "1995-01-15", type: "date" },
    {
      name: "asOfDate",
      label: "As of date (optional)",
      defaultValue: "",
      type: "date",
      helper: "Leave empty to calculate age as of today.",
    },
  ],
  "date-difference-calculator": [
    { name: "startDate", label: "Start date", defaultValue: "2026-01-01", type: "date" },
    { name: "endDate", label: "End date", defaultValue: "2026-12-31", type: "date" },
    {
      name: "includeEndDate",
      label: "Count mode",
      defaultValue: "no",
      type: "select",
      options: [
        { label: "Exclusive (exclude end date)", value: "no" },
        { label: "Inclusive (include end date)", value: "yes" },
      ],
      helper: "Inclusive mode counts both start and end dates.",
    },
  ],
  "pregnancy-due-date-calculator": [
    { name: "lmpDate", label: "First day of last period", defaultValue: "2026-01-01", type: "date" },
    { name: "cycleLengthDays", label: "Cycle length (days)", defaultValue: "28", min: 20, step: 1, type: "number" },
  ],
  "savings-goal-calculator": [
    { name: "targetAmount", label: "Target amount (USD)", defaultValue: "50000", min: 1, step: 100, type: "number" },
    { name: "currentSavings", label: "Current savings (USD)", defaultValue: "5000", min: 0, step: 100, type: "number" },
    { name: "years", label: "Years to goal", defaultValue: "5", min: 0.1, step: 0.1, type: "number" },
    { name: "annualReturn", label: "Expected annual return (%)", defaultValue: "5", min: 0, step: 0.1, type: "number" },
  ],
  "break-even-calculator": [
    { name: "fixedCosts", label: "Fixed costs (USD)", defaultValue: "15000", min: 0, step: 100, type: "number" },
    { name: "variableCostPerUnit", label: "Variable cost/unit (USD)", defaultValue: "20", min: 0, step: 0.01, type: "number" },
    { name: "unitPrice", label: "Selling price/unit (USD)", defaultValue: "45", min: 0, step: 0.01, type: "number" },
  ],
  "startup-cost-estimator": [
    { name: "oneTimeCosts", label: "One-time setup costs (USD)", defaultValue: "25000", min: 0, step: 100, type: "number" },
    { name: "monthlyBurn", label: "Monthly operating burn (USD)", defaultValue: "12000", min: 0, step: 100, type: "number" },
    { name: "runwayMonths", label: "Runway target (months)", defaultValue: "12", min: 1, step: 1, type: "number" },
    { name: "contingencyPercent", label: "Contingency buffer (%)", defaultValue: "15", min: 0, step: 1, type: "number" },
  ],
  "freelance-rate-calculator": [
    {
      name: "targetMonthlyIncome",
      label: "Target monthly income (USD)",
      defaultValue: "4000",
      min: 0,
      step: 50,
      type: "number",
    },
    { name: "monthlyExpenses", label: "Monthly expenses (USD)", defaultValue: "1500", min: 0, step: 50, type: "number" },
    {
      name: "billableHoursPerMonth",
      label: "Billable hours/month",
      defaultValue: "80",
      min: 1,
      step: 1,
      type: "number",
    },
    { name: "desiredProfitPercent", label: "Desired profit (%)", defaultValue: "20", min: 0, step: 1, type: "number" },
  ],
};

interface CalculatorPreset {
  label: string;
  values: Record<string, string>;
}

const calculatorSubtitles: Record<CalculatorId, string> = {
  "loan-emi-calculator": "Plan loan payments with amortization detail and repayment impact.",
  "mortgage-calculator": "Estimate all-in home payments with taxes, insurance, and HOA included.",
  "debt-to-income-calculator": "Model lender-style front-end/back-end DTI and affordability headroom in one view.",
  "compound-interest-calculator": "Model long-term growth and compounding outcomes year by year.",
  "simple-interest-calculator": "Quickly estimate simple-interest returns for fixed-rate periods.",
  "inflation-calculator": "Project future price impact and loss of purchasing power over time.",
  "currency-converter-calculator": "Convert currencies using your rate assumptions and fee impact.",
  "crypto-profit-calculator": "Evaluate crypto trade outcomes including entry/exit fees.",
  "credit-card-payoff-calculator": "See how payment size changes debt payoff time and interest cost.",
  "salary-after-tax-calculator": "Estimate realistic take-home pay after taxes and deductions.",
  "roi-calculator": "Measure profitability and capital efficiency for campaigns and investments.",
  "profit-margin-calculator": "Tune price, cost, margin, and markup for sustainable profitability.",
  "markup-calculator": "Set retail selling price from your target markup and unit cost.",
  "vat-calculator": "Compute tax-inclusive totals with accurate VAT breakdowns.",
  "bmi-calculator": "Check body mass index and healthy range guidance.",
  "body-fat-calculator": "Estimate body-fat percentage and lean mass using body measurements.",
  "calorie-needs-calculator": "Estimate maintenance, cut, and gain calorie targets.",
  "water-intake-calculator": "Set a hydration target based on body weight and activity.",
  "age-calculator": "Calculate exact age, next birthday, and total time lived from birth date.",
  "date-difference-calculator": "Compare two dates with exact calendar, day, and business-day differences.",
  "pregnancy-due-date-calculator": "Estimate due date and current gestational age from LMP.",
  "savings-goal-calculator": "Calculate the monthly contribution needed to hit your target.",
  "break-even-calculator": "See units and revenue needed to cover fixed and variable costs.",
  "startup-cost-estimator": "Forecast startup capital requirements with runway and contingency.",
  "freelance-rate-calculator": "Set hourly/day rates aligned with income and profit goals.",
};

const calculatorPresets: Record<CalculatorId, CalculatorPreset[]> = {
  "loan-emi-calculator": [
    { label: "Home Loan", values: { principal: "250000", annualRate: "7.5", months: "360" } },
    { label: "Car Loan", values: { principal: "28000", annualRate: "6.8", months: "60" } },
  ],
  "mortgage-calculator": [
    {
      label: "Starter home",
      values: {
        homePrice: "350000",
        downPayment: "70000",
        annualRate: "6.4",
        years: "30",
        annualPropertyTaxRate: "1.1",
        annualHomeInsurance: "1400",
        monthlyHoa: "0",
      },
    },
    {
      label: "Urban condo",
      values: {
        homePrice: "520000",
        downPayment: "104000",
        annualRate: "6.1",
        years: "30",
        annualPropertyTaxRate: "1.3",
        annualHomeInsurance: "2100",
        monthlyHoa: "360",
      },
    },
  ],
  "debt-to-income-calculator": [
    {
      label: "Conservative household",
      values: {
        grossMonthlyIncome: "9000",
        coBorrowerMonthlyIncome: "0",
        otherMonthlyIncome: "500",
        monthlyHousingPayment: "1900",
        monthlyPropertyTax: "280",
        monthlyInsuranceHoa: "180",
        monthlyCarPayment: "320",
        monthlyStudentLoanPayment: "140",
        monthlyCreditCardPayments: "90",
        monthlyPersonalLoanPayments: "0",
        monthlyChildSupportAlimony: "0",
        monthlyOtherDebts: "0",
        targetFrontEndDti: "28",
        targetBackEndDti: "36",
      },
    },
    {
      label: "Typical buyer profile",
      values: {
        grossMonthlyIncome: "8500",
        coBorrowerMonthlyIncome: "1500",
        otherMonthlyIncome: "0",
        monthlyHousingPayment: "2500",
        monthlyPropertyTax: "420",
        monthlyInsuranceHoa: "260",
        monthlyCarPayment: "520",
        monthlyStudentLoanPayment: "240",
        monthlyCreditCardPayments: "190",
        monthlyPersonalLoanPayments: "120",
        monthlyChildSupportAlimony: "0",
        monthlyOtherDebts: "80",
        targetFrontEndDti: "31",
        targetBackEndDti: "43",
      },
    },
    {
      label: "High debt pressure",
      values: {
        grossMonthlyIncome: "7000",
        coBorrowerMonthlyIncome: "0",
        otherMonthlyIncome: "0",
        monthlyHousingPayment: "2300",
        monthlyPropertyTax: "320",
        monthlyInsuranceHoa: "200",
        monthlyCarPayment: "650",
        monthlyStudentLoanPayment: "420",
        monthlyCreditCardPayments: "380",
        monthlyPersonalLoanPayments: "260",
        monthlyChildSupportAlimony: "150",
        monthlyOtherDebts: "120",
        targetFrontEndDti: "28",
        targetBackEndDti: "36",
      },
    },
  ],
  "compound-interest-calculator": [
    {
      label: "Retirement (25y)",
      values: { principal: "25000", annualRate: "8", years: "25", compoundsPerYear: "12" },
    },
    {
      label: "Conservative (10y)",
      values: { principal: "10000", annualRate: "5", years: "10", compoundsPerYear: "4" },
    },
  ],
  "simple-interest-calculator": [
    { label: "Short-term deposit", values: { principal: "5000", annualRate: "4.5", years: "2" } },
    { label: "Corporate note", values: { principal: "25000", annualRate: "6.2", years: "3" } },
  ],
  "inflation-calculator": [
    { label: "Moderate inflation", values: { amount: "1000", annualInflationRate: "3", years: "10" } },
    { label: "High inflation", values: { amount: "1000", annualInflationRate: "7", years: "10" } },
  ],
  "currency-converter-calculator": [
    {
      label: "USD to EUR",
      values: { amount: "1500", fromCurrency: "USD", toCurrency: "EUR", exchangeRate: "0.92", conversionFeePercent: "0.5" },
    },
    {
      label: "USD to JPY",
      values: { amount: "1500", fromCurrency: "USD", toCurrency: "JPY", exchangeRate: "149.4", conversionFeePercent: "1" },
    },
  ],
  "crypto-profit-calculator": [
    { label: "BTC swing trade", values: { buyPrice: "60000", sellPrice: "72000", quantity: "0.15", tradingFeePercent: "0.2" } },
    { label: "ETH quick trade", values: { buyPrice: "3100", sellPrice: "3450", quantity: "2.5", tradingFeePercent: "0.35" } },
  ],
  "credit-card-payoff-calculator": [
    { label: "Aggressive payoff", values: { balance: "8500", apr: "21.9", monthlyPayment: "420" } },
    { label: "Moderate payoff", values: { balance: "8500", apr: "21.9", monthlyPayment: "260" } },
  ],
  "salary-after-tax-calculator": [
    {
      label: "Mid-career role",
      values: { annualSalary: "95000", federalTaxRate: "18", stateTaxRate: "6", retirementPercent: "8", monthlyBenefitsCost: "260" },
    },
    {
      label: "Senior role",
      values: { annualSalary: "140000", federalTaxRate: "24", stateTaxRate: "7", retirementPercent: "10", monthlyBenefitsCost: "420" },
    },
  ],
  "roi-calculator": [
    { label: "Marketing campaign", values: { investment: "1500", returns: "4200" } },
    { label: "Equipment upgrade", values: { investment: "8000", returns: "11200" } },
  ],
  "profit-margin-calculator": [
    { label: "SaaS plan", values: { revenue: "49", cost: "12" } },
    { label: "Ecommerce product", values: { revenue: "80", cost: "42" } },
  ],
  "markup-calculator": [
    { label: "Retail 50%", values: { cost: "35", markupPercent: "50" } },
    { label: "Premium 120%", values: { cost: "85", markupPercent: "120" } },
  ],
  "vat-calculator": [
    { label: "Standard VAT 20%", values: { amount: "500", vatRate: "20" } },
    { label: "Reduced VAT 5%", values: { amount: "500", vatRate: "5" } },
  ],
  "bmi-calculator": [
    { label: "Average adult", values: { weightKg: "72", heightCm: "175" } },
    { label: "Athletic build", values: { weightKg: "82", heightCm: "183" } },
  ],
  "body-fat-calculator": [
    {
      label: "Male profile",
      values: { sex: "male", weightKg: "78", heightCm: "178", neckCm: "39", waistCm: "88", hipCm: "98" },
    },
    {
      label: "Female profile",
      values: { sex: "female", weightKg: "64", heightCm: "168", neckCm: "33", waistCm: "76", hipCm: "98" },
    },
  ],
  "calorie-needs-calculator": [
    {
      label: "Desk worker",
      values: { sex: "female", age: "30", weightKg: "65", heightCm: "168", activityFactor: "1.2" },
    },
    {
      label: "Active athlete",
      values: { sex: "male", age: "28", weightKg: "78", heightCm: "180", activityFactor: "1.725" },
    },
  ],
  "water-intake-calculator": [
    { label: "Low activity", values: { weightKg: "70", activityMinutes: "20" } },
    { label: "High activity", values: { weightKg: "70", activityMinutes: "90" } },
  ],
  "age-calculator": [
    { label: "Adult profile", values: { birthDate: "1995-01-15", asOfDate: "" } },
    { label: "School age profile", values: { birthDate: "2012-09-01", asOfDate: "" } },
  ],
  "date-difference-calculator": [
    { label: "Q1 planning window", values: { startDate: "2026-01-01", endDate: "2026-03-31", includeEndDate: "no" } },
    { label: "30-day sprint (inclusive)", values: { startDate: "2026-04-01", endDate: "2026-04-30", includeEndDate: "yes" } },
  ],
  "pregnancy-due-date-calculator": [
    { label: "28-day cycle", values: { lmpDate: "2026-01-01", cycleLengthDays: "28" } },
    { label: "32-day cycle", values: { lmpDate: "2026-01-01", cycleLengthDays: "32" } },
  ],
  "savings-goal-calculator": [
    {
      label: "Emergency fund",
      values: { targetAmount: "15000", currentSavings: "2000", years: "2", annualReturn: "3.5" },
    },
    {
      label: "House down payment",
      values: { targetAmount: "60000", currentSavings: "10000", years: "5", annualReturn: "5.5" },
    },
  ],
  "break-even-calculator": [
    { label: "Product launch", values: { fixedCosts: "20000", variableCostPerUnit: "18", unitPrice: "45" } },
    { label: "Service package", values: { fixedCosts: "8000", variableCostPerUnit: "45", unitPrice: "140" } },
  ],
  "startup-cost-estimator": [
    { label: "Lean SaaS", values: { oneTimeCosts: "18000", monthlyBurn: "9000", runwayMonths: "12", contingencyPercent: "15" } },
    { label: "Marketplace launch", values: { oneTimeCosts: "45000", monthlyBurn: "22000", runwayMonths: "18", contingencyPercent: "20" } },
  ],
  "freelance-rate-calculator": [
    {
      label: "Solo consultant",
      values: { targetMonthlyIncome: "6000", monthlyExpenses: "2200", billableHoursPerMonth: "85", desiredProfitPercent: "25" },
    },
    {
      label: "Part-time specialist",
      values: { targetMonthlyIncome: "3000", monthlyExpenses: "1100", billableHoursPerMonth: "45", desiredProfitPercent: "20" },
    },
  ],
};

const CALCULATORS_WITH_DISPLAY_CURRENCY = new Set<CalculatorId>([
  "loan-emi-calculator",
  "mortgage-calculator",
  "debt-to-income-calculator",
  "compound-interest-calculator",
  "simple-interest-calculator",
  "inflation-calculator",
  "crypto-profit-calculator",
  "credit-card-payoff-calculator",
  "salary-after-tax-calculator",
  "roi-calculator",
  "profit-margin-calculator",
  "markup-calculator",
  "vat-calculator",
  "savings-goal-calculator",
  "break-even-calculator",
  "startup-cost-estimator",
  "freelance-rate-calculator",
]);

const MONEY_LABEL_PATTERN = /\(USD\)\s*$/i;
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

const calculatorNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatCurrencyValue(value: number, currency = "USD"): string {
  return formatCurrencyWithCode(value, currency);
}

function formatNumericValue(value: number): string {
  return calculatorNumberFormatter.format(value);
}

function sanitizeCalculatorCurrencyCode(value: string | undefined): string {
  if (!value) return "USD";
  const normalized = value.trim().toUpperCase();
  return CURRENCY_CODE_PATTERN.test(normalized) ? normalized : "USD";
}

function formatCalculatorFieldLabel(field: CalculatorField, currency: string): string {
  if (!MONEY_LABEL_PATTERN.test(field.label)) return field.label;
  return `${field.label.replace(MONEY_LABEL_PATTERN, "").trim()} (${currency})`;
}

function safeNumberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringifyRows(rows: ResultRow[]): string {
  return rows.map((row) => `${row.label}: ${row.value}`).join("\n");
}

function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function downloadTextFile(filename: string, content: string, mime = "text/plain;charset=utf-8;"): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function downloadDataUrl(filename: string, dataUrl: string): void {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

const TOOL_TEXT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

type TextUploadMergeMode = "replace" | "append";

async function readTextFileWithLimit(file: File, maxBytes = TOOL_TEXT_UPLOAD_MAX_BYTES): Promise<string> {
  if (!file) {
    throw new Error("No file selected.");
  }
  if (file.size > maxBytes) {
    throw new Error(`File is too large. Limit is ${formatBytes(maxBytes)}.`);
  }
  return file.text();
}

function mergeUploadedText(currentText: string, incomingText: string, mode: TextUploadMergeMode): string {
  if (mode === "replace" || !currentText.trim()) {
    return incomingText;
  }
  return `${currentText.trimEnd()}\n\n${incomingText.trimStart()}`;
}

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeUploadedText(value: string): string {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n");
}

function stripTagsFromMarkup(markup: string): string {
  return markup
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/gi, "'");
}

function extractPlainTextFromHtml(value: string): string {
  if (typeof DOMParser === "undefined") {
    return normalizeUploadedText(decodeBasicHtmlEntities(stripTagsFromMarkup(value)))
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(value, "text/html");
  const text = documentNode.body.textContent ?? "";
  return normalizeUploadedText(text).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

interface ParsedHtmlMetaSnapshot {
  title: string;
  description: string;
  canonical: string;
  author: string;
  robots: string;
  siteName: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  ogType: string;
  ogLocale: string;
  ogImageAlt: string;
  twitterCard: string;
  twitterSite: string;
  twitterCreator: string;
}

function parseHtmlMetaSnapshot(markup: string): ParsedHtmlMetaSnapshot {
  if (typeof DOMParser === "undefined") {
    const pickMeta = (attribute: "name" | "property", key: string) => {
      const regex = new RegExp(
        `<meta[^>]*${attribute}\\s*=\\s*["']${key}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`,
        "i",
      );
      return (markup.match(regex)?.[1] ?? "").trim();
    };
    const title = (markup.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const canonical =
      (
        markup.match(/<link[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["'][^>]*>/i)?.[1] ??
        ""
      ).trim();

    return {
      title: decodeBasicHtmlEntities(stripTagsFromMarkup(title)).trim(),
      description: pickMeta("name", "description"),
      canonical,
      author: pickMeta("name", "author"),
      robots: pickMeta("name", "robots"),
      siteName: pickMeta("property", "og:site_name"),
      ogTitle: pickMeta("property", "og:title"),
      ogDescription: pickMeta("property", "og:description"),
      ogUrl: pickMeta("property", "og:url"),
      ogImage: pickMeta("property", "og:image"),
      ogType: pickMeta("property", "og:type"),
      ogLocale: pickMeta("property", "og:locale"),
      ogImageAlt: pickMeta("property", "og:image:alt"),
      twitterCard: pickMeta("name", "twitter:card"),
      twitterSite: pickMeta("name", "twitter:site"),
      twitterCreator: pickMeta("name", "twitter:creator"),
    };
  }

  const parser = new DOMParser();
  const documentNode = parser.parseFromString(markup, "text/html");
  const byName = (name: string) =>
    (documentNode.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "").trim();
  const byProperty = (name: string) =>
    (documentNode.querySelector(`meta[property="${name}"]`)?.getAttribute("content") ?? "").trim();

  return {
    title: (documentNode.querySelector("title")?.textContent ?? "").trim(),
    description: byName("description"),
    canonical: (documentNode.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "").trim(),
    author: byName("author"),
    robots: byName("robots"),
    siteName: byProperty("og:site_name"),
    ogTitle: byProperty("og:title"),
    ogDescription: byProperty("og:description"),
    ogUrl: byProperty("og:url"),
    ogImage: byProperty("og:image"),
    ogType: byProperty("og:type"),
    ogLocale: byProperty("og:locale"),
    ogImageAlt: byProperty("og:image:alt"),
    twitterCard: byName("twitter:card"),
    twitterSite: byName("twitter:site"),
    twitterCreator: byName("twitter:creator"),
  };
}

function parseUrlListFromUploadedText(raw: string): string[] {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return lines
    .map((line) => {
      const firstToken = line.includes(",") ? line.split(",")[0]?.trim() ?? "" : line;
      return firstToken.replace(/^["']|["']$/g, "");
    })
    .filter(Boolean);
}

function extractUrlsFromSitemapXml(xmlText: string): string[] {
  if (typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, "application/xml");
      if (xml.querySelector("parsererror")) {
        throw new Error("Invalid XML");
      }
      return Array.from(xml.getElementsByTagName("loc"))
        .map((node) => (node.textContent ?? "").trim())
        .filter(Boolean);
    } catch {
      // Fall through to regex fallback.
    }
  }

  return [...xmlText.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((match) => (match[1] ?? "").trim())
    .filter(Boolean);
}

function parseRobotsTxtInput(value: string): {
  userAgent: string;
  allowPaths: string[];
  disallowPaths: string[];
  crawlDelay: string;
  host: string;
  sitemaps: string[];
  customDirectives: string[];
} {
  const result = {
    userAgent: "*",
    allowPaths: [] as string[],
    disallowPaths: [] as string[],
    crawlDelay: "",
    host: "",
    sitemaps: [] as string[],
    customDirectives: [] as string[],
  };

  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIndex = trimmed.indexOf(":");
    if (colonIndex <= 0) {
      result.customDirectives.push(trimmed);
      continue;
    }
    const key = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const directiveValue = trimmed.slice(colonIndex + 1).trim();
    if (!directiveValue) continue;

    if (key === "user-agent") {
      result.userAgent = directiveValue;
    } else if (key === "allow") {
      result.allowPaths.push(directiveValue);
    } else if (key === "disallow") {
      result.disallowPaths.push(directiveValue);
    } else if (key === "crawl-delay") {
      result.crawlDelay = directiveValue;
    } else if (key === "host") {
      result.host = directiveValue;
    } else if (key === "sitemap") {
      result.sitemaps.push(directiveValue);
    } else {
      result.customDirectives.push(trimmed);
    }
  }

  return result;
}

function normalizeRobotsPath(path: string): string {
  if (!path.trim()) return "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function evaluateRobotsPathDecision(
  path: string,
  allowPaths: string[],
  disallowPaths: string[],
): { decision: "Allowed" | "Blocked"; matchedAllow?: string; matchedDisallow?: string } {
  const normalizedPath = normalizeRobotsPath(path.trim());
  const matchedAllow = allowPaths
    .map((rule) => normalizeRobotsPath(rule.trim()))
    .filter((rule) => normalizedPath.startsWith(rule))
    .sort((left, right) => right.length - left.length)[0];

  const matchedDisallow = disallowPaths
    .map((rule) => normalizeRobotsPath(rule.trim()))
    .filter((rule) => normalizedPath.startsWith(rule))
    .sort((left, right) => right.length - left.length)[0];

  if (!matchedDisallow) {
    return { decision: "Allowed", matchedAllow };
  }
  if (!matchedAllow) {
    return { decision: "Blocked", matchedDisallow };
  }
  if (matchedAllow.length >= matchedDisallow.length) {
    return { decision: "Allowed", matchedAllow, matchedDisallow };
  }
  return { decision: "Blocked", matchedAllow, matchedDisallow };
}

function downloadBlobFile(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

interface ImageWorkflowHandoffPayload {
  sourceToolId: ImageToolId;
  targetToolId: ImageToolId;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  createdAt: number;
  runContext?: ImageWorkflowRunContext;
}

interface ImageWorkflowIncomingFile {
  token: string;
  sourceToolId: ImageToolId;
  file: File;
  runContext?: ImageWorkflowRunContext;
}

interface ImageWorkflowRunContext {
  runId: string;
  workflowId: string;
  workflowName: string;
  sourceToolId: ImageToolId;
  steps: ImageToolId[];
  currentStepIndex: number;
  startedAt: number;
}

interface SavedImageWorkflow {
  id: string;
  name: string;
  sourceToolId: ImageToolId;
  steps: ImageToolId[];
  createdAt: number;
  updatedAt: number;
  runCount: number;
  lastRunAt: number | null;
}

interface ImageWorkflowRunHistoryEntry {
  id: string;
  runId: string;
  workflowId: string;
  workflowName: string;
  sourceToolId: ImageToolId;
  steps: ImageToolId[];
  createdAt: number;
}

const IMAGE_WORKFLOW_STORAGE_KEY = "utiliora-image-workflow-handoff-v1";
const IMAGE_WORKFLOW_MAX_AGE_MS = 20 * 60 * 1000;
const IMAGE_WORKFLOW_LIBRARY_STORAGE_KEY = "utiliora-image-workflow-library-v1";
const IMAGE_WORKFLOW_RUN_HISTORY_STORAGE_KEY = "utiliora-image-workflow-run-history-v1";
const IMAGE_WORKFLOW_RUN_HISTORY_LIMIT = 40;

const IMAGE_TOOL_ROUTE_SLUGS: Record<ImageToolId, string> = {
  "qr-code-generator": "qr-code-generator",
  "color-picker": "color-picker",
  "hex-rgb-converter": "hex-rgb-converter",
  "background-remover": "background-remover",
  "image-resizer": "image-resizer",
  "image-compressor": "image-compressor",
  "jpg-to-png": "jpg-to-png-converter",
  "png-to-webp": "png-to-webp-converter",
  "image-cropper": "image-cropper",
  "barcode-generator": "barcode-generator",
  "image-to-pdf": "image-to-pdf-converter",
  "pdf-merge": "pdf-merge",
  "pdf-split": "pdf-split",
  "pdf-compressor": "pdf-compressor",
  "pdf-to-word": "pdf-to-word-converter",
  "word-to-pdf": "word-to-pdf-converter",
  "pdf-to-jpg": "pdf-to-jpg-converter",
};

const IMAGE_TOOL_LABELS: Record<ImageToolId, string> = {
  "qr-code-generator": "QR Code Generator",
  "color-picker": "Color Picker",
  "hex-rgb-converter": "HEX-RGB Converter",
  "background-remover": "Background Remover",
  "image-resizer": "Image Resizer",
  "image-compressor": "Image Compressor",
  "jpg-to-png": "JPG -> PNG",
  "png-to-webp": "PNG -> WebP",
  "image-cropper": "Image Cropper",
  "barcode-generator": "Barcode Generator",
  "image-to-pdf": "Image -> PDF",
  "pdf-merge": "PDF Merge",
  "pdf-split": "PDF Split",
  "pdf-compressor": "PDF Compressor",
  "pdf-to-word": "PDF -> Word",
  "word-to-pdf": "Word -> PDF",
  "pdf-to-jpg": "PDF -> JPG",
};

const IMAGE_WORKFLOW_TARGET_OPTIONS: Partial<Record<ImageToolId, ImageToolId[]>> = {
  "background-remover": ["image-cropper", "image-compressor", "png-to-webp", "image-to-pdf", "image-resizer"],
  "image-resizer": ["background-remover", "image-compressor", "png-to-webp", "image-cropper", "image-to-pdf", "jpg-to-png"],
  "image-compressor": ["background-remover", "png-to-webp", "image-cropper", "image-to-pdf", "image-resizer", "jpg-to-png"],
  "jpg-to-png": ["background-remover", "png-to-webp", "image-cropper", "image-to-pdf", "image-compressor", "image-resizer"],
  "png-to-webp": ["background-remover", "image-compressor", "image-cropper", "image-to-pdf", "image-resizer", "jpg-to-png"],
  "image-cropper": ["background-remover", "image-compressor", "png-to-webp", "image-to-pdf", "image-resizer", "jpg-to-png"],
  "pdf-to-jpg": ["image-cropper", "image-compressor", "png-to-webp", "image-resizer", "image-to-pdf"],
};

function getImageToolLabel(id: ImageToolId): string {
  return IMAGE_TOOL_LABELS[id] ?? id;
}

function getImageWorkflowTargetOptions(sourceToolId: ImageToolId): ImageToolId[] {
  return IMAGE_WORKFLOW_TARGET_OPTIONS[sourceToolId] ?? [];
}

function sanitizeImageWorkflowName(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.replace(/\s+/g, " ").slice(0, 60);
}

function normalizeWorkflowTargets(sourceToolId: ImageToolId, targets: Array<ImageToolId | "">): ImageToolId[] {
  const filtered = targets.filter((target): target is ImageToolId => Boolean(target && target !== sourceToolId));
  return [...new Set(filtered)].slice(0, 5);
}

function readImageWorkflowLibrary(): SavedImageWorkflow[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(IMAGE_WORKFLOW_LIBRARY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedImageWorkflow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeImageWorkflowLibrary(next: SavedImageWorkflow[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(IMAGE_WORKFLOW_LIBRARY_STORAGE_KEY, JSON.stringify(next.slice(0, 60)));
  } catch {
    // Ignore storage failures.
  }
}

function readImageWorkflowRunHistory(): ImageWorkflowRunHistoryEntry[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(IMAGE_WORKFLOW_RUN_HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImageWorkflowRunHistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeImageWorkflowRunHistory(next: ImageWorkflowRunHistoryEntry[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      IMAGE_WORKFLOW_RUN_HISTORY_STORAGE_KEY,
      JSON.stringify(next.slice(0, IMAGE_WORKFLOW_RUN_HISTORY_LIMIT)),
    );
  } catch {
    // Ignore storage failures.
  }
}

function getNextWorkflowStepContext(
  runContext: ImageWorkflowRunContext | undefined,
  currentToolId: ImageToolId,
): { nextToolId: ImageToolId; nextRunContext: ImageWorkflowRunContext } | null {
  if (!runContext?.steps?.length) return null;
  if (runContext.steps[runContext.currentStepIndex] !== currentToolId) return null;
  const nextStepIndex = runContext.currentStepIndex + 1;
  if (nextStepIndex >= runContext.steps.length) return null;
  return {
    nextToolId: runContext.steps[nextStepIndex],
    nextRunContext: {
      ...runContext,
      currentStepIndex: nextStepIndex,
    },
  };
}

function createImageWorkflowRunContext(
  workflow: SavedImageWorkflow,
  targetStepIndex: number,
): ImageWorkflowRunContext {
  return {
    runId: crypto.randomUUID(),
    workflowId: workflow.id,
    workflowName: workflow.name,
    sourceToolId: workflow.sourceToolId,
    steps: workflow.steps,
    currentStepIndex: targetStepIndex,
    startedAt: Date.now(),
  };
}

function createDefaultWorkflowTargets(sourceToolId: ImageToolId): Array<ImageToolId | ""> {
  const options = getImageWorkflowTargetOptions(sourceToolId);
  return [options[0] ?? "", options[1] ?? "", ""];
}

function getSourceToolIdFromImageMode(mode: ImageMode): ImageToolId {
  if (mode === "resize") return "image-resizer";
  if (mode === "compress") return "image-compressor";
  if (mode === "jpg-to-png") return "jpg-to-png";
  return "png-to-webp";
}

function buildSavedWorkflowSteps(sourceToolId: ImageToolId, targets: Array<ImageToolId | "">): ImageToolId[] {
  const normalizedTargets = normalizeWorkflowTargets(sourceToolId, targets);
  return [sourceToolId, ...normalizedTargets];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to encode file."));
      }
    };
    reader.onerror = () => reject(new Error("Failed to encode file."));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToFile(dataUrl: string, fileName: string, fallbackMimeType = "image/png"): File | null {
  const parts = dataUrl.split(",");
  if (parts.length < 2) return null;
  const meta = parts[0];
  const base64 = parts[1];
  const mimeMatch = /data:([^;]+);base64/.exec(meta);
  const mimeType = mimeMatch?.[1] ?? fallbackMimeType;

  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return new File([bytes], fileName, { type: mimeType });
  } catch {
    return null;
  }
}

async function handoffImageResultToTool(options: {
  sourceToolId: ImageToolId;
  targetToolId: ImageToolId;
  fileName: string;
  mimeType: string;
  sourceUrl: string;
  runContext?: ImageWorkflowRunContext;
}): Promise<boolean> {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return false;
  try {
    const response = await fetch(options.sourceUrl);
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    const payload: ImageWorkflowHandoffPayload = {
      sourceToolId: options.sourceToolId,
      targetToolId: options.targetToolId,
      fileName: options.fileName,
      mimeType: options.mimeType || blob.type || "image/png",
      dataUrl,
      createdAt: Date.now(),
      ...(options.runContext ? { runContext: options.runContext } : {}),
    };
    sessionStorage.setItem(IMAGE_WORKFLOW_STORAGE_KEY, JSON.stringify(payload));
    window.location.assign(`/image-tools/${IMAGE_TOOL_ROUTE_SLUGS[options.targetToolId]}`);
    return true;
  } catch {
    return false;
  }
}

function consumeImageWorkflowHandoff(targetToolId: ImageToolId): ImageWorkflowIncomingFile | null {
  if (typeof window === "undefined" || typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(IMAGE_WORKFLOW_STORAGE_KEY);
  if (!raw) return null;

  let parsed: ImageWorkflowHandoffPayload;
  try {
    parsed = JSON.parse(raw) as ImageWorkflowHandoffPayload;
  } catch {
    sessionStorage.removeItem(IMAGE_WORKFLOW_STORAGE_KEY);
    return null;
  }

  if (parsed.targetToolId !== targetToolId) return null;
  sessionStorage.removeItem(IMAGE_WORKFLOW_STORAGE_KEY);
  if (!parsed.createdAt || Date.now() - parsed.createdAt > IMAGE_WORKFLOW_MAX_AGE_MS) return null;

  const file = dataUrlToFile(parsed.dataUrl, parsed.fileName, parsed.mimeType);
  if (!file) return null;

  const runContext =
    parsed.runContext &&
    typeof parsed.runContext === "object" &&
    Array.isArray(parsed.runContext.steps) &&
    typeof parsed.runContext.currentStepIndex === "number"
      ? (parsed.runContext as ImageWorkflowRunContext)
      : undefined;

  return {
    token: `${parsed.targetToolId}-${parsed.createdAt}-${parsed.fileName}`,
    sourceToolId: parsed.sourceToolId,
    file,
    ...(runContext ? { runContext } : {}),
  };
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

interface ToolSessionEntry {
  id: string;
  label: string;
  createdAt: number;
  updatedAt: number;
}

interface UseToolSessionOptions {
  toolKey: string;
  defaultSessionLabel: string;
  newSessionPrefix: string;
  defaultSessionId?: string;
}

interface UseToolSessionResult {
  isReady: boolean;
  sessionId: string;
  sessionLabel: string;
  sessions: ToolSessionEntry[];
  storageKey: (baseKey: string) => string;
  selectSession: (nextSessionId: string) => void;
  createSession: () => void;
  renameSession: (nextLabel: string) => void;
}

interface ToolSessionControlsProps {
  sessionId: string;
  sessionLabel: string;
  sessions: ToolSessionEntry[];
  description?: string;
  onSelectSession: (nextSessionId: string) => void;
  onCreateSession: () => void;
  onRenameSession: (nextLabel: string) => void;
}

const PRODUCTIVITY_SESSION_QUERY_KEY = "session";
const TOOL_SESSION_MAX_ENTRIES = 30;
const TOOL_SESSION_DEFAULT_ID = "default";
const TOOL_SESSION_ID_PATTERN = /^[a-z0-9][a-z0-9-_]{1,47}$/i;

function sanitizeToolSessionId(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (!normalized) return null;
  return TOOL_SESSION_ID_PATTERN.test(normalized) ? normalized : null;
}

function sanitizeToolSessionLabel(value: string, fallback: string): string {
  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 48);
  return normalized || fallback;
}

function sortToolSessions(entries: ToolSessionEntry[]): ToolSessionEntry[] {
  return [...entries].sort((left, right) => right.updatedAt - left.updatedAt || left.label.localeCompare(right.label));
}

function readToolSessionEntries(storageKey: string): ToolSessionEntry[] {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const candidate = entry as Partial<ToolSessionEntry>;
        const id = sanitizeToolSessionId(candidate.id);
        if (!id) return null;
        const createdAt = typeof candidate.createdAt === "number" ? candidate.createdAt : Date.now();
        const updatedAt = typeof candidate.updatedAt === "number" ? candidate.updatedAt : createdAt;
        return {
          id,
          label: sanitizeToolSessionLabel(candidate.label ?? "", `Session ${id}`),
          createdAt,
          updatedAt,
        } satisfies ToolSessionEntry;
      })
      .filter((entry): entry is ToolSessionEntry => Boolean(entry));
    return sortToolSessions(normalized).slice(0, TOOL_SESSION_MAX_ENTRIES);
  } catch {
    return [];
  }
}

function writeToolSessionEntries(storageKey: string, entries: ToolSessionEntry[]): void {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(sortToolSessions(entries).slice(0, TOOL_SESSION_MAX_ENTRIES)));
  } catch {
    // Ignore storage failures.
  }
}

function setToolSessionQueryParam(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get(PRODUCTIVITY_SESSION_QUERY_KEY) === sessionId) return;
    url.searchParams.set(PRODUCTIVITY_SESSION_QUERY_KEY, sessionId);
    const query = url.searchParams.toString();
    const nextUrl = `${url.pathname}${query ? `?${query}` : ""}${url.hash}`;
    window.history.replaceState({}, "", nextUrl);
  } catch {
    // Ignore URL rewriting failures.
  }
}

function createToolSessionId(prefix: string): string {
  const normalizedPrefix = sanitizeToolSessionId(prefix) ?? "session";
  return `${normalizedPrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function useToolSession({
  toolKey,
  defaultSessionLabel,
  newSessionPrefix,
  defaultSessionId = TOOL_SESSION_DEFAULT_ID,
}: UseToolSessionOptions): UseToolSessionResult {
  const normalizedDefaultSessionId = sanitizeToolSessionId(defaultSessionId) ?? TOOL_SESSION_DEFAULT_ID;
  const directoryStorageKey = useMemo(() => `utiliora-${toolKey}-sessions-v1`, [toolKey]);
  const lastSessionStorageKey = useMemo(() => `utiliora-${toolKey}-last-session-v1`, [toolKey]);
  const [sessionId, setSessionId] = useState(normalizedDefaultSessionId);
  const [sessions, setSessions] = useState<ToolSessionEntry[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    let fromUrl: string | null = null;
    let fromStorage: string | null = null;
    try {
      fromUrl = sanitizeToolSessionId(new URLSearchParams(window.location.search).get(PRODUCTIVITY_SESSION_QUERY_KEY));
    } catch {
      fromUrl = null;
    }
    try {
      fromStorage = sanitizeToolSessionId(localStorage.getItem(lastSessionStorageKey));
    } catch {
      fromStorage = null;
    }
    const resolvedSessionId = fromUrl ?? fromStorage ?? normalizedDefaultSessionId;
    const existing = readToolSessionEntries(directoryStorageKey);
    const existingEntry = existing.find((entry) => entry.id === resolvedSessionId);
    const activeEntry: ToolSessionEntry = existingEntry
      ? { ...existingEntry, updatedAt: now }
      : {
          id: resolvedSessionId,
          label:
            resolvedSessionId === normalizedDefaultSessionId
              ? defaultSessionLabel
              : `${defaultSessionLabel} ${existing.length + 1}`,
          createdAt: now,
          updatedAt: now,
        };
    const nextSessions = sortToolSessions([activeEntry, ...existing.filter((entry) => entry.id !== resolvedSessionId)]).slice(
      0,
      TOOL_SESSION_MAX_ENTRIES,
    );
    setSessions(nextSessions);
    setSessionId(activeEntry.id);
    setToolSessionQueryParam(activeEntry.id);
    try {
      localStorage.setItem(lastSessionStorageKey, activeEntry.id);
    } catch {
      // Ignore storage failures.
    }
    setIsReady(true);
  }, [defaultSessionLabel, directoryStorageKey, lastSessionStorageKey, normalizedDefaultSessionId]);

  useEffect(() => {
    if (!isReady) return;
    writeToolSessionEntries(directoryStorageKey, sessions);
  }, [directoryStorageKey, isReady, sessions]);

  useEffect(() => {
    if (!isReady) return;
    const now = Date.now();
    setToolSessionQueryParam(sessionId);
    try {
      localStorage.setItem(lastSessionStorageKey, sessionId);
    } catch {
      // Ignore storage failures.
    }
    setSessions((current) => {
      const existing = current.find((entry) => entry.id === sessionId);
      if (existing) {
        return sortToolSessions(
          current.map((entry) => (entry.id === sessionId ? { ...entry, updatedAt: now } : entry)),
        ).slice(0, TOOL_SESSION_MAX_ENTRIES);
      }
      const nextEntry: ToolSessionEntry = {
        id: sessionId,
        label:
          sessionId === normalizedDefaultSessionId
            ? defaultSessionLabel
            : `${defaultSessionLabel} ${current.length + 1}`,
        createdAt: now,
        updatedAt: now,
      };
      return sortToolSessions([nextEntry, ...current]).slice(0, TOOL_SESSION_MAX_ENTRIES);
    });
  }, [defaultSessionLabel, isReady, lastSessionStorageKey, normalizedDefaultSessionId, sessionId]);

  const activeSession = useMemo(
    () => sessions.find((entry) => entry.id === sessionId) ?? null,
    [sessionId, sessions],
  );
  const sessionLabel = activeSession?.label ?? defaultSessionLabel;

  const storageKey = useCallback(
    (baseKey: string) => `${baseKey}:${sessionId}`,
    [sessionId],
  );

  const selectSession = useCallback((nextSessionId: string) => {
    const sanitized = sanitizeToolSessionId(nextSessionId);
    if (!sanitized) return;
    setSessionId(sanitized);
  }, []);

  const createSession = useCallback(() => {
    const nextId = createToolSessionId(newSessionPrefix);
    const now = Date.now();
    setSessions((current) =>
      sortToolSessions([
        {
          id: nextId,
          label: `${defaultSessionLabel} ${current.length + 1}`,
          createdAt: now,
          updatedAt: now,
        },
        ...current,
      ]).slice(0, TOOL_SESSION_MAX_ENTRIES),
    );
    setSessionId(nextId);
  }, [defaultSessionLabel, newSessionPrefix]);

  const renameSession = useCallback(
    (nextLabel: string) => {
      const normalizedLabel = sanitizeToolSessionLabel(nextLabel, defaultSessionLabel);
      setSessions((current) =>
        current.map((entry) =>
          entry.id === sessionId ? { ...entry, label: normalizedLabel, updatedAt: Date.now() } : entry,
        ),
      );
    },
    [defaultSessionLabel, sessionId],
  );

  return {
    isReady,
    sessionId,
    sessionLabel,
    sessions,
    storageKey,
    selectSession,
    createSession,
    renameSession,
  };
}

function ToolSessionControls({
  sessionId,
  sessionLabel,
  sessions,
  description,
  onSelectSession,
  onCreateSession,
  onRenameSession,
}: ToolSessionControlsProps) {
  const [labelDraft, setLabelDraft] = useState(sessionLabel);

  useEffect(() => {
    setLabelDraft(sessionLabel);
  }, [sessionLabel]);

  return (
    <div className="mini-panel session-panel">
      <div className="panel-head">
        <h3>Workspace session</h3>
        <button className="action-button secondary" type="button" onClick={onCreateSession}>
          <Plus size={15} />
          New session
        </button>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Session</span>
          <select value={sessionId} onChange={(event) => onSelectSession(event.target.value)}>
            {sessions.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Session name</span>
          <input
            type="text"
            value={labelDraft}
            onChange={(event) => setLabelDraft(event.target.value)}
            onBlur={() => onRenameSession(labelDraft)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              onRenameSession(labelDraft);
              (event.currentTarget as HTMLInputElement).blur();
            }}
          />
        </label>
      </div>
      {description ? <p className="supporting-text">{description}</p> : null}
    </div>
  );
}

function formatCurrencyWithCode(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value);
  } catch {
    return `${formatNumericValue(value)} ${currency}`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function openPrintWindow(title: string, bodyHtml: string, extraCss = ""): boolean {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
  if (!printWindow) return false;

  const markup = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      padding: 20px;
      font-family: "Segoe UI", Arial, sans-serif;
      color: #13161a;
      background: #fff;
      line-height: 1.45;
    }
    h1, h2, h3 { margin: 0 0 8px; }
    p { margin: 0 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d3dbe5; padding: 8px; text-align: left; }
    th { background: #f4f6f8; }
    .muted { color: #5d6a78; }
    @media print {
      body { padding: 0; }
    }
    ${extraCss}
  </style>
</head>
<body>${bodyHtml}</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(markup);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 300);
  return true;
}

function splitNonEmptyLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function resolveUrlFromBase(baseUrl: string, pathOrUrl: string): string | null {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return null;

  try {
    const full = new URL(trimmed);
    if (full.protocol !== "http:" && full.protocol !== "https:") return null;
    return full.toString();
  } catch {
    try {
      const normalizedBase = baseUrl.trim() || "https://example.com";
      const normalizedPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
      const joined = new URL(normalizedPath, normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`);
      if (joined.protocol !== "http:" && joined.protocol !== "https:") return null;
      return joined.toString();
    } catch {
      return null;
    }
  }
}

interface CalculatorScenarioSnapshot {
  id: string;
  label: string;
  createdAt: number;
  values: Record<string, string>;
  currency: string;
}

type GoalDirection = "at-most" | "at-least";

interface CalculatorGoalConfig {
  metricLabel: string;
  target: number;
  direction: GoalDirection;
  lastReachedAt: number | null;
}

interface CalculatorComparisonRow {
  label: string;
  values: string[];
  deltas: Array<number | null>;
}

interface FinanceProfilePreset {
  id: string;
  label: string;
  description: string;
  values: Record<string, string>;
}

interface CalculatorFunnelLink {
  id: CalculatorId;
  label: string;
  description: string;
}

const FINANCE_PROFILE_STORAGE_KEY = "utiliora-calculator-finance-profile-v1";

const FINANCE_PROFILE_PRESETS: FinanceProfilePreset[] = [
  {
    id: "single",
    label: "Single Professional",
    description: "Balanced debt and savings assumptions for one income household.",
    values: {
      grossMonthlyIncome: "7000",
      coBorrowerMonthlyIncome: "0",
      otherMonthlyIncome: "0",
      monthlyHousingPayment: "1800",
      monthlyPropertyTax: "250",
      monthlyInsuranceHoa: "150",
      monthlyCarPayment: "280",
      monthlyStudentLoanPayment: "180",
      monthlyCreditCardPayments: "120",
      monthlyPersonalLoanPayments: "0",
      monthlyChildSupportAlimony: "0",
      monthlyOtherDebts: "0",
      annualSalary: "84000",
      federalTaxRate: "18",
      stateTaxRate: "5",
      retirementPercent: "8",
      monthlyBenefitsCost: "220",
      targetMonthlyIncome: "5200",
      monthlyExpenses: "1800",
      billableHoursPerMonth: "80",
      desiredProfitPercent: "20",
      balance: "6500",
      apr: "21.9",
      monthlyPayment: "280",
      targetAmount: "25000",
      currentSavings: "4000",
      years: "3",
      annualReturn: "5",
    },
  },
  {
    id: "couple",
    label: "Dual Income Couple",
    description: "Two-income household with moderate recurring debt obligations.",
    values: {
      grossMonthlyIncome: "8500",
      coBorrowerMonthlyIncome: "3200",
      otherMonthlyIncome: "300",
      monthlyHousingPayment: "2600",
      monthlyPropertyTax: "420",
      monthlyInsuranceHoa: "240",
      monthlyCarPayment: "520",
      monthlyStudentLoanPayment: "260",
      monthlyCreditCardPayments: "190",
      monthlyPersonalLoanPayments: "140",
      monthlyChildSupportAlimony: "0",
      monthlyOtherDebts: "100",
      annualSalary: "142000",
      federalTaxRate: "22",
      stateTaxRate: "6",
      retirementPercent: "10",
      monthlyBenefitsCost: "420",
      targetMonthlyIncome: "7800",
      monthlyExpenses: "3200",
      billableHoursPerMonth: "100",
      desiredProfitPercent: "25",
      balance: "9800",
      apr: "19.5",
      monthlyPayment: "420",
      targetAmount: "60000",
      currentSavings: "12000",
      years: "5",
      annualReturn: "5.5",
    },
  },
  {
    id: "family",
    label: "Family Budget",
    description: "Higher housing and childcare pressure with conservative debt targets.",
    values: {
      grossMonthlyIncome: "9200",
      coBorrowerMonthlyIncome: "2800",
      otherMonthlyIncome: "700",
      monthlyHousingPayment: "3200",
      monthlyPropertyTax: "520",
      monthlyInsuranceHoa: "320",
      monthlyCarPayment: "650",
      monthlyStudentLoanPayment: "210",
      monthlyCreditCardPayments: "260",
      monthlyPersonalLoanPayments: "180",
      monthlyChildSupportAlimony: "350",
      monthlyOtherDebts: "170",
      annualSalary: "165000",
      federalTaxRate: "24",
      stateTaxRate: "7",
      retirementPercent: "9",
      monthlyBenefitsCost: "560",
      targetMonthlyIncome: "9600",
      monthlyExpenses: "5200",
      billableHoursPerMonth: "120",
      desiredProfitPercent: "20",
      balance: "14500",
      apr: "20.5",
      monthlyPayment: "560",
      targetAmount: "90000",
      currentSavings: "18000",
      years: "6",
      annualReturn: "5",
    },
  },
  {
    id: "business",
    label: "Small Business Operator",
    description: "Owner-operator profile with variable cash flow and stronger margin targets.",
    values: {
      grossMonthlyIncome: "11000",
      coBorrowerMonthlyIncome: "0",
      otherMonthlyIncome: "1800",
      monthlyHousingPayment: "2800",
      monthlyPropertyTax: "380",
      monthlyInsuranceHoa: "220",
      monthlyCarPayment: "540",
      monthlyStudentLoanPayment: "0",
      monthlyCreditCardPayments: "310",
      monthlyPersonalLoanPayments: "450",
      monthlyChildSupportAlimony: "0",
      monthlyOtherDebts: "240",
      annualSalary: "132000",
      federalTaxRate: "24",
      stateTaxRate: "5",
      retirementPercent: "12",
      monthlyBenefitsCost: "300",
      targetMonthlyIncome: "12000",
      monthlyExpenses: "4800",
      billableHoursPerMonth: "90",
      desiredProfitPercent: "30",
      balance: "21000",
      apr: "23.5",
      monthlyPayment: "900",
      targetAmount: "120000",
      currentSavings: "25000",
      years: "5",
      annualReturn: "6",
    },
  },
];

const FINANCE_CALCULATORS = new Set<CalculatorId>([
  "loan-emi-calculator",
  "mortgage-calculator",
  "debt-to-income-calculator",
  "compound-interest-calculator",
  "simple-interest-calculator",
  "inflation-calculator",
  "currency-converter-calculator",
  "crypto-profit-calculator",
  "credit-card-payoff-calculator",
  "salary-after-tax-calculator",
  "roi-calculator",
  "profit-margin-calculator",
  "markup-calculator",
  "vat-calculator",
  "savings-goal-calculator",
  "break-even-calculator",
  "startup-cost-estimator",
  "freelance-rate-calculator",
]);

const CALCULATOR_FUNNEL_LINKS: Partial<Record<CalculatorId, CalculatorFunnelLink[]>> = {
  "loan-emi-calculator": [
    {
      id: "debt-to-income-calculator",
      label: "Check DTI impact",
      description: "See whether this loan payment keeps your debt ratios lender-friendly.",
    },
    {
      id: "mortgage-calculator",
      label: "Move to mortgage plan",
      description: "Model full home-payment structure with taxes, insurance, and HOA.",
    },
    {
      id: "credit-card-payoff-calculator",
      label: "Optimize debt stack",
      description: "Reallocate cash flow to reduce high-interest debt first.",
    },
  ],
  "mortgage-calculator": [
    {
      id: "debt-to-income-calculator",
      label: "Qualify this payment",
      description: "Push your mortgage assumptions into DTI to test eligibility.",
    },
    {
      id: "savings-goal-calculator",
      label: "Plan down payment",
      description: "Create a timeline to build your down-payment target.",
    },
  ],
  "debt-to-income-calculator": [
    {
      id: "mortgage-calculator",
      label: "Convert to home budget",
      description: "Use DTI results to build a workable housing payment scenario.",
    },
    {
      id: "loan-emi-calculator",
      label: "Estimate new-loan EMI",
      description: "Simulate additional debt before taking a loan offer.",
    },
    {
      id: "credit-card-payoff-calculator",
      label: "Reduce DTI faster",
      description: "Plan a card-payoff strategy to improve your back-end DTI.",
    },
  ],
  "credit-card-payoff-calculator": [
    {
      id: "debt-to-income-calculator",
      label: "Track DTI improvement",
      description: "See how credit-card payment changes can improve qualification odds.",
    },
    {
      id: "savings-goal-calculator",
      label: "Rebuild reserves",
      description: "Create an emergency-fund plan after debt cleanup.",
    },
  ],
  "salary-after-tax-calculator": [
    {
      id: "savings-goal-calculator",
      label: "Allocate take-home",
      description: "Turn your net monthly pay into a concrete savings timeline.",
    },
    {
      id: "debt-to-income-calculator",
      label: "Measure affordability",
      description: "Convert income assumptions into lender-style debt ratios.",
    },
  ],
};

function sanitizeScenarioLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 60);
}

function parseDisplayNumber(value: string): number | null {
  const normalized = value.replace(/,/g, "");
  const matches = normalized.match(/-?\d+(\.\d+)?/g);
  if (!matches?.length) return null;
  const parsed = Number(matches[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRowNumericValue(rows: ResultRow[], label: string): number | null {
  const row = rows.find((entry) => entry.label === label);
  if (!row) return null;
  return parseDisplayNumber(row.value);
}

function estimateMonthlyPayment(principal: number, annualRate: number, months: number): number {
  const safePrincipal = Math.max(0, principal);
  const safeMonths = Math.max(1, Math.round(months));
  const monthlyRate = Math.max(0, annualRate) / 1200;
  if (monthlyRate === 0) return safePrincipal / safeMonths;
  const factor = Math.pow(1 + monthlyRate, safeMonths);
  return (safePrincipal * monthlyRate * factor) / (factor - 1);
}

function buildFunnelPrefillValues(
  sourceId: CalculatorId,
  targetId: CalculatorId,
  values: Record<string, string>,
): Record<string, string> | null {
  if (sourceId === "mortgage-calculator" && targetId === "debt-to-income-calculator") {
    const homePrice = Math.max(0, safeNumberValue(values.homePrice));
    const downPayment = Math.max(0, safeNumberValue(values.downPayment));
    const annualRate = Math.max(0, safeNumberValue(values.annualRate));
    const years = Math.max(1, safeNumberValue(values.years));
    const annualPropertyTaxRate = Math.max(0, safeNumberValue(values.annualPropertyTaxRate));
    const annualHomeInsurance = Math.max(0, safeNumberValue(values.annualHomeInsurance));
    const monthlyHoa = Math.max(0, safeNumberValue(values.monthlyHoa));
    const principal = Math.max(0, homePrice - downPayment);
    const monthlyHousingPayment = estimateMonthlyPayment(principal, annualRate, years * 12);
    const monthlyPropertyTax = (homePrice * (annualPropertyTaxRate / 100)) / 12;
    const monthlyInsuranceHoa = annualHomeInsurance / 12 + monthlyHoa;
    return {
      monthlyHousingPayment: monthlyHousingPayment.toFixed(2),
      monthlyPropertyTax: monthlyPropertyTax.toFixed(2),
      monthlyInsuranceHoa: monthlyInsuranceHoa.toFixed(2),
    };
  }

  if (sourceId === "loan-emi-calculator" && targetId === "debt-to-income-calculator") {
    const principal = Math.max(0, safeNumberValue(values.principal));
    const annualRate = Math.max(0, safeNumberValue(values.annualRate));
    const months = Math.max(1, safeNumberValue(values.months));
    const emi = estimateMonthlyPayment(principal, annualRate, months);
    return { monthlyPersonalLoanPayments: emi.toFixed(2) };
  }

  if (sourceId === "credit-card-payoff-calculator" && targetId === "debt-to-income-calculator") {
    return {
      monthlyCreditCardPayments: Math.max(0, safeNumberValue(values.monthlyPayment)).toFixed(2),
    };
  }

  if (sourceId === "debt-to-income-calculator" && targetId === "credit-card-payoff-calculator") {
    return {
      monthlyPayment: Math.max(25, safeNumberValue(values.monthlyCreditCardPayments)).toFixed(0),
      apr: "21.9",
    };
  }

  if (sourceId === "debt-to-income-calculator" && targetId === "mortgage-calculator") {
    const monthlyHousing = Math.max(
      0,
      safeNumberValue(values.monthlyHousingPayment) +
        safeNumberValue(values.monthlyPropertyTax) +
        safeNumberValue(values.monthlyInsuranceHoa),
    );
    const suggestedHomePrice = monthlyHousing > 0 ? monthlyHousing * 200 : 350000;
    return {
      homePrice: Math.round(suggestedHomePrice).toString(),
      downPayment: Math.round(suggestedHomePrice * 0.2).toString(),
      annualRate: "6.5",
      years: "30",
      annualPropertyTaxRate: "1.2",
      annualHomeInsurance: "1800",
      monthlyHoa: "0",
    };
  }

  if (sourceId === "salary-after-tax-calculator" && targetId === "savings-goal-calculator") {
    const annualSalary = Math.max(0, safeNumberValue(values.annualSalary));
    const federalTaxRate = Math.max(0, safeNumberValue(values.federalTaxRate));
    const stateTaxRate = Math.max(0, safeNumberValue(values.stateTaxRate));
    const retirementPercent = Math.max(0, safeNumberValue(values.retirementPercent));
    const monthlyBenefitsCost = Math.max(0, safeNumberValue(values.monthlyBenefitsCost));
    const grossMonthly = annualSalary / 12;
    const monthlyTaxes = grossMonthly * ((federalTaxRate + stateTaxRate) / 100);
    const monthlyRetirement = grossMonthly * (retirementPercent / 100);
    const netMonthly = grossMonthly - monthlyTaxes - monthlyRetirement - monthlyBenefitsCost;
    const targetMonthlySavings = Math.max(0, netMonthly * 0.2);
    return {
      targetAmount: Math.round(targetMonthlySavings * 36).toString(),
      currentSavings: "0",
      years: "3",
      annualReturn: "5",
    };
  }

  return null;
}

function buildSmartActionPlan(
  id: CalculatorId,
  values: Record<string, string>,
  resultRows: ResultRow[],
  currency: string,
): string[] {
  const formatMoney = (value: number) => formatCurrencyWithCode(value, currency);
  const plans: string[] = [];

  if (id === "debt-to-income-calculator") {
    const backEnd = getRowNumericValue(resultRows, "Back-end DTI (Total)") ?? 0;
    const targetBack = Math.max(0, safeNumberValue(values.targetBackEndDti));
    const debtReductionNeeded = getRowNumericValue(resultRows, "Debt Reduction Needed");
    const additionalCapacity = getRowNumericValue(resultRows, "Additional Debt Capacity");
    if (backEnd > targetBack) {
      plans.push(
        debtReductionNeeded !== null
          ? `Cut recurring debt by about ${formatMoney(debtReductionNeeded)} per month to reach your target back-end DTI.`
          : "Reduce recurring debt payments and avoid taking new debt until back-end DTI drops below target.",
      );
      plans.push("Attack credit-card minimums first, then personal loans, to unlock DTI headroom quickly.");
    } else {
      plans.push(
        additionalCapacity !== null
          ? `You still have about ${formatMoney(additionalCapacity)} monthly debt capacity under your target ratio.`
          : "Your current debt load is within target. Preserve this margin by limiting discretionary debt.",
      );
      plans.push("Keep total housing + debt fixed even if income rises, and direct the difference to reserves.");
    }
    return plans;
  }

  if (id === "credit-card-payoff-calculator") {
    const balance = Math.max(0, safeNumberValue(values.balance));
    const apr = Math.max(0, safeNumberValue(values.apr));
    const monthlyPayment = Math.max(1, safeNumberValue(values.monthlyPayment));
    const monthlyInterest = balance * (apr / 1200);
    const paymentPlusTen = monthlyPayment * 1.1;
    plans.push(
      `Increase payment from ${formatMoney(monthlyPayment)} to ${formatMoney(paymentPlusTen)} to shorten payoff and reduce interest drag.`,
    );
    plans.push(
      `Current first-month interest is about ${formatMoney(monthlyInterest)}; keep autopay above this level to keep principal shrinking.`,
    );
    return plans;
  }

  if (id === "loan-emi-calculator") {
    const principal = Math.max(0, safeNumberValue(values.principal));
    const months = Math.max(1, Math.round(safeNumberValue(values.months)));
    const extraPrincipal = Math.max(25, principal * 0.0025);
    plans.push(`Add ${formatMoney(extraPrincipal)} monthly toward principal to compress term and total interest.`);
    plans.push(`Before refinancing, compare your current tenor (${months} months) against a shorter term at similar EMI.`);
    return plans;
  }

  if (id === "mortgage-calculator") {
    const homePrice = Math.max(0, safeNumberValue(values.homePrice));
    const downPayment = Math.max(0, safeNumberValue(values.downPayment));
    const targetDown = homePrice * 0.2;
    const downGap = Math.max(0, targetDown - downPayment);
    plans.push(
      downGap > 0
        ? `Increase down payment by about ${formatMoney(downGap)} to approach 20% and improve loan terms.`
        : "Your down payment is near or above 20%; focus next on total housing payment and emergency reserves.",
    );
    plans.push("Pressure-test housing cost at +1% rate to ensure affordability before committing.");
    return plans;
  }

  if (id === "savings-goal-calculator") {
    const requiredMonthly = getRowNumericValue(resultRows, "Required Monthly Savings") ?? 0;
    plans.push(
      `Automate at least ${formatMoney(requiredMonthly)} monthly to stay on track; run a second scenario with +10% contribution.`,
    );
    plans.push("Review progress monthly and redirect windfalls to this goal instead of extending timeline.");
    return plans;
  }

  if (id === "salary-after-tax-calculator") {
    const monthlyTakeHome = getRowNumericValue(resultRows, "Net Monthly Take-home") ?? 0;
    const monthlySavingsTarget = monthlyTakeHome * 0.2;
    plans.push(`Allocate ${formatMoney(monthlySavingsTarget)} (20% of monthly take-home) to savings/investment buckets first.`);
    plans.push("When pay increases, keep lifestyle fixed for one quarter and route the delta to debt and reserves.");
    return plans;
  }

  if (id === "freelance-rate-calculator") {
    const hourlyRate = getRowNumericValue(resultRows, "Target Hourly Rate") ?? 0;
    plans.push(`Quote at least ${formatMoney(hourlyRate)} hourly and include a revision cap in contracts.`);
    plans.push("Track non-billable hours weekly; if they exceed 30%, raise rates or narrow scope.");
    return plans;
  }

  return [
    "Save 2-3 scenarios and compare outcomes before making final decisions.",
    "Translate your preferred outcome into a monthly target and track it as a goal in this workspace.",
  ];
}

function CalculatorTool({ id }: { id: CalculatorId }) {
  const toolSession = useToolSession({
    toolKey: `calculator-${id}`,
    defaultSessionLabel: "Calculator workspace",
    newSessionPrefix: "calc",
  });
  const fields = calculatorFields[id];
  const supportsDisplayCurrency = CALCULATORS_WITH_DISPLAY_CURRENCY.has(id);
  const isFinanceCalculator = FINANCE_CALCULATORS.has(id);
  const defaultValues = useMemo(() => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue])), [fields]);
  const storageKey = toolSession.storageKey(`utiliora-calculator-values-${id}`);
  const autoModeKey = toolSession.storageKey(`utiliora-calculator-auto-${id}`);
  const currencyStorageKey = toolSession.storageKey(`utiliora-calculator-currency-${id}`);
  const scenarioStorageKey = toolSession.storageKey(`utiliora-calculator-scenarios-${id}`);
  const comparisonStorageKey = toolSession.storageKey(`utiliora-calculator-compare-${id}`);
  const goalStorageKey = toolSession.storageKey(`utiliora-calculator-goal-${id}`);
  const legacyStorageKey = `utiliora-calculator-values-${id}`;
  const legacyAutoModeKey = `utiliora-calculator-auto-${id}`;
  const legacyCurrencyStorageKey = `utiliora-calculator-currency-${id}`;
  const legacyScenarioStorageKey = `utiliora-calculator-scenarios-${id}`;
  const legacyComparisonStorageKey = `utiliora-calculator-compare-${id}`;
  const legacyGoalStorageKey = `utiliora-calculator-goal-${id}`;
  const isCurrencyConverter = id === "currency-converter-calculator";
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>(INVOICE_LOCAL_CURRENCIES);
  const [currencySource, setCurrencySource] = useState("local-fallback");
  const [resultRows, setResultRows] = useState<ResultRow[]>(runCalculator(id, defaultValues, { currency: "USD" }));
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const [showFullTable, setShowFullTable] = useState(false);
  const [rateStatus, setRateStatus] = useState("");
  const [rateMeta, setRateMeta] = useState<{ source: string; date: string } | null>(null);
  const [scenarioName, setScenarioName] = useState("");
  const [scenarios, setScenarios] = useState<CalculatorScenarioSnapshot[]>([]);
  const [comparisonScenarioIds, setComparisonScenarioIds] = useState<string[]>([]);
  const [goalConfig, setGoalConfig] = useState<CalculatorGoalConfig | null>(null);
  const [goalMetricLabel, setGoalMetricLabel] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDirection, setGoalDirection] = useState<GoalDirection>("at-most");
  const [selectedFinanceProfileId, setSelectedFinanceProfileId] = useState(FINANCE_PROFILE_PRESETS[0]?.id ?? "single");
  const presets = calculatorPresets[id] ?? [];
  const formatCalculatorCurrency = useCallback(
    (amount: number) => formatCurrencyValue(amount, selectedCurrency),
    [selectedCurrency],
  );

  const currencySelectOptions = useMemo(
    () => currencyOptions.map((currency) => ({ label: `${currency.code} - ${currency.name}`, value: currency.code })),
    [currencyOptions],
  );

  const renderFields = useMemo(() => {
    if (!isCurrencyConverter) return fields;
    return fields.map((field) => {
      if (field.name !== "fromCurrency" && field.name !== "toCurrency") return field;
      return {
        ...field,
        options: currencySelectOptions.length ? currencySelectOptions : field.options,
      };
    });
  }, [currencySelectOptions, fields, isCurrencyConverter]);

  const activeFinanceProfile = useMemo(
    () => FINANCE_PROFILE_PRESETS.find((profile) => profile.id === selectedFinanceProfileId) ?? FINANCE_PROFILE_PRESETS[0],
    [selectedFinanceProfileId],
  );

  const smartActionPlan = useMemo(
    () => buildSmartActionPlan(id, values, resultRows, selectedCurrency),
    [id, resultRows, selectedCurrency, values],
  );

  const funnelLinks = CALCULATOR_FUNNEL_LINKS[id] ?? [];

  useEffect(() => {
    setIsSessionHydrated(false);
    setValues(defaultValues);
    setSelectedCurrency("USD");
    setResultRows(runCalculator(id, defaultValues, { currency: "USD" }));
    setShowFullTable(false);
    setRateStatus("");
    setRateMeta(null);
    setScenarioName("");
    setScenarios([]);
    setComparisonScenarioIds([]);
    setGoalConfig(null);
    setGoalMetricLabel("");
    setGoalTarget("");
    setGoalDirection("at-most");
  }, [defaultValues, id]);

  useEffect(() => {
    if (!toolSession.isReady) return;
    setIsSessionHydrated(false);
    try {
      const useLegacyFallback = toolSession.sessionId === TOOL_SESSION_DEFAULT_ID;
      const savedValues =
        localStorage.getItem(storageKey) ??
        (useLegacyFallback ? localStorage.getItem(legacyStorageKey) : null);
      const savedAutoMode =
        localStorage.getItem(autoModeKey) ??
        (useLegacyFallback ? localStorage.getItem(legacyAutoModeKey) : null);
      const savedCurrency =
        localStorage.getItem(currencyStorageKey) ??
        (useLegacyFallback ? localStorage.getItem(legacyCurrencyStorageKey) : null);
      const nextValues: Record<string, string> = { ...defaultValues };
      let nextAutoCalculate = true;
      let nextCurrency = sanitizeCalculatorCurrencyCode(savedCurrency ?? undefined);

      if (savedValues) {
        const parsed = JSON.parse(savedValues) as Record<string, string>;
        Object.assign(nextValues, parsed);
      }
      if (savedAutoMode !== null) {
        nextAutoCalculate = savedAutoMode === "true";
      }

      const params = new URLSearchParams(window.location.search);
      const encodedState = params.get("state");
      if (encodedState) {
        const decoded = decodeBase64Url(encodedState);
        if (decoded) {
          try {
            const parsed = JSON.parse(decoded) as Partial<{
              values: Record<string, string>;
              currency: string;
              autoCalculate: boolean;
            }>;
            if (parsed.values && typeof parsed.values === "object") {
              Object.assign(nextValues, parsed.values);
            }
            if (typeof parsed.currency === "string") {
              nextCurrency = sanitizeCalculatorCurrencyCode(parsed.currency);
            }
            if (typeof parsed.autoCalculate === "boolean") {
              nextAutoCalculate = parsed.autoCalculate;
            }
          } catch {
            // Ignore malformed share payload and continue with saved/local values.
          }
        }
      }

      fields.forEach((field) => {
        const queryValue = params.get(field.name);
        if (queryValue !== null) {
          nextValues[field.name] = queryValue;
        }
      });
      const queryCurrency = params.get("displayCurrency");
      if (queryCurrency) {
        nextCurrency = sanitizeCalculatorCurrencyCode(queryCurrency);
      }

      setValues(nextValues);
      setAutoCalculate(nextAutoCalculate);
      setSelectedCurrency(nextCurrency);
      setResultRows(runCalculator(id, nextValues, { currency: nextCurrency }));
    } catch {
      // Ignore malformed storage values and continue with defaults.
    } finally {
      setIsSessionHydrated(true);
    }
  }, [
    autoModeKey,
    currencyStorageKey,
    defaultValues,
    fields,
    id,
    legacyAutoModeKey,
    legacyCurrencyStorageKey,
    legacyStorageKey,
    storageKey,
    toolSession.isReady,
    toolSession.sessionId,
  ]);

  useEffect(() => {
    try {
      const savedProfileId = localStorage.getItem(FINANCE_PROFILE_STORAGE_KEY);
      if (!savedProfileId) return;
      if (FINANCE_PROFILE_PRESETS.some((entry) => entry.id === savedProfileId)) {
        setSelectedFinanceProfileId(savedProfileId);
      }
    } catch {
      // Ignore storage failures.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(FINANCE_PROFILE_STORAGE_KEY, selectedFinanceProfileId);
    } catch {
      // Ignore storage failures.
    }
  }, [selectedFinanceProfileId]);

  useEffect(() => {
    if (!toolSession.isReady) return;
    try {
      const useLegacyFallback = toolSession.sessionId === TOOL_SESSION_DEFAULT_ID;
      const savedScenarios =
        localStorage.getItem(scenarioStorageKey) ??
        (useLegacyFallback ? localStorage.getItem(legacyScenarioStorageKey) : null);
      const parsedScenarios = savedScenarios ? (JSON.parse(savedScenarios) as CalculatorScenarioSnapshot[]) : [];
      const normalizedScenarios = Array.isArray(parsedScenarios)
        ? parsedScenarios
            .filter((entry) => entry && typeof entry.id === "string" && typeof entry.label === "string")
            .slice(0, 30)
        : [];
      setScenarios(normalizedScenarios);

      const savedComparisonIds =
        localStorage.getItem(comparisonStorageKey) ??
        (useLegacyFallback ? localStorage.getItem(legacyComparisonStorageKey) : null);
      const parsedComparisonIds = savedComparisonIds ? (JSON.parse(savedComparisonIds) as string[]) : [];
      const allowedIds = new Set(normalizedScenarios.map((entry) => entry.id));
      const normalizedComparisonIds = Array.isArray(parsedComparisonIds)
        ? parsedComparisonIds.filter((entry) => typeof entry === "string" && allowedIds.has(entry)).slice(0, 2)
        : [];
      setComparisonScenarioIds(normalizedComparisonIds);

      const savedGoal =
        localStorage.getItem(goalStorageKey) ??
        (useLegacyFallback ? localStorage.getItem(legacyGoalStorageKey) : null);
      if (!savedGoal) {
        setGoalConfig(null);
        return;
      }
      const parsedGoal = JSON.parse(savedGoal) as Partial<CalculatorGoalConfig>;
      if (
        typeof parsedGoal.metricLabel !== "string" ||
        typeof parsedGoal.target !== "number" ||
        !Number.isFinite(parsedGoal.target) ||
        (parsedGoal.direction !== "at-most" && parsedGoal.direction !== "at-least")
      ) {
        setGoalConfig(null);
        return;
      }
      const normalizedGoal: CalculatorGoalConfig = {
        metricLabel: parsedGoal.metricLabel,
        target: parsedGoal.target,
        direction: parsedGoal.direction,
        lastReachedAt: typeof parsedGoal.lastReachedAt === "number" ? parsedGoal.lastReachedAt : null,
      };
      setGoalConfig(normalizedGoal);
      setGoalMetricLabel(normalizedGoal.metricLabel);
      setGoalTarget(normalizedGoal.target.toString());
      setGoalDirection(normalizedGoal.direction);
    } catch {
      setScenarios([]);
      setComparisonScenarioIds([]);
      setGoalConfig(null);
    }
  }, [
    comparisonStorageKey,
    goalStorageKey,
    legacyComparisonStorageKey,
    legacyGoalStorageKey,
    legacyScenarioStorageKey,
    scenarioStorageKey,
    toolSession.isReady,
    toolSession.sessionId,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
      localStorage.setItem(autoModeKey, autoCalculate ? "true" : "false");
      localStorage.setItem(currencyStorageKey, selectedCurrency);
    } catch {
      // Ignore storage failures.
    }
  }, [
    autoCalculate,
    autoModeKey,
    currencyStorageKey,
    isSessionHydrated,
    selectedCurrency,
    storageKey,
    toolSession.isReady,
    values,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(scenarioStorageKey, JSON.stringify(scenarios.slice(0, 30)));
    } catch {
      // Ignore storage failures.
    }
  }, [isSessionHydrated, scenarioStorageKey, scenarios, toolSession.isReady]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(comparisonStorageKey, JSON.stringify(comparisonScenarioIds.slice(0, 2)));
    } catch {
      // Ignore storage failures.
    }
  }, [comparisonScenarioIds, comparisonStorageKey, isSessionHydrated, toolSession.isReady]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      if (!goalConfig) {
        localStorage.removeItem(goalStorageKey);
        return;
      }
      localStorage.setItem(goalStorageKey, JSON.stringify(goalConfig));
    } catch {
      // Ignore storage failures.
    }
  }, [goalConfig, goalStorageKey, isSessionHydrated, toolSession.isReady]);

  useEffect(() => {
    if (goalMetricLabel && resultRows.some((row) => row.label === goalMetricLabel)) return;
    if (!resultRows.length) return;
    setGoalMetricLabel(resultRows[0].label);
  }, [goalMetricLabel, resultRows]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadCurrencies = async () => {
      try {
        const response = await fetch("/api/currencies", { signal: controller.signal });
        if (!response.ok) throw new Error("Currency API unavailable");
        const payload = (await response.json()) as {
          ok?: boolean;
          source?: string;
          currencies?: Array<{ code?: string; name?: string }>;
        };
        const normalized = (payload.currencies ?? [])
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            code: typeof item.code === "string" ? item.code.trim().toUpperCase() : "",
            name: typeof item.name === "string" ? item.name.trim() : "",
          }))
          .filter((item) => CURRENCY_CODE_PATTERN.test(item.code) && item.name)
          .sort((left, right) => left.code.localeCompare(right.code));
        if (!normalized.length) throw new Error("No currencies returned");
        if (!cancelled) {
          setCurrencyOptions(mergeCurrencyOptions(normalized, INVOICE_AFRICAN_PRIORITY));
          setCurrencySource(payload.source || "api");
        }
      } catch {
        if (!cancelled) {
          setCurrencyOptions(INVOICE_LOCAL_CURRENCIES);
          setCurrencySource("local-fallback");
        }
      }
    };
    void loadCurrencies();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!supportsDisplayCurrency || !currencyOptions.length) return;
    if (currencyOptions.some((item) => item.code === selectedCurrency)) return;
    const fallbackCurrency = currencyOptions[0].code;
    setSelectedCurrency(fallbackCurrency);
    if (!autoCalculate) {
      setResultRows(runCalculator(id, values, { currency: fallbackCurrency }));
    }
  }, [autoCalculate, currencyOptions, id, selectedCurrency, supportsDisplayCurrency, values]);

  useEffect(() => {
    if (!isCurrencyConverter || !currencyOptions.length) return;
    const fallbackFrom = currencyOptions.find((item) => item.code === "USD")?.code ?? currencyOptions[0].code;
    const fallbackTo = currencyOptions.find((item) => item.code === "EUR")?.code ?? currencyOptions[Math.min(1, currencyOptions.length - 1)].code;
    let didChange = false;
    const nextValues = { ...values };
    if (!currencyOptions.some((item) => item.code === values.fromCurrency)) {
      nextValues.fromCurrency = fallbackFrom;
      didChange = true;
    }
    if (!currencyOptions.some((item) => item.code === values.toCurrency)) {
      nextValues.toCurrency = fallbackTo;
      didChange = true;
    }
    if (!didChange) return;
    setValues(nextValues);
    if (!autoCalculate) {
      setResultRows(runCalculator(id, nextValues, { currency: selectedCurrency }));
    }
  }, [autoCalculate, currencyOptions, id, isCurrencyConverter, selectedCurrency, values]);

  const calculate = useCallback(
    (
      trigger: "manual" | "auto" | "preset" | "reset" = "manual",
      nextValues: Record<string, string> = values,
    ) => {
      const rows = runCalculator(id, nextValues, { currency: selectedCurrency });
      setResultRows(rows);
      trackEvent("tool_calculate", { tool: id, trigger });
    },
    [id, selectedCurrency, values],
  );

  useEffect(() => {
    if (!autoCalculate) return;
    calculate("auto");
  }, [autoCalculate, calculate]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        calculate("manual");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calculate]);

  const fetchLiveExchangeRate = useCallback(async () => {
    if (!isCurrencyConverter) return;
    const fromCurrency = sanitizeCalculatorCurrencyCode(values.fromCurrency);
    const toCurrency = sanitizeCalculatorCurrencyCode(values.toCurrency);
    if (!fromCurrency || !toCurrency) {
      setRateStatus("Choose both currencies first.");
      return;
    }

    if (fromCurrency === toCurrency) {
      const nextValues = { ...values, exchangeRate: "1" };
      setValues(nextValues);
      setRateMeta({ source: "local", date: new Date().toISOString().slice(0, 10) });
      setRateStatus("From and to currencies are identical. Rate set to 1.");
      if (!autoCalculate) {
        calculate("manual", nextValues);
      }
      return;
    }

    setRateStatus(`Fetching live rate ${fromCurrency} -> ${toCurrency}...`);
    try {
      const response = await fetch(
        `/api/exchange-rate?from=${encodeURIComponent(fromCurrency)}&to=${encodeURIComponent(toCurrency)}`,
      );
      if (!response.ok) throw new Error("Rate request failed");
      const payload = (await response.json()) as {
        ok?: boolean;
        source?: string;
        date?: string;
        rate?: number;
      };
      if (!payload.ok || typeof payload.rate !== "number" || !Number.isFinite(payload.rate) || payload.rate <= 0) {
        throw new Error("Invalid live rate payload");
      }
      const normalizedRate = payload.rate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
      const nextValues = { ...values, exchangeRate: normalizedRate || payload.rate.toString() };
      setValues(nextValues);
      setRateMeta({
        source: payload.source ?? "api",
        date: payload.date ?? new Date().toISOString().slice(0, 10),
      });
      setRateStatus(`Live rate updated: 1 ${fromCurrency} = ${nextValues.exchangeRate} ${toCurrency}.`);
      trackEvent("calculator_live_rate_fetch", { tool: id, fromCurrency, toCurrency });
      if (!autoCalculate) {
        calculate("manual", nextValues);
      }
    } catch {
      setRateStatus("Live rate unavailable right now. You can still input your own exchange rate.");
    }
  }, [autoCalculate, calculate, id, isCurrencyConverter, values]);

  const swapConverterCurrencies = useCallback(() => {
    if (!isCurrencyConverter) return;
    const nextValues = {
      ...values,
      fromCurrency: values.toCurrency || "USD",
      toCurrency: values.fromCurrency || "EUR",
    };
    setValues(nextValues);
    setRateStatus("Swapped from and to currencies.");
    trackEvent("calculator_currency_swap", { tool: id });
    if (!autoCalculate) {
      calculate("manual", nextValues);
    }
  }, [autoCalculate, calculate, id, isCurrencyConverter, values]);

  const applyFinanceProfile = useCallback(() => {
    const profile = FINANCE_PROFILE_PRESETS.find((entry) => entry.id === selectedFinanceProfileId);
    if (!profile) {
      setCopyStatus("Selected profile was not found.");
      return;
    }
    const fieldNameSet = new Set(fields.map((field) => field.name));
    const entries = Object.entries(profile.values).filter(([name]) => fieldNameSet.has(name));
    if (!entries.length) {
      setCopyStatus(`${profile.label} has no mapped fields for this calculator.`);
      return;
    }
    const mappedValues = Object.fromEntries(entries);
    const nextValues = { ...values, ...mappedValues };
    setValues(nextValues);
    setCopyStatus(`Applied ${profile.label} profile (${entries.length} mapped fields).`);
    trackEvent("calculator_profile_apply", { tool: id, profile: profile.id, mappedFields: entries.length });
    if (!autoCalculate) {
      calculate("preset", nextValues);
    }
  }, [autoCalculate, calculate, fields, id, selectedFinanceProfileId, values]);

  const saveScenarioToVault = useCallback(() => {
    const label = sanitizeScenarioLabel(scenarioName) || `Scenario ${scenarios.length + 1}`;
    const snapshot: CalculatorScenarioSnapshot = {
      id: crypto.randomUUID(),
      label,
      createdAt: Date.now(),
      values: { ...values },
      currency: selectedCurrency,
    };
    setScenarios((current) => [snapshot, ...current].slice(0, 30));
    setScenarioName("");
    setCopyStatus(`Saved scenario "${label}".`);
    trackEvent("calculator_scenario_save", { tool: id });
  }, [id, scenarioName, scenarios.length, selectedCurrency, values]);

  const applyScenarioFromVault = useCallback(
    (scenario: CalculatorScenarioSnapshot) => {
      const nextValues = { ...defaultValues, ...scenario.values };
      const nextCurrency = sanitizeCalculatorCurrencyCode(scenario.currency || selectedCurrency);
      setValues(nextValues);
      setSelectedCurrency(nextCurrency);
      setCopyStatus(`Loaded scenario "${scenario.label}".`);
      trackEvent("calculator_scenario_apply", { tool: id });
      if (!autoCalculate) {
        setResultRows(runCalculator(id, nextValues, { currency: nextCurrency }));
      }
    },
    [autoCalculate, defaultValues, id, selectedCurrency],
  );

  const removeScenarioFromVault = useCallback((scenarioId: string) => {
    setScenarios((current) => current.filter((entry) => entry.id !== scenarioId));
    setComparisonScenarioIds((current) => current.filter((entry) => entry !== scenarioId));
    trackEvent("calculator_scenario_delete", { tool: id });
  }, [id]);

  const toggleScenarioComparison = useCallback(
    (scenarioId: string) => {
      if (comparisonScenarioIds.includes(scenarioId)) {
        setComparisonScenarioIds((current) => current.filter((entry) => entry !== scenarioId));
        return;
      }
      if (comparisonScenarioIds.length >= 2) {
        setCopyStatus("Compare mode supports 2 saved scenarios plus your current inputs.");
        return;
      }
      setComparisonScenarioIds((current) => [...current, scenarioId]);
    },
    [comparisonScenarioIds],
  );

  const openFunnelCalculator = useCallback(
    (targetId: CalculatorId, withCarryOver: boolean) => {
      let route = `/calculators/${targetId}`;
      if (withCarryOver) {
        const targetDefaults = Object.fromEntries(
          (calculatorFields[targetId] ?? []).map((field) => [field.name, field.defaultValue]),
        );
        const overlappingValues = Object.fromEntries(
          Object.entries(values).filter(([name]) => Object.prototype.hasOwnProperty.call(targetDefaults, name)),
        );
        const prefillValues = buildFunnelPrefillValues(id, targetId, values) ?? {};
        const nextValues = { ...targetDefaults, ...overlappingValues, ...prefillValues };
        const encodedState = encodeBase64Url(
          JSON.stringify({
            values: nextValues,
            currency: selectedCurrency,
            autoCalculate: true,
          }),
        );
        route = `${route}?state=${encodeURIComponent(encodedState)}`;
      }
      trackEvent("calculator_funnel_open", { tool: id, target: targetId, carryOver: withCarryOver ? "yes" : "no" });
      window.location.assign(route);
    },
    [id, selectedCurrency, values],
  );

  const insights = useMemo(
    () => getCalculatorInsights(id, values, { currency: selectedCurrency }),
    [id, selectedCurrency, values],
  );
  const loanSchedule = useMemo(() => {
    if (id === "loan-emi-calculator") {
      return getLoanAmortizationSchedule(values);
    }
    if (id === "mortgage-calculator") {
      const homePrice = Math.max(0, safeNumberValue(values.homePrice));
      const downPayment = Math.max(0, safeNumberValue(values.downPayment));
      const annualRate = Math.max(0, safeNumberValue(values.annualRate));
      const years = Math.max(1, Math.round(safeNumberValue(values.years)));
      const principal = Math.max(0, homePrice - downPayment);
      return getLoanAmortizationSchedule({ principal, annualRate, months: years * 12 });
    }
    return [];
  }, [id, values]);
  const compoundTimeline = useMemo(
    () => (id === "compound-interest-calculator" ? getCompoundGrowthTimeline(values) : []),
    [id, values],
  );
  const savingsTimeline = useMemo(
    () => (id === "savings-goal-calculator" ? getSavingsGoalTimeline(values) : []),
    [id, values],
  );
  const breakEvenScenarios = useMemo(
    () => (id === "break-even-calculator" ? getBreakEvenScenarios(values) : []),
    [id, values],
  );
  const dtiAffordabilityScenarios = useMemo(
    () => (id === "debt-to-income-calculator" ? getDtiAffordabilityScenarios(values) : []),
    [id, values],
  );

  const selectedComparisonScenarios = useMemo(
    () =>
      comparisonScenarioIds
        .map((scenarioId) => scenarios.find((entry) => entry.id === scenarioId) ?? null)
        .filter((entry): entry is CalculatorScenarioSnapshot => entry !== null),
    [comparisonScenarioIds, scenarios],
  );

  const comparisonColumns = useMemo(() => {
    const columns = [
      {
        id: "__current__",
        label: "Current",
        rows: runCalculator(id, values, { currency: selectedCurrency }),
      },
      ...selectedComparisonScenarios.map((scenario) => ({
        id: scenario.id,
        label: scenario.label,
        rows: runCalculator(id, scenario.values, { currency: selectedCurrency }),
      })),
    ];
    return columns.slice(0, 3);
  }, [id, selectedComparisonScenarios, selectedCurrency, values]);

  const comparisonRows = useMemo<CalculatorComparisonRow[]>(() => {
    if (comparisonColumns.length < 2) return [];
    const labels = new Set<string>();
    comparisonColumns.forEach((column) => {
      column.rows.forEach((row) => labels.add(row.label));
    });

    return [...labels].map((label) => {
      const valuesByColumn = comparisonColumns.map((column) => column.rows.find((row) => row.label === label)?.value ?? "—");
      const baseline = parseDisplayNumber(valuesByColumn[0]);
      const deltas = valuesByColumn.map((value, index) => {
        if (index === 0 || baseline === null) return null;
        const currentValue = parseDisplayNumber(value);
        return currentValue === null ? null : currentValue - baseline;
      });
      return {
        label,
        values: valuesByColumn,
        deltas,
      };
    });
  }, [comparisonColumns]);

  const goalEvaluation = useMemo(() => {
    if (!goalConfig) return null;
    const row = resultRows.find((entry) => entry.label === goalConfig.metricLabel);
    if (!row) {
      return {
        isValid: false,
        isReached: false,
        currentValue: null as number | null,
        delta: null as number | null,
      };
    }
    const currentValue = parseDisplayNumber(row.value);
    if (currentValue === null) {
      return {
        isValid: false,
        isReached: false,
        currentValue: null as number | null,
        delta: null as number | null,
      };
    }
    const delta = goalConfig.direction === "at-most" ? currentValue - goalConfig.target : goalConfig.target - currentValue;
    return {
      isValid: true,
      isReached: delta <= 0,
      currentValue,
      delta,
    };
  }, [goalConfig, resultRows]);

  useEffect(() => {
    if (!goalConfig || !goalEvaluation?.isReached || goalConfig.lastReachedAt) return;
    setGoalConfig((current) =>
      current ? { ...current, lastReachedAt: Date.now() } : current,
    );
    trackEvent("calculator_goal_reached", { tool: id, metric: goalConfig.metricLabel });
  }, [goalConfig, goalEvaluation, id]);

  const visibleLoanRows = showFullTable ? loanSchedule : loanSchedule.slice(0, 24);

  return (
    <section className="tool-surface">
      <ToolHeading icon={Calculator} title="Calculator workspace" subtitle={calculatorSubtitles[id]} />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each calculator workspace session is saved locally and linked to this calculator route."
        onSelectSession={(nextSessionId) => {
          toolSession.selectSession(nextSessionId);
          setCopyStatus("Switched calculator workspace session.");
        }}
        onCreateSession={() => {
          toolSession.createSession();
          setCopyStatus("Created a new calculator workspace session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />

      {presets.length > 0 ? (
        <div className="preset-row">
          <span className="supporting-text">Quick presets:</span>
          {presets.map((preset) => (
            <button
              key={preset.label}
              className="chip-button"
              type="button"
              onClick={() => {
                const nextValues = { ...values, ...preset.values };
                setValues(nextValues);
                setCopyStatus(`Applied preset: ${preset.label}`);
                if (!autoCalculate) {
                  calculate("preset", nextValues);
                }
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      {isFinanceCalculator && activeFinanceProfile ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>Reusable finance profile</h3>
            <button className="action-button secondary" type="button" onClick={applyFinanceProfile}>
              <Sparkles size={15} />
              Apply profile
            </button>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Profile</span>
              <select value={selectedFinanceProfileId} onChange={(event) => setSelectedFinanceProfileId(event.target.value)}>
                {FINANCE_PROFILE_PRESETS.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="supporting-text">{activeFinanceProfile.description}</p>
        </div>
      ) : null}

      {(supportsDisplayCurrency || isCurrencyConverter) ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>{isCurrencyConverter ? "Currency configuration" : "Display currency"}</h3>
            {isCurrencyConverter ? (
              <div className="button-row">
                <button className="action-button secondary" type="button" onClick={swapConverterCurrencies}>
                  <RefreshCw size={15} />
                  Swap
                </button>
                <button className="action-button secondary" type="button" onClick={() => void fetchLiveExchangeRate()}>
                  <MonitorUp size={15} />
                  Fetch live rate
                </button>
              </div>
            ) : null}
          </div>
          <div className="field-grid">
            {supportsDisplayCurrency ? (
              <label className="field">
                <span>Result currency</span>
                <select
                  value={selectedCurrency}
                  onChange={(event) => {
                    const nextCurrency = sanitizeCalculatorCurrencyCode(event.target.value);
                    setSelectedCurrency(nextCurrency);
                    if (!autoCalculate) {
                      setResultRows(runCalculator(id, values, { currency: nextCurrency }));
                    }
                  }}
                >
                  {currencySelectOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {isCurrencyConverter ? (
              <p className="supporting-text">
                Source: {currencySource}. Loaded {formatNumericValue(currencyOptions.length)} currencies.
                {rateMeta ? ` Last rate source: ${rateMeta.source} (${rateMeta.date}).` : ""}
              </p>
            ) : null}
          </div>
          {isCurrencyConverter && rateStatus ? <p className="supporting-text">{rateStatus}</p> : null}
          {supportsDisplayCurrency ? (
            <>
              <p className="supporting-text">
                Currency list source: {currencySource}. Loaded {formatNumericValue(currencyOptions.length)} options.
              </p>
              <p className="supporting-text">
                Values stay the same, but all money outputs are shown in {selectedCurrency} for your region.
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="field-grid">
        {renderFields.map((field) => (
          <label key={field.name} className="field">
            <span>{supportsDisplayCurrency ? formatCalculatorFieldLabel(field, selectedCurrency) : field.label}</span>
            {field.type === "select" ? (
              <select
                value={values[field.name] ?? field.defaultValue}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {!field.options?.some((option) => option.value === (values[field.name] ?? field.defaultValue)) ? (
                  <option value={values[field.name] ?? field.defaultValue}>{values[field.name] ?? field.defaultValue}</option>
                ) : null}
              </select>
            ) : (
              <input
                type={field.type === "date" ? "date" : field.type === "text" ? "text" : "number"}
                min={field.type === "number" ? field.min : undefined}
                step={field.type === "number" ? field.step : undefined}
                value={values[field.name] ?? field.defaultValue}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              />
            )}
            {field.helper ? <small className="supporting-text">{field.helper}</small> : null}
          </label>
        ))}
      </div>

      <div className="button-row">
        <button className="action-button" onClick={() => calculate("manual")} type="button">
          Calculate
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setValues(defaultValues);
            setCopyStatus("Reset to default values.");
            calculate("reset", defaultValues);
          }}
        >
          <RefreshCw size={15} />
          Reset
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(stringifyRows(resultRows));
            setCopyStatus(ok ? "Results copied to clipboard." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy results
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const encoded = encodeBase64Url(
              JSON.stringify({
                values,
                currency: selectedCurrency,
                autoCalculate,
              }),
            );
            const shareUrl = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
            const ok = await copyTextToClipboard(shareUrl);
            setCopyStatus(ok ? "Share link copied." : "Could not copy share link.");
            if (ok) {
              trackEvent("calculator_share_link", { tool: id });
            }
          }}
        >
          <Link2 size={15} />
          Copy share link
        </button>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={autoCalculate}
            onChange={(event) => setAutoCalculate(event.target.checked)}
          />
          Auto-calculate
        </label>
      </div>
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}

      <ResultList rows={resultRows} />

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Goal tracker</h3>
          <div className="button-row">
            <button
              className="action-button secondary"
              type="button"
              onClick={() => {
                const parsedTarget = Number(goalTarget);
                if (!goalMetricLabel || !Number.isFinite(parsedTarget)) {
                  setCopyStatus("Choose a metric and a numeric goal target first.");
                  return;
                }
                const nextGoal: CalculatorGoalConfig = {
                  metricLabel: goalMetricLabel,
                  target: parsedTarget,
                  direction: goalDirection,
                  lastReachedAt: null,
                };
                setGoalConfig(nextGoal);
                setCopyStatus(`Goal saved for "${goalMetricLabel}".`);
                trackEvent("calculator_goal_save", { tool: id, metric: goalMetricLabel, direction: goalDirection });
              }}
            >
              Save goal
            </button>
            <button
              className="action-button secondary"
              type="button"
              onClick={() => {
                setGoalConfig(null);
                setGoalTarget("");
                setCopyStatus("Goal cleared.");
              }}
            >
              Clear goal
            </button>
          </div>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Metric</span>
            <select value={goalMetricLabel} onChange={(event) => setGoalMetricLabel(event.target.value)}>
              {resultRows.map((row) => (
                <option key={row.label} value={row.label}>
                  {row.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Target value</span>
            <input type="number" value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} />
          </label>
          <label className="field">
            <span>Target direction</span>
            <select value={goalDirection} onChange={(event) => setGoalDirection(event.target.value as GoalDirection)}>
              <option value="at-most">Current value should be at most target</option>
              <option value="at-least">Current value should be at least target</option>
            </select>
          </label>
        </div>
        {goalConfig && goalEvaluation ? (
          <p className="supporting-text">
            {goalEvaluation.isValid
              ? `${goalEvaluation.isReached ? "Goal reached" : "Goal not reached"} | Current: ${
                  resultRows.find((row) => row.label === goalConfig.metricLabel)?.value ?? "--"
                } | Target: ${goalConfig.target} | Delta: ${
                  goalEvaluation.delta !== null ? formatNumericValue(Math.abs(goalEvaluation.delta)) : "--"
                }${goalConfig.lastReachedAt ? ` | Last reached: ${new Date(goalConfig.lastReachedAt).toLocaleString()}` : ""}`
              : "Selected goal metric is not numeric for this calculator output."}
          </p>
        ) : (
          <p className="supporting-text">Set one measurable target to keep this calculator outcome on track.</p>
        )}
      </div>

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Scenario vault</h3>
          <button className="action-button secondary" type="button" onClick={saveScenarioToVault}>
            <Plus size={15} />
            Save current scenario
          </button>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Scenario label</span>
            <input
              type="text"
              value={scenarioName}
              onChange={(event) => setScenarioName(event.target.value)}
              placeholder="e.g., Aggressive payoff plan"
            />
          </label>
        </div>
        {scenarios.length ? (
          <ul className="plain-list">
            {scenarios.slice(0, 12).map((scenario) => (
              <li key={scenario.id}>
                <strong>{scenario.label}</strong> ({new Date(scenario.createdAt).toLocaleDateString()})
                <div className="button-row">
                  <button className="action-button secondary" type="button" onClick={() => applyScenarioFromVault(scenario)}>
                    Load
                  </button>
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() => toggleScenarioComparison(scenario.id)}
                  >
                    {comparisonScenarioIds.includes(scenario.id) ? "Remove from compare" : "Add to compare"}
                  </button>
                  <button className="action-button secondary" type="button" onClick={() => removeScenarioFromVault(scenario.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="supporting-text">No saved scenarios yet. Save your current setup to build your comparison vault.</p>
        )}
      </div>

      {comparisonRows.length > 0 ? (
        <div className="mini-panel">
          <h3>Compare mode (A/B/C)</h3>
          <p className="supporting-text">Current scenario is baseline. Add up to two saved scenarios to compare against it.</p>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {comparisonColumns.map((column) => (
                    <th key={column.id}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {row.values.map((value, valueIndex) => (
                      <td key={`${row.label}-${valueIndex}`}>
                        <div>{value}</div>
                        {valueIndex > 0 && row.deltas[valueIndex] !== null ? (
                          <small className="supporting-text">
                            Δ {row.deltas[valueIndex]! >= 0 ? "+" : ""}
                            {formatNumericValue(row.deltas[valueIndex] ?? 0)}
                          </small>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Smart action plan</h3>
          <button
            className="action-button secondary"
            type="button"
            onClick={async () => {
              const ok = await copyTextToClipboard(smartActionPlan.map((entry, index) => `${index + 1}. ${entry}`).join("\n"));
              setCopyStatus(ok ? "Action plan copied." : "Nothing to copy.");
            }}
          >
            <Copy size={15} />
            Copy plan
          </button>
        </div>
        <ul className="plain-list">
          {smartActionPlan.map((plan) => (
            <li key={plan}>{plan}</li>
          ))}
        </ul>
      </div>

      <div className="mini-panel">
        <h3 className="mini-heading">
          <Sparkles size={15} />
          Insights
        </h3>
        <ul className="plain-list">
          {insights.map((insight) => (
            <li key={insight}>{insight}</li>
          ))}
        </ul>
      </div>

      {funnelLinks.length ? (
        <div className="mini-panel">
          <h3>Funnel navigation</h3>
          <ul className="plain-list">
            {funnelLinks.map((link) => (
              <li key={`${id}-${link.id}-${link.label}`}>
                <strong>{link.label}</strong>: {link.description}
                <div className="button-row">
                  <button className="action-button secondary" type="button" onClick={() => openFunnelCalculator(link.id, false)}>
                    Open {link.id}
                  </button>
                  <button className="action-button secondary" type="button" onClick={() => openFunnelCalculator(link.id, true)}>
                    Open with carry-over
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {(id === "loan-emi-calculator" || id === "mortgage-calculator") && loanSchedule.length > 0 ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>Amortization schedule</h3>
            <div className="button-row">
              <button
                className="action-button secondary"
                type="button"
                onClick={() => setShowFullTable((current) => !current)}
              >
                {showFullTable ? "Show first 24" : "Show full table"}
              </button>
              <button
                className="action-button secondary"
                type="button"
                onClick={() =>
                  downloadCsv(
                    "loan-amortization.csv",
                    ["Month", "Payment", "Principal", "Interest", "Balance"],
                    loanSchedule.map((row) => [
                      row.period.toString(),
                      row.payment.toFixed(2),
                      row.principal.toFixed(2),
                      row.interest.toFixed(2),
                      row.balance.toFixed(2),
                    ]),
                  )
                }
              >
                <Download size={15} />
                CSV
              </button>
            </div>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Payment</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {visibleLoanRows.map((row) => (
                  <tr key={`loan-row-${row.period}`}>
                    <td>{row.period}</td>
                    <td>{formatCalculatorCurrency(row.payment)}</td>
                    <td>{formatCalculatorCurrency(row.principal)}</td>
                    <td>{formatCalculatorCurrency(row.interest)}</td>
                    <td>{formatCalculatorCurrency(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {id === "compound-interest-calculator" && compoundTimeline.length > 0 ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>Growth timeline</h3>
            <button
              className="action-button secondary"
              type="button"
              onClick={() =>
                downloadCsv(
                  "compound-growth-timeline.csv",
                  ["Years", "Value", "Gain"],
                  compoundTimeline.map((row) => [
                    row.periodYears.toString(),
                    row.value.toFixed(2),
                    row.gain.toFixed(2),
                  ]),
                )
              }
            >
              <Download size={15} />
              CSV
            </button>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Years</th>
                  <th>Account Value</th>
                  <th>Total Gain</th>
                </tr>
              </thead>
              <tbody>
                {compoundTimeline.map((row) => (
                  <tr key={`growth-${row.periodYears}`}>
                    <td>{Number.isInteger(row.periodYears) ? row.periodYears : row.periodYears.toFixed(1)}</td>
                    <td>{formatCalculatorCurrency(row.value)}</td>
                    <td>{formatCalculatorCurrency(row.gain)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {id === "savings-goal-calculator" && savingsTimeline.length > 0 ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>Savings projection timeline</h3>
            <button
              className="action-button secondary"
              type="button"
              onClick={() =>
                downloadCsv(
                  "savings-projection.csv",
                  ["Years", "Account Value", "Contributed", "Growth"],
                  savingsTimeline.map((row) => [
                    row.periodYears.toString(),
                    row.accountValue.toFixed(2),
                    row.contributed.toFixed(2),
                    row.growth.toFixed(2),
                  ]),
                )
              }
            >
              <Download size={15} />
              CSV
            </button>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Years</th>
                  <th>Account Value</th>
                  <th>Contributed</th>
                  <th>Growth</th>
                </tr>
              </thead>
              <tbody>
                {savingsTimeline.map((row) => (
                  <tr key={`savings-${row.periodYears}`}>
                    <td>{Number.isInteger(row.periodYears) ? row.periodYears : row.periodYears.toFixed(1)}</td>
                    <td>{formatCalculatorCurrency(row.accountValue)}</td>
                    <td>{formatCalculatorCurrency(row.contributed)}</td>
                    <td>{formatCalculatorCurrency(row.growth)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {id === "break-even-calculator" && breakEvenScenarios.length > 0 ? (
        <div className="mini-panel">
          <h3>Price sensitivity scenarios</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Unit Price</th>
                  <th>Contribution</th>
                  <th>Break-even Units</th>
                  <th>Break-even Revenue</th>
                </tr>
              </thead>
              <tbody>
                {breakEvenScenarios.map((row, index) => {
                  const labels = ["-10%", "Current", "+10%", "+20%"];
                  return (
                    <tr key={`break-even-${labels[index]}`}>
                      <td>{labels[index] ?? `${index + 1}`}</td>
                      <td>{formatCalculatorCurrency(row.unitPrice)}</td>
                      <td>{formatCalculatorCurrency(row.contributionPerUnit)}</td>
                      <td>{Number.isFinite(row.units) ? formatNumericValue(row.units) : "Not reachable"}</td>
                      <td>{Number.isFinite(row.revenue) ? formatCalculatorCurrency(row.revenue) : "Not reachable"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {id === "debt-to-income-calculator" && dtiAffordabilityScenarios.length > 0 ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>DTI affordability scenarios</h3>
            <button
              className="action-button secondary"
              type="button"
              onClick={() =>
                downloadCsv(
                  "dti-affordability-scenarios.csv",
                  ["Scenario", "Front-end limit", "Back-end limit", "Max housing payment", "Max total debt", "Headroom", "Constraint"],
                  dtiAffordabilityScenarios.map((row) => [
                    row.label,
                    `${row.frontEndLimit}%`,
                    `${row.backEndLimit}%`,
                    row.maxHousingPayment.toFixed(2),
                    row.maxTotalDebt.toFixed(2),
                    row.headroom.toFixed(2),
                    row.constraint,
                  ]),
                )
              }
            >
              <Download size={15} />
              CSV
            </button>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Scenario</th>
                  <th>Limits (Front/Back)</th>
                  <th>Max Housing Payment</th>
                  <th>Max Total Debt</th>
                  <th>Headroom vs Current Housing</th>
                  <th>Constraint</th>
                </tr>
              </thead>
              <tbody>
                {dtiAffordabilityScenarios.map((row) => (
                  <tr key={`dti-${row.label}`}>
                    <td>{row.label}</td>
                    <td>
                      {row.frontEndLimit}% / {row.backEndLimit}%
                    </td>
                    <td>{formatCalculatorCurrency(row.maxHousingPayment)}</td>
                    <td>{formatCalculatorCurrency(row.maxTotalDebt)}</td>
                    <td>
                      {row.headroom >= 0 ? "+" : "-"}
                      {formatCalculatorCurrency(Math.abs(row.headroom))}
                    </td>
                    <td>{row.constraint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {id === "freelance-rate-calculator" ? (
        <div className="mini-panel">
          <h3>Pricing quick view</h3>
          <ResultList
            rows={[
              {
                label: "Estimated hourly",
                value: resultRows.find((row) => row.label === "Target Hourly Rate")?.value ?? "--",
              },
              {
                label: "Estimated day rate (8h)",
                value: formatCalculatorCurrency((safeNumberValue(values.targetMonthlyIncome) + safeNumberValue(values.monthlyExpenses)) / Math.max(1, safeNumberValue(values.billableHoursPerMonth)) * (1 + safeNumberValue(values.desiredProfitPercent) / 100) * 8),
              },
              {
                label: "Estimated week rate (40h)",
                value: formatCalculatorCurrency((safeNumberValue(values.targetMonthlyIncome) + safeNumberValue(values.monthlyExpenses)) / Math.max(1, safeNumberValue(values.billableHoursPerMonth)) * (1 + safeNumberValue(values.desiredProfitPercent) / 100) * 40),
              },
            ]}
          />
        </div>
      ) : null}
    </section>
  );
}

interface WeightHistoryEntry {
  id: string;
  input: number;
  from: string;
  to: string;
  output: number;
  timestamp: number;
}

const weightQuickPresets: Array<{ label: string; value: string; from: string; to: string }> = [
  { label: "Bodyweight kg -> lb", value: "70", from: "kilogram", to: "pound" },
  { label: "Shipping lb -> kg", value: "25", from: "pound", to: "kilogram" },
  { label: "Cooking g -> oz", value: "500", from: "gram", to: "ounce" },
  { label: "Nutrition oz -> g", value: "12", from: "ounce", to: "gram" },
];

function UnitConverterTool({ quantity }: { quantity: UnitQuantity }) {
  const toolSession = useToolSession({
    toolKey: `unit-converter-${quantity}`,
    defaultSessionLabel: "Converter session",
    newSessionPrefix: "convert",
  });
  const units = useMemo(() => getUnitsForQuantity(quantity), [quantity]);
  const stateStorageKey = toolSession.storageKey(`utiliora-unit-converter-state-${quantity}-v1`);
  const historyStorageKey = toolSession.storageKey(`utiliora-weight-converter-history-v2`);
  const legacyHistoryStorageKey = "utiliora-weight-converter-history-v1";
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [inputValue, setInputValue] = useState("1");
  const [from, setFrom] = useState(units[0]?.value ?? "");
  const [to, setTo] = useState(units[1]?.value ?? units[0]?.value ?? "");
  const [precision, setPrecision] = useState("6");
  const [status, setStatus] = useState("");
  const [weightHistory, setWeightHistory] = useState<WeightHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const isWeightConverter = quantity === "weight";

  useEffect(() => {
    if (!toolSession.isReady) return;
    setHistoryLoaded(false);
    setIsSessionHydrated(false);

    const defaultFrom = units[0]?.value ?? "";
    const defaultTo = units[1]?.value ?? defaultFrom;
    const unitSet = new Set(units.map((unit) => unit.value));

    let nextInput = "1";
    let nextFrom = defaultFrom;
    let nextTo = defaultTo;
    let nextPrecision = "6";
    let nextHistory: WeightHistoryEntry[] = [];

    try {
      const rawState = localStorage.getItem(stateStorageKey);
      if (rawState) {
        const parsed = JSON.parse(rawState) as Partial<{
          inputValue: string;
          from: string;
          to: string;
          precision: string;
        }>;
        if (typeof parsed.inputValue === "string") nextInput = parsed.inputValue;
        if (typeof parsed.from === "string" && unitSet.has(parsed.from)) nextFrom = parsed.from;
        if (typeof parsed.to === "string" && unitSet.has(parsed.to)) nextTo = parsed.to;
        if (parsed.precision === "2" || parsed.precision === "4" || parsed.precision === "6" || parsed.precision === "8") {
          nextPrecision = parsed.precision;
        }
      }

      if (isWeightConverter) {
        const rawHistory =
          localStorage.getItem(historyStorageKey) ??
          (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacyHistoryStorageKey) : null);
        if (rawHistory) {
          const parsedHistory = JSON.parse(rawHistory) as unknown[];
          if (Array.isArray(parsedHistory)) {
            nextHistory = parsedHistory
              .filter((entry) => Boolean(entry) && typeof entry === "object")
              .map((entry) => {
                const candidate = entry as Partial<WeightHistoryEntry>;
                return {
                  id: typeof candidate.id === "string" ? candidate.id : crypto.randomUUID(),
                  input: Number(candidate.input),
                  from: typeof candidate.from === "string" ? candidate.from : nextFrom,
                  to: typeof candidate.to === "string" ? candidate.to : nextTo,
                  output: Number(candidate.output),
                  timestamp: typeof candidate.timestamp === "number" ? candidate.timestamp : Date.now(),
                } satisfies WeightHistoryEntry;
              })
              .filter((entry) => Number.isFinite(entry.input) && Number.isFinite(entry.output))
              .slice(0, 10);
          }
        }
      }
    } catch {
      // Ignore malformed storage and continue.
    }

    setInputValue(nextInput);
    setFrom(nextFrom);
    setTo(nextTo);
    setPrecision(nextPrecision);
    setStatus("");
    setWeightHistory(nextHistory);
    setHistoryLoaded(true);
    setIsSessionHydrated(true);
  }, [
    historyStorageKey,
    isWeightConverter,
    legacyHistoryStorageKey,
    quantity,
    stateStorageKey,
    toolSession.isReady,
    toolSession.sessionId,
    units,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(
        stateStorageKey,
        JSON.stringify({
          inputValue,
          from,
          to,
          precision,
        }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [from, inputValue, isSessionHydrated, precision, stateStorageKey, to, toolSession.isReady]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated || !isWeightConverter || !historyLoaded) return;
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(weightHistory.slice(0, 10)));
    } catch {
      // Ignore storage failures.
    }
  }, [
    historyLoaded,
    historyStorageKey,
    isSessionHydrated,
    isWeightConverter,
    toolSession.isReady,
    weightHistory,
  ]);

  const parsedInput = Number(inputValue);
  const maxFractionDigits = Math.max(0, Math.min(10, Number(precision) || 6));
  const unitMap = useMemo(() => new Map(units.map((unit) => [unit.value, unit.label])), [units]);

  const conversion = useMemo(() => {
    if (!Number.isFinite(parsedInput)) {
      return { ok: false, message: "Enter a valid number.", value: 0 };
    }
    const converted = convertUnitValue(quantity, parsedInput, from, to);
    if (!Number.isFinite(converted)) {
      return { ok: false, message: "Unable to convert with selected units.", value: 0 };
    }
    return { ok: true, message: "", value: converted };
  }, [from, parsedInput, quantity, to]);

  const conversionDisplay = conversion.ok
    ? conversion.value.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits })
    : conversion.message;

  const perUnitValue = useMemo(() => {
    if (!from || !to) return null;
    const converted = convertUnitValue(quantity, 1, from, to);
    if (!Number.isFinite(converted)) return null;
    return converted;
  }, [from, quantity, to]);

  const allWeightConversions = useMemo(() => {
    if (!isWeightConverter || !Number.isFinite(parsedInput)) return [];
    return units
      .map((unit) => ({
        unit: unit.label,
        value: convertUnitValue(quantity, parsedInput, from, unit.value),
      }))
      .filter((entry) => Number.isFinite(entry.value));
  }, [from, isWeightConverter, parsedInput, quantity, units]);

  const fromLabel = unitMap.get(from) ?? from;
  const toLabel = unitMap.get(to) ?? to;

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={RefreshCw}
        title="Unit converter"
        subtitle="Fast, precise conversions with instant output updates and smart conversion helpers."
      />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each converter session is saved locally and linked to this converter route."
        onSelectSession={(nextSessionId) => {
          toolSession.selectSession(nextSessionId);
          setStatus("Switched converter session.");
        }}
        onCreateSession={() => {
          toolSession.createSession();
          setStatus("Created a new converter session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />

      {isWeightConverter ? (
        <div className="preset-row">
          <span className="supporting-text">Weight presets:</span>
          {weightQuickPresets.map((preset) => (
            <button
              key={preset.label}
              className="chip-button"
              type="button"
              onClick={() => {
                setInputValue(preset.value);
                setFrom(preset.from);
                setTo(preset.to);
                setStatus(`Applied preset: ${preset.label}`);
                trackEvent("unit_converter_preset", { quantity, preset: preset.label });
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="field-grid">
        <label className="field">
          <span>Value</span>
          <input
            type="number"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            inputMode="decimal"
          />
        </label>
        <label className="field">
          <span>From</span>
          <select value={from} onChange={(event) => setFrom(event.target.value)}>
            {units.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>To</span>
          <select value={to} onChange={(event) => setTo(event.target.value)}>
            {units.map((unit) => (
              <option key={unit.value} value={unit.value}>
                {unit.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Precision</span>
          <select value={precision} onChange={(event) => setPrecision(event.target.value)}>
            <option value="2">2 decimals</option>
            <option value="4">4 decimals</option>
            <option value="6">6 decimals</option>
            <option value="8">8 decimals</option>
          </select>
        </label>
      </div>

      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setFrom(to);
            setTo(from);
            setStatus("Swapped conversion direction.");
            trackEvent("unit_converter_swap", { quantity });
          }}
        >
          <RefreshCw size={15} />
          Swap
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(conversion.ok ? `${conversionDisplay}` : "");
            setStatus(ok ? "Converted value copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy result
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const defaultFrom = units[0]?.value ?? "";
            const defaultTo = units[1]?.value ?? defaultFrom;
            setInputValue("1");
            setFrom(defaultFrom);
            setTo(defaultTo);
            setPrecision("6");
            setStatus("Converter reset to defaults.");
            trackEvent("unit_converter_reset", { quantity });
          }}
        >
          <Trash2 size={15} />
          Reset
        </button>
        {isWeightConverter ? (
          <button
            className="action-button secondary"
            type="button"
            onClick={() => {
              if (!conversion.ok || !Number.isFinite(parsedInput)) return;
              const entry: WeightHistoryEntry = {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                input: parsedInput,
                from,
                to,
                output: conversion.value,
                timestamp: Date.now(),
              };
              setWeightHistory((current) => [entry, ...current].slice(0, 10));
              setStatus("Saved conversion to recent history.");
              trackEvent("weight_converter_history_save", { quantity, from, to });
            }}
            disabled={!conversion.ok}
          >
            Save conversion
          </button>
        ) : null}
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}

      <div className="result-list" aria-live="polite">
        <div className="result-row">
          <span>
            Converted value ({fromLabel} to {toLabel})
          </span>
          <strong>{conversionDisplay}</strong>
        </div>
        {perUnitValue !== null ? (
          <div className="result-row">
            <span>Rate</span>
            <strong>
              1 {fromLabel} = {perUnitValue.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits })}{" "}
              {toLabel}
            </strong>
          </div>
        ) : null}
      </div>

      {isWeightConverter && allWeightConversions.length > 0 ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>All weight unit outputs</h3>
            <button
              className="action-button secondary"
              type="button"
              onClick={() =>
                downloadCsv(
                  "weight-conversions.csv",
                  ["Unit", "Value"],
                  allWeightConversions.map((entry) => [entry.unit, entry.value.toString()]),
                )
              }
            >
              <Download size={15} />
              CSV
            </button>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {allWeightConversions.map((entry) => (
                  <tr key={entry.unit}>
                    <td>{entry.unit}</td>
                    <td>{entry.value.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {isWeightConverter ? (
        <div className="mini-panel">
          <div className="panel-head">
            <h3>Recent weight conversions</h3>
            <button
              className="action-button secondary"
              type="button"
              onClick={() => {
                setWeightHistory([]);
                setStatus("Cleared recent conversion history.");
              }}
            >
              Clear history
            </button>
          </div>
          {weightHistory.length === 0 ? (
            <p className="supporting-text">No history yet. Save a conversion to create quick recall.</p>
          ) : (
            <ul className="plain-list">
              {weightHistory.map((entry) => {
                const fromText = unitMap.get(entry.from) ?? entry.from;
                const toText = unitMap.get(entry.to) ?? entry.to;
                return (
                  <li key={entry.id}>
                    <div className="history-line">
                      <strong>
                        {entry.input.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits })} {fromText} ={" "}
                        {entry.output.toLocaleString("en-US", { maximumFractionDigits: maxFractionDigits })} {toText}
                      </strong>
                      <span className="supporting-text">{new Date(entry.timestamp).toLocaleString("en-US")}</span>
                    </div>
                    <div className="button-row">
                      <button
                        className="action-button secondary"
                        type="button"
                        onClick={() => {
                          setInputValue(entry.input.toString());
                          setFrom(entry.from);
                          setTo(entry.to);
                          setStatus("Loaded conversion from history.");
                        }}
                      >
                        Use again
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function NumberConverterTool({
  mode,
}: {
  mode: NumberConverterMode;
}) {
  const toolSession = useToolSession({
    toolKey: `number-converter-${mode}`,
    defaultSessionLabel: "Number converter",
    newSessionPrefix: "numbers",
  });
  const storageKey = toolSession.storageKey(`utiliora-number-converter-input-${mode}-v1`);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!toolSession.isReady) return;
    setIsSessionHydrated(false);
    try {
      const saved = localStorage.getItem(storageKey);
      setInput(typeof saved === "string" ? saved : "");
    } catch {
      setInput("");
    } finally {
      setStatus("");
      setIsSessionHydrated(true);
    }
  }, [storageKey, toolSession.isReady]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(storageKey, input);
    } catch {
      // Ignore storage failures.
    }
  }, [input, isSessionHydrated, storageKey, toolSession.isReady]);

  const result = useMemo(() => convertNumber(mode, input), [input, mode]);

  return (
    <section className="tool-surface">
      <ToolHeading icon={Hash} title="Number converter" subtitle="Convert between common number systems with saved sessions." />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each number-converter session is saved locally and linked to this route."
        onSelectSession={(nextSessionId) => {
          toolSession.selectSession(nextSessionId);
          setStatus("Switched number converter session.");
        }}
        onCreateSession={() => {
          toolSession.createSession();
          setStatus("Created a new number converter session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />
      <label className="field">
        <span>Input</span>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Enter value..."
        />
      </label>
      {status ? <p className="supporting-text">{status}</p> : null}
      <div className="result-list">
        <div className="result-row">
          <span>Result</span>
          <strong>{result.primary || "Waiting for input..."}</strong>
        </div>
        {result.secondary ? (
          <div className="result-row">
            <span>Extra</span>
            <strong>{result.secondary}</strong>
          </div>
        ) : null}
      </div>
    </section>
  );
}

interface ToolHeadingProps {
  icon: LucideIcon;
  title: string;
  subtitle: string;
}

function ToolHeading({ icon: Icon, title, subtitle }: ToolHeadingProps) {
  return (
    <header className="tool-heading">
      <div className="tool-heading-icon" aria-hidden>
        <Icon size={18} />
      </div>
      <div className="tool-heading-text">
        <h2>{title}</h2>
        <p className="supporting-text">{subtitle}</p>
      </div>
    </header>
  );
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  if (!value.trim()) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textarea);
      return copied;
    } catch {
      return false;
    }
  }
}

function analyzeTerms(text: string, nGram: 1 | 2 | 3): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0);

  if (nGram === 1) {
    return words.filter((word) => word.length > 2);
  }

  const terms: string[] = [];
  for (let index = 0; index <= words.length - nGram; index += 1) {
    terms.push(words.slice(index, index + nGram).join(" "));
  }
  return terms;
}

const CHARACTER_LIMIT_PRESETS = [
  { id: "seo-title", label: "SEO title", limit: 60 },
  { id: "meta-description", label: "Meta description", limit: 160 },
  { id: "x-post", label: "X / Twitter post", limit: 280 },
  { id: "linkedin-post", label: "LinkedIn post", limit: 3000 },
  { id: "youtube-description", label: "YouTube description", limit: 5000 },
] as const;

function WordCounterTool() {
  const [text, setText] = useState("");
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [targetWords, setTargetWords] = useState(1000);
  const [focusKeyword, setFocusKeyword] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");
  const words = countWords(text);
  const characters = text.length;
  const charactersNoSpaces = countCharacters(text, false);
  const sentences = text.split(/[.!?]+/).filter((segment) => segment.trim()).length;
  const paragraphs = text.split(/\n\s*\n/).filter((segment) => segment.trim()).length;
  const lines = text.split("\n").filter((line) => line.trim()).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));
  const speakingTime = Math.max(1, Math.ceil(words / 130));
  const avgWordLength = words > 0 ? (charactersNoSpaces / words).toFixed(1) : "0";
  const tokenWords = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const totalSyllables = tokenWords.reduce((sum, word) => sum + estimateSyllables(word), 0);
  const readabilityScore =
    words > 0 && sentences > 0 ? 206.835 - 1.015 * (words / sentences) - 84.6 * (totalSyllables / words) : null;
  const targetProgress = targetWords > 0 ? Math.round((words / targetWords) * 100) : 0;
  const normalizedFocusKeyword = focusKeyword.trim().toLowerCase();
  const focusRegex = normalizedFocusKeyword
    ? new RegExp(`\\b${escapeRegExp(normalizedFocusKeyword).replace(/\s+/g, "\\s+")}\\b`, "g")
    : null;
  const focusOccurrences = focusRegex ? text.toLowerCase().match(focusRegex)?.length ?? 0 : 0;
  const topTerms = keywordDensity(text, 8, {
    nGram: 1,
    excludeStopWords: true,
    minLength: 3,
  });

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const extension = getFileExtension(file.name);
        const normalized = normalizeUploadedText(raw);
        const imported = extension === "html" || extension === "htm" ? extractPlainTextFromHtml(normalized) : normalized;
        setText((current) => mergeUploadedText(current, imported, uploadMode));
        setStatus(`Loaded text from ${file.name}.`);
        trackEvent("tool_word_counter_upload", { extension: extension || "unknown", mode: uploadMode });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not read uploaded text file.");
      }
    },
    [uploadMode],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Type}
        title="Word analysis"
        subtitle="Detailed writing stats for SEO pages, posts, and product copy."
      />
      <label className="field">
        <span>Paste your text</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Target word count</span>
          <input
            type="number"
            min={50}
            max={50000}
            value={targetWords}
            onChange={(event) => setTargetWords(Number.parseInt(event.target.value, 10) || 0)}
          />
        </label>
        <label className="field">
          <span>Focus keyword (optional)</span>
          <input type="text" value={focusKeyword} onChange={(event) => setFocusKeyword(event.target.value)} />
        </label>
        <label className="field">
          <span>Upload behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace text</option>
            <option value="append">Append to text</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Upload text/HTML file</span>
        <input
          type="file"
          accept=".txt,.md,.markdown,.csv,.html,.htm"
          onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setText("");
            setCopyStatus("");
            setStatus("");
          }}
        >
          <Trash2 size={15} />
          Clear
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(text);
            setCopyStatus(ok ? "Text copied." : "Copy failed.");
          }}
        >
          <Copy size={15} />
          Copy text
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const rows: Array<[string, string]> = [
              ["Words", words.toString()],
              ["Characters", characters.toString()],
              ["Characters (no spaces)", charactersNoSpaces.toString()],
              ["Sentences", sentences.toString()],
              ["Paragraphs", paragraphs.toString()],
              ["Lines", lines.toString()],
              ["Estimated reading time", `${readingTime} min`],
              ["Estimated speaking time", `${speakingTime} min`],
              ["Average word length", avgWordLength],
              ["Target word count", targetWords.toString()],
              ["Target progress", `${targetProgress}%`],
            ];
            if (readabilityScore !== null) {
              rows.push(["Reading ease", readabilityScore.toFixed(1)]);
            }
            if (normalizedFocusKeyword) {
              rows.push(["Focus keyword", normalizedFocusKeyword], ["Focus keyword count", focusOccurrences.toString()]);
            }
            downloadCsv("word-analysis.csv", ["Metric", "Value"], rows);
            trackEvent("tool_word_counter_export", { words, hasFocusKeyword: Boolean(normalizedFocusKeyword) });
          }}
        >
          <Download size={15} />
          Export summary
        </button>
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
      <ResultList
        rows={[
          { label: "Words", value: words.toString() },
          { label: "Characters", value: characters.toString() },
          { label: "Characters (no spaces)", value: charactersNoSpaces.toString() },
          { label: "Sentences", value: sentences.toString() },
          { label: "Paragraphs", value: paragraphs.toString() },
          { label: "Lines", value: lines.toString() },
          { label: "Estimated reading time", value: `${readingTime} min` },
          { label: "Estimated speaking time", value: `${speakingTime} min` },
          { label: "Average word length", value: `${avgWordLength} chars` },
          { label: "Target progress", value: targetWords > 0 ? `${targetProgress}% of ${targetWords}` : "Set target" },
          { label: "Reading ease", value: readabilityScore !== null ? readabilityScore.toFixed(1) : "N/A" },
          { label: "Focus keyword count", value: normalizedFocusKeyword ? focusOccurrences.toString() : "Not set" },
        ]}
      />
      {topTerms.length > 0 ? (
        <div className="mini-panel">
          <h3>Top keywords (stop words removed)</h3>
          <div className="chip-list">
            {topTerms.map((row) => (
              <span key={row.keyword} className="chip">
                {row.keyword} ({row.count})
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function CharacterCounterTool() {
  const [text, setText] = useState("");
  const [includeSpaces, setIncludeSpaces] = useState(true);
  const [presetId, setPresetId] = useState<(typeof CHARACTER_LIMIT_PRESETS)[number]["id"]>("seo-title");
  const [useCustomLimit, setUseCustomLimit] = useState(false);
  const [customLimit, setCustomLimit] = useState("160");
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [status, setStatus] = useState("");
  const currentPreset = CHARACTER_LIMIT_PRESETS.find((preset) => preset.id === presetId) ?? CHARACTER_LIMIT_PRESETS[0];
  const parsedCustomLimit = Number.parseInt(customLimit, 10);
  const activeLimit =
    useCustomLimit && Number.isFinite(parsedCustomLimit) && parsedCustomLimit > 0
      ? Math.min(250000, parsedCustomLimit)
      : currentPreset.limit;
  const count = countCharacters(text, includeSpaces);
  const words = countWords(text);
  const lines = text ? text.split("\n").length : 0;
  const remaining = activeLimit - count;
  const rawProgress = activeLimit > 0 ? (count / activeLimit) * 100 : 0;
  const progress = Math.max(0, Math.min(130, rawProgress));
  const overLimit = remaining < 0;
  const snippet = count > activeLimit ? text.slice(0, activeLimit).trimEnd() : text;

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const extension = getFileExtension(file.name);
        const normalized = normalizeUploadedText(raw);
        const imported = extension === "html" || extension === "htm" ? extractPlainTextFromHtml(normalized) : normalized;
        setText((current) => mergeUploadedText(current, imported, uploadMode));
        setStatus(`Loaded text from ${file.name}.`);
        trackEvent("tool_character_counter_upload", { extension: extension || "unknown", mode: uploadMode });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not read uploaded text file.");
      }
    },
    [uploadMode],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Hash}
        title="Character counter"
        subtitle="Track copy limits for SEO tags and social platforms in real time."
      />
      <label className="field">
        <span>Text</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Limit preset</span>
          <select value={presetId} onChange={(event) => setPresetId(event.target.value as typeof presetId)}>
            {CHARACTER_LIMIT_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} ({preset.limit})
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Custom limit</span>
          <input
            type="number"
            min={1}
            max={250000}
            value={customLimit}
            onChange={(event) => setCustomLimit(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Upload behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace text</option>
            <option value="append">Append to text</option>
          </select>
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={includeSpaces}
          onChange={(event) => setIncludeSpaces(event.target.checked)}
        />
        Include spaces
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={useCustomLimit}
          onChange={(event) => setUseCustomLimit(event.target.checked)}
        />
        Use custom limit instead of preset
      </label>
      <label className="field">
        <span>Upload text/HTML file</span>
        <input
          type="file"
          accept=".txt,.md,.markdown,.csv,.html,.htm"
          onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
        />
      </label>
      <div className="limit-meter-wrap" aria-live="polite">
        <div className="limit-meter">
          <div
            className={`limit-meter-fill ${overLimit ? "over" : ""}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <small className="supporting-text">
          {overLimit
            ? `${Math.abs(remaining)} characters over limit (${activeLimit}).`
            : `${remaining} characters left (${activeLimit} max).`}
        </small>
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(text);
            setStatus(ok ? "Text copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy text
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(snippet);
            setStatus(ok ? "Trimmed snippet copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy within limit
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Characters", value: count.toString() },
          { label: "Words", value: words.toString() },
          { label: "Lines", value: lines.toString() },
          { label: "Limit", value: activeLimit.toString() },
          { label: "Remaining", value: remaining.toString() },
        ]}
      />
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function KeywordDensityTool() {
  const [text, setText] = useState("");
  const [nGram, setNGram] = useState<1 | 2 | 3>(1);
  const [excludeStopWords, setExcludeStopWords] = useState(true);
  const [topN, setTopN] = useState(12);
  const [targetKeyword, setTargetKeyword] = useState("");
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");
  const rows = keywordDensity(text, topN, {
    nGram,
    excludeStopWords,
    minLength: nGram === 1 ? 3 : 1,
  });
  const analyzedTerms = analyzeTerms(text, nGram);
  const totalTerms = analyzedTerms.length;
  const uniqueTerms = new Set(analyzedTerms).size;
  const lexicalDiversity = totalTerms > 0 ? ((uniqueTerms / totalTerms) * 100).toFixed(1) : "0";
  const normalizedTarget = targetKeyword
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const targetCount = normalizedTarget ? analyzedTerms.filter((term) => term === normalizedTarget).length : 0;
  const targetDensity = totalTerms > 0 ? `${((targetCount / totalTerms) * 100).toFixed(2)}%` : "0.00%";
  const csvOutput = rows.map((row) => `${row.keyword},${row.count},${row.density}`).join("\n");

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const extension = getFileExtension(file.name);
        const imported =
          extension === "html" || extension === "htm"
            ? extractPlainTextFromHtml(raw)
            : normalizeUploadedText(raw).trim();
        const next = mergeUploadedText(text, imported, uploadMode);
        setText(next);
        setStatus(
          `Imported ${file.name} (${formatNumericValue(countWords(imported))} words) using ${uploadMode} mode.`,
        );
        trackEvent("tool_keyword_density_upload", {
          extension: extension || "unknown",
          words: countWords(imported),
          mergeMode: uploadMode,
        });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not read uploaded file.");
      }
    },
    [text, uploadMode],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Search}
        title="Keyword density checker"
        subtitle="Analyze term frequency, lexical diversity, and exact target-keyword share."
      />
      <div className="field-grid">
        <label className="field">
          <span>Term size</span>
          <select value={nGram} onChange={(event) => setNGram(Number(event.target.value) as 1 | 2 | 3)}>
            <option value={1}>Single word</option>
            <option value={2}>2-word phrase</option>
            <option value={3}>3-word phrase</option>
          </select>
        </label>
        <label className="field">
          <span>Top rows</span>
          <input
            type="number"
            min={5}
            max={30}
            value={topN}
            onChange={(event) => setTopN(Math.max(5, Math.min(30, Number(event.target.value) || 5)))}
          />
        </label>
        <label className="field">
          <span>Target keyword/phrase</span>
          <input
            type="text"
            value={targetKeyword}
            onChange={(event) => setTargetKeyword(event.target.value)}
            placeholder={nGram === 1 ? "example: seo" : "example: seo tools"}
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={excludeStopWords}
          onChange={(event) => setExcludeStopWords(event.target.checked)}
        />
        Exclude common stop words
      </label>
      <label className="field">
        <span>Content input</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Upload content file (.txt, .md, .html)</span>
          <input type="file" accept=".txt,.md,.markdown,.html,.htm,.csv" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
        </label>
        <label className="field">
          <span>Upload behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace editor content</option>
            <option value="append">Append to existing content</option>
          </select>
        </label>
      </div>
      <ResultList
        rows={[
          { label: "Terms analyzed", value: totalTerms.toString() },
          { label: "Unique terms", value: uniqueTerms.toString() },
          { label: "Lexical diversity", value: `${lexicalDiversity}%` },
          { label: "Target occurrences", value: targetCount.toString() },
          { label: "Target density", value: targetDensity },
        ]}
      />
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(csvOutput);
            setCopyStatus(ok ? "CSV copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy CSV
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadCsv(
              "keyword-density.csv",
              ["Keyword", "Count", "Density"],
              rows.map((row) => [row.keyword, row.count.toString(), row.density]),
            )
          }
          disabled={!rows.length}
        >
          <Download size={15} />
          Download CSV
        </button>
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      {rows.length ? (
        <table className="table">
          <thead>
            <tr>
              <th>Keyword</th>
              <th>Count</th>
              <th>Density</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.keyword}>
                <td>{row.keyword}</td>
                <td>{row.count}</td>
                <td>{row.density}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="supporting-text">Add content to see frequency analysis.</p>
      )}
    </section>
  );
}

function SlugGeneratorTool() {
  const [text, setText] = useState("");
  const [separator, setSeparator] = useState<"-" | "_">("-");
  const [lowercase, setLowercase] = useState(true);
  const [removeStopWords, setRemoveStopWords] = useState(false);
  const [enforceUnique, setEnforceUnique] = useState(true);
  const [maxLength, setMaxLength] = useState(80);
  const [domain, setDomain] = useState("https://utiliora.com");
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const generated = useMemo(() => {
    const duplicateCounter = new Map<string, number>();
    return lines.map((line) => {
      const base = slugify(line, {
        separator,
        lowercase,
        maxLength,
        removeStopWords,
      });
      if (!enforceUnique || !base) {
        return base;
      }
      const currentCount = duplicateCounter.get(base) ?? 0;
      duplicateCounter.set(base, currentCount + 1);
      if (currentCount === 0) {
        return base;
      }
      return `${base}${separator}${currentCount + 1}`;
    });
  }, [enforceUnique, lines, lowercase, maxLength, removeStopWords, separator]);
  const output = generated[0] ?? "";
  const normalizedDomain = domain.replace(/\/+$/, "");
  const fullUrl = output ? `${normalizedDomain}/${output}` : normalizedDomain;

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const extension = getFileExtension(file.name);
        const imported =
          extension === "html" || extension === "htm"
            ? extractPlainTextFromHtml(raw)
            : normalizeUploadedText(raw);
        const next = mergeUploadedText(text, imported, uploadMode);
        setText(next);
        setStatus(`Imported ${file.name} with ${formatNumericValue(next.split(/\r?\n/).filter(Boolean).length)} lines.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Unable to import titles.");
      }
    },
    [text, uploadMode],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Link2}
        title="Slug generator"
        subtitle="Generate clean URL slugs with separator, casing, and length controls."
      />
      <div className="field-grid">
        <label className="field">
          <span>Separator</span>
          <select value={separator} onChange={(event) => setSeparator(event.target.value as "-" | "_")}>
            <option value="-">Hyphen (-)</option>
            <option value="_">Underscore (_)</option>
          </select>
        </label>
        <label className="field">
          <span>Max length</span>
          <input
            type="number"
            min={20}
            max={200}
            value={maxLength}
            onChange={(event) => setMaxLength(Math.max(20, Math.min(200, Number(event.target.value) || 80)))}
          />
        </label>
        <label className="field">
          <span>Preview domain</span>
          <input type="url" value={domain} onChange={(event) => setDomain(event.target.value)} />
        </label>
      </div>
      <div className="button-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={lowercase}
            onChange={(event) => setLowercase(event.target.checked)}
          />
          Force lowercase
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={removeStopWords}
            onChange={(event) => setRemoveStopWords(event.target.checked)}
          />
          Remove stop words
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={enforceUnique}
            onChange={(event) => setEnforceUnique(event.target.checked)}
          />
          Force unique slugs in bulk mode
        </label>
      </div>
      <label className="field">
        <span>Source title(s) - one per line for bulk generation</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={6} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Upload titles file</span>
          <input type="file" accept=".txt,.csv,.md,.html,.htm" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
        </label>
        <label className="field">
          <span>Upload behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace titles</option>
            <option value="append">Append titles</option>
          </select>
        </label>
      </div>
      <div className="result-row">
        <span>Slug</span>
        <strong>{output || "Add title text to generate slug"}</strong>
      </div>
      <div className="result-row">
        <span>URL preview</span>
        <strong>{fullUrl}</strong>
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setCopyStatus(ok ? "Slug copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy slug
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(fullUrl);
            setCopyStatus(ok ? "URL copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy full URL
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(generated.join("\n"));
            setCopyStatus(ok ? "Bulk slugs copied." : "Nothing to copy.");
          }}
          disabled={!generated.length}
        >
          <Copy size={15} />
          Copy all slugs
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadCsv(
              "slug-output.csv",
              ["Input title", "Slug", "Preview URL"],
              lines.map((line, index) => {
                const slug = generated[index] ?? "";
                return [line, slug, slug ? `${normalizedDomain}/${slug}` : normalizedDomain];
              }),
            )
          }
          disabled={!generated.length}
        >
          <Download size={15} />
          Download CSV
        </button>
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      {generated.length > 1 ? (
        <div className="mini-panel">
          <h3>Bulk output</h3>
          <ul className="plain-list">
            {generated.map((slug, index) => (
              <li key={`${slug}-${index}`}>
                <code>{slug}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function MetaTagGeneratorTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [canonical, setCanonical] = useState("");
  const [author, setAuthor] = useState("");
  const [robotsIndex, setRobotsIndex] = useState(true);
  const [robotsFollow, setRobotsFollow] = useState(true);
  const [siteName, setSiteName] = useState("Utiliora");
  const [focusKeyword, setFocusKeyword] = useState("");
  const [languageTag, setLanguageTag] = useState("en");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");
  const titleLength = title.length;
  const descriptionLength = description.length;
  const robotsValue = `${robotsIndex ? "index" : "noindex"}, ${robotsFollow ? "follow" : "nofollow"}`;
  const canonicalUrl = canonical.trim() || "https://example.com/page";
  const normalizedKeyword = focusKeyword.toLowerCase().trim();
  const keywordInTitle = normalizedKeyword ? title.toLowerCase().includes(normalizedKeyword) : false;
  const keywordInDescription = normalizedKeyword ? description.toLowerCase().includes(normalizedKeyword) : false;

  const recommendations: string[] = [];
  if (titleLength < 35) recommendations.push("Title is short; aim for 50-60 characters for richer SERP context.");
  if (titleLength > 60) recommendations.push("Title may truncate in search results; keep near 60 characters.");
  if (descriptionLength < 120) recommendations.push("Description is short; expand toward 140-160 characters.");
  if (descriptionLength > 160) recommendations.push("Description may truncate in search results.");
  if (!canonical.trim()) recommendations.push("Set a canonical URL to reduce duplicate-content ambiguity.");
  if (normalizedKeyword && !keywordInTitle) recommendations.push("Focus keyword is missing from the title.");
  if (normalizedKeyword && !keywordInDescription) recommendations.push("Focus keyword is missing from the description.");
  if (!recommendations.length) recommendations.push("Meta signals look healthy for publish.");

  const safeTitle = escapeHtml(title || "Page title");
  const safeDescription = escapeHtml(description || "Page description");
  const safeCanonical = escapeHtml(canonical);
  const safeAuthor = escapeHtml(author);
  const safeSiteName = escapeHtml(siteName);
  const safeLanguageTag = escapeHtml(languageTag || "en");

  const output = [
    `<meta charset="utf-8" />`,
    `<meta name="viewport" content="width=device-width, initial-scale=1" />`,
    `<!-- Add to your HTML tag: <html lang="${safeLanguageTag}"> -->`,
    `<title>${safeTitle}</title>`,
    `<meta name="description" content="${safeDescription}" />`,
    `<meta name="robots" content="${robotsValue}" />`,
    safeAuthor ? `<meta name="author" content="${safeAuthor}" />` : "",
    `<meta property="og:site_name" content="${safeSiteName}" />`,
    safeCanonical ? `<link rel="canonical" href="${safeCanonical}" />` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const handleHtmlImport = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      const snapshot = parseHtmlMetaSnapshot(raw);
      if (snapshot.title) setTitle(snapshot.title);
      if (snapshot.description) setDescription(snapshot.description);
      if (snapshot.canonical) setCanonical(snapshot.canonical);
      if (snapshot.author) setAuthor(snapshot.author);
      if (snapshot.siteName) setSiteName(snapshot.siteName);
      if (snapshot.robots) {
        const robotsLower = snapshot.robots.toLowerCase();
        setRobotsIndex(!robotsLower.includes("noindex"));
        setRobotsFollow(!robotsLower.includes("nofollow"));
      }
      setStatus(`Imported metadata from ${file.name}.`);
      trackEvent("tool_meta_tag_import", { extension: getFileExtension(file.name) || "unknown" });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import HTML metadata.");
    }
  }, []);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Tags}
        title="Meta tag generator"
        subtitle="Build production-ready title/description tags with robots control and SERP preview."
      />
      <div className="field-grid">
        <label className="field">
          <span>Title ({titleLength}/60)</span>
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>Description ({descriptionLength}/160)</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
        </label>
        <label className="field">
          <span>Canonical URL</span>
          <input type="url" value={canonical} onChange={(event) => setCanonical(event.target.value)} />
        </label>
        <label className="field">
          <span>Author</span>
          <input type="text" value={author} onChange={(event) => setAuthor(event.target.value)} />
        </label>
        <label className="field">
          <span>Site name</span>
          <input type="text" value={siteName} onChange={(event) => setSiteName(event.target.value)} />
        </label>
        <label className="field">
          <span>Focus keyword (optional)</span>
          <input type="text" value={focusKeyword} onChange={(event) => setFocusKeyword(event.target.value)} />
        </label>
        <label className="field">
          <span>Language tag (for HTML lang)</span>
          <input type="text" value={languageTag} onChange={(event) => setLanguageTag(event.target.value)} placeholder="en" />
        </label>
      </div>
      <div className="button-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={robotsIndex}
            onChange={(event) => setRobotsIndex(event.target.checked)}
          />
          Allow indexing
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={robotsFollow}
            onChange={(event) => setRobotsFollow(event.target.checked)}
          />
          Allow following links
        </label>
      </div>
      <label className="field">
        <span>Import from HTML file</span>
        <input type="file" accept=".html,.htm" onChange={(event) => void handleHtmlImport(event.target.files?.[0] ?? null)} />
      </label>
      <div className="serp-preview">
        <small>Google preview</small>
        <h3>{title || "Page title preview"}</h3>
        <p className="serp-url">{canonicalUrl}</p>
        <p>{description || "Meta description preview appears here."}</p>
      </div>
      <ResultList
        rows={[
          { label: "Title length", value: `${titleLength}/60` },
          { label: "Description length", value: `${descriptionLength}/160` },
          { label: "Keyword in title", value: normalizedKeyword ? (keywordInTitle ? "Yes" : "No") : "-" },
          { label: "Keyword in description", value: normalizedKeyword ? (keywordInDescription ? "Yes" : "No") : "-" },
        ]}
      />
      <div className="mini-panel">
        <h3>Optimization suggestions</h3>
        <ul className="plain-list">
          {recommendations.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
      <label className="field">
        <span>Generated tags</span>
        <textarea value={output} readOnly rows={6} />
      </label>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setCopyStatus(ok ? "Meta tags copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy tags
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => downloadTextFile("meta-tags.html", output, "text/html;charset=utf-8;")}
        >
          <Download size={15} />
          Download snippet
        </button>
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function OpenGraphGeneratorTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [siteName, setSiteName] = useState("Utiliora");
  const [ogType, setOgType] = useState("website");
  const [ogLocale, setOgLocale] = useState("en_US");
  const [twitterCard, setTwitterCard] = useState("summary_large_image");
  const [twitterHandle, setTwitterHandle] = useState("@utiliora");
  const [twitterCreator, setTwitterCreator] = useState("@utiliora");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");
  const previewTitle = title || "Social preview title";
  const previewDescription = description || "Social preview description will appear here.";
  const previewUrl = url || "https://example.com";
  const completionScore = [
    Boolean(title.trim()),
    Boolean(description.trim()),
    Boolean(url.trim()),
    Boolean(image.trim()),
    Boolean(siteName.trim()),
  ].filter(Boolean).length;
  const safeTitle = escapeHtml(previewTitle);
  const safeDescription = escapeHtml(previewDescription);
  const safeUrl = escapeHtml(previewUrl);
  const safeImage = escapeHtml(image.trim());
  const safeImageAlt = escapeHtml(imageAlt.trim());
  const safeSiteName = escapeHtml(siteName.trim() || "Utiliora");
  const safeTwitterHandle = escapeHtml(twitterHandle.trim());
  const safeTwitterCreator = escapeHtml(twitterCreator.trim());
  const safeLocale = escapeHtml(ogLocale.trim() || "en_US");

  const output = [
    `<meta property="og:title" content="${safeTitle}" />`,
    `<meta property="og:description" content="${safeDescription}" />`,
    `<meta property="og:url" content="${safeUrl}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${safeSiteName}" />`,
    `<meta property="og:locale" content="${safeLocale}" />`,
    safeImage ? `<meta property="og:image" content="${safeImage}" />` : "",
    safeImageAlt ? `<meta property="og:image:alt" content="${safeImageAlt}" />` : "",
    `<meta name="twitter:card" content="${twitterCard}" />`,
    `<meta name="twitter:title" content="${safeTitle}" />`,
    `<meta name="twitter:description" content="${safeDescription}" />`,
    safeTwitterHandle ? `<meta name="twitter:site" content="${safeTwitterHandle}" />` : "",
    safeTwitterCreator ? `<meta name="twitter:creator" content="${safeTwitterCreator}" />` : "",
    safeImage ? `<meta name="twitter:image" content="${safeImage}" />` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const handleHtmlImport = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      const snapshot = parseHtmlMetaSnapshot(raw);
      setTitle(snapshot.ogTitle || snapshot.title);
      setDescription(snapshot.ogDescription || snapshot.description);
      setUrl(snapshot.ogUrl || snapshot.canonical);
      setImage(snapshot.ogImage);
      setImageAlt(snapshot.ogImageAlt);
      setSiteName(snapshot.siteName || "Utiliora");
      setOgType(snapshot.ogType || "website");
      setOgLocale(snapshot.ogLocale || "en_US");
      setTwitterCard(snapshot.twitterCard || "summary_large_image");
      setTwitterHandle(snapshot.twitterSite || "@utiliora");
      setTwitterCreator(snapshot.twitterCreator || snapshot.twitterSite || "@utiliora");
      setStatus(`Imported Open Graph data from ${file.name}.`);
      trackEvent("tool_open_graph_import", { extension: getFileExtension(file.name) || "unknown" });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import Open Graph metadata.");
    }
  }, []);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Share2}
        title="Open Graph + Twitter generator"
        subtitle="Generate complete social card metadata with a live preview panel."
      />
      <div className="field-grid">
        <label className="field">
          <span>Title</span>
          <input type="text" value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} />
        </label>
        <label className="field">
          <span>Page URL</span>
          <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
        </label>
        <label className="field">
          <span>Image URL</span>
          <input type="url" value={image} onChange={(event) => setImage(event.target.value)} />
        </label>
        <label className="field">
          <span>Image alt text</span>
          <input type="text" value={imageAlt} onChange={(event) => setImageAlt(event.target.value)} />
        </label>
        <label className="field">
          <span>Site name</span>
          <input type="text" value={siteName} onChange={(event) => setSiteName(event.target.value)} />
        </label>
        <label className="field">
          <span>Open Graph type</span>
          <select value={ogType} onChange={(event) => setOgType(event.target.value)}>
            <option value="website">website</option>
            <option value="article">article</option>
            <option value="product">product</option>
          </select>
        </label>
        <label className="field">
          <span>Locale</span>
          <input type="text" value={ogLocale} onChange={(event) => setOgLocale(event.target.value)} placeholder="en_US" />
        </label>
        <label className="field">
          <span>Twitter card</span>
          <select value={twitterCard} onChange={(event) => setTwitterCard(event.target.value)}>
            <option value="summary_large_image">summary_large_image</option>
            <option value="summary">summary</option>
          </select>
        </label>
        <label className="field">
          <span>Twitter site handle</span>
          <input type="text" value={twitterHandle} onChange={(event) => setTwitterHandle(event.target.value)} />
        </label>
        <label className="field">
          <span>Twitter creator handle</span>
          <input type="text" value={twitterCreator} onChange={(event) => setTwitterCreator(event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Import existing HTML metadata</span>
        <input type="file" accept=".html,.htm" onChange={(event) => void handleHtmlImport(event.target.files?.[0] ?? null)} />
      </label>
      <div className="social-preview-card">
        <div className="social-preview-media">
          {image ? (
            <span className="supporting-text">Image URL configured</span>
          ) : (
            <span className="supporting-text">No image URL set</span>
          )}
        </div>
        <div className="social-preview-body">
          <small>{previewUrl}</small>
          <h3>{previewTitle}</h3>
          <p>{previewDescription}</p>
        </div>
      </div>
      <ResultList
        rows={[
          { label: "Field completion", value: `${completionScore}/5 core fields` },
          { label: "Title length", value: formatNumericValue(previewTitle.length) },
          { label: "Description length", value: formatNumericValue(previewDescription.length) },
          { label: "Has image alt", value: imageAlt.trim() ? "Yes" : "No" },
        ]}
      />
      <label className="field">
        <span>Generated OG tags</span>
        <textarea value={output} readOnly rows={11} />
      </label>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setCopyStatus(ok ? "Tags copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy social tags
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => downloadTextFile("open-graph-tags.html", output, "text/html;charset=utf-8;")}
        >
          <Download size={15} />
          Download tags
        </button>
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

const SITEMAP_CHANGEFREQUENCIES = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
] as const;

type SitemapChangeFrequency = (typeof SITEMAP_CHANGEFREQUENCIES)[number];

function generateSitemapIndexXml(entries: Array<{ loc: string; lastmod?: string }>): string {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'];
  entries.forEach((entry) => {
    lines.push("  <sitemap>");
    lines.push(`    <loc>${entry.loc}</loc>`);
    if (entry.lastmod) {
      lines.push(`    <lastmod>${entry.lastmod}</lastmod>`);
    }
    lines.push("  </sitemap>");
  });
  lines.push("</sitemapindex>");
  return lines.join("\n");
}

function HtmlBeautifierTool() {
  const [input, setInput] = useState(
    "<!doctype html><html><head><title>Utiliora</title></head><body><main><h1>Simple tools. Instant results.</h1><p>Format this HTML for readability.</p></main></body></html>",
  );
  const [indentSize, setIndentSize] = useState(2);
  const [stripComments, setStripComments] = useState(false);
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [output, setOutput] = useState(() => beautifyHtml(input, 2));
  const [status, setStatus] = useState("");

  const runBeautifier = () => {
    const source = stripComments ? input.replace(/<!--[\s\S]*?-->/g, "") : input;
    const formatted = beautifyHtml(source, indentSize);
    setOutput(formatted);
    setStatus(formatted ? "Formatted HTML ready." : "Enter HTML to beautify.");
    trackEvent("tool_html_beautifier_run", { indentSize, hasInput: Boolean(input.trim()), stripComments });
  };

  const lineCount = output ? output.split("\n").length : 0;

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const normalized = normalizeUploadedText(raw);
        const next = mergeUploadedText(input, normalized, uploadMode);
        setInput(next);
        setStatus(`Loaded ${file.name}. Click Beautify HTML to format.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not load HTML file.");
      }
    },
    [input, uploadMode],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="HTML beautifier"
        subtitle="Format compressed or messy HTML into readable, indented markup."
      />
      <div className="field-grid">
        <label className="field">
          <span>Indent size</span>
          <input
            type="number"
            min={0}
            max={8}
            step={1}
            value={indentSize}
            onChange={(event) => setIndentSize(Math.max(0, Math.min(8, Number(event.target.value) || 2)))}
          />
        </label>
        <label className="field">
          <span>Upload behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace editor content</option>
            <option value="append">Append HTML</option>
          </select>
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={stripComments}
          onChange={(event) => setStripComments(event.target.checked)}
        />
        Strip HTML comments before formatting
      </label>
      <label className="field">
        <span>Input HTML</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={8} />
      </label>
      <label className="field">
        <span>Upload HTML file</span>
        <input type="file" accept=".html,.htm,.xml,.txt" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={runBeautifier}>
          Beautify HTML
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setStatus(ok ? "Beautified HTML copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy output
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => downloadTextFile("formatted.html", output, "text/html;charset=utf-8;")}
        >
          <Download size={15} />
          Download HTML
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Input size", value: `${input.length} chars` },
          { label: "Output size", value: `${output.length} chars` },
          { label: "Output lines", value: lineCount.toString() },
        ]}
      />
      <label className="field">
        <span>Beautified output</span>
        <textarea value={output} readOnly rows={12} />
      </label>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function XmlSitemapGeneratorTool() {
  const [baseUrl, setBaseUrl] = useState("https://utiliora.com");
  const [rawPaths, setRawPaths] = useState("/\n/tools\n/seo-tools/xml-sitemap-generator\n/blog/launch-checklist");
  const [includeLastmod, setIncludeLastmod] = useState(true);
  const [changefreq, setChangefreq] = useState<SitemapChangeFrequency>("weekly");
  const [priority, setPriority] = useState("0.7");
  const [maxUrlsPerFile, setMaxUrlsPerFile] = useState(50000);
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");

  const generation = useMemo(() => {
    const requestedPriority = Number.parseFloat(priority);
    const normalizedPriority = Number.isFinite(requestedPriority)
      ? Math.max(0, Math.min(1, requestedPriority))
      : 0.7;
    const safeMaxUrlsPerFile = Math.max(1, Math.min(50000, Math.round(maxUrlsPerFile || 50000)));
    const today = new Date().toISOString().slice(0, 10);
    const seen = new Set<string>();
    const invalidLines: string[] = [];
    const entries = splitNonEmptyLines(rawPaths)
      .map((line) => ({ line, resolved: resolveUrlFromBase(baseUrl, line) }))
      .filter((entry) => {
        if (!entry.resolved) {
          invalidLines.push(entry.line);
          return false;
        }
        if (seen.has(entry.resolved)) return false;
        seen.add(entry.resolved);
        return true;
      })
      .map((entry) => ({
        url: entry.resolved as string,
        lastmod: includeLastmod ? today : undefined,
        changefreq,
        priority: normalizedPriority,
      }));

    const files = entries.length
      ? Array.from({ length: Math.ceil(entries.length / safeMaxUrlsPerFile) }, (_unused, index) => {
          const chunk = entries.slice(index * safeMaxUrlsPerFile, (index + 1) * safeMaxUrlsPerFile);
          const name = entries.length > safeMaxUrlsPerFile ? `sitemap-${index + 1}.xml` : "sitemap.xml";
          return { name, xml: generateSitemapXml(chunk), entries: chunk };
        })
      : [{ name: "sitemap.xml", xml: generateSitemapXml([]), entries: [] as typeof entries }];

    let sitemapIndexXml = "";
    if (files.length > 1) {
      let normalizedBase = "https://example.com/";
      try {
        const parsedBase = new URL(baseUrl.trim() || "https://example.com/");
        normalizedBase = parsedBase.toString().endsWith("/") ? parsedBase.toString() : `${parsedBase.toString()}/`;
      } catch {
        normalizedBase = "https://example.com/";
      }
      sitemapIndexXml = generateSitemapIndexXml(
        files.map((file) => ({
          loc: new URL(file.name, normalizedBase).toString(),
          lastmod: includeLastmod ? today : undefined,
        })),
      );
    }

    const xml = files.length > 1 ? sitemapIndexXml : files[0]?.xml ?? "";
    return {
      xml,
      entries,
      invalidLines,
      priority: normalizedPriority,
      safeMaxUrlsPerFile,
      files,
      sitemapIndexXml,
      primaryFileName: files.length > 1 ? "sitemap-index.xml" : "sitemap.xml",
    };
  }, [baseUrl, changefreq, includeLastmod, maxUrlsPerFile, priority, rawPaths]);

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const extension = getFileExtension(file.name);
        const importedUrls =
          extension === "xml"
            ? extractUrlsFromSitemapXml(raw)
            : parseUrlListFromUploadedText(raw);
        if (!importedUrls.length) {
          setStatus("No valid URLs found in the uploaded file.");
          return;
        }
        const merged = mergeUploadedText(rawPaths, importedUrls.join("\n"), uploadMode);
        setRawPaths(merged);
        setStatus(`Imported ${formatNumericValue(importedUrls.length)} URL line(s) from ${file.name}.`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not import sitemap file.");
      }
    },
    [rawPaths, uploadMode],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Link2}
        title="XML sitemap generator"
        subtitle="Generate a valid sitemap.xml from paths or full URLs with SEO-friendly metadata."
      />
      <div className="field-grid">
        <label className="field">
          <span>Base URL</span>
          <input type="url" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
        </label>
        <label className="field">
          <span>Change frequency</span>
          <select value={changefreq} onChange={(event) => setChangefreq(event.target.value as SitemapChangeFrequency)}>
            {SITEMAP_CHANGEFREQUENCIES.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Priority (0.0 to 1.0)</span>
          <input type="number" min={0} max={1} step={0.1} value={priority} onChange={(event) => setPriority(event.target.value)} />
        </label>
        <label className="field">
          <span>Max URLs per sitemap file</span>
          <input
            type="number"
            min={1}
            max={50000}
            value={maxUrlsPerFile}
            onChange={(event) => setMaxUrlsPerFile(Number(event.target.value))}
          />
        </label>
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={includeLastmod}
          onChange={(event) => setIncludeLastmod(event.target.checked)}
        />
        Include today&apos;s <code>lastmod</code> for all entries
      </label>
      <label className="field">
        <span>Paths or URLs (one per line)</span>
        <textarea value={rawPaths} onChange={(event) => setRawPaths(event.target.value)} rows={8} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Import URL list / sitemap file</span>
          <input type="file" accept=".txt,.csv,.xml" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
        </label>
        <label className="field">
          <span>Import behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace current lines</option>
            <option value="append">Append imported lines</option>
          </select>
        </label>
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(generation.xml);
            setCopyStatus(ok ? "Sitemap XML copied." : "Nothing to copy.");
            if (ok) {
              trackEvent("tool_xml_sitemap_copy", {
                urls: generation.entries.length,
                invalid: generation.invalidLines.length,
              });
            }
          }}
        >
          <Copy size={15} />
          Copy sitemap
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            if (generation.files.length === 1) {
              downloadTextFile(generation.files[0].name, generation.files[0].xml, "application/xml;charset=utf-8;");
              trackEvent("tool_xml_sitemap_download", { urls: generation.entries.length, files: 1 });
              return;
            }

            try {
              const jsZipModule = await import("jszip");
              const JSZip = jsZipModule.default;
              const zip = new JSZip();
              generation.files.forEach((file) => {
                zip.file(file.name, file.xml);
              });
              if (generation.sitemapIndexXml) {
                zip.file("sitemap-index.xml", generation.sitemapIndexXml);
              }
              const blob = await zip.generateAsync({ type: "blob" });
              downloadBlobFile("sitemap-bundle.zip", blob);
              setStatus(`Downloaded sitemap bundle with ${generation.files.length + 1} files.`);
              trackEvent("tool_xml_sitemap_download", { urls: generation.entries.length, files: generation.files.length + 1 });
            } catch {
              setStatus("Could not create sitemap ZIP bundle.");
            }
          }}
        >
          <Download size={15} />
          {generation.files.length > 1 ? "Download sitemap bundle" : "Download sitemap.xml"}
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Valid URLs", value: generation.entries.length.toString() },
          { label: "Invalid lines", value: generation.invalidLines.length.toString() },
          { label: "Priority used", value: generation.priority.toFixed(1) },
          { label: "Sitemap files", value: formatNumericValue(generation.files.length) },
          { label: "Max URLs/file", value: formatNumericValue(generation.safeMaxUrlsPerFile) },
        ]}
      />
      {generation.invalidLines.length ? (
        <div className="mini-panel">
          <h3>Skipped lines</h3>
          <ul className="plain-list">
            {generation.invalidLines.slice(0, 10).map((line) => (
              <li key={line}>
                <code>{line}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {generation.files.length > 1 ? (
        <div className="mini-panel">
          <h3>Generated files</h3>
          <ul className="plain-list">
            <li>
              <code>sitemap-index.xml</code> (references {generation.files.length} sitemap files)
            </li>
            {generation.files.map((file) => (
              <li key={file.name}>
                <code>{file.name}</code> ({formatNumericValue(file.entries.length)} URL{file.entries.length === 1 ? "" : "s"})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <label className="field">
        <span>Generated {generation.primaryFileName}</span>
        <textarea value={generation.xml} readOnly rows={12} />
      </label>
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function RobotsTxtGeneratorTool() {
  const [userAgent, setUserAgent] = useState("*");
  const [allowPaths, setAllowPaths] = useState("/");
  const [disallowPaths, setDisallowPaths] = useState("");
  const [crawlDelay, setCrawlDelay] = useState("");
  const [host, setHost] = useState("utiliora.com");
  const [sitemaps, setSitemaps] = useState("https://utiliora.com/sitemap.xml");
  const [customDirectives, setCustomDirectives] = useState("");
  const [testPath, setTestPath] = useState("/private/dashboard");
  const [status, setStatus] = useState("");
  const customDirectiveLines = useMemo(() => splitNonEmptyLines(customDirectives), [customDirectives]);

  const output = useMemo(() => {
    const crawlDelayValue = Number.parseInt(crawlDelay, 10);
    const generated = generateRobotsTxt({
      userAgent,
      allowPaths: splitNonEmptyLines(allowPaths),
      disallowPaths: splitNonEmptyLines(disallowPaths),
      crawlDelay: Number.isFinite(crawlDelayValue) ? crawlDelayValue : null,
      host,
      sitemapUrls: splitNonEmptyLines(sitemaps),
    });
    if (!customDirectiveLines.length) return generated;
    return `${generated}\n${customDirectiveLines.join("\n")}`;
  }, [allowPaths, crawlDelay, customDirectiveLines, disallowPaths, host, sitemaps, userAgent]);

  const pathTestResult = useMemo(
    () => evaluateRobotsPathDecision(testPath, splitNonEmptyLines(allowPaths), splitNonEmptyLines(disallowPaths)),
    [allowPaths, disallowPaths, testPath],
  );

  const handleUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      const parsed = parseRobotsTxtInput(raw);
      setUserAgent(parsed.userAgent || "*");
      setAllowPaths(parsed.allowPaths.length ? parsed.allowPaths.join("\n") : "/");
      setDisallowPaths(parsed.disallowPaths.join("\n"));
      setCrawlDelay(parsed.crawlDelay);
      setHost(parsed.host);
      setSitemaps(parsed.sitemaps.join("\n"));
      setCustomDirectives(parsed.customDirectives.join("\n"));
      setStatus(`Imported robots directives from ${file.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import robots.txt file.");
    }
  }, []);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Search}
        title="Robots.txt generator"
        subtitle="Build crawl directives with allow/disallow rules plus host and sitemap lines."
      />
      <div className="field-grid">
        <label className="field">
          <span>User-agent</span>
          <input type="text" value={userAgent} onChange={(event) => setUserAgent(event.target.value)} />
        </label>
        <label className="field">
          <span>Crawl delay (optional)</span>
          <input type="number" min={1} step={1} value={crawlDelay} onChange={(event) => setCrawlDelay(event.target.value)} />
        </label>
        <label className="field">
          <span>Host (optional)</span>
          <input type="text" value={host} onChange={(event) => setHost(event.target.value)} />
        </label>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Allow paths (one per line)</span>
          <textarea value={allowPaths} onChange={(event) => setAllowPaths(event.target.value)} rows={5} />
        </label>
        <label className="field">
          <span>Disallow paths (one per line)</span>
          <textarea value={disallowPaths} onChange={(event) => setDisallowPaths(event.target.value)} rows={5} />
        </label>
      </div>
      <label className="field">
        <span>Sitemap URLs (one per line)</span>
        <textarea value={sitemaps} onChange={(event) => setSitemaps(event.target.value)} rows={3} />
      </label>
      <label className="field">
        <span>Custom directives (optional, one per line)</span>
        <textarea value={customDirectives} onChange={(event) => setCustomDirectives(event.target.value)} rows={3} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Import robots.txt file</span>
          <input type="file" accept=".txt,.robots" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
        </label>
        <label className="field">
          <span>Test path against rules</span>
          <input type="text" value={testPath} onChange={(event) => setTestPath(event.target.value)} placeholder="/private/dashboard" />
          <small className="supporting-text">
            Decision: {pathTestResult.decision}
            {pathTestResult.matchedDisallow ? ` | Disallow: ${pathTestResult.matchedDisallow}` : ""}
            {pathTestResult.matchedAllow ? ` | Allow: ${pathTestResult.matchedAllow}` : ""}
          </small>
        </label>
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setStatus(ok ? "robots.txt copied." : "Nothing to copy.");
            if (ok) {
              trackEvent("tool_robots_txt_copy", {
                allowCount: splitNonEmptyLines(allowPaths).length,
                disallowCount: splitNonEmptyLines(disallowPaths).length,
              });
            }
          }}
        >
          <Copy size={15} />
          Copy robots.txt
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            downloadTextFile("robots.txt", output, "text/plain;charset=utf-8;");
            trackEvent("tool_robots_txt_download", { hasHost: Boolean(host.trim()) });
          }}
        >
          <Download size={15} />
          Download robots.txt
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Allow rules", value: splitNonEmptyLines(allowPaths).length.toString() },
          { label: "Disallow rules", value: splitNonEmptyLines(disallowPaths).length.toString() },
          { label: "Sitemap lines", value: splitNonEmptyLines(sitemaps).length.toString() },
          { label: "Custom directives", value: formatNumericValue(customDirectiveLines.length) },
          { label: "Path test result", value: pathTestResult.decision },
        ]}
      />
      <label className="field">
        <span>Generated robots.txt</span>
        <textarea value={output} readOnly rows={10} />
      </label>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

type SchemaIssueSeverity = "error" | "warning";

interface SchemaIssue {
  severity: SchemaIssueSeverity;
  message: string;
  path?: string;
}

interface StructuredDataBlockAnalysis {
  index: number;
  raw: string;
  pretty: string;
  issues: SchemaIssue[];
  typeSummary: string;
  nodeCount: number;
}

const REQUIRED_SCHEMA_FIELDS: Record<string, string[]> = {
  Article: ["headline", "datePublished", "author"],
  BlogPosting: ["headline", "datePublished", "author"],
  Product: ["name", "offers"],
  FAQPage: ["mainEntity"],
  HowTo: ["name", "step"],
  LocalBusiness: ["name", "address"],
  Organization: ["name", "url"],
  Event: ["name", "startDate", "location"],
  Recipe: ["name", "recipeIngredient", "recipeInstructions"],
  BreadcrumbList: ["itemListElement"],
};

const STRUCTURED_DATA_TEMPLATES: Array<{ label: string; value: string; payload: string }> = [
  {
    label: "Article",
    value: "article",
    payload: `{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Your article headline",
  "datePublished": "2026-02-25",
  "author": {
    "@type": "Person",
    "name": "Author name"
  },
  "url": "https://example.com/blog/article"
}`,
  },
  {
    label: "Product",
    value: "product",
    payload: `{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Product name",
  "description": "Clear product description",
  "image": "https://example.com/images/product.jpg",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "49.99",
    "availability": "https://schema.org/InStock"
  }
}`,
  },
  {
    label: "FAQPage",
    value: "faq",
    payload: `{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Question one?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Answer one."
      }
    }
  ]
}`,
  },
];

function extractJsonLdSegments(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const scriptMatches = [...trimmed.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
  if (scriptMatches.length) return scriptMatches;

  return trimmed
    .split(/\n-{3,}\n/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function getSchemaTypes(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  const typeValue = node["@type"];
  if (typeof typeValue === "string" && typeValue.trim()) return [typeValue.trim()];
  if (Array.isArray(typeValue)) {
    return typeValue.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
  }
  return [];
}

function hasFieldValue(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizePath(path: string, segment: string): string {
  return path === "$" ? `$.${segment}` : `${path}.${segment}`;
}

function collectSchemaIssues(node: unknown, path: string): SchemaIssue[] {
  const issues: SchemaIssue[] = [];
  if (!node || typeof node !== "object") {
    issues.push({ severity: "error", message: "Schema node must be an object.", path });
    return issues;
  }

  const record = node as Record<string, unknown>;
  const contextValue = record["@context"];
  const typeList = getSchemaTypes(record);
  if (!contextValue) {
    issues.push({ severity: "warning", message: "Missing @context.", path: normalizePath(path, "@context") });
  } else if (typeof contextValue === "string" && !contextValue.includes("schema.org")) {
    issues.push({
      severity: "warning",
      message: "Use a schema.org @context URL.",
      path: normalizePath(path, "@context"),
    });
  }

  if (!typeList.length) {
    issues.push({ severity: "error", message: "Missing @type.", path: normalizePath(path, "@type") });
  }

  typeList.forEach((schemaType) => {
    const requiredFields = REQUIRED_SCHEMA_FIELDS[schemaType] ?? [];
    requiredFields.forEach((field) => {
      if (!hasFieldValue(record[field])) {
        issues.push({
          severity: "warning",
          message: `Recommended field "${field}" is missing for ${schemaType}.`,
          path: normalizePath(path, field),
        });
      }
    });
  });

  const urlFieldCandidates = ["url", "sameAs", "image", "logo"];
  urlFieldCandidates.forEach((field) => {
    const value = record[field];
    if (typeof value === "string" && value.trim() && !/^https?:\/\//i.test(value.trim())) {
      issues.push({
        severity: "warning",
        message: `Field "${field}" should usually be an absolute URL.`,
        path: normalizePath(path, field),
      });
    }
  });

  return issues;
}

function analyzeStructuredDataInput(input: string): {
  blocks: StructuredDataBlockAnalysis[];
  totalErrors: number;
  totalWarnings: number;
  totalNodes: number;
} {
  const segments = extractJsonLdSegments(input);
  const blocks: StructuredDataBlockAnalysis[] = segments.map((segment, index) => {
    try {
      const parsed = JSON.parse(segment) as unknown;
      const nodes: unknown[] = [];
      if (Array.isArray(parsed)) {
        nodes.push(...parsed);
      } else if (parsed && typeof parsed === "object" && Array.isArray((parsed as Record<string, unknown>)["@graph"])) {
        nodes.push(...((parsed as Record<string, unknown>)["@graph"] as unknown[]));
      } else {
        nodes.push(parsed);
      }

      const issues = nodes.flatMap((node, nodeIndex) => collectSchemaIssues(node, nodes.length > 1 ? `$[${nodeIndex}]` : "$"));
      const typeSummary = nodes
        .flatMap((node) => getSchemaTypes(node))
        .filter(Boolean)
        .slice(0, 6)
        .join(", ");

      return {
        index: index + 1,
        raw: segment,
        pretty: JSON.stringify(parsed, null, 2),
        issues,
        typeSummary: typeSummary || "Unknown type",
        nodeCount: Math.max(1, nodes.length),
      } satisfies StructuredDataBlockAnalysis;
    } catch (error) {
      return {
        index: index + 1,
        raw: segment,
        pretty: segment,
        issues: [
          {
            severity: "error",
            message: error instanceof Error ? error.message : "Invalid JSON.",
            path: "$",
          },
        ],
        typeSummary: "Invalid JSON",
        nodeCount: 0,
      } satisfies StructuredDataBlockAnalysis;
    }
  });

  const totalErrors = blocks.reduce(
    (sum, block) => sum + block.issues.filter((issue) => issue.severity === "error").length,
    0,
  );
  const totalWarnings = blocks.reduce(
    (sum, block) => sum + block.issues.filter((issue) => issue.severity === "warning").length,
    0,
  );
  const totalNodes = blocks.reduce((sum, block) => sum + block.nodeCount, 0);

  return { blocks, totalErrors, totalWarnings, totalNodes };
}

function StructuredDataValidatorTool() {
  const [input, setInput] = useState(`{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Utiliora launches new SEO toolkit",
  "datePublished": "2026-02-23",
  "author": {
    "@type": "Person",
    "name": "Utiliora Team"
  },
  "url": "https://utiliora.com/blog/seo-toolkit"
}`);
  const [template, setTemplate] = useState("custom");
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");
  const analysis = useMemo(() => analyzeStructuredDataInput(input), [input]);

  const mergedPrettyOutput = useMemo(
    () => analysis.blocks.map((block) => block.pretty).join("\n\n"),
    [analysis.blocks],
  );

  const autofixCommonIssues = useCallback(() => {
    const segments = extractJsonLdSegments(input);
    if (!segments.length) {
      setStatus("No JSON-LD blocks found to auto-fix.");
      return;
    }
    const nextBlocks: string[] = [];
    for (const segment of segments) {
      try {
        const parsed = JSON.parse(segment) as Record<string, unknown>;
        if (!parsed["@context"]) {
          parsed["@context"] = "https://schema.org";
        }
        if (!parsed["@type"]) {
          parsed["@type"] = "Thing";
        }
        nextBlocks.push(JSON.stringify(parsed, null, 2));
      } catch {
        nextBlocks.push(segment);
      }
    }
    setInput(nextBlocks.join("\n\n---\n\n"));
    setStatus("Applied auto-fix for missing @context/@type where possible.");
  }, [input]);

  const handleUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      const extension = getFileExtension(file.name);
      if (extension === "html" || extension === "htm") {
        const scripts = extractJsonLdSegments(raw);
        if (!scripts.length) {
          setStatus("No JSON-LD script blocks found in uploaded HTML.");
          return;
        }
        setInput(scripts.join("\n\n---\n\n"));
        setStatus(`Imported ${formatNumericValue(scripts.length)} JSON-LD block(s) from ${file.name}.`);
      } else {
        setInput(normalizeUploadedText(raw));
        setStatus(`Imported structured data from ${file.name}.`);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not import structured data file.");
    }
  }, []);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Braces}
        title="Structured data validator"
        subtitle="Validate JSON-LD schema blocks, detect issues, and export clean markup for SEO pages."
      />
      <div className="field-grid">
        <label className="field">
          <span>Template starter</span>
          <select
            value={template}
            onChange={(event) => {
              const value = event.target.value;
              setTemplate(value);
              const selected = STRUCTURED_DATA_TEMPLATES.find((entry) => entry.value === value);
              if (selected) {
                setInput(selected.payload);
                setStatus(`Loaded ${selected.label} template.`);
              }
            }}
          >
            <option value="custom">Custom / keep current</option>
            {STRUCTURED_DATA_TEMPLATES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Import JSON-LD / HTML file</span>
          <input type="file" accept=".json,.jsonld,.txt,.html,.htm" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
        </label>
      </div>
      <label className="field">
        <span>JSON-LD or script tags</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={12} />
      </label>
      <div className="button-row">
        <button className="action-button secondary" type="button" onClick={autofixCommonIssues}>
          Auto-fix basic issues
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(mergedPrettyOutput);
            setCopyStatus(ok ? "Validated markup copied." : "Nothing to copy.");
            if (ok) {
              trackEvent("tool_structured_data_copy", {
                blocks: analysis.blocks.length,
                errors: analysis.totalErrors,
                warnings: analysis.totalWarnings,
              });
            }
          }}
        >
          <Copy size={15} />
          Copy formatted output
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            downloadTextFile("structured-data.json", mergedPrettyOutput, "application/json;charset=utf-8;");
            trackEvent("tool_structured_data_download", { blocks: analysis.blocks.length });
          }}
        >
          <Download size={15} />
          Download JSON
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Blocks detected", value: formatNumericValue(analysis.blocks.length) },
          { label: "Schema nodes", value: formatNumericValue(analysis.totalNodes) },
          { label: "Errors", value: formatNumericValue(analysis.totalErrors) },
          { label: "Warnings", value: formatNumericValue(analysis.totalWarnings) },
        ]}
      />
      {analysis.blocks.length ? (
        <div className="mini-panel">
          <h3>Validation details</h3>
          <ul className="plain-list">
            {analysis.blocks.map((block) => (
              <li key={block.index}>
                <strong>Block {block.index}</strong>: {block.typeSummary} ({block.issues.length} issue
                {block.issues.length === 1 ? "" : "s"})
                {block.issues.length ? (
                  <ul className="plain-list">
                    {block.issues.slice(0, 8).map((issue, issueIndex) => (
                      <li key={`${block.index}-${issueIndex}`}>
                        [{issue.severity}] {issue.message}
                        {issue.path ? ` (${issue.path})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="supporting-text">No issues found in this block.</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="supporting-text">Paste JSON-LD to begin validation.</p>
      )}
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

interface LinkMapEntry {
  href: string;
  resolvedUrl: string;
  anchorText: string;
  internal: boolean;
  rel: string;
  nofollow: boolean;
  target: string;
  hasAnchorText: boolean;
}

function extractAnchorLinksFromHtml(html: string): Array<{ href: string; anchorText: string; rel: string; target: string }> {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const documentNode = parser.parseFromString(html, "text/html");
    return Array.from(documentNode.querySelectorAll("a[href]")).map((anchor) => ({
      href: (anchor.getAttribute("href") ?? "").trim(),
      anchorText: (anchor.textContent ?? "").replace(/\s+/g, " ").trim(),
      rel: (anchor.getAttribute("rel") ?? "").toLowerCase().trim(),
      target: (anchor.getAttribute("target") ?? "").trim(),
    }));
  }

  const getAttribute = (attributes: string, attributeName: string): string => {
    const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const quoted = new RegExp(`${escapedName}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(attributes);
    if (quoted) {
      return (quoted[2] ?? quoted[3] ?? "").trim();
    }
    const bare = new RegExp(`${escapedName}\\s*=\\s*([^\\s"'>]+)`, "i").exec(attributes);
    return (bare?.[1] ?? "").trim();
  };

  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)].map((match) => {
    const attributes = match[1] ?? "";
    const href = getAttribute(attributes, "href");
    const rel = getAttribute(attributes, "rel").toLowerCase();
    const target = getAttribute(attributes, "target");
    const anchorText = decodeBasicHtmlEntities(stripTagsFromMarkup(match[2] ?? ""))
      .replace(/\s+/g, " ")
      .trim();

    return {
      href,
      anchorText,
      rel,
      target,
    };
  });
}

function InternalLinkMapHelperTool() {
  const [sourceUrl, setSourceUrl] = useState("https://utiliora.com/blog/seo-checklist");
  const [html, setHtml] = useState(`<p>Read the <a href="/tools">tool index</a> and <a href="/seo-tools/structured-data-validator">schema validator</a>. Visit <a href="https://schema.org">Schema.org</a> too.</p>`);
  const [status, setStatus] = useState("");

  const analysis = useMemo(() => {
    const links = extractAnchorLinksFromHtml(html);
    if (!links.length) {
      return {
        entries: [] as LinkMapEntry[],
        invalid: [] as string[],
        internalCount: 0,
        externalCount: 0,
        nofollowCount: 0,
        missingAnchorTextCount: 0,
      };
    }

    let base: URL | null = null;
    try {
      base = new URL(sourceUrl.trim());
    } catch {
      base = null;
    }

    const entries: LinkMapEntry[] = [];
    const invalid: string[] = [];
    links.forEach((link) => {
      const href = link.href.trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        invalid.push(href || "(empty)");
        return;
      }
      try {
        const resolved = base ? new URL(href, base) : new URL(href);
        if (!/^https?:$/i.test(resolved.protocol)) {
          invalid.push(href);
          return;
        }
        const resolvedUrl = resolved.toString();
        const internal = base ? resolved.hostname === base.hostname : false;
        const relTokens = link.rel
          .split(/\s+/)
          .map((token) => token.trim())
          .filter(Boolean);
        entries.push({
          href,
          resolvedUrl,
          anchorText: link.anchorText || "(no anchor text)",
          internal,
          rel: link.rel,
          nofollow: relTokens.includes("nofollow"),
          target: link.target,
          hasAnchorText: Boolean(link.anchorText.trim()),
        });
      } catch {
        invalid.push(href);
      }
    });

    return {
      entries,
      invalid,
      internalCount: entries.filter((entry) => entry.internal).length,
      externalCount: entries.filter((entry) => !entry.internal).length,
      nofollowCount: entries.filter((entry) => entry.nofollow).length,
      missingAnchorTextCount: entries.filter((entry) => !entry.hasAnchorText).length,
    };
  }, [html, sourceUrl]);

  const uniqueInternal = useMemo(() => {
    const map = new Map<string, { count: number; anchors: Set<string> }>();
    analysis.entries
      .filter((entry) => entry.internal)
      .forEach((entry) => {
        const existing = map.get(entry.resolvedUrl) ?? { count: 0, anchors: new Set<string>() };
        existing.count += 1;
        existing.anchors.add(entry.anchorText);
        map.set(entry.resolvedUrl, existing);
      });
    return [...map.entries()]
      .map(([url, value]) => ({ url, count: value.count, anchors: [...value.anchors].slice(0, 3) }))
      .sort((a, b) => b.count - a.count);
  }, [analysis.entries]);

  const handleUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      setHtml(normalizeUploadedText(raw));
      setStatus(`Loaded HTML from ${file.name}.`);
      trackEvent("tool_internal_link_map_upload", { extension: getFileExtension(file.name) || "unknown" });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read uploaded HTML file.");
    }
  }, []);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Link2}
        title="Internal link map helper"
        subtitle="Parse page HTML, classify links, and export internal-link maps for technical SEO audits."
      />
      <label className="field">
        <span>Source page URL</span>
        <input type="text" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} />
      </label>
      <label className="field">
        <span>Page HTML snippet</span>
        <textarea value={html} onChange={(event) => setHtml(event.target.value)} rows={10} />
      </label>
      <label className="field">
        <span>Upload HTML file</span>
        <input type="file" accept=".html,.htm,.txt" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
      </label>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const lines = uniqueInternal.map((entry) => `${entry.url} (${entry.count})`);
            const ok = await copyTextToClipboard(lines.join("\n"));
            setStatus(ok ? "Internal link map copied." : "Nothing to copy.");
            if (ok) {
              trackEvent("tool_internal_link_map_copy", {
                internal: analysis.internalCount,
                external: analysis.externalCount,
              });
            }
          }}
        >
          <Copy size={15} />
          Copy internal map
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const rows = uniqueInternal.map((entry) => [entry.url, entry.count.toString(), entry.anchors.join(" | ")]);
            downloadCsv("internal-link-map.csv", ["URL", "Occurrences", "Anchor samples"], rows);
            trackEvent("tool_internal_link_map_download", { internal: analysis.internalCount });
          }}
        >
          <Download size={15} />
          Export CSV
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Total links", value: formatNumericValue(analysis.entries.length + analysis.invalid.length) },
          { label: "Internal links", value: formatNumericValue(analysis.internalCount) },
          { label: "External links", value: formatNumericValue(analysis.externalCount) },
          { label: "Nofollow links", value: formatNumericValue(analysis.nofollowCount) },
          { label: "Missing anchor text", value: formatNumericValue(analysis.missingAnchorTextCount) },
          { label: "Invalid/skipped", value: formatNumericValue(analysis.invalid.length) },
        ]}
      />
      {uniqueInternal.length ? (
        <div className="mini-panel">
          <h3>Internal link map</h3>
          <ul className="plain-list">
            {uniqueInternal.slice(0, 20).map((entry) => (
              <li key={entry.url}>
                <code>{entry.url}</code> x {entry.count}
                {entry.anchors.length ? ` | Anchors: ${entry.anchors.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="supporting-text">No internal links detected yet.</p>
      )}
      {analysis.entries.some((entry) => entry.nofollow) ? (
        <div className="mini-panel">
          <h3>Nofollow links</h3>
          <ul className="plain-list">
            {analysis.entries
              .filter((entry) => entry.nofollow)
              .slice(0, 12)
              .map((entry, index) => (
                <li key={`${entry.resolvedUrl}-${index}`}>
                  <code>{entry.resolvedUrl}</code>
                  {entry.anchorText ? ` | Anchor: ${entry.anchorText}` : ""}
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {analysis.invalid.length ? (
        <div className="mini-panel">
          <h3>Invalid or skipped links</h3>
          <ul className="plain-list">
            {analysis.invalid.slice(0, 10).map((value, index) => (
              <li key={`${value}-${index}`}>
                <code>{value}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function JsonFormatterTool() {
  const [input, setInput] = useState('{"name":"Utiliora","tools":10}');
  const [sortKeys, setSortKeys] = useState(true);
  const [minifyOutput, setMinifyOutput] = useState(false);
  const [indent, setIndent] = useState(2);
  const [result, setResult] = useState(() =>
    safeJsonFormat('{"name":"Utiliora","tools":10}', {
      sortKeys: true,
      minify: false,
      indent: 2,
    }),
  );
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");

  const format = () =>
    setResult(
      safeJsonFormat(input, {
        sortKeys,
        minify: minifyOutput,
        indent,
      }),
    );

  const handleUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      setInput(normalizeUploadedText(raw));
      setStatus(`Loaded ${file.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read JSON file.");
    }
  }, []);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Braces}
        title="JSON formatter + validator"
        subtitle="Validate, beautify, minify, and sort JSON keys with error location hints."
      />
      <label className="field">
        <span>Input JSON</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={8} />
      </label>
      <div className="field-grid">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={sortKeys}
            onChange={(event) => setSortKeys(event.target.checked)}
          />
          Sort object keys
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={minifyOutput}
            onChange={(event) => setMinifyOutput(event.target.checked)}
          />
          Minify output
        </label>
        <label className="field">
          <span>Indent size</span>
          <input
            type="number"
            min={0}
            max={8}
            value={indent}
            onChange={(event) => setIndent(Math.max(0, Math.min(8, Number(event.target.value) || 2)))}
            disabled={minifyOutput}
          />
        </label>
        <label className="field">
          <span>Upload JSON file</span>
          <input type="file" accept=".json,.jsonld,.txt" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={format}>
          Format JSON
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(result.output);
            setCopyStatus(ok ? "Output copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy output
        </button>
        <button className="action-button secondary" type="button" onClick={() => setInput("")}>
          <Trash2 size={15} />
          Clear input
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Status", value: result.ok ? "Valid JSON" : "Invalid JSON" },
          { label: "Input size", value: `${result.sizeBefore} chars` },
          {
            label: "Output size",
            value: result.ok ? `${result.sizeAfter ?? result.output.length} chars` : "N/A",
          },
        ]}
      />
      {result.error ? <p className="error-text">{result.error}</p> : null}
      <label className="field">
        <span>{result.ok ? "Formatted JSON" : "Error"}</span>
        <textarea value={result.ok ? result.output : result.error ?? result.output} readOnly rows={10} />
      </label>
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function MinifierTool({ mode }: { mode: "css" | "js" }) {
  const [input, setInput] = useState(
    mode === "css" ? "body { color: #111; }" : "function hello() { console.log('hi'); }",
  );
  const [output, setOutput] = useState(() => (mode === "css" ? minifyCss(input) : minifyJs(input)));
  const [autoMinify, setAutoMinify] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!autoMinify) return;
    setOutput(mode === "css" ? minifyCss(input) : minifyJs(input));
  }, [autoMinify, input, mode]);

  const minify = () => {
    const result = mode === "css" ? minifyCss(input) : minifyJs(input);
    setOutput(result);
  };
  const before = input.length;
  const after = output.length;
  const savings = before > 0 ? (((before - after) / before) * 100).toFixed(1) : "0";
  const gzipEstimateBytes = Math.max(0, Math.round(after * 0.33));

  const handleUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      setInput(normalizeUploadedText(raw));
      setStatus(`Loaded ${file.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to read code file.");
    }
  }, []);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Code2}
        title={`${mode.toUpperCase()} minifier`}
        subtitle="Reduce payload size and estimate compression impact before deployment."
      />
      <label className="field">
        <span>Input {mode.toUpperCase()}</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={8} />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={autoMinify}
          onChange={(event) => setAutoMinify(event.target.checked)}
        />
        Auto minify while typing
      </label>
      <label className="field">
        <span>Upload {mode.toUpperCase()} file</span>
        <input type="file" accept={mode === "css" ? ".css,.txt" : ".js,.mjs,.cjs,.txt"} onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={minify}>
          Minify now
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setCopyStatus(ok ? "Minified code copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy output
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadTextFile(
              mode === "css" ? "styles.min.css" : "script.min.js",
              output,
              "text/plain;charset=utf-8;",
            )
          }
        >
          <Download size={15} />
          Download output
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Original size", value: `${before} chars` },
          { label: "Minified size", value: `${after} chars` },
          { label: "Reduction", value: `${savings}%` },
          { label: "Estimated gzip size", value: `${formatBytes(gzipEstimateBytes)}` },
        ]}
      />
      <label className="field">
        <span>Output</span>
        <textarea value={output} readOnly rows={6} />
      </label>
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [includeDataUrlPrefix, setIncludeDataUrlPrefix] = useState(false);
  const [dataUrlMimeType, setDataUrlMimeType] = useState("text/plain");
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [status, setStatus] = useState("");
  const [decodedFileUrl, setDecodedFileUrl] = useState("");
  const [decodedFileName, setDecodedFileName] = useState("decoded.bin");
  const decodedFileUrlRef = useRef("");
  const inputBytes = useMemo(() => new TextEncoder().encode(input).length, [input]);
  const outputBytes = useMemo(() => new TextEncoder().encode(output).length, [output]);

  useEffect(() => {
    return () => {
      if (decodedFileUrlRef.current) URL.revokeObjectURL(decodedFileUrlRef.current);
    };
  }, []);

  const toUrlSafe = (value: string) => value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  const fromUrlSafe = (value: string) => {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = normalized.length % 4;
    if (padding === 0) return normalized;
    return normalized + "=".repeat(4 - padding);
  };

  const normalizePayload = (value: string) => {
    const dataUrlMatch = value.match(/^data:[^;]+;base64,(.+)$/i);
    return dataUrlMatch?.[1] ?? value;
  };

  const encode = () => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(input.trim())));
      const base = urlSafe ? toUrlSafe(encoded) : encoded;
      setOutput(includeDataUrlPrefix ? `data:${dataUrlMimeType};base64,${base}` : base);
      setStatus("Encoded successfully.");
      trackEvent("tool_base64_encode", { urlSafe, includeDataUrlPrefix });
    } catch {
      setOutput("Unable to encode input.");
      setStatus("Encode failed.");
    }
  };

  const decode = () => {
    try {
      const payload = normalizePayload(input.trim());
      const decoded = decodeURIComponent(escape(atob(urlSafe ? fromUrlSafe(payload) : payload)));
      setOutput(decoded);
      setStatus("Decoded successfully.");
      trackEvent("tool_base64_decode", { urlSafe });
    } catch {
      setOutput("Invalid Base64 string.");
      setStatus("Decode failed.");
    }
  };

  const decodeToFile = () => {
    try {
      const raw = input.trim();
      const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/i);
      const mimeType = dataUrlMatch?.[1] ?? "application/octet-stream";
      const payload = dataUrlMatch ? dataUrlMatch[2] : normalizePayload(raw);
      const decodedBinary = atob(urlSafe ? fromUrlSafe(payload) : payload);
      const buffer = new Uint8Array(decodedBinary.length);
      for (let index = 0; index < decodedBinary.length; index += 1) {
        buffer[index] = decodedBinary.charCodeAt(index);
      }
      const blob = new Blob([buffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      if (decodedFileUrlRef.current) URL.revokeObjectURL(decodedFileUrlRef.current);
      decodedFileUrlRef.current = url;
      setDecodedFileUrl(url);
      setDecodedFileName(`decoded.${mimeType.split("/")[1] || "bin"}`);
      setStatus("Decoded into downloadable file.");
    } catch {
      setStatus("Unable to decode file payload.");
    }
  };

  const handleTextUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const normalized = normalizeUploadedText(raw);
        setInput((current) => mergeUploadedText(current, normalized, uploadMode));
        setStatus(`Loaded text payload from ${file.name}.`);
        trackEvent("tool_base64_upload_text", { extension: getFileExtension(file.name) || "unknown", mode: uploadMode });
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not read uploaded text file.");
      }
    },
    [uploadMode],
  );

  const encodeFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setInput(uploadMode === "append" && input.trim() ? `${input.trimEnd()}\n${result}` : result);
      setStatus("File converted to Data URL Base64.");
      trackEvent("tool_base64_upload_binary", { extension: getFileExtension(file.name) || "unknown" });
    };
    reader.onerror = () => {
      setStatus("Unable to read selected file.");
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Binary}
        title="Base64 encoder/decoder"
        subtitle="Encode text, decode payloads, and convert files to/from Base64 Data URLs."
      />
      <label className="checkbox">
        <input
          type="checkbox"
          checked={urlSafe}
          onChange={(event) => setUrlSafe(event.target.checked)}
        />
        URL-safe mode (- and _ instead of + and /)
      </label>
      <div className="field-grid">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeDataUrlPrefix}
            onChange={(event) => setIncludeDataUrlPrefix(event.target.checked)}
          />
          Prefix encoded output as Data URL
        </label>
        <label className="field">
          <span>Data URL MIME type</span>
          <input type="text" value={dataUrlMimeType} onChange={(event) => setDataUrlMimeType(event.target.value || "text/plain")} />
        </label>
        <label className="field">
          <span>Upload behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace input</option>
            <option value="append">Append input</option>
          </select>
        </label>
      </div>
      <label className="field">
        <span>Input</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={6} />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={encode}>
          Encode
        </button>
        <button className="action-button secondary" type="button" onClick={decode}>
          Decode
        </button>
        <button className="action-button secondary" type="button" onClick={decodeToFile}>
          Decode to file
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setStatus(ok ? "Output copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy output
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setInput(output);
            setStatus("Output moved into input.");
          }}
        >
          <RefreshCw size={15} />
          Use output as input
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            downloadTextFile("base64-output.txt", output);
            trackEvent("tool_base64_download", { outputBytes });
          }}
        >
          <Download size={15} />
          Download output
        </button>
      </div>
      <label className="field">
        <span>Upload text payload</span>
        <input
          type="file"
          accept=".txt,.md,.json,.csv,.xml,.html,.htm"
          onChange={(event) => void handleTextUpload(event.target.files?.[0] ?? null)}
        />
      </label>
      <label className="field">
        <span>Encode file to Base64 Data URL</span>
        <input type="file" onChange={(event) => encodeFile(event.target.files?.[0] ?? null)} />
      </label>
      <ResultList
        rows={[
          { label: "Input length", value: `${input.length} chars` },
          { label: "Input bytes", value: formatBytes(inputBytes) },
          { label: "Output length", value: `${output.length} chars` },
          { label: "Output bytes", value: formatBytes(outputBytes) },
        ]}
      />
      <label className="field">
        <span>Output</span>
        <textarea value={output} readOnly rows={6} />
      </label>
      {decodedFileUrl ? (
        <a className="action-link" href={decodedFileUrl} download={decodedFileName}>
          Download decoded file
        </a>
      ) : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function PasswordGeneratorTool() {
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(true);
  const [batchSize, setBatchSize] = useState(1);
  const [passwords, setPasswords] = useState<string[]>([]);
  const [status, setStatus] = useState("");

  const pickRandomChar = (chars: string): string => {
    if (!chars.length) return "";
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    return chars[random[0] % chars.length];
  };

  const generate = () => {
    const uppercase = excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = excludeAmbiguous ? "abcdefghijkmnopqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
    const numbers = excludeAmbiguous ? "23456789" : "0123456789";
    const symbols = "!@#$%^&*()_+-=?.";
    const sets: string[] = [];
    if (includeUppercase) sets.push(uppercase);
    if (includeLowercase) sets.push(lowercase);
    if (includeNumbers) sets.push(numbers);
    if (includeSymbols) sets.push(symbols);

    if (!sets.length) {
      setStatus("Enable at least one character set.");
      return;
    }

    const chosenLength = Math.min(64, Math.max(8, length));
    const chosenBatchSize = Math.min(20, Math.max(1, batchSize));
    const allChars = sets.join("");
    const generated = Array.from({ length: chosenBatchSize }, () => {
      const requiredChars = sets.map((set) => pickRandomChar(set));
      const resultChars = [...requiredChars];
      while (resultChars.length < chosenLength) {
        resultChars.push(pickRandomChar(allChars));
      }
      for (let index = resultChars.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [resultChars[index], resultChars[swapIndex]] = [resultChars[swapIndex], resultChars[index]];
      }
      return resultChars.join("");
    });

    setPasswords(generated);
    setStatus(`Generated ${generated.length} password${generated.length === 1 ? "" : "s"}.`);
    trackEvent("tool_generate_password", { length: chosenLength, batchSize: chosenBatchSize, sets: sets.length });
  };

  const charsetSize =
    (includeUppercase ? (excludeAmbiguous ? 24 : 26) : 0) +
    (includeLowercase ? (excludeAmbiguous ? 24 : 26) : 0) +
    (includeNumbers ? (excludeAmbiguous ? 8 : 10) : 0) +
    (includeSymbols ? 15 : 0);
  const entropyBits = charsetSize > 0 ? Math.log2(charsetSize) * Math.min(64, Math.max(8, length)) : 0;
  const strengthScore = Math.round(clampScore((entropyBits / 120) * 100, 0, 100));
  const strengthLabel = strengthScore >= 80 ? "Very strong" : strengthScore >= 60 ? "Strong" : strengthScore >= 40 ? "Fair" : "Weak";

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Sparkles}
        title="Password generator"
        subtitle="Create high-entropy single or batch passwords with tuned character rules."
      />
      <div className="field-grid">
        <label className="field">
          <span>Length</span>
          <input
            type="number"
            min={8}
            max={64}
            value={length}
            onChange={(event) => setLength(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Batch size</span>
          <input
            type="number"
            min={1}
            max={20}
            value={batchSize}
            onChange={(event) => setBatchSize(Number(event.target.value))}
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeUppercase}
            onChange={(event) => setIncludeUppercase(event.target.checked)}
          />
          Include uppercase
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeLowercase}
            onChange={(event) => setIncludeLowercase(event.target.checked)}
          />
          Include lowercase
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeNumbers}
            onChange={(event) => setIncludeNumbers(event.target.checked)}
          />
          Include numbers
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={includeSymbols}
            onChange={(event) => setIncludeSymbols(event.target.checked)}
          />
          Include symbols
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={excludeAmbiguous}
            onChange={(event) => setExcludeAmbiguous(event.target.checked)}
          />
          Exclude ambiguous chars (O/0/l/1)
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={generate}>
          Generate password
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const first = passwords[0] ?? "";
            const ok = await copyTextToClipboard(first);
            setStatus(ok ? "Primary password copied." : "Generate a password first.");
          }}
        >
          <Copy size={15} />
          Copy first
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(passwords.join("\n"));
            setStatus(ok ? "All passwords copied." : "Generate passwords first.");
          }}
        >
          <Copy size={15} />
          Copy all
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => downloadTextFile("generated-passwords.txt", passwords.join("\n"))}
        >
          <Download size={15} />
          Download
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Charset size", value: formatNumericValue(charsetSize) },
          { label: "Estimated entropy", value: `${entropyBits.toFixed(1)} bits` },
          { label: "Strength score", value: `${strengthScore}/100 (${strengthLabel})` },
          { label: "Generated", value: `${passwords.length}` },
        ]}
      />
      <label className="field">
        <span>Primary password</span>
        <input type="text" value={passwords[0] ?? ""} readOnly />
      </label>
      {passwords.length > 1 ? (
        <div className="mini-panel">
          <h3>Batch output</h3>
          <ul className="plain-list">
            {passwords.map((value, index) => (
              <li key={`${value}-${index}`}>
                {index + 1}. <code>{value}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

function LoremIpsumTool() {
  const [paragraphs, setParagraphs] = useState(3);
  const [format, setFormat] = useState<"plain" | "html" | "markdown-list">("plain");
  const [status, setStatus] = useState("");
  const [output, setOutput] = useState(generateLoremIpsum(3));

  const applyFormat = (raw: string, selectedFormat: "plain" | "html" | "markdown-list"): string => {
    const blocks = raw
      .split(/\n\s*\n/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    if (!blocks.length) {
      return "";
    }
    if (selectedFormat === "html") {
      return blocks.map((segment) => `<p>${segment}</p>`).join("\n");
    }
    if (selectedFormat === "markdown-list") {
      return blocks.map((segment) => `- ${segment}`).join("\n");
    }
    return blocks.join("\n\n");
  };

  const generate = useCallback(() => {
    const chosenParagraphs = Math.min(20, Math.max(1, paragraphs));
    const raw = generateLoremIpsum(chosenParagraphs);
    setOutput(applyFormat(raw, format));
    setStatus(`Generated ${chosenParagraphs} paragraph${chosenParagraphs === 1 ? "" : "s"} in ${format} format.`);
    trackEvent("tool_lorem_generate", { paragraphs: chosenParagraphs, format });
  }, [format, paragraphs]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="Lorem Ipsum generator"
        subtitle="Generate placeholder copy in plain text, HTML paragraph, or markdown-list formats."
      />
      <div className="field-grid">
        <label className="field">
          <span>Paragraphs</span>
          <input
            type="number"
            min={1}
            max={20}
            value={paragraphs}
            onChange={(event) => setParagraphs(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Output format</span>
          <select value={format} onChange={(event) => setFormat(event.target.value as typeof format)}>
            <option value="plain">Plain text</option>
            <option value="html">HTML paragraphs</option>
            <option value="markdown-list">Markdown list</option>
          </select>
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={generate}>
          Generate text
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setStatus(ok ? "Output copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy output
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => downloadTextFile(format === "html" ? "lorem-ipsum.html" : "lorem-ipsum.txt", output)}
        >
          <Download size={15} />
          Download
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Paragraphs", value: formatNumericValue(paragraphs) },
          { label: "Words", value: formatNumericValue(countWords(output)) },
          { label: "Characters", value: formatNumericValue(output.length) },
          { label: "Format", value: format },
        ]}
      />
      <label className="field">
        <span>Output</span>
        <textarea value={output} rows={10} readOnly />
      </label>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

type AiDetectorProfile = "balanced" | "strict" | "lenient";

interface AiSentenceRiskRow {
  index: number;
  risk: number;
  sentence: string;
  reasons: string[];
}

interface AiDetectorReport {
  riskScore: number;
  confidence: number;
  verdict: string;
  verdictTone: "ok" | "info" | "warn" | "bad";
  profile: AiDetectorProfile;
  wordCount: number;
  sentenceCount: number;
  lexicalDiversity: number;
  burstiness: number;
  averageSentenceLength: number;
  sentenceStdDev: number;
  repeatedPhraseCoverage: number;
  transitionDensity: number;
  punctuationPerSentence: number;
  stopWordRatio: number;
  readingEase: number | null;
  tokenEntropy: number;
  repeatedPhrases: Array<{ phrase: string; count: number }>;
  sentenceRiskRows: AiSentenceRiskRow[];
  signals: string[];
  rewriteTips: string[];
}

const AI_TRANSITION_PATTERN =
  /\b(however|moreover|therefore|furthermore|additionally|in conclusion|in summary|overall|thus|notably|finally)\b/gi;
const AI_COMMON_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "if",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "to",
  "was",
  "were",
  "with",
]);

function tokenizeAiWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9']+/g) ?? [];
}

function splitAiSentences(value: string): string[] {
  return value
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function clampScore(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function estimateSyllables(word: string): number {
  const normalized = word
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/(?:es|ed|e)$/g, "");
  if (!normalized) return 1;
  const matches = normalized.match(/[aeiouy]{1,2}/g);
  return Math.max(1, matches?.length ?? 1);
}

function estimateFleschReadingEase(words: string[], sentenceCount: number): number | null {
  if (!words.length || sentenceCount <= 0) return null;
  const syllableCount = words.reduce((sum, word) => sum + estimateSyllables(word), 0);
  const score = 206.835 - 1.015 * (words.length / sentenceCount) - 84.6 * (syllableCount / words.length);
  return Number.isFinite(score) ? Number(score.toFixed(1)) : null;
}

function calculateTokenEntropy(words: string[]): number {
  if (!words.length) return 0;
  const frequencies = new Map<string, number>();
  words.forEach((word) => {
    frequencies.set(word, (frequencies.get(word) ?? 0) + 1);
  });
  let entropy = 0;
  frequencies.forEach((count) => {
    const p = count / words.length;
    entropy -= p * Math.log2(p);
  });
  return Number(entropy.toFixed(3));
}

function buildAiDetectorReport(value: string, profile: AiDetectorProfile): AiDetectorReport | null {
  const text = value.trim();
  if (!text) return null;

  const words = tokenizeAiWords(text);
  const sentences = splitAiSentences(text);
  const wordCount = words.length;
  const sentenceCount = Math.max(1, sentences.length);
  if (!wordCount) return null;

  const uniqueWordCount = new Set(words).size;
  const lexicalDiversity = uniqueWordCount / wordCount;

  const sentenceLengths = sentences
    .map((sentence) => tokenizeAiWords(sentence).length)
    .filter((length) => length > 0);
  const averageSentenceLength =
    sentenceLengths.reduce((sum, length) => sum + length, 0) / Math.max(1, sentenceLengths.length);
  const sentenceVariance =
    sentenceLengths.reduce((sum, length) => sum + Math.pow(length - averageSentenceLength, 2), 0) /
    Math.max(1, sentenceLengths.length);
  const sentenceStdDev = Math.sqrt(sentenceVariance);
  const burstiness = averageSentenceLength > 0 ? sentenceStdDev / averageSentenceLength : 0;

  const phraseCounts = new Map<string, number>();
  for (let index = 0; index <= words.length - 3; index += 1) {
    const phrase = words.slice(index, index + 3).join(" ");
    if (phrase.length < 10) continue;
    phraseCounts.set(phrase, (phraseCounts.get(phrase) ?? 0) + 1);
  }

  const repeatedPhrases = [...phraseCounts.entries()]
    .filter((entry) => entry[1] > 1)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([phrase, count]) => ({ phrase, count }));

  const repeatedPhraseCoverage =
    repeatedPhrases.reduce((sum, entry) => sum + entry.count * 3, 0) / Math.max(1, wordCount);

  const transitionMatches = text.match(AI_TRANSITION_PATTERN) ?? [];
  const transitionDensity = transitionMatches.length / sentenceCount;
  const punctuationMarks = (text.match(/[,:;!?]/g) ?? []).length;
  const punctuationPerSentence = punctuationMarks / sentenceCount;
  const stopWordRatio = words.filter((word) => AI_COMMON_WORDS.has(word)).length / wordCount;
  const readingEase = estimateFleschReadingEase(words, sentenceCount);
  const tokenEntropy = calculateTokenEntropy(words);

  let risk = 35;
  if (lexicalDiversity < 0.35) risk += 22;
  else if (lexicalDiversity < 0.42) risk += 10;
  else if (lexicalDiversity > 0.58) risk -= 8;

  if (burstiness < 0.28) risk += 20;
  else if (burstiness < 0.4) risk += 10;
  else if (burstiness > 0.75) risk -= 6;

  if (repeatedPhraseCoverage > 0.18) risk += 22;
  else if (repeatedPhraseCoverage > 0.1) risk += 12;

  if (transitionDensity > 0.6) risk += 10;
  if (punctuationPerSentence < 0.45) risk += 6;
  if (wordCount < 120) risk += 6;
  if (stopWordRatio > 0.6 && lexicalDiversity < 0.4) risk += 6;
  if (tokenEntropy < 4) risk += 8;

  if (profile === "strict") risk += 7;
  if (profile === "lenient") risk -= 7;

  const riskScore = clampScore(Math.round(risk), 2, 98);

  const repeatedPhraseSet = new Set(repeatedPhrases.map((entry) => entry.phrase));
  const sentenceRiskRows = sentences
    .map((sentence, index): AiSentenceRiskRow | null => {
      const sentenceWords = tokenizeAiWords(sentence);
      if (!sentenceWords.length) return null;
      const sentenceText = sentence.toLowerCase();
      const sentenceLexicalDiversity = new Set(sentenceWords).size / sentenceWords.length;
      const reasons: string[] = [];
      let sentenceRisk = 0;

      if (sentenceWords.length >= 8 && sentenceWords.length <= 22) {
        sentenceRisk += 12;
        reasons.push("Mid-length sentence pattern");
      }
      if (sentenceWords.length > 30) {
        sentenceRisk += 10;
        reasons.push("Long sentence complexity");
      }
      if (sentenceLexicalDiversity < 0.65 && sentenceWords.length >= 10) {
        sentenceRisk += 12;
        reasons.push("Low lexical variation");
      }
      if (/^(however|moreover|therefore|furthermore|additionally|overall|thus)\b/.test(sentenceText)) {
        sentenceRisk += 18;
        reasons.push("Formulaic transition opening");
      }
      if (repeatedPhraseSet.size && [...repeatedPhraseSet].some((phrase) => sentenceText.includes(phrase))) {
        sentenceRisk += 16;
        reasons.push("Contains repeated 3-word phrase");
      }
      if (!/[,:;!?]/.test(sentence) && sentenceWords.length > 15) {
        sentenceRisk += 8;
        reasons.push("Low punctuation variation");
      }

      if (!reasons.length) return null;
      return {
        index: index + 1,
        risk: clampScore(Math.round(sentenceRisk), 1, 99),
        sentence,
        reasons,
      };
    })
    .filter((row): row is AiSentenceRiskRow => Boolean(row))
    .sort((left, right) => right.risk - left.risk)
    .slice(0, 12);

  const signals: string[] = [];
  if (lexicalDiversity < 0.38) signals.push("Low lexical diversity");
  if (burstiness < 0.35) signals.push("Very uniform sentence lengths");
  if (repeatedPhraseCoverage > 0.1) signals.push("Repeated phrase patterns");
  if (transitionDensity > 0.6) signals.push("High transition-word density");
  if (tokenEntropy < 4) signals.push("Low token entropy across vocabulary");
  if (stopWordRatio > 0.6) signals.push("High common-word ratio");
  if (wordCount < 120) signals.push("Short sample reduces reliability");
  if (!signals.length) signals.push("Mixed signals");

  const rewriteTips: string[] = [];
  if (burstiness < 0.4) rewriteTips.push("Mix short and long sentences to improve rhythm.");
  if (repeatedPhraseCoverage > 0.1) rewriteTips.push("Replace repeated 3-word phrases with varied wording.");
  if (lexicalDiversity < 0.4) rewriteTips.push("Use more specific vocabulary and concrete details.");
  if (transitionDensity > 0.6) rewriteTips.push("Reduce formulaic connectors and use direct transitions.");
  if (tokenEntropy < 4) rewriteTips.push("Introduce domain-specific terminology to widen lexical distribution.");
  if (!rewriteTips.length) rewriteTips.push("Add personal examples and domain-specific references.");

  const confidenceLengthFactor = Math.min(1, wordCount / 500);
  const confidenceSignalFactor = Math.min(
    1,
    Math.abs(riskScore - 50) / 50 + repeatedPhraseCoverage + Math.max(0, 0.5 - burstiness),
  );
  const confidence = clampScore(
    Math.round((0.35 + confidenceLengthFactor * 0.45 + confidenceSignalFactor * 0.2) * 100),
    20,
    98,
  );

  let verdict = "Mixed / uncertain";
  let verdictTone: "ok" | "info" | "warn" | "bad" = "info";
  if (riskScore >= 70) {
    verdict = "Likely AI-generated";
    verdictTone = "bad";
  } else if (riskScore >= 45) {
    verdict = "Possibly AI-assisted";
    verdictTone = "warn";
  } else {
    verdict = "Likely human-written";
    verdictTone = "ok";
  }

  return {
    riskScore,
    confidence,
    verdict,
    verdictTone,
    profile,
    wordCount,
    sentenceCount,
    lexicalDiversity,
    burstiness,
    averageSentenceLength,
    sentenceStdDev,
    repeatedPhraseCoverage,
    transitionDensity,
    punctuationPerSentence,
    stopWordRatio,
    readingEase,
    tokenEntropy,
    repeatedPhrases,
    sentenceRiskRows,
    signals,
    rewriteTips,
  };
}

function AiDetectorTool() {
  const [text, setText] = useState("");
  const [profile, setProfile] = useState<AiDetectorProfile>("balanced");
  const [uploadMode, setUploadMode] = useState<TextUploadMergeMode>("replace");
  const [convertHtmlUploadToText, setConvertHtmlUploadToText] = useState(true);
  const [report, setReport] = useState<AiDetectorReport | null>(null);
  const [status, setStatus] = useState("Paste text and run analysis.");

  const runAnalysis = useCallback(() => {
    const nextReport = buildAiDetectorReport(text, profile);
    if (!nextReport) {
      setReport(null);
      setStatus("Enter enough text to analyze (at least a short paragraph).");
      return;
    }
    setReport(nextReport);
    setStatus(`Analysis complete. ${nextReport.verdict} (${nextReport.confidence}% confidence).`);
    trackEvent("tool_ai_detector_analyze", {
      words: nextReport.wordCount,
      riskScore: nextReport.riskScore,
      confidence: nextReport.confidence,
      profile,
    });
  }, [profile, text]);

  const handleUpload = useCallback(
    async (file: File | null) => {
      if (!file) return;
      try {
        const raw = await readTextFileWithLimit(file);
        const extension = getFileExtension(file.name);
        const shouldExtractHtml = convertHtmlUploadToText && (extension === "html" || extension === "htm");
        const imported = shouldExtractHtml ? extractPlainTextFromHtml(raw) : normalizeUploadedText(raw);
        const merged = mergeUploadedText(text, imported, uploadMode);
        setText(merged);
        setStatus(`Imported ${file.name} (${formatNumericValue(countWords(imported))} words).`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not import text file.");
      }
    },
    [convertHtmlUploadToText, text, uploadMode],
  );

  const summary = report
    ? [
        `Verdict: ${report.verdict}`,
        `Risk score: ${report.riskScore}/100`,
        `Confidence: ${report.confidence}%`,
        `Profile: ${report.profile}`,
        `Words: ${report.wordCount} | Sentences: ${report.sentenceCount}`,
        `Lexical diversity: ${(report.lexicalDiversity * 100).toFixed(1)}%`,
        `Burstiness: ${report.burstiness.toFixed(2)}`,
        `Token entropy: ${report.tokenEntropy.toFixed(3)}`,
        `Signals: ${report.signals.join("; ")}`,
        `Rewrite tips: ${report.rewriteTips.join("; ")}`,
      ].join("\n")
    : "";

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Sparkles}
        title="AI detector"
        subtitle="Run multi-signal AI-likeness analysis with profile modes, sentence diagnostics, and rewrite guidance."
      />

      <div className="field-grid">
        <label className="field">
          <span>Detection profile</span>
          <select value={profile} onChange={(event) => setProfile(event.target.value as AiDetectorProfile)}>
            <option value="balanced">Balanced</option>
            <option value="strict">Strict (higher sensitivity)</option>
            <option value="lenient">Lenient (lower false positives)</option>
          </select>
        </label>
        <label className="field">
          <span>Upload behavior</span>
          <select value={uploadMode} onChange={(event) => setUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="replace">Replace editor content</option>
            <option value="append">Append imported text</option>
          </select>
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={convertHtmlUploadToText}
          onChange={(event) => setConvertHtmlUploadToText(event.target.checked)}
        />
        Convert uploaded HTML files to plain text before analysis
      </label>

      <label className="field">
        <span>Text to analyze</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={10}
          placeholder="Paste article, essay, email, or any long-form text."
        />
      </label>

      <label className="field">
        <span>Upload text / HTML / Markdown file</span>
        <input type="file" accept=".txt,.md,.markdown,.html,.htm,.rtf" onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)} />
      </label>

      <div className="button-row">
        <button className="action-button" type="button" onClick={runAnalysis}>
          Analyze text
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(summary);
            setStatus(ok ? "Executive summary copied." : "Nothing to copy.");
          }}
          disabled={!report}
        >
          <Copy size={15} />
          Copy summary
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            report
              ? downloadTextFile(
                  "ai-detector-report.json",
                  JSON.stringify(report, null, 2),
                  "application/json;charset=utf-8;",
                )
              : undefined
          }
          disabled={!report}
        >
          <Download size={15} />
          Download JSON report
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setText("");
            setReport(null);
            setStatus("Cleared analysis.");
          }}
        >
          <Trash2 size={15} />
          Clear
        </button>
      </div>

      <p className="supporting-text">{status}</p>

      <ResultList
        rows={[
          { label: "Characters", value: formatNumericValue(countCharacters(text, true)) },
          { label: "Words", value: formatNumericValue(countWords(text)) },
          { label: "Sentences", value: formatNumericValue(splitAiSentences(text).length) },
        ]}
      />

      {report ? (
        <>
          <p className={`status-badge ${report.verdictTone}`}>
            {report.verdict} | Risk score: {report.riskScore}/100 | Confidence: {report.confidence}%
          </p>
          <ResultList
            rows={[
              { label: "Lexical diversity", value: `${(report.lexicalDiversity * 100).toFixed(1)}%` },
              { label: "Sentence burstiness", value: report.burstiness.toFixed(2) },
              { label: "Average sentence length", value: report.averageSentenceLength.toFixed(1) },
              { label: "Sentence std. dev.", value: report.sentenceStdDev.toFixed(2) },
              {
                label: "Repeated phrase coverage",
                value: `${(report.repeatedPhraseCoverage * 100).toFixed(1)}%`,
              },
              { label: "Transition density", value: report.transitionDensity.toFixed(2) },
              { label: "Punctuation / sentence", value: report.punctuationPerSentence.toFixed(2) },
              { label: "Stop-word ratio", value: `${(report.stopWordRatio * 100).toFixed(1)}%` },
              { label: "Token entropy", value: report.tokenEntropy.toFixed(3) },
              { label: "Reading ease", value: report.readingEase != null ? report.readingEase.toFixed(1) : "N/A" },
            ]}
          />

          <div className="mini-panel">
            <h3>Detected signals</h3>
            <ul className="plain-list">
              {report.signals.map((signal) => (
                <li key={signal}>{signal}</li>
              ))}
            </ul>
          </div>

          {report.sentenceRiskRows.length ? (
            <div className="mini-panel">
              <h3>Highest-risk sentences</h3>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Risk</th>
                      <th>Sentence</th>
                      <th>Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.sentenceRiskRows.map((entry) => (
                      <tr key={`${entry.index}-${entry.risk}`}>
                        <td>{entry.index}</td>
                        <td>{entry.risk}</td>
                        <td>{entry.sentence}</td>
                        <td>{entry.reasons.join(", ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {report.repeatedPhrases.length ? (
            <div className="mini-panel">
              <h3>Top repeated phrases</h3>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Phrase</th>
                      <th>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.repeatedPhrases.map((entry) => (
                      <tr key={entry.phrase}>
                        <td>{entry.phrase}</td>
                        <td>{entry.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className="mini-panel">
            <h3>Rewrite suggestions</h3>
            <ul className="plain-list">
              {report.rewriteTips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </section>
  );
}

interface PlagiarismSourceResult {
  sourceLabel: string;
  sourceWordCount: number;
  similarity: number;
  sourceCoverage: number;
  overlapCount: number;
  sentenceMatches: number;
  matchedPhrases: string[];
}

interface PlagiarismReport {
  candidateWordCount: number;
  sourceCount: number;
  overallSimilarity: number;
  overallCoverage: number;
  flaggedSentenceCount: number;
  verdict: string;
  verdictTone: "ok" | "info" | "warn" | "bad";
  results: PlagiarismSourceResult[];
}

function parsePlagiarismSources(value: string): string[] {
  return value
    .split(/\n-{3,}\n|\n={3,}\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function buildWordShingles(words: string[], size: number): string[] {
  if (words.length < size) return [];
  const phrases: string[] = [];
  for (let index = 0; index <= words.length - size; index += 1) {
    phrases.push(words.slice(index, index + size).join(" "));
  }
  return phrases;
}

function normalizeSentenceForSimilarity(value: string): string {
  return tokenizeAiWords(value).join(" ");
}

function buildPlagiarismReport(candidateText: string, sources: string[], nGramSize: number): PlagiarismReport | null {
  const candidateWords = tokenizeAiWords(candidateText);
  const candidateWordCount = candidateWords.length;
  if (candidateWordCount < Math.max(20, nGramSize * 4)) return null;

  const candidateShingles = new Set(buildWordShingles(candidateWords, nGramSize));
  if (!candidateShingles.size) return null;

  const candidateSentences = splitAiSentences(candidateText)
    .map((sentence) => normalizeSentenceForSimilarity(sentence))
    .filter((sentence) => tokenizeAiWords(sentence).length >= 6);
  const candidateSentenceSet = new Set(candidateSentences);

  const aggregateOverlap = new Set<string>();
  const aggregateSentenceMatches = new Set<string>();

  const results = sources
    .map((source, index): PlagiarismSourceResult => {
      const sourceWords = tokenizeAiWords(source);
      const sourceShingles = new Set(buildWordShingles(sourceWords, nGramSize));
      const overlap: string[] = [];
      const [smaller, larger] =
        candidateShingles.size <= sourceShingles.size
          ? [candidateShingles, sourceShingles]
          : [sourceShingles, candidateShingles];

      for (const phrase of smaller) {
        if (larger.has(phrase) && candidateShingles.has(phrase)) {
          overlap.push(phrase);
          aggregateOverlap.add(phrase);
        }
      }

      const sourceSentenceSet = new Set(
        splitAiSentences(source)
          .map((sentence) => normalizeSentenceForSimilarity(sentence))
          .filter((sentence) => tokenizeAiWords(sentence).length >= 6),
      );
      let sentenceMatches = 0;
      for (const sentence of candidateSentenceSet) {
        if (sourceSentenceSet.has(sentence)) {
          sentenceMatches += 1;
          aggregateSentenceMatches.add(sentence);
        }
      }

      const similarity = (overlap.length / candidateShingles.size) * 100;
      const sourceCoverage = sourceShingles.size ? (overlap.length / sourceShingles.size) * 100 : 0;

      return {
        sourceLabel: `Source ${index + 1}`,
        sourceWordCount: sourceWords.length,
        similarity,
        sourceCoverage,
        overlapCount: overlap.length,
        sentenceMatches,
        matchedPhrases: overlap.slice(0, 6),
      };
    })
    .sort((left, right) => right.similarity - left.similarity);

  const overallSimilarity = (aggregateOverlap.size / candidateShingles.size) * 100;
  const overallCoverage = results.length
    ? results.reduce((sum, result) => sum + result.sourceCoverage, 0) / results.length
    : 0;
  const flaggedSentenceCount = aggregateSentenceMatches.size;

  let verdict = "Low overlap detected";
  let verdictTone: "ok" | "info" | "warn" | "bad" = "ok";
  if (overallSimilarity >= 35 || flaggedSentenceCount >= 4) {
    verdict = "High plagiarism risk";
    verdictTone = "bad";
  } else if (overallSimilarity >= 15 || flaggedSentenceCount >= 2) {
    verdict = "Moderate overlap found";
    verdictTone = "warn";
  } else if (overallSimilarity >= 8) {
    verdict = "Minor overlap found";
    verdictTone = "info";
  }

  return {
    candidateWordCount,
    sourceCount: sources.length,
    overallSimilarity,
    overallCoverage,
    flaggedSentenceCount,
    verdict,
    verdictTone,
    results,
  };
}

function PlagiarismCheckerTool() {
  const [candidateText, setCandidateText] = useState("");
  const [sourcesInput, setSourcesInput] = useState("");
  const [nGramSize, setNGramSize] = useState(6);
  const [sourcesUploadMode, setSourcesUploadMode] = useState<TextUploadMergeMode>("append");
  const [report, setReport] = useState<PlagiarismReport | null>(null);
  const [status, setStatus] = useState("Paste a target text and one or more source texts.");

  const sourceCount = useMemo(() => parsePlagiarismSources(sourcesInput).length, [sourcesInput]);

  const analyze = useCallback(() => {
    const sources = parsePlagiarismSources(sourcesInput);
    if (!candidateText.trim()) {
      setStatus("Enter target text first.");
      setReport(null);
      return;
    }
    if (!sources.length) {
      setStatus("Add at least one source text. Separate sources with a line containing ---");
      setReport(null);
      return;
    }

    const reportResult = buildPlagiarismReport(
      candidateText,
      sources,
      Math.max(3, Math.min(10, Math.round(nGramSize))),
    );
    if (!reportResult) {
      setStatus("Text is too short for reliable similarity analysis.");
      setReport(null);
      return;
    }

    setReport(reportResult);
    setStatus(
      `Analysis complete: ${reportResult.verdict} (${reportResult.overallSimilarity.toFixed(1)}% overall overlap).`,
    );
    trackEvent("tool_plagiarism_checker_analyze", {
      words: reportResult.candidateWordCount,
      sources: reportResult.sourceCount,
      overlap: Number(reportResult.overallSimilarity.toFixed(1)),
      flaggedSentences: reportResult.flaggedSentenceCount,
    });
  }, [candidateText, nGramSize, sourcesInput]);

  const handleCandidateUpload = useCallback(async (file: File | null) => {
    if (!file) return;
    try {
      const raw = await readTextFileWithLimit(file);
      const extension = getFileExtension(file.name);
      const normalized =
        extension === "html" || extension === "htm" ? extractPlainTextFromHtml(raw) : normalizeUploadedText(raw);
      setCandidateText(normalized);
      setStatus(`Loaded target text from ${file.name}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load target file.");
    }
  }, []);

  const handleSourcesUpload = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      try {
        const chunks: string[] = [];
        for (const file of Array.from(files)) {
          const raw = await readTextFileWithLimit(file);
          const extension = getFileExtension(file.name);
          const normalized =
            extension === "html" || extension === "htm" ? extractPlainTextFromHtml(raw) : normalizeUploadedText(raw);
          if (normalized.trim()) {
            chunks.push(normalized.trim());
          }
        }
        if (!chunks.length) {
          setStatus("No usable source text found in uploaded files.");
          return;
        }
        const mergedSourceBlock = chunks.join("\n\n---\n\n");
        const nextValue =
          sourcesUploadMode === "replace" || !sourcesInput.trim()
            ? mergedSourceBlock
            : `${sourcesInput.trimEnd()}\n\n---\n\n${mergedSourceBlock}`;
        setSourcesInput(nextValue);
        setStatus(`Loaded ${formatNumericValue(chunks.length)} source file(s).`);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : "Could not load source files.");
      }
    },
    [sourcesInput, sourcesUploadMode],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Search}
        title="Plagiarism checker"
        subtitle="Compare text against multiple sources using n-gram overlap and matched phrase evidence."
      />

      <label className="field">
        <span>Target text</span>
        <textarea
          value={candidateText}
          onChange={(event) => setCandidateText(event.target.value)}
          rows={8}
          placeholder="Paste the text you want to check."
        />
      </label>
      <label className="field">
        <span>Upload target file</span>
        <input type="file" accept=".txt,.md,.markdown,.html,.htm" onChange={(event) => void handleCandidateUpload(event.target.files?.[0] ?? null)} />
      </label>

      <label className="field">
        <span>Source text(s)</span>
        <textarea
          value={sourcesInput}
          onChange={(event) => setSourcesInput(event.target.value)}
          rows={10}
          placeholder={`Paste one or more source texts.\nUse a line with --- between sources.`}
        />
        <small className="supporting-text">
          Separate each source with a standalone line containing `---`.
        </small>
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Upload one or more source files</span>
          <input type="file" multiple accept=".txt,.md,.markdown,.html,.htm" onChange={(event) => void handleSourcesUpload(event.target.files)} />
        </label>
        <label className="field">
          <span>Source upload behavior</span>
          <select value={sourcesUploadMode} onChange={(event) => setSourcesUploadMode(event.target.value as TextUploadMergeMode)}>
            <option value="append">Append uploaded sources</option>
            <option value="replace">Replace existing sources</option>
          </select>
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>N-gram phrase size</span>
          <input
            type="number"
            min={3}
            max={10}
            value={nGramSize}
            onChange={(event) => setNGramSize(Number(event.target.value))}
          />
          <small className="supporting-text">
            Larger values reduce false positives but may miss paraphrasing.
          </small>
        </label>
      </div>

      <div className="button-row">
        <button className="action-button" type="button" onClick={analyze}>
          Analyze similarity
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setCandidateText("");
            setSourcesInput("");
            setReport(null);
            setStatus("Cleared plagiarism analysis.");
          }}
        >
          <Trash2 size={15} />
          Clear
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            report
              ? downloadCsv(
                  "plagiarism-report.csv",
                  ["Source", "Words", "Similarity %", "Source Coverage %", "Overlap Count", "Sentence Matches"],
                  report.results.map((result) => [
                    result.sourceLabel,
                    result.sourceWordCount.toString(),
                    result.similarity.toFixed(2),
                    result.sourceCoverage.toFixed(2),
                    result.overlapCount.toString(),
                    result.sentenceMatches.toString(),
                  ]),
                )
              : undefined
          }
          disabled={!report}
        >
          <Download size={15} />
          Download CSV
        </button>
      </div>

      <p className="supporting-text">{status}</p>
      <ResultList
        rows={[
          { label: "Target words", value: formatNumericValue(countWords(candidateText)) },
          { label: "Sources loaded", value: formatNumericValue(sourceCount) },
          { label: "N-gram size", value: formatNumericValue(Math.max(3, Math.min(10, Math.round(nGramSize || 3)))) },
        ]}
      />

      {report ? (
        <>
          <p className={`status-badge ${report.verdictTone}`}>
            {report.verdict} | Overall overlap: {report.overallSimilarity.toFixed(1)}% | Flagged sentence matches:{" "}
            {report.flaggedSentenceCount}
          </p>

          <ResultList
            rows={[
              { label: "Overall overlap", value: `${report.overallSimilarity.toFixed(1)}%` },
              { label: "Average source coverage", value: `${report.overallCoverage.toFixed(1)}%` },
              { label: "Flagged sentence matches", value: formatNumericValue(report.flaggedSentenceCount) },
              { label: "Compared sources", value: formatNumericValue(report.sourceCount) },
            ]}
          />

          <div className="mini-panel">
            <h3>Source comparison</h3>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Words</th>
                    <th>Similarity</th>
                    <th>Source coverage</th>
                    <th>Phrase overlaps</th>
                    <th>Sentence matches</th>
                  </tr>
                </thead>
                <tbody>
                  {report.results.map((result) => (
                    <tr key={result.sourceLabel}>
                      <td>{result.sourceLabel}</td>
                      <td>{formatNumericValue(result.sourceWordCount)}</td>
                      <td>{result.similarity.toFixed(1)}%</td>
                      <td>{result.sourceCoverage.toFixed(1)}%</td>
                      <td>{formatNumericValue(result.overlapCount)}</td>
                      <td>{formatNumericValue(result.sentenceMatches)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {report.results.some((result) => result.matchedPhrases.length) ? (
            <div className="mini-panel">
              <h3>Matched phrases</h3>
              <ul className="plain-list">
                {report.results.map((result) => (
                  <li key={`${result.sourceLabel}-phrases`}>
                    <strong>{result.sourceLabel}:</strong>{" "}
                    {result.matchedPhrases.length ? result.matchedPhrases.join(" | ") : "No strong phrase overlaps"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function TextTool({ id }: { id: TextToolId }) {
  switch (id) {
    case "word-counter":
      return <WordCounterTool />;
    case "character-counter":
      return <CharacterCounterTool />;
    case "keyword-density-checker":
      return <KeywordDensityTool />;
    case "slug-generator":
      return <SlugGeneratorTool />;
    case "meta-tag-generator":
      return <MetaTagGeneratorTool />;
    case "open-graph-generator":
      return <OpenGraphGeneratorTool />;
    case "html-beautifier":
      return <HtmlBeautifierTool />;
    case "json-formatter":
      return <JsonFormatterTool />;
    case "xml-sitemap-generator":
      return <XmlSitemapGeneratorTool />;
    case "robots-txt-generator":
      return <RobotsTxtGeneratorTool />;
    case "structured-data-validator":
      return <StructuredDataValidatorTool />;
    case "internal-link-map-helper":
      return <InternalLinkMapHelperTool />;
    case "css-minifier":
      return <MinifierTool mode="css" />;
    case "js-minifier":
      return <MinifierTool mode="js" />;
    case "base64-encoder-decoder":
      return <Base64Tool />;
    case "ai-detector":
      return <AiDetectorTool />;
    case "plagiarism-checker":
      return <PlagiarismCheckerTool />;
    case "password-generator":
      return <PasswordGeneratorTool />;
    case "lorem-ipsum-generator":
      return <LoremIpsumTool />;
    default:
      return <p>Text tool unavailable.</p>;
  }
}

function UuidGeneratorTool() {
  const [count, setCount] = useState("5");
  const [uppercase, setUppercase] = useState(false);
  const [stripHyphens, setStripHyphens] = useState(false);
  const [uuids, setUuids] = useState<string[]>(() =>
    Array.from({ length: 5 }, () => crypto.randomUUID()),
  );
  const [status, setStatus] = useState("");

  const buildUuid = useCallback(() => {
    let next = crypto.randomUUID();
    if (stripHyphens) next = next.replace(/-/g, "");
    if (uppercase) next = next.toUpperCase();
    return next;
  }, [stripHyphens, uppercase]);

  const generateBatch = useCallback(() => {
    const targetCount = Math.max(1, Math.min(100, Math.round(Number(count) || 1)));
    const nextBatch = Array.from({ length: targetCount }, () => buildUuid());
    setUuids(nextBatch);
    setStatus(`Generated ${targetCount} UUID${targetCount === 1 ? "" : "s"}.`);
    trackEvent("tool_generate_uuid", { count: targetCount, uppercase, stripHyphens });
  }, [buildUuid, count, stripHyphens, uppercase]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Hash}
        title="UUID generator"
        subtitle="Generate batch UUID v4 values, customize format, and export directly for dev workflows."
      />
      <div className="field-grid">
        <label className="field">
          <span>Batch size</span>
          <input
            type="number"
            min={1}
            max={100}
            step={1}
            value={count}
            onChange={(event) => setCount(event.target.value)}
          />
          <small className="supporting-text">Generate 1 to 100 UUIDs at once.</small>
        </label>
      </div>
      <div className="button-row">
        <label className="checkbox">
          <input type="checkbox" checked={uppercase} onChange={(event) => setUppercase(event.target.checked)} />
          Uppercase
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={stripHyphens}
            onChange={(event) => setStripHyphens(event.target.checked)}
          />
          Remove hyphens
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={generateBatch}>
          Generate batch
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(uuids.join("\n"));
            setStatus(ok ? "UUID list copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy all
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => downloadTextFile("uuids.txt", uuids.join("\n"))}
        >
          <Download size={15} />
          TXT
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <ul className="mono-list">
        {uuids.map((uuid, index) => (
          <li key={`${uuid}-${index}`}>
            <div className="panel-head">
              <span>{uuid}</span>
              <button
                className="action-button secondary"
                type="button"
                onClick={async () => {
                  const ok = await copyTextToClipboard(uuid);
                  setStatus(ok ? `UUID ${index + 1} copied.` : "Unable to copy.");
                }}
              >
                Copy
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function extractQueryParams(value: string): Array<{ key: string; value: string }> {
  const trimmed = value.trim();
  if (!trimmed) return [];

  try {
    const params = new URL(trimmed).searchParams;
    return [...params.entries()].map(([key, paramValue]) => ({ key, value: paramValue }));
  } catch {
    try {
      const normalized = trimmed.startsWith("?") ? trimmed.slice(1) : trimmed;
      if (!normalized.includes("=")) return [];
      const params = new URLSearchParams(normalized);
      return [...params.entries()].map(([key, paramValue]) => ({ key, value: paramValue }));
    } catch {
      return [];
    }
  }
}

function UrlEncoderDecoderTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [mode, setMode] = useState<"component" | "uri">("component");
  const [decodePlusAsSpace, setDecodePlusAsSpace] = useState(true);
  const [status, setStatus] = useState("");
  const queryRows = useMemo(() => extractQueryParams(output), [output]);

  const encode = () => {
    const next = mode === "uri" ? encodeURI(input) : encodeURIComponent(input);
    setOutput(next);
    setStatus("Encoded successfully.");
    trackEvent("tool_url_transform", { action: "encode", mode });
  };

  const decode = () => {
    const source = decodePlusAsSpace ? input.replace(/\+/g, "%20") : input;
    try {
      const next = mode === "uri" ? decodeURI(source) : decodeURIComponent(source);
      setOutput(next);
      setStatus("Decoded successfully.");
      trackEvent("tool_url_transform", { action: "decode", mode });
    } catch {
      setStatus("Unable to decode input. Verify escaped characters.");
    }
  };

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Link2}
        title="URL encode/decode"
        subtitle="Encode URL components safely, decode quickly, and inspect parsed query parameters."
      />
      <div className="field-grid">
        <label className="field">
          <span>Mode</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as "component" | "uri")}>
            <option value="component">URL component (encodeURIComponent)</option>
            <option value="uri">Full URI (encodeURI)</option>
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={decodePlusAsSpace}
            onChange={(event) => setDecodePlusAsSpace(event.target.checked)}
          />
          Treat + as spaces on decode
        </label>
      </div>
      <label className="field">
        <span>Input</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={5} />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={encode}>
          Encode
        </button>
        <button className="action-button secondary" type="button" onClick={decode}>
          Decode
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setInput(output);
            setOutput(input);
            setStatus("Swapped input and output.");
          }}
        >
          <RefreshCw size={15} />
          Swap
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(output);
            setStatus(ok ? "Output copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy output
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <label className="field">
        <span>Output</span>
        <textarea value={output} readOnly rows={5} />
      </label>
      <ResultList
        rows={[
          { label: "Input length", value: formatNumericValue(input.length) },
          { label: "Output length", value: formatNumericValue(output.length) },
          { label: "Query parameters found", value: formatNumericValue(queryRows.length) },
        ]}
      />
      {queryRows.length > 0 ? (
        <div className="mini-panel">
          <h3>Parsed query parameters</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                {queryRows.map((row, index) => (
                  <tr key={`${row.key}-${index}`}>
                    <td>{row.key}</td>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface TimeZoneOption {
  value: string;
  label: string;
}

const TIME_ZONE_PRIORITY = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Africa/Lagos",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const TIME_ZONE_COMPARE_DEFAULTS = [
  "UTC",
  "America/New_York",
  "Europe/London",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const zonePartsFormatterCache = new Map<string, Intl.DateTimeFormat>();
const zoneDisplayFormatterCache = new Map<string, Intl.DateTimeFormat>();

function isValidTimeZoneValue(value: string): boolean {
  if (!value.trim()) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimeZoneValue(value: string, fallback = "UTC"): string {
  const trimmed = value.trim();
  return isValidTimeZoneValue(trimmed) ? trimmed : fallback;
}

function getZonePartsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zonePartsFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  zonePartsFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getZoneDisplayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = zoneDisplayFormatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZoneName: "short",
  });
  zoneDisplayFormatterCache.set(timeZone, formatter);
  return formatter;
}

function getDatePartsInTimeZone(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = getZonePartsFormatter(timeZone).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.get("year") ?? "0"),
    month: Number(map.get("month") ?? "0"),
    day: Number(map.get("day") ?? "0"),
    hour: Number(map.get("hour") ?? "0"),
    minute: Number(map.get("minute") ?? "0"),
    second: Number(map.get("second") ?? "0"),
  };
}

function parseDateTimeLocalValue(value: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
} | null {
  const matched = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  const hour = Number(matched[4]);
  const minute = Number(matched[5]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

function formatDateTimeLocalForZone(date: Date, timeZone: string): string {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day
    .toString()
    .padStart(2, "0")}T${parts.hour.toString().padStart(2, "0")}:${parts.minute.toString().padStart(2, "0")}`;
}

function getTimeZoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = getDatePartsInTimeZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

function formatOffsetMinutes(offsetMinutes: number): string {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  const hours = Math.floor(absolute / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (absolute % 60).toString().padStart(2, "0");
  return `UTC${sign}${hours}:${minutes}`;
}

function getDayStampForZone(date: Date, timeZone: string): number {
  const parts = getDatePartsInTimeZone(date, timeZone);
  return Math.floor(Date.UTC(parts.year, parts.month - 1, parts.day) / DAY_IN_MS);
}

function resolveZonedDateTime(value: string, timeZone: string): { date: Date | null; exact: boolean } {
  const parsed = parseDateTimeLocalValue(value);
  if (!parsed || !isValidTimeZoneValue(timeZone)) return { date: null, exact: false };

  const expected = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute, 0, 0);
  let guess = expected;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const offsetMinutes = getTimeZoneOffsetMinutes(new Date(guess), timeZone);
    const nextGuess = expected - offsetMinutes * 60_000;
    if (Math.abs(nextGuess - guess) < 1000) {
      guess = nextGuess;
      break;
    }
    guess = nextGuess;
  }

  const candidates = [guess, guess - 60 * 60 * 1000, guess + 60 * 60 * 1000];
  for (const candidateMs of candidates) {
    const candidateDate = new Date(candidateMs);
    const parts = getDatePartsInTimeZone(candidateDate, timeZone);
    if (
      parts.year === parsed.year &&
      parts.month === parsed.month &&
      parts.day === parsed.day &&
      parts.hour === parsed.hour &&
      parts.minute === parsed.minute
    ) {
      return { date: candidateDate, exact: true };
    }
  }

  return { date: new Date(guess), exact: false };
}

function getSupportedTimeZoneOptions(localTimeZone: string): TimeZoneOption[] {
  const intlWithSupported = Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] };
  const fallback = TIME_ZONE_PRIORITY.filter((entry) => isValidTimeZoneValue(entry));
  const supported = intlWithSupported.supportedValuesOf?.("timeZone") ?? fallback;
  const normalizedLocal = normalizeTimeZoneValue(localTimeZone, "UTC");

  const seen = new Set<string>();
  const ordered = [...TIME_ZONE_PRIORITY, normalizedLocal, ...supported];
  const unique = ordered.filter((entry) => {
    const normalized = normalizeTimeZoneValue(entry, "");
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });

  return unique.map((value) => ({
    value,
    label: value.replace(/_/g, " "),
  }));
}

function formatTimeZoneDate(date: Date, timeZone: string): string {
  return getZoneDisplayFormatter(timeZone).format(date);
}

function TimeZoneConverterTool() {
  const browserTimeZone = useMemo(
    () => normalizeTimeZoneValue(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", "UTC"),
    [],
  );
  const timeZoneOptions = useMemo(() => getSupportedTimeZoneOptions(browserTimeZone), [browserTimeZone]);
  const [fromTimeZone, setFromTimeZone] = useState(browserTimeZone);
  const [toTimeZone, setToTimeZone] = useState("UTC");
  const [dateTimeInput, setDateTimeInput] = useState(() => formatDateTimeLocalForZone(new Date(), browserTimeZone));
  const [compareZoneInput, setCompareZoneInput] = useState("Europe/London");
  const [compareZones, setCompareZones] = useState<string[]>(TIME_ZONE_COMPARE_DEFAULTS);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (timeZoneOptions.some((option) => option.value === fromTimeZone)) return;
    setFromTimeZone(browserTimeZone);
  }, [browserTimeZone, fromTimeZone, timeZoneOptions]);

  useEffect(() => {
    if (timeZoneOptions.some((option) => option.value === toTimeZone)) return;
    setToTimeZone("UTC");
  }, [timeZoneOptions, toTimeZone]);

  const conversion = useMemo(() => {
    const normalizedFrom = normalizeTimeZoneValue(fromTimeZone, browserTimeZone);
    const normalizedTo = normalizeTimeZoneValue(toTimeZone, "UTC");
    const resolved = resolveZonedDateTime(dateTimeInput, normalizedFrom);
    if (!resolved.date) {
      return {
        valid: false as const,
        message: "Enter a valid date/time to convert.",
      };
    }

    const instant = resolved.date;
    const sourceOffsetMinutes = getTimeZoneOffsetMinutes(instant, normalizedFrom);
    const targetOffsetMinutes = getTimeZoneOffsetMinutes(instant, normalizedTo);
    const sourceDayStamp = getDayStampForZone(instant, normalizedFrom);
    const targetDayStamp = getDayStampForZone(instant, normalizedTo);
    const dayShift = targetDayStamp - sourceDayStamp;

    return {
      valid: true as const,
      instant,
      exact: resolved.exact,
      fromTimeZone: normalizedFrom,
      toTimeZone: normalizedTo,
      sourceOffsetMinutes,
      targetOffsetMinutes,
      dayShift,
      fromFormatted: formatTimeZoneDate(instant, normalizedFrom),
      toFormatted: formatTimeZoneDate(instant, normalizedTo),
      utcFormatted: instant.toISOString(),
      unixSeconds: Math.floor(instant.getTime() / 1000),
      unixMilliseconds: instant.getTime(),
    };
  }, [browserTimeZone, dateTimeInput, fromTimeZone, toTimeZone]);

  const comparisonRows = useMemo(() => {
    if (!conversion.valid) return [];
    const uniqueZones = Array.from(
      new Set([conversion.fromTimeZone, conversion.toTimeZone, ...compareZones].map((entry) => normalizeTimeZoneValue(entry, ""))),
    ).filter(Boolean);

    return uniqueZones.slice(0, 12).map((zone) => {
      const offset = getTimeZoneOffsetMinutes(conversion.instant, zone);
      return {
        zone,
        formatted: formatTimeZoneDate(conversion.instant, zone),
        offset: formatOffsetMinutes(offset),
      };
    });
  }, [compareZones, conversion]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Tags}
        title="Time zone converter"
        subtitle="Convert a source timezone datetime into global timezones with offset and day-shift visibility."
      />
      <div className="field-grid">
        <label className="field">
          <span>Source date and time</span>
          <input type="datetime-local" value={dateTimeInput} onChange={(event) => setDateTimeInput(event.target.value)} />
        </label>
        <label className="field">
          <span>From timezone</span>
          <select value={fromTimeZone} onChange={(event) => setFromTimeZone(event.target.value)}>
            {timeZoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>To timezone</span>
          <select value={toTimeZone} onChange={(event) => setToTimeZone(event.target.value)}>
            {timeZoneOptions.map((option) => (
              <option key={`to-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setDateTimeInput(formatDateTimeLocalForZone(new Date(), fromTimeZone));
            setStatus(`Loaded current time in ${fromTimeZone}.`);
          }}
        >
          Use now in source timezone
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setFromTimeZone(toTimeZone);
            setToTimeZone(fromTimeZone);
            setStatus("Swapped source and target timezones.");
          }}
        >
          <RefreshCw size={15} />
          Swap timezones
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            if (!conversion.valid) return;
            const payload = [
              `Source (${conversion.fromTimeZone}): ${conversion.fromFormatted}`,
              `Target (${conversion.toTimeZone}): ${conversion.toFormatted}`,
              `UTC: ${conversion.utcFormatted}`,
            ].join("\n");
            const ok = await copyTextToClipboard(payload);
            setStatus(ok ? "Conversion summary copied." : "Could not copy conversion summary.");
          }}
          disabled={!conversion.valid}
        >
          <Copy size={15} />
          Copy summary
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      {!conversion.valid ? (
        <p className="error-text">{conversion.message}</p>
      ) : (
        <>
          {!conversion.exact ? (
            <p className="supporting-text">
              This local time may fall in a DST transition gap/overlap. Closest valid instant is shown.
            </p>
          ) : null}
          <ResultList
            rows={[
              { label: `Source (${conversion.fromTimeZone})`, value: conversion.fromFormatted },
              { label: `Target (${conversion.toTimeZone})`, value: conversion.toFormatted },
              { label: "UTC", value: conversion.utcFormatted },
              { label: "Source offset", value: formatOffsetMinutes(conversion.sourceOffsetMinutes) },
              { label: "Target offset", value: formatOffsetMinutes(conversion.targetOffsetMinutes) },
              {
                label: "Offset difference (target - source)",
                value: `${formatNumericValue((conversion.targetOffsetMinutes - conversion.sourceOffsetMinutes) / 60)} hours`,
              },
              {
                label: "Day shift",
                value:
                  conversion.dayShift === 0
                    ? "Same calendar day"
                    : conversion.dayShift > 0
                      ? `Target is +${conversion.dayShift} day(s)`
                      : `Target is ${conversion.dayShift} day(s)`,
              },
              { label: "Unix seconds", value: conversion.unixSeconds.toString() },
              { label: "Unix milliseconds", value: conversion.unixMilliseconds.toString() },
            ]}
          />

          <div className="mini-panel">
            <div className="panel-head">
              <h3>World compare grid</h3>
              <div className="button-row">
                <label className="field">
                  <span>Add timezone</span>
                  <select value={compareZoneInput} onChange={(event) => setCompareZoneInput(event.target.value)}>
                    {timeZoneOptions.map((option) => (
                      <option key={`compare-${option.value}`} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() =>
                    setCompareZones((current) =>
                      current.includes(compareZoneInput) ? current : [...current, compareZoneInput].slice(0, 12),
                    )
                  }
                >
                  Add
                </button>
                <button className="action-button secondary" type="button" onClick={() => setCompareZones(TIME_ZONE_COMPARE_DEFAULTS)}>
                  Reset list
                </button>
              </div>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timezone</th>
                    <th>Local time</th>
                    <th>UTC offset</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.zone}>
                      <td>{row.zone}</td>
                      <td>{row.formatted}</td>
                      <td>{row.offset}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function TimestampConverterTool() {
  const [unixInput, setUnixInput] = useState(Math.floor(Date.now() / 1000).toString());
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 16));
  const [status, setStatus] = useState("");

  const parsedUnix = Number(unixInput.trim());
  const unixMs = Number.isFinite(parsedUnix) ? (Math.abs(parsedUnix) >= 1e12 ? parsedUnix : parsedUnix * 1000) : NaN;
  const unixDate = Number.isFinite(unixMs) ? new Date(unixMs) : null;
  const parsedDate = new Date(dateInput);
  const dateValid = !Number.isNaN(parsedDate.getTime());
  const unixFromDateSeconds = dateValid ? Math.floor(parsedDate.getTime() / 1000) : null;
  const unixFromDateMilliseconds = dateValid ? parsedDate.getTime() : null;

  const relativeTime = useMemo(() => {
    if (!Number.isFinite(unixMs)) return "Invalid timestamp";
    const derivedDate = new Date(unixMs);
    if (Number.isNaN(derivedDate.getTime())) return "Invalid timestamp";
    const deltaSeconds = Math.round((derivedDate.getTime() - Date.now()) / 1000);
    const absolute = Math.abs(deltaSeconds);
    const suffix = deltaSeconds >= 0 ? "from now" : "ago";
    if (absolute < 60) return `${absolute} seconds ${suffix}`;
    if (absolute < 3600) return `${Math.round(absolute / 60)} minutes ${suffix}`;
    if (absolute < 86_400) return `${Math.round(absolute / 3600)} hours ${suffix}`;
    return `${Math.round(absolute / 86_400)} days ${suffix}`;
  }, [unixMs]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Tags}
        title="Timestamp converter"
        subtitle="Convert Unix seconds/milliseconds to readable time formats and back in one view."
      />
      <div className="field-grid">
        <label className="field">
          <span>Unix timestamp (seconds or milliseconds)</span>
          <input type="text" value={unixInput} onChange={(event) => setUnixInput(event.target.value)} />
        </label>
        <label className="field">
          <span>Date and time (local)</span>
          <input type="datetime-local" value={dateInput} onChange={(event) => setDateInput(event.target.value)} />
        </label>
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const now = new Date();
            setUnixInput(Math.floor(now.getTime() / 1000).toString());
            setDateInput(now.toISOString().slice(0, 16));
            setStatus("Loaded current time.");
          }}
        >
          Use now
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            if (!unixDate) return;
            setDateInput(unixDate.toISOString().slice(0, 16));
            setStatus("Applied Unix value to date field.");
          }}
          disabled={!unixDate}
        >
          Unix to date field
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            if (unixFromDateSeconds === null) return;
            setUnixInput(unixFromDateSeconds.toString());
            setStatus("Applied date value to Unix field.");
          }}
          disabled={unixFromDateSeconds === null}
        >
          Date to Unix field
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <ResultList
        rows={[
          {
            label: "Unix -> UTC",
            value: unixDate && !Number.isNaN(unixDate.getTime()) ? unixDate.toUTCString() : "Invalid timestamp",
          },
          {
            label: "Unix input interpreted as",
            value: Number.isFinite(parsedUnix)
              ? Math.abs(parsedUnix) >= 1e12
                ? "Milliseconds"
                : "Seconds"
              : "Invalid",
          },
          {
            label: "Unix -> Local",
            value:
              unixDate && !Number.isNaN(unixDate.getTime())
                ? unixDate.toLocaleString("en-US", { hour12: false })
                : "Invalid timestamp",
          },
          {
            label: "Unix -> ISO 8601",
            value: unixDate && !Number.isNaN(unixDate.getTime()) ? unixDate.toISOString() : "Invalid timestamp",
          },
          { label: "Unix -> Relative", value: relativeTime },
          { label: "Date -> Unix seconds", value: unixFromDateSeconds !== null ? unixFromDateSeconds.toString() : "Invalid date" },
          {
            label: "Date -> Unix milliseconds",
            value: unixFromDateMilliseconds !== null ? unixFromDateMilliseconds.toString() : "Invalid date",
          },
        ]}
      />
    </section>
  );
}

function MarkdownToHtmlTool() {
  const [markdown, setMarkdown] = useState("# Heading\n\nWrite **bold** text, *italic* text, and - list items.");
  const [status, setStatus] = useState("");
  const html = useMemo(() => markdownToHtml(markdown), [markdown]);
  const htmlDocument = useMemo(
    () =>
      `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Markdown Output</title>
</head>
<body>
${html}
</body>
</html>`,
    [html],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Braces}
        title="Markdown to HTML"
        subtitle="Convert markdown instantly with preview, raw HTML output, and export-ready HTML documents."
      />
      <div className="split-panel">
        <label className="field">
          <span>Markdown input</span>
          <textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} rows={14} />
        </label>
        <div className="preview">
          <h3>Rendered preview</h3>
          <div className="preview-box" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
      <label className="field">
        <span>HTML output</span>
        <textarea value={html} readOnly rows={10} />
      </label>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(html);
            setStatus(ok ? "HTML copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy HTML
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => downloadTextFile("markdown-output.html", htmlDocument, "text/html;charset=utf-8;")}
        >
          <Download size={15} />
          Download HTML
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <ResultList
        rows={[
          { label: "Markdown characters", value: formatNumericValue(markdown.length) },
          { label: "Markdown words", value: formatNumericValue(countWords(markdown)) },
          { label: "Generated HTML size", value: `${formatNumericValue(html.length)} chars` },
        ]}
      />
    </section>
  );
}

interface ParsedUserAgentDetails {
  browser: string;
  browserVersion: string;
  os: string;
  engine: string;
  deviceType: string;
}

function parseUserAgentDetails(userAgent: string): ParsedUserAgentDetails {
  const ua = userAgent.trim();
  const browserChecks: Array<{ name: string; pattern: RegExp }> = [
    { name: "Edge", pattern: /Edg\/([\d.]+)/i },
    { name: "Opera", pattern: /OPR\/([\d.]+)/i },
    { name: "Chrome", pattern: /Chrome\/([\d.]+)/i },
    { name: "Firefox", pattern: /Firefox\/([\d.]+)/i },
    { name: "Safari", pattern: /Version\/([\d.]+).*Safari/i },
    { name: "Internet Explorer", pattern: /(?:MSIE\s|rv:)([\d.]+)/i },
  ];

  let browser = "Unknown";
  let browserVersion = "Unknown";
  for (const check of browserChecks) {
    const match = ua.match(check.pattern);
    if (match) {
      browser = check.name;
      browserVersion = match[1] ?? "Unknown";
      break;
    }
  }

  let os = "Unknown";
  if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let engine = "Unknown";
  if (/AppleWebKit/i.test(ua) && /Chrome|Chromium|Edg|OPR/i.test(ua)) engine = "Blink";
  else if (/AppleWebKit/i.test(ua)) engine = "WebKit";
  else if (/Gecko\/\d/i.test(ua) && /Firefox/i.test(ua)) engine = "Gecko";
  else if (/Trident/i.test(ua)) engine = "Trident";

  let deviceType = "Desktop";
  if (/bot|crawler|spider|slurp/i.test(ua)) deviceType = "Bot";
  else if (/tablet|ipad/i.test(ua)) deviceType = "Tablet";
  else if (/mobile|iphone|android/i.test(ua)) deviceType = "Mobile";

  return { browser, browserVersion, os, engine, deviceType };
}

function UserAgentCheckerTool() {
  const [agentInput, setAgentInput] = useState("");
  const [status, setStatus] = useState("");
  const [environment, setEnvironment] = useState<{
    platform: string;
    language: string;
    languages: string;
    cookieEnabled: string;
    online: string;
    hardwareConcurrency: string;
    deviceMemory: string;
    maxTouchPoints: string;
  }>({
    platform: "Unknown",
    language: "Unknown",
    languages: "Unknown",
    cookieEnabled: "Unknown",
    online: "Unknown",
    hardwareConcurrency: "Unknown",
    deviceMemory: "Unknown",
    maxTouchPoints: "Unknown",
  });

  useEffect(() => {
    const nav = navigator as Navigator & { deviceMemory?: number };
    setAgentInput(nav.userAgent);
    setEnvironment({
      platform: nav.platform || "Unknown",
      language: nav.language || "Unknown",
      languages: nav.languages?.join(", ") || "Unknown",
      cookieEnabled: String(nav.cookieEnabled),
      online: String(nav.onLine),
      hardwareConcurrency: nav.hardwareConcurrency ? nav.hardwareConcurrency.toString() : "Unknown",
      deviceMemory: nav.deviceMemory ? `${nav.deviceMemory} GB` : "Unknown",
      maxTouchPoints: nav.maxTouchPoints ? nav.maxTouchPoints.toString() : "0",
    });
  }, []);

  const parsed = useMemo(() => parseUserAgentDetails(agentInput), [agentInput]);
  const payload = useMemo(
    () =>
      JSON.stringify(
        {
          userAgent: agentInput,
          ...parsed,
          ...environment,
        },
        null,
        2,
      ),
    [agentInput, environment, parsed],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Search}
        title="User agent checker"
        subtitle="Inspect browser, engine, OS, and device context for debugging analytics and compatibility."
      />
      <label className="field">
        <span>User agent string</span>
        <textarea value={agentInput} onChange={(event) => setAgentInput(event.target.value)} rows={5} />
      </label>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setAgentInput(navigator.userAgent);
            setStatus("Loaded current browser user agent.");
          }}
        >
          Load current UA
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(payload);
            setStatus(ok ? "Details copied as JSON." : "Unable to copy.");
          }}
        >
          <Copy size={15} />
          Copy JSON
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <ResultList
        rows={[
          { label: "Browser", value: `${parsed.browser} ${parsed.browserVersion}`.trim() },
          { label: "Engine", value: parsed.engine },
          { label: "Operating system", value: parsed.os },
          { label: "Device type", value: parsed.deviceType },
          { label: "Platform", value: environment.platform },
          { label: "Language", value: environment.language },
          { label: "Languages", value: environment.languages },
          { label: "CPU threads", value: environment.hardwareConcurrency },
          { label: "Device memory", value: environment.deviceMemory },
          { label: "Touch points", value: environment.maxTouchPoints },
          { label: "Cookie enabled", value: environment.cookieEnabled },
          { label: "Online status", value: environment.online },
        ]}
      />
    </section>
  );
}

interface IpLookupPayload {
  ok: boolean;
  ip?: string;
  source?: string;
  forwardedFor?: string;
  error?: string;
  checkedAt?: string;
}

function IpAddressCheckerTool() {
  const [data, setData] = useState<IpLookupPayload>({ ok: false, ip: "Not loaded yet" });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [connection, setConnection] = useState<{
    effectiveType: string;
    downlink: string;
    rtt: string;
    saveData: string;
  }>({
    effectiveType: "Unknown",
    downlink: "Unknown",
    rtt: "Unknown",
    saveData: "Unknown",
  });

  const loadIp = useCallback(async () => {
    setLoading(true);
    setStatus("Checking IP...");
    try {
      const response = await fetch("/api/ip-address", { cache: "no-store" });
      const payload = (await response.json()) as IpLookupPayload;
      setData(payload);
      setStatus(payload.ok ? "IP details loaded." : payload.error ?? "Unable to fetch IP.");
      trackEvent("tool_check_ip", { success: payload.ok });
    } catch {
      setStatus("Request failed. Check network connectivity.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const nav = navigator as Navigator & {
      connection?: { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    };
    const info = nav.connection;
    if (info) {
      setConnection({
        effectiveType: info.effectiveType ?? "Unknown",
        downlink: Number.isFinite(info.downlink) ? `${info.downlink} Mbps` : "Unknown",
        rtt: Number.isFinite(info.rtt) ? `${info.rtt} ms` : "Unknown",
        saveData: typeof info.saveData === "boolean" ? String(info.saveData) : "Unknown",
      });
    }
    void loadIp();
  }, [loadIp]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Share2}
        title="Public IP checker"
        subtitle="Fetch current public IP with request source context and local network condition indicators."
      />
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void loadIp()} disabled={loading}>
          {loading ? "Checking..." : "Refresh IP"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(data.ip ?? "");
            setStatus(ok ? "IP copied." : "No IP available to copy.");
          }}
          disabled={!data.ip}
        >
          <Copy size={15} />
          Copy IP
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <ResultList
        rows={[
          { label: "Public IP", value: data.ip ?? "Unavailable" },
          { label: "Source", value: data.source ?? "Unknown" },
          { label: "Forwarded chain", value: data.forwardedFor ?? "Unavailable" },
          { label: "Checked at", value: data.checkedAt ?? "Unavailable" },
          { label: "Connection type", value: connection.effectiveType },
          { label: "Downlink", value: connection.downlink },
          { label: "Round-trip time", value: connection.rtt },
          { label: "Data saver", value: connection.saveData },
        ]}
      />
      <p className="supporting-text">
        IP data is used for this check only and is not stored server-side by this tool.
      </p>
    </section>
  );
}

interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

interface CronPreset {
  label: string;
  values: CronParts;
}

const CRON_PRESETS: CronPreset[] = [
  { label: "Every minute", values: { minute: "*", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" } },
  { label: "Every 15 minutes", values: { minute: "*/15", hour: "*", dayOfMonth: "*", month: "*", dayOfWeek: "*" } },
  { label: "Daily at 09:00", values: { minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "*" } },
  { label: "Weekdays 09:00", values: { minute: "0", hour: "9", dayOfMonth: "*", month: "*", dayOfWeek: "1-5" } },
  { label: "Monthly at midnight", values: { minute: "0", hour: "0", dayOfMonth: "1", month: "*", dayOfWeek: "*" } },
];

const DAY_NAME_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function normalizeCronField(field: string): string {
  return field.trim() || "*";
}

function parseCronNumericToken(
  token: string,
  min: number,
  max: number,
  allowDayOfWeekSeven = false,
): number | null {
  const parsed = Number.parseInt(token, 10);
  if (!Number.isInteger(parsed)) return null;
  if (allowDayOfWeekSeven && parsed === 7) return 0;
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function parseCronRange(
  token: string,
  min: number,
  max: number,
  allowDayOfWeekSeven = false,
): { start: number; end: number } | null {
  const [rawStart, rawEnd] = token.split("-");
  if (!rawStart || !rawEnd) return null;
  const start = parseCronNumericToken(rawStart, min, max, allowDayOfWeekSeven);
  const end = parseCronNumericToken(rawEnd, min, max, allowDayOfWeekSeven);
  if (start === null || end === null || start > end) return null;
  return { start, end };
}

function doesCronPartMatch(
  part: string,
  value: number,
  min: number,
  max: number,
  allowDayOfWeekSeven = false,
): boolean {
  const clean = part.trim();
  if (!clean) return false;
  if (clean === "*") return true;

  if (clean.includes("/")) {
    const [base, stepToken] = clean.split("/");
    const step = Number.parseInt(stepToken, 10);
    if (!Number.isInteger(step) || step <= 0) return false;

    let start = min;
    let end = max;

    if (base !== "*") {
      if (base.includes("-")) {
        const range = parseCronRange(base, min, max, allowDayOfWeekSeven);
        if (!range) return false;
        start = range.start;
        end = range.end;
      } else {
        const numericBase = parseCronNumericToken(base, min, max, allowDayOfWeekSeven);
        if (numericBase === null) return false;
        start = numericBase;
        end = max;
      }
    }

    if (value < start || value > end) return false;
    return (value - start) % step === 0;
  }

  if (clean.includes("-")) {
    const range = parseCronRange(clean, min, max, allowDayOfWeekSeven);
    if (!range) return false;
    return value >= range.start && value <= range.end;
  }

  const direct = parseCronNumericToken(clean, min, max, allowDayOfWeekSeven);
  return direct !== null && value === direct;
}

function matchesCronField(
  field: string,
  value: number,
  min: number,
  max: number,
  allowDayOfWeekSeven = false,
): boolean {
  const normalized = normalizeCronField(field);
  if (normalized === "*") return true;
  return normalized.split(",").some((part) => doesCronPartMatch(part, value, min, max, allowDayOfWeekSeven));
}

function validateCronField(
  label: string,
  field: string,
  min: number,
  max: number,
  allowDayOfWeekSeven = false,
): string | null {
  const normalized = normalizeCronField(field);
  if (!/^[0-9*\/,\-]+$/.test(normalized)) {
    return `${label} supports digits, '*', ',', '-', '/'.`;
  }

  const parts = normalized.split(",");
  for (const partRaw of parts) {
    const part = partRaw.trim();
    if (!part) return `${label} contains an empty token.`;
    if (part === "*") continue;

    if (part.includes("/")) {
      const [base, stepToken] = part.split("/");
      const step = Number.parseInt(stepToken, 10);
      if (!Number.isInteger(step) || step <= 0) {
        return `${label} step value must be a positive integer.`;
      }
      if (base !== "*") {
        if (base.includes("-")) {
          if (!parseCronRange(base, min, max, allowDayOfWeekSeven)) return `${label} range '${base}' is invalid.`;
        } else if (parseCronNumericToken(base, min, max, allowDayOfWeekSeven) === null) {
          return `${label} value '${base}' is out of range.`;
        }
      }
      continue;
    }

    if (part.includes("-")) {
      if (!parseCronRange(part, min, max, allowDayOfWeekSeven)) return `${label} range '${part}' is invalid.`;
      continue;
    }

    if (parseCronNumericToken(part, min, max, allowDayOfWeekSeven) === null) {
      return `${label} value '${part}' is out of range (${min}-${max}${allowDayOfWeekSeven ? ", Sunday can be 7" : ""}).`;
    }
  }

  return null;
}

function cronMatchesDate(parts: CronParts, date: Date): boolean {
  const minuteMatch = matchesCronField(parts.minute, date.getMinutes(), 0, 59);
  const hourMatch = matchesCronField(parts.hour, date.getHours(), 0, 23);
  const monthMatch = matchesCronField(parts.month, date.getMonth() + 1, 1, 12);
  const domMatch = matchesCronField(parts.dayOfMonth, date.getDate(), 1, 31);
  const dowMatch = matchesCronField(parts.dayOfWeek, date.getDay(), 0, 6, true);
  const domAny = normalizeCronField(parts.dayOfMonth) === "*";
  const dowAny = normalizeCronField(parts.dayOfWeek) === "*";
  const dayMatch = domAny && dowAny ? true : domAny ? dowMatch : dowAny ? domMatch : domMatch || dowMatch;

  return minuteMatch && hourMatch && monthMatch && dayMatch;
}

function getNextCronRunDates(parts: CronParts, count = 5): Date[] {
  const output: Date[] = [];
  const now = new Date();
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  const maxIterations = 525_600 * 3;
  for (let index = 0; index < maxIterations && output.length < count; index += 1) {
    if (cronMatchesDate(parts, cursor)) {
      output.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  return output;
}

function summarizeCronExpression(parts: CronParts): string {
  const minute = normalizeCronField(parts.minute);
  const hour = normalizeCronField(parts.hour);
  const dom = normalizeCronField(parts.dayOfMonth);
  const month = normalizeCronField(parts.month);
  const dow = normalizeCronField(parts.dayOfWeek);

  if (minute === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return "Runs every minute.";
  }

  const stepMinuteMatch = minute.match(/^\*\/(\d+)$/);
  if (stepMinuteMatch && hour === "*" && dom === "*" && month === "*" && dow === "*") {
    return `Runs every ${stepMinuteMatch[1]} minutes.`;
  }

  const minuteValue = Number.parseInt(minute, 10);
  const hourValue = Number.parseInt(hour, 10);
  if (
    Number.isInteger(minuteValue) &&
    minuteValue >= 0 &&
    minuteValue <= 59 &&
    hour === "*" &&
    dom === "*" &&
    month === "*" &&
    dow === "*"
  ) {
    return `Runs at minute ${minuteValue} of every hour.`;
  }

  if (
    Number.isInteger(minuteValue) &&
    Number.isInteger(hourValue) &&
    minuteValue >= 0 &&
    minuteValue <= 59 &&
    hourValue >= 0 &&
    hourValue <= 23 &&
    dom === "*" &&
    month === "*" &&
    dow === "*"
  ) {
    return `Runs daily at ${hourValue.toString().padStart(2, "0")}:${minuteValue.toString().padStart(2, "0")} (local time).`;
  }

  if (
    Number.isInteger(minuteValue) &&
    Number.isInteger(hourValue) &&
    minuteValue >= 0 &&
    minuteValue <= 59 &&
    hourValue >= 0 &&
    hourValue <= 23 &&
    dom === "*" &&
    month === "*" &&
    /^\d$/.test(dow)
  ) {
    const dayIndex = Number.parseInt(dow, 10) % 7;
    return `Runs every ${DAY_NAME_SHORT[dayIndex]} at ${hourValue.toString().padStart(2, "0")}:${minuteValue.toString().padStart(2, "0")} (local time).`;
  }

  return "Custom schedule: review generated run previews below.";
}

function CronGeneratorTool() {
  const [minute, setMinute] = useState("0");
  const [hour, setHour] = useState("*");
  const [dayOfMonth, setDayOfMonth] = useState("*");
  const [month, setMonth] = useState("*");
  const [dayOfWeek, setDayOfWeek] = useState("*");
  const [status, setStatus] = useState("");

  const cronParts = useMemo(
    () => ({
      minute: normalizeCronField(minute),
      hour: normalizeCronField(hour),
      dayOfMonth: normalizeCronField(dayOfMonth),
      month: normalizeCronField(month),
      dayOfWeek: normalizeCronField(dayOfWeek),
    }),
    [dayOfMonth, dayOfWeek, hour, minute, month],
  );

  const cron = `${cronParts.minute} ${cronParts.hour} ${cronParts.dayOfMonth} ${cronParts.month} ${cronParts.dayOfWeek}`;
  const validationErrors = useMemo(
    () =>
      [
        validateCronField("Minute", cronParts.minute, 0, 59),
        validateCronField("Hour", cronParts.hour, 0, 23),
        validateCronField("Day of month", cronParts.dayOfMonth, 1, 31),
        validateCronField("Month", cronParts.month, 1, 12),
        validateCronField("Day of week", cronParts.dayOfWeek, 0, 6, true),
      ].filter((error): error is string => Boolean(error)),
    [cronParts.dayOfMonth, cronParts.dayOfWeek, cronParts.hour, cronParts.minute, cronParts.month],
  );
  const summary = useMemo(
    () => (validationErrors.length === 0 ? summarizeCronExpression(cronParts) : "Fix field errors to generate schedule preview."),
    [cronParts, validationErrors.length],
  );
  const nextRuns = useMemo(
    () => (validationErrors.length === 0 ? getNextCronRunDates(cronParts, 5) : []),
    [cronParts, validationErrors.length],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={RefreshCw}
        title="Cron expression generator"
        subtitle="Build cron jobs with validation, natural-language summary, and next-run simulation."
      />
      <div className="preset-row">
        <span className="supporting-text">Presets:</span>
        {CRON_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className="chip-button"
            type="button"
            onClick={() => {
              setMinute(preset.values.minute);
              setHour(preset.values.hour);
              setDayOfMonth(preset.values.dayOfMonth);
              setMonth(preset.values.month);
              setDayOfWeek(preset.values.dayOfWeek);
              setStatus(`Applied preset: ${preset.label}`);
            }}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Minute (0-59)</span>
          <input value={minute} onChange={(event) => setMinute(event.target.value)} />
        </label>
        <label className="field">
          <span>Hour (0-23)</span>
          <input value={hour} onChange={(event) => setHour(event.target.value)} />
        </label>
        <label className="field">
          <span>Day of month (1-31)</span>
          <input value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} />
        </label>
        <label className="field">
          <span>Month (1-12)</span>
          <input value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className="field">
          <span>Day of week (0-6, 7=Sun)</span>
          <input value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)} />
        </label>
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(cron);
            setStatus(ok ? "Cron expression copied." : "Nothing to copy.");
          }}
        >
          <Copy size={15} />
          Copy expression
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setMinute("0");
            setHour("*");
            setDayOfMonth("*");
            setMonth("*");
            setDayOfWeek("*");
            setStatus("Reset cron fields to defaults.");
          }}
        >
          <Trash2 size={15} />
          Reset
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <ResultList
        rows={[
          { label: "Cron expression", value: cron },
          { label: "Schedule summary", value: summary },
          { label: "Timezone", value: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local" },
        ]}
      />
      {validationErrors.length > 0 ? (
        <div className="mini-panel">
          <h3>Field validation</h3>
          <ul className="plain-list">
            {validationErrors.map((error) => (
              <li key={error} className="error-text">
                {error}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {validationErrors.length === 0 && nextRuns.length > 0 ? (
        <div className="mini-panel">
          <h3>Next run preview</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Local Time</th>
                  <th>UTC</th>
                </tr>
              </thead>
              <tbody>
                {nextRuns.map((run, index) => (
                  <tr key={`${run.toISOString()}-${index}`}>
                    <td>{index + 1}</td>
                    <td>{run.toLocaleString("en-US", { hour12: false })}</td>
                    <td>{run.toUTCString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface HttpStatusCheckResult {
  url: string;
  method: "HEAD" | "GET";
  ok: boolean;
  status?: number;
  statusText?: string;
  timingMs?: number;
  finalUrl?: string;
  redirected?: boolean;
  contentType?: string;
  contentLength?: string;
  error?: string;
  checkedAt: number;
}

interface HttpStatusHistoryEntry {
  id: string;
  url: string;
  method: "HEAD" | "GET";
  statusLabel: string;
  checkedAt: number;
}

const HTTP_STATUS_EXAMPLES = ["https://example.com", "https://utiliora.com", "https://vercel.com"];

function getStatusTone(status?: number, error?: string): "ok" | "warn" | "bad" | "info" {
  if (error) return "bad";
  if (status === undefined) return "info";
  if (status >= 200 && status < 300) return "ok";
  if (status >= 300 && status < 400) return "info";
  if (status >= 400 && status < 500) return "warn";
  return "bad";
}

function HttpStatusCheckerTool() {
  const historyStorageKey = "utiliora-http-status-history-v1";
  const [urlInput, setUrlInput] = useState("https://example.com");
  const [method, setMethod] = useState<"HEAD" | "GET">("HEAD");
  const [results, setResults] = useState<HttpStatusCheckResult[]>([]);
  const [history, setHistory] = useState<HttpStatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Enter one URL per line to run checks.");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as HttpStatusHistoryEntry[];
      if (Array.isArray(parsed)) {
        setHistory(parsed.slice(0, 30));
      }
    } catch {
      // Ignore malformed storage.
    }
  }, [historyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 30)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey]);

  const runChecks = useCallback(
    async (overrideTargets?: string[]) => {
      const targets = (overrideTargets ?? urlInput.split(/\r?\n/g))
        .map((item) => item.trim())
        .filter(Boolean);
      const deduped = Array.from(new Set(targets)).slice(0, 10);

      if (deduped.length === 0) {
        setStatusMessage("Enter at least one valid URL.");
        return;
      }

      setLoading(true);
      setStatusMessage(`Checking ${deduped.length} URL${deduped.length === 1 ? "" : "s"}...`);

      const nextResults = await Promise.all(
        deduped.map(async (targetUrl): Promise<HttpStatusCheckResult> => {
          try {
            const response = await fetch(
              `/api/http-status?url=${encodeURIComponent(targetUrl)}&method=${encodeURIComponent(method)}`,
              { cache: "no-store" },
            );
            const payload = (await response.json()) as {
              ok: boolean;
              status?: number;
              statusText?: string;
              error?: string;
              timingMs?: number;
              finalUrl?: string;
              redirected?: boolean;
              contentType?: string;
              contentLength?: string;
            };
            return {
              url: targetUrl,
              method,
              ok: payload.ok,
              status: payload.status,
              statusText: payload.statusText,
              error: payload.error,
              timingMs: payload.timingMs,
              finalUrl: payload.finalUrl,
              redirected: payload.redirected,
              contentType: payload.contentType,
              contentLength: payload.contentLength,
              checkedAt: Date.now(),
            };
          } catch {
            return {
              url: targetUrl,
              method,
              ok: false,
              error: "Request failed before receiving a response.",
              checkedAt: Date.now(),
            };
          }
        }),
      );

      setResults(nextResults);
      setLoading(false);

      const successes = nextResults.filter((result) => result.ok).length;
      setStatusMessage(`Completed ${nextResults.length} checks. ${successes} succeeded, ${nextResults.length - successes} failed.`);
      trackEvent("tool_http_check", { count: nextResults.length, method, successes });

      const historyRows = nextResults.map((result) => ({
        id: `${result.checkedAt}-${result.url}-${Math.random().toString(36).slice(2, 7)}`,
        url: result.url,
        method: result.method,
        statusLabel: result.ok
          ? `${result.status ?? ""} ${result.statusText ?? ""}`.trim()
          : result.error ?? "Failed",
        checkedAt: result.checkedAt,
      }));
      setHistory((current) => [...historyRows, ...current].slice(0, 30));
    },
    [method, urlInput],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Link2}
        title="HTTP status checker"
        subtitle="Run batch URL checks with response timing, redirect insight, and reusable check history."
      />
      <label className="field">
        <span>URLs (one per line)</span>
        <textarea value={urlInput} onChange={(event) => setUrlInput(event.target.value)} rows={5} />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Method</span>
          <select value={method} onChange={(event) => setMethod(event.target.value as "HEAD" | "GET")}>
            <option value="HEAD">HEAD (faster)</option>
            <option value="GET">GET</option>
          </select>
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void runChecks()} disabled={loading}>
          {loading ? "Checking..." : "Check URLs"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => setUrlInput(HTTP_STATUS_EXAMPLES.join("\n"))}
        >
          Load examples
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadCsv(
              "http-status-results.csv",
              ["URL", "Method", "Status", "Timing (ms)", "Final URL", "Content-Type", "Error"],
              results.map((result) => [
                result.url,
                result.method,
                result.status ? `${result.status} ${result.statusText ?? ""}`.trim() : "",
                result.timingMs?.toString() ?? "",
                result.finalUrl ?? "",
                result.contentType ?? "",
                result.error ?? "",
              ]),
            )
          }
          disabled={results.length === 0}
        >
          <Download size={15} />
          CSV
        </button>
      </div>
      <p className="supporting-text">{statusMessage}</p>
      {results.length > 0 ? (
        <div className="mini-panel">
          <h3>Check results</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Final URL</th>
                  <th>Type</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={`${result.url}-${result.checkedAt}`}>
                    <td>{result.url}</td>
                    <td>
                      <span className={`status-badge ${getStatusTone(result.status, result.error)}`}>
                        {result.ok
                          ? `${result.status ?? ""} ${result.statusText ?? ""}`.trim()
                          : result.error ?? "Failed"}
                      </span>
                    </td>
                    <td>{result.timingMs ? `${result.timingMs} ms` : "-"}</td>
                    <td>{result.finalUrl ?? "-"}</td>
                    <td>{result.contentType ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
      <div className="mini-panel">
        <div className="panel-head">
          <h3>Recent checks</h3>
          <button className="action-button secondary" type="button" onClick={() => setHistory([])}>
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No history yet. Run checks to save recent endpoints.</p>
        ) : (
          <ul className="plain-list">
            {history.map((item) => (
              <li key={item.id}>
                <div className="history-line">
                  <strong>{item.url}</strong>
                  <span className="supporting-text">
                    {item.method} | {item.statusLabel} | {new Date(item.checkedAt).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() => {
                      setMethod(item.method);
                      setUrlInput(item.url);
                      void runChecks([item.url]);
                    }}
                  >
                    Re-run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type DnsResolver = "google" | "cloudflare";

type DnsRecordType = "A" | "AAAA" | "CNAME" | "MX" | "TXT" | "NS" | "SOA" | "CAA";

interface DnsAnswerRecord {
  name: string;
  type: string;
  ttl: number | null;
  data: string;
}

interface DnsTypeResult {
  ok: boolean;
  status: number;
  rd: boolean;
  ra: boolean;
  ad: boolean;
  tc: boolean;
  comment?: string;
  responseTimeMs: number;
  answers: DnsAnswerRecord[];
  authorities: DnsAnswerRecord[];
  error?: string;
}

interface DnsLookupPayload {
  ok: boolean;
  domain?: string;
  resolver?: DnsResolver;
  checkedAt?: string;
  durationMs?: number;
  timeoutMs?: number;
  types?: DnsRecordType[];
  results?: Partial<Record<DnsRecordType, DnsTypeResult>>;
  dmarc?: DnsTypeResult;
  insights?: {
    hasA: boolean;
    hasAAAA: boolean;
    hasMx: boolean;
    hasTxt: boolean;
    hasNs: boolean;
    hasCaa: boolean;
    hasSpf: boolean;
    hasDmarc: boolean;
    hasDnssecSignal: boolean;
    totalAnswers: number;
    mxHosts: string[];
    nameservers: string[];
  };
  error?: string;
}

interface DnsLookupHistoryEntry {
  id: string;
  domain: string;
  resolver: DnsResolver;
  types: DnsRecordType[];
  answerCount: number;
  checkedAt: number;
}

interface DnsResolverComparisonRow {
  type: DnsRecordType;
  primaryAnswers: number;
  secondaryAnswers: number;
  primaryStatus: string;
  secondaryStatus: string;
}

interface DnsResolverComparison {
  secondaryResolver: DnsResolver;
  secondaryPayload: DnsLookupPayload;
  differences: DnsResolverComparisonRow[];
}

const DNS_RECORD_TYPE_OPTIONS: DnsRecordType[] = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SOA", "CAA"];

const DNS_PRESETS: Array<{ label: string; types: DnsRecordType[] }> = [
  { label: "All", types: [...DNS_RECORD_TYPE_OPTIONS] },
  { label: "Web stack", types: ["A", "AAAA", "CNAME", "TXT", "CAA"] },
  { label: "Email stack", types: ["MX", "TXT", "NS", "SOA", "CAA"] },
  { label: "Routing core", types: ["A", "AAAA", "CNAME", "NS"] },
];

function getAlternateResolver(resolver: DnsResolver): DnsResolver {
  return resolver === "google" ? "cloudflare" : "google";
}

function DnsLookupTool() {
  const historyStorageKey = "utiliora-dns-lookup-history-v1";
  const [domain, setDomain] = useState("utiliora.com");
  const [resolver, setResolver] = useState<DnsResolver>("google");
  const [selectedTypes, setSelectedTypes] = useState<DnsRecordType[]>(["A", "AAAA", "MX", "TXT", "NS", "CAA"]);
  const [timeoutMs, setTimeoutMs] = useState(6000);
  const [compareResolvers, setCompareResolvers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Select record types and run a lookup.");
  const [result, setResult] = useState<DnsLookupPayload | null>(null);
  const [comparison, setComparison] = useState<DnsResolverComparison | null>(null);
  const [history, setHistory] = useState<DnsLookupHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DnsLookupHistoryEntry[];
      if (Array.isArray(parsed)) {
        setHistory(parsed.slice(0, 25));
      }
    } catch {
      // Ignore malformed history.
    }
  }, [historyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 25)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey]);

  const runLookup = useCallback(
    async (override?: { domain?: string; resolver?: DnsResolver; types?: DnsRecordType[] }) => {
      const targetDomain = (override?.domain ?? domain).trim();
      const targetResolver = override?.resolver ?? resolver;
      const targetTypes = override?.types ?? selectedTypes;

      if (!targetDomain) {
        setStatus("Enter a domain to run DNS lookup.");
        return;
      }

      if (!targetTypes.length) {
        setStatus("Choose at least one record type.");
        return;
      }

      setLoading(true);
      setStatus("Running DNS lookup...");
      setComparison(null);

      try {
        const runSingleLookup = async (selectedResolver: DnsResolver): Promise<DnsLookupPayload> => {
          const params = new URLSearchParams({
            domain: targetDomain,
            resolver: selectedResolver,
            types: targetTypes.join(","),
            timeoutMs: String(timeoutMs),
          });
          const response = await fetch(`/api/dns-lookup?${params.toString()}`, { cache: "no-store" });
          return (await response.json()) as DnsLookupPayload;
        };

        const payload = await runSingleLookup(targetResolver);
        setResult(payload);

        if (!payload.ok) {
          setStatus(payload.error ?? "DNS lookup failed.");
          return;
        }

        const answerCount = payload.insights?.totalAnswers ?? 0;
        setStatus(`Lookup complete. ${formatNumericValue(answerCount)} answers found.`);
        setHistory((current) => {
          const nextEntry: DnsLookupHistoryEntry = {
            id: crypto.randomUUID(),
            domain: payload.domain ?? targetDomain,
            resolver: payload.resolver ?? targetResolver,
            types: payload.types ?? targetTypes,
            answerCount,
            checkedAt: Date.now(),
          };
          return [nextEntry, ...current].slice(0, 25);
        });
        trackEvent("tool_dns_lookup", {
          resolver: payload.resolver ?? targetResolver,
          types: (payload.types ?? targetTypes).length,
          answers: answerCount,
          hasSpf: payload.insights?.hasSpf ?? false,
          hasDmarc: payload.insights?.hasDmarc ?? false,
        });

        if (compareResolvers) {
          const secondaryResolver = getAlternateResolver(payload.resolver ?? targetResolver);
          const secondaryPayload = await runSingleLookup(secondaryResolver);

          if (secondaryPayload.ok) {
            const differences = DNS_RECORD_TYPE_OPTIONS.filter((type) =>
              (payload.types ?? targetTypes).includes(type),
            )
              .map((type) => {
                const primaryBucket = payload.results?.[type];
                const secondaryBucket = secondaryPayload.results?.[type];
                const primaryStatus = primaryBucket?.error
                  ? "error"
                  : primaryBucket
                    ? String(primaryBucket.status)
                    : "n/a";
                const secondaryStatus = secondaryBucket?.error
                  ? "error"
                  : secondaryBucket
                    ? String(secondaryBucket.status)
                    : "n/a";
                return {
                  type,
                  primaryAnswers: primaryBucket?.answers.length ?? 0,
                  secondaryAnswers: secondaryBucket?.answers.length ?? 0,
                  primaryStatus,
                  secondaryStatus,
                };
              })
              .filter(
                (entry) =>
                  entry.primaryAnswers !== entry.secondaryAnswers ||
                  entry.primaryStatus !== entry.secondaryStatus,
              );

            setComparison({
              secondaryResolver,
              secondaryPayload,
              differences,
            });

            trackEvent("tool_dns_lookup_compare", {
              primaryResolver: payload.resolver ?? targetResolver,
              secondaryResolver,
              differences: differences.length,
            });
          }
        }
      } catch {
        setStatus("Lookup request failed. Check network connectivity and try again.");
      } finally {
        setLoading(false);
      }
    },
    [compareResolvers, domain, resolver, selectedTypes, timeoutMs],
  );

  const toggleType = (type: DnsRecordType) => {
    setSelectedTypes((current) => {
      if (current.includes(type)) return current.filter((entry) => entry !== type);
      return [...current, type];
    });
  };

  const exportCsv = () => {
    if (!result?.results) return;
    const rows = DNS_RECORD_TYPE_OPTIONS.flatMap((type) => {
      const bucket = result.results?.[type];
      if (!bucket?.answers?.length) return [];
      return bucket.answers.map((answer) => [
        type,
        answer.name,
        answer.type,
        answer.ttl !== null ? String(answer.ttl) : "",
        answer.data,
      ]);
    });

    downloadCsv("dns-lookup.csv", ["Query Type", "Name", "Record Type", "TTL", "Data"], rows);
  };

  const renderedTypes = result?.types ?? selectedTypes;

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Search}
        title="DNS lookup"
        subtitle="Inspect DNS records with resolver controls, DNSSEC signals, email checks, history, and exports."
      />
      <div className="field-grid">
        <label className="field">
          <span>Domain</span>
          <input type="text" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" />
        </label>
        <label className="field">
          <span>Resolver</span>
          <select value={resolver} onChange={(event) => setResolver(event.target.value as DnsResolver)}>
            <option value="google">Google DNS over HTTPS</option>
            <option value="cloudflare">Cloudflare DNS over HTTPS</option>
          </select>
        </label>
        <label className="field">
          <span>Timeout (ms)</span>
          <input
            type="number"
            min={2000}
            max={12000}
            step={250}
            value={timeoutMs}
            onChange={(event) =>
              setTimeoutMs(Math.max(2000, Math.min(12000, Number(event.target.value) || 6000)))
            }
          />
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={compareResolvers}
            onChange={(event) => setCompareResolvers(event.target.checked)}
          />
          Compare with secondary resolver
        </label>
      </div>
      <div className="preset-row">
        <span className="supporting-text">Record presets:</span>
        {DNS_PRESETS.map((preset) => (
          <button key={preset.label} className="chip-button" type="button" onClick={() => setSelectedTypes(preset.types)}>
            {preset.label}
          </button>
        ))}
      </div>
      <div className="chip-list">
        {DNS_RECORD_TYPE_OPTIONS.map((type) => (
          <button
            key={type}
            className="chip-button"
            type="button"
            aria-pressed={selectedTypes.includes(type)}
            onClick={() => toggleType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void runLookup()} disabled={loading}>
          {loading ? "Looking up..." : "Run lookup"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(result ? JSON.stringify(result, null, 2) : "");
            setStatus(ok ? "DNS result copied as JSON." : "No DNS result to copy.");
          }}
          disabled={!result}
        >
          <Copy size={15} />
          Copy JSON
        </button>
        <button className="action-button secondary" type="button" onClick={exportCsv} disabled={!result?.results}>
          <Download size={15} />
          Export CSV
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      {result?.ok ? (
        <>
          <ResultList
            rows={[
              { label: "Checked domain", value: result.domain ?? "-" },
              { label: "Resolver", value: result.resolver ?? "-" },
              { label: "Total answers", value: formatNumericValue(result.insights?.totalAnswers ?? 0) },
              { label: "Response time", value: `${formatNumericValue(result.durationMs ?? 0)} ms` },
              { label: "SPF detected", value: result.insights?.hasSpf ? "Yes" : "No" },
              { label: "DMARC detected", value: result.insights?.hasDmarc ? "Yes" : "No" },
              { label: "DNSSEC AD signal", value: result.insights?.hasDnssecSignal ? "Yes" : "No" },
            ]}
          />
          <div className="mini-panel">
            <h3>Email + zone insights</h3>
            <ResultList
              rows={[
                { label: "MX hosts", value: formatNumericValue(result.insights?.mxHosts.length ?? 0) },
                { label: "Nameservers", value: formatNumericValue(result.insights?.nameservers.length ?? 0) },
                {
                  label: "DMARC TXT rows",
                  value: formatNumericValue(result.dmarc?.answers.length ?? 0),
                },
                { label: "SPF present", value: result.insights?.hasSpf ? "Yes" : "No" },
                { label: "DMARC present", value: result.insights?.hasDmarc ? "Yes" : "No" },
              ]}
            />
            {result.insights?.mxHosts.length ? (
              <div className="chip-list">
                {result.insights.mxHosts.slice(0, 12).map((host) => (
                  <span key={host} className="chip">
                    MX: {host}
                  </span>
                ))}
              </div>
            ) : null}
            {result.insights?.nameservers.length ? (
              <div className="chip-list">
                {result.insights.nameservers.slice(0, 12).map((host) => (
                  <span key={host} className="chip">
                    NS: {host}
                  </span>
                ))}
              </div>
            ) : null}
            {result.dmarc?.answers.length ? (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>DMARC Name</th>
                      <th>TTL</th>
                      <th>TXT Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.dmarc.answers.map((entry, index) => (
                      <tr key={`${entry.data}-${index}`}>
                        <td>{entry.name || "-"}</td>
                        <td>{entry.ttl !== null ? formatNumericValue(entry.ttl) : "-"}</td>
                        <td>{entry.data}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
          {comparison?.secondaryPayload.ok ? (
            <div className="mini-panel">
              <div className="panel-head">
                <h3>Resolver comparison</h3>
                <span className="supporting-text">
                  {result.resolver ?? resolver} vs {comparison.secondaryResolver}
                </span>
              </div>
              <ResultList
                rows={[
                  {
                    label: `${result.resolver ?? resolver} answers`,
                    value: formatNumericValue(result.insights?.totalAnswers ?? 0),
                  },
                  {
                    label: `${comparison.secondaryResolver} answers`,
                    value: formatNumericValue(comparison.secondaryPayload.insights?.totalAnswers ?? 0),
                  },
                  {
                    label: "Differences",
                    value: formatNumericValue(comparison.differences.length),
                  },
                ]}
              />
              {comparison.differences.length ? (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>{result.resolver ?? resolver} answers</th>
                        <th>{comparison.secondaryResolver} answers</th>
                        <th>{result.resolver ?? resolver} status</th>
                        <th>{comparison.secondaryResolver} status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparison.differences.map((row) => (
                        <tr key={row.type}>
                          <td>{row.type}</td>
                          <td>{formatNumericValue(row.primaryAnswers)}</td>
                          <td>{formatNumericValue(row.secondaryAnswers)}</td>
                          <td>{row.primaryStatus}</td>
                          <td>{row.secondaryStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="supporting-text">No resolver differences detected for selected record types.</p>
              )}
            </div>
          ) : null}
          {renderedTypes.map((type) => {
            const bucket = result.results?.[type];
            if (!bucket) return null;
            const tone = bucket.error ? "bad" : bucket.ok ? "ok" : "warn";
            return (
              <div key={type} className="mini-panel">
                <div className="panel-head">
                  <h3>{type} records</h3>
                  <span className={`status-badge ${tone}`}>
                    {bucket.error ? "Error" : bucket.ok ? "OK" : `Status ${bucket.status}`}
                  </span>
                </div>
                <p className="supporting-text">
                  Answers: {formatNumericValue(bucket.answers.length)} | Authorities:{" "}
                  {formatNumericValue(bucket.authorities.length)} | Resolver time:{" "}
                  {formatNumericValue(bucket.responseTimeMs)} ms
                </p>
                {bucket.error ? <p className="error-text">{bucket.error}</p> : null}
                {bucket.answers.length ? (
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>TTL</th>
                          <th>Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bucket.answers.map((answer, index) => (
                          <tr key={`${answer.data}-${index}`}>
                            <td>{answer.name || "-"}</td>
                            <td>{answer.type}</td>
                            <td>{answer.ttl !== null ? formatNumericValue(answer.ttl) : "-"}</td>
                            <td>{answer.data}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="supporting-text">No answers returned for this type.</p>
                )}
              </div>
            );
          })}
        </>
      ) : null}
      <div className="mini-panel">
        <div className="panel-head">
          <h3>Recent lookups</h3>
          <button className="action-button secondary" type="button" onClick={() => setHistory([])}>
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No DNS lookup history yet.</p>
        ) : (
          <ul className="plain-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>{entry.domain}</strong>
                  <span className="supporting-text">
                    {entry.resolver} | {entry.types.join(", ")} | {formatNumericValue(entry.answerCount)} answers |{" "}
                    {new Date(entry.checkedAt).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() => {
                      setDomain(entry.domain);
                      setResolver(entry.resolver);
                      setSelectedTypes(entry.types);
                      void runLookup({ domain: entry.domain, resolver: entry.resolver, types: entry.types });
                    }}
                  >
                    Re-run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface SslChainRow {
  depth: number;
  subject: string;
  issuer: string;
  validFrom: string | null;
  validTo: string | null;
  serialNumber: string | null;
  fingerprint256: string | null;
  selfSigned: boolean;
}

interface SslCheckPayload {
  ok: boolean;
  target?: string;
  host?: string;
  port?: number;
  normalizedTarget?: string;
  checkedAt?: string;
  timeoutMs?: number;
  resolvedAddresses?: string[];
  timingMs?: number;
  protocol?: string;
  alpnProtocol?: string;
  authorized?: boolean;
  authorizationError?: string | null;
  cipher?: {
    name?: string;
    version?: string;
    standardName?: string;
  };
  certificate?: {
    subject: string;
    commonName: string | null;
    issuer: string;
    serialNumber: string | null;
    fingerprint256: string | null;
    fingerprint: string | null;
    validFrom: string | null;
    validTo: string | null;
    daysRemaining: number | null;
    isExpired: boolean;
    expiresSoon: boolean;
    subjectAltNames: string[];
    subjectAltNameCount: number;
    hostnameMatches: boolean;
    hostnameMatchSource: "san" | "common-name" | "none";
    infoAccess: string[];
    extKeyUsage: string[];
    pem?: string;
  };
  chain?: SslChainRow[];
  error?: string;
}

interface SslHistoryEntry {
  id: string;
  target: string;
  host: string;
  daysRemaining: number | null;
  checkedAt: number;
}

function getSslHealth(payload: SslCheckPayload | null): {
  score: number | null;
  grade: string;
  tone: "ok" | "warn" | "bad" | "info";
  notes: string[];
} {
  if (!payload?.ok || !payload.certificate) {
    return { score: null, grade: "N/A", tone: "info", notes: ["No certificate data yet."] };
  }

  let score = 100;
  const notes: string[] = [];
  if (!payload.authorized) {
    score -= 30;
    notes.push("Certificate chain is not fully trusted.");
  }
  if (!payload.certificate.hostnameMatches) {
    score -= 35;
    notes.push("Certificate does not match requested hostname.");
  }
  if (payload.certificate.isExpired) {
    score = 0;
    notes.push("Certificate has already expired.");
  } else if (payload.certificate.expiresSoon) {
    score -= 20;
    notes.push("Certificate expires within 30 days.");
  }

  const protocol = (payload.protocol ?? "").toUpperCase();
  if (protocol.includes("TLSV1.0") || protocol.includes("TLSV1.1")) {
    score -= 25;
    notes.push("Legacy TLS protocol detected.");
  } else if (protocol.includes("TLSV1.2")) {
    score -= 5;
  }

  const cipher = (payload.cipher?.standardName ?? payload.cipher?.name ?? "").toUpperCase();
  if (/RC4|3DES|DES|NULL|EXPORT/.test(cipher)) {
    score -= 20;
    notes.push("Potentially weak cipher detected.");
  }

  score = Math.max(0, Math.min(100, score));
  const grade = score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";
  const tone: "ok" | "warn" | "bad" = score >= 85 ? "ok" : score >= 70 ? "warn" : "bad";
  if (!notes.length) notes.push("No obvious TLS or certificate risk signals detected.");
  return { score, grade, tone, notes };
}

function SslCheckerTool() {
  const historyStorageKey = "utiliora-ssl-check-history-v1";
  const [target, setTarget] = useState("https://utiliora.com");
  const [timeoutMs, setTimeoutMs] = useState(9000);
  const [includePem, setIncludePem] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Enter a host or URL and run SSL inspection.");
  const [result, setResult] = useState<SslCheckPayload | null>(null);
  const [history, setHistory] = useState<SslHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SslHistoryEntry[];
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, 25));
    } catch {
      // Ignore malformed history.
    }
  }, [historyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 25)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey]);

  const runCheck = useCallback(
    async (overrideTarget?: string) => {
      const nextTarget = (overrideTarget ?? target).trim();
      if (!nextTarget) {
        setStatus("Enter a valid target before running SSL inspection.");
        return;
      }

      setLoading(true);
      setStatus("Inspecting TLS certificate...");
      try {
        const params = new URLSearchParams({
          target: nextTarget,
          timeoutMs: String(timeoutMs),
          includePem: includePem ? "true" : "false",
        });
        const response = await fetch(`/api/ssl-check?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as SslCheckPayload;
        setResult(payload);

        if (!response.ok || !payload.ok) {
          setStatus(payload.error ?? "SSL inspection failed.");
          trackEvent("tool_ssl_check", { success: false });
          return;
        }

        const days = payload.certificate?.daysRemaining ?? null;
        const hostnameMatches = payload.certificate?.hostnameMatches ?? true;
        setStatus(
          !hostnameMatches
            ? "Certificate loaded, but hostname does not match SAN/CN coverage."
            : days === null
              ? "SSL inspection completed."
              : days < 0
                ? "Certificate has expired."
                : `Certificate valid. ${formatNumericValue(days)} day(s) remaining.`,
        );

        setHistory((current) => [
          {
            id: crypto.randomUUID(),
            target: payload.target ?? nextTarget,
            host: payload.host ?? "unknown",
            daysRemaining: days,
            checkedAt: Date.now(),
          },
          ...current,
        ].slice(0, 25));

        trackEvent("tool_ssl_check", {
          success: true,
          authorized: payload.authorized ?? false,
          expiresSoon: payload.certificate?.expiresSoon ?? false,
          expired: payload.certificate?.isExpired ?? false,
          hostnameMatches: payload.certificate?.hostnameMatches ?? false,
        });
      } catch {
        setStatus("SSL inspection request failed.");
        trackEvent("tool_ssl_check", { success: false });
      } finally {
        setLoading(false);
      }
    },
    [includePem, target, timeoutMs],
  );

  const sslHealth = useMemo(() => getSslHealth(result), [result]);
  const certificateTone = sslHealth.tone;
  const summaryText =
    sslHealth.score === null
      ? "No certificate analyzed yet."
      : `TLS grade ${sslHealth.grade} (${formatNumericValue(sslHealth.score)}/100)`;

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={MonitorUp}
        title="SSL checker"
        subtitle="Inspect certificate chain, TLS handshake metadata, SAN coverage, trust status, and expiry risk."
      />
      <div className="field-grid">
        <label className="field">
          <span>Target host or URL</span>
          <input type="text" value={target} onChange={(event) => setTarget(event.target.value)} placeholder="https://example.com" />
        </label>
        <label className="field">
          <span>Timeout (ms)</span>
          <input
            type="number"
            min={3000}
            max={20000}
            step={250}
            value={timeoutMs}
            onChange={(event) =>
              setTimeoutMs(Math.max(3000, Math.min(20000, Number(event.target.value) || 9000)))
            }
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={includePem} onChange={(event) => setIncludePem(event.target.checked)} />
          Include leaf certificate PEM in output
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void runCheck()} disabled={loading}>
          {loading ? "Inspecting..." : "Run SSL check"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(result ? JSON.stringify(result, null, 2) : "");
            setStatus(ok ? "SSL result copied as JSON." : "No SSL result to copy.");
          }}
          disabled={!result}
        >
          <Copy size={15} />
          Copy JSON
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadTextFile(
              "ssl-summary.txt",
              result ? JSON.stringify(result, null, 2) : "No SSL result yet.",
              "text/plain;charset=utf-8;",
            )
          }
          disabled={!result}
        >
          <Download size={15} />
          Export
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <p className={`status-badge ${certificateTone}`}>{summaryText}</p>
      {sslHealth.score !== null ? (
        <div className="mini-panel">
          <h3>TLS risk notes</h3>
          <ul className="plain-list">
            {sslHealth.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result?.ok ? (
        <>
          <ResultList
            rows={[
              { label: "Host", value: result.host ?? "-" },
              { label: "Port", value: result.port ? String(result.port) : "-" },
              { label: "TLS protocol", value: result.protocol ?? "-" },
              { label: "ALPN", value: result.alpnProtocol ?? "-" },
              { label: "Cipher", value: result.cipher?.standardName ?? result.cipher?.name ?? "-" },
              { label: "Handshake time", value: `${formatNumericValue(result.timingMs ?? 0)} ms` },
              { label: "Trust status", value: result.authorized ? "Trusted chain" : "Untrusted / warning" },
              {
                label: "Hostname coverage",
                value: result.certificate?.hostnameMatches ? "Matches target host" : "Mismatch",
              },
              {
                label: "Match source",
                value: result.certificate?.hostnameMatchSource ?? "none",
              },
              { label: "Authorization error", value: result.authorizationError ?? "None" },
              {
                label: "Days until expiry",
                value:
                  result.certificate?.daysRemaining !== null && result.certificate?.daysRemaining !== undefined
                    ? formatNumericValue(result.certificate.daysRemaining)
                    : "Unknown",
              },
              { label: "SAN entries", value: formatNumericValue(result.certificate?.subjectAltNameCount ?? 0) },
              { label: "Chain depth", value: formatNumericValue(result.chain?.length ?? 0) },
            ]}
          />
          {result.resolvedAddresses?.length ? (
            <div className="mini-panel">
              <h3>Resolved addresses</h3>
              <div className="chip-list">
                {result.resolvedAddresses.map((address) => (
                  <span key={address} className="chip">
                    {address}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mini-panel">
            <h3>Certificate details</h3>
            <p className="supporting-text">
              <strong>Common Name:</strong> {result.certificate?.commonName ?? "-"}
            </p>
            <p className="supporting-text">
              <strong>Subject:</strong> {result.certificate?.subject ?? "-"}
            </p>
            <p className="supporting-text">
              <strong>Issuer:</strong> {result.certificate?.issuer ?? "-"}
            </p>
            <p className="supporting-text">
              <strong>Valid from:</strong>{" "}
              {result.certificate?.validFrom ? new Date(result.certificate.validFrom).toLocaleString("en-US") : "-"}
            </p>
            <p className="supporting-text">
              <strong>Valid to:</strong>{" "}
              {result.certificate?.validTo ? new Date(result.certificate.validTo).toLocaleString("en-US") : "-"}
            </p>
            <p className="supporting-text">
              <strong>SHA-256:</strong> {result.certificate?.fingerprint256 ?? "-"}
            </p>
          </div>
          {result.certificate?.infoAccess?.length ? (
            <div className="mini-panel">
              <h3>Authority Information Access</h3>
              <ul className="plain-list">
                {result.certificate.infoAccess.map((entry) => (
                  <li key={entry}>
                    <code>{entry}</code>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.certificate?.extKeyUsage?.length ? (
            <div className="mini-panel">
              <h3>Extended Key Usage</h3>
              <div className="chip-list">
                {result.certificate.extKeyUsage.map((entry) => (
                  <span key={entry} className="chip">
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {result.certificate?.subjectAltNames?.length ? (
            <div className="mini-panel">
              <h3>Subject Alternative Names</h3>
              <div className="chip-list">
                {result.certificate.subjectAltNames.slice(0, 40).map((entry) => (
                  <span key={entry} className="chip">
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {result.chain?.length ? (
            <div className="mini-panel">
              <h3>Certificate chain</h3>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Depth</th>
                      <th>Subject</th>
                      <th>Issuer</th>
                      <th>Valid To</th>
                      <th>Self-signed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.chain.map((entry) => (
                      <tr key={`${entry.depth}-${entry.subject}`}>
                        <td>{entry.depth}</td>
                        <td>{entry.subject}</td>
                        <td>{entry.issuer}</td>
                        <td>{entry.validTo ? new Date(entry.validTo).toLocaleDateString("en-US") : "-"}</td>
                        <td>{entry.selfSigned ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {includePem && result.certificate?.pem ? (
            <label className="field">
              <span>Leaf certificate PEM</span>
              <textarea value={result.certificate.pem} readOnly rows={10} />
            </label>
          ) : null}
        </>
      ) : null}
      <div className="mini-panel">
        <div className="panel-head">
          <h3>Recent SSL checks</h3>
          <button className="action-button secondary" type="button" onClick={() => setHistory([])}>
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No SSL check history yet.</p>
        ) : (
          <ul className="plain-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>{entry.target}</strong>
                  <span className="supporting-text">
                    Host: {entry.host} | Days remaining:{" "}
                    {entry.daysRemaining === null ? "-" : formatNumericValue(entry.daysRemaining)} |{" "}
                    {new Date(entry.checkedAt).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() => {
                      setTarget(entry.target);
                      void runCheck(entry.target);
                    }}
                  >
                    Re-run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface WhoisLookupPayload {
  ok: boolean;
  domain?: string;
  normalizedDomain?: string;
  unicodeDomain?: string | null;
  rdapSource?: string;
  checkedAt?: string;
  statuses?: string[];
  nameservers?: string[];
  dnssecSigned?: boolean | null;
  registrar?: {
    name: string | null;
    handle: string | null;
    ianaId: string | null;
  };
  registrant?: {
    handle: string;
    fullName: string | null;
    organization: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  contacts?: Array<{
    handle: string;
    roles: string[];
    fullName: string | null;
    organization: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
  }>;
  events?: {
    registration: string | null;
    expiration: string | null;
    lastChanged: string | null;
    lastTransfer: string | null;
    lastRdapUpdate: string | null;
    daysUntilExpiration: number | null;
    expired: boolean | null;
  };
  notices?: string[];
  links?: string[];
  error?: string;
}

interface WhoisHistoryEntry {
  id: string;
  domain: string;
  registrarName: string;
  expiration: string | null;
  checkedAt: number;
}

function WhoisLookupTool() {
  const historyStorageKey = "utiliora-whois-history-v1";
  const [domain, setDomain] = useState("utiliora.com");
  const [timeoutMs, setTimeoutMs] = useState(9000);
  const [includeRaw, setIncludeRaw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Enter a domain and run WHOIS lookup.");
  const [result, setResult] = useState<WhoisLookupPayload | null>(null);
  const [history, setHistory] = useState<WhoisHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as WhoisHistoryEntry[];
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, 25));
    } catch {
      // Ignore malformed history.
    }
  }, [historyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 25)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey]);

  const runLookup = useCallback(
    async (overrideDomain?: string) => {
      const targetDomain = (overrideDomain ?? domain).trim();
      if (!targetDomain) {
        setStatus("Enter a valid domain.");
        return;
      }

      setLoading(true);
      setStatus("Running WHOIS lookup...");
      try {
        const params = new URLSearchParams({
          domain: targetDomain,
          timeoutMs: String(timeoutMs),
          includeRaw: includeRaw ? "true" : "false",
        });
        const response = await fetch(`/api/whois?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as WhoisLookupPayload;
        setResult(payload);

        if (!response.ok || !payload.ok) {
          setStatus(payload.error ?? "WHOIS lookup failed.");
          trackEvent("tool_whois_lookup", { success: false });
          return;
        }

        const days = payload.events?.daysUntilExpiration;
        setStatus(
          typeof days !== "number"
            ? "WHOIS data loaded."
            : days < 0
              ? `Domain expired ${formatNumericValue(Math.abs(days))} day(s) ago.`
              : `Domain expires in ${formatNumericValue(days)} day(s).`,
        );
        setHistory((current) => [
          {
            id: crypto.randomUUID(),
            domain: payload.domain ?? targetDomain,
            registrarName: payload.registrar?.name ?? "Unknown registrar",
            expiration: payload.events?.expiration ?? null,
            checkedAt: Date.now(),
          },
          ...current,
        ].slice(0, 25));
        trackEvent("tool_whois_lookup", {
          success: true,
          hasRegistrar: Boolean(payload.registrar?.name),
          hasExpiration: Boolean(payload.events?.expiration),
          dnssecSigned: payload.dnssecSigned ?? undefined,
        });
      } catch {
        setStatus("WHOIS lookup request failed.");
        trackEvent("tool_whois_lookup", { success: false });
      } finally {
        setLoading(false);
      }
    },
    [domain, includeRaw, timeoutMs],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Tags}
        title="WHOIS lookup"
        subtitle="Inspect registrar details, domain status, DNSSEC flags, nameservers, and lifecycle events."
      />
      <div className="field-grid">
        <label className="field">
          <span>Domain</span>
          <input type="text" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" />
        </label>
        <label className="field">
          <span>Timeout (ms)</span>
          <input
            type="number"
            min={3000}
            max={20000}
            step={250}
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(Math.max(3000, Math.min(20000, Number(event.target.value) || 9000)))}
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={includeRaw} onChange={(event) => setIncludeRaw(event.target.checked)} />
          Include raw RDAP payload
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" disabled={loading} onClick={() => void runLookup()}>
          {loading ? "Checking..." : "Run WHOIS lookup"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(result ? JSON.stringify(result, null, 2) : "");
            setStatus(ok ? "WHOIS JSON copied." : "No WHOIS result to copy.");
          }}
          disabled={!result}
        >
          <Copy size={15} />
          Copy JSON
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadTextFile(
              "whois-lookup.json",
              result ? JSON.stringify(result, null, 2) : "No WHOIS result yet.",
              "application/json;charset=utf-8;",
            )
          }
          disabled={!result}
        >
          <Download size={15} />
          Export
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      {result?.ok ? (
        <>
          <ResultList
            rows={[
              { label: "Domain", value: result.normalizedDomain ?? result.domain ?? "-" },
              { label: "Unicode domain", value: result.unicodeDomain ?? "-" },
              { label: "Registrar", value: result.registrar?.name ?? "-" },
              { label: "Registrar IANA ID", value: result.registrar?.ianaId ?? "-" },
              { label: "Statuses", value: formatNumericValue(result.statuses?.length ?? 0) },
              { label: "Nameservers", value: formatNumericValue(result.nameservers?.length ?? 0) },
              { label: "DNSSEC signed", value: result.dnssecSigned === null ? "Unknown" : result.dnssecSigned ? "Yes" : "No" },
              {
                label: "Days until expiration",
                value:
                  result.events?.daysUntilExpiration === null || result.events?.daysUntilExpiration === undefined
                    ? "Unknown"
                    : formatNumericValue(result.events.daysUntilExpiration),
              },
            ]}
          />
          <div className="mini-panel">
            <h3>Registration timeline</h3>
            <ResultList
              rows={[
                {
                  label: "Registration date",
                  value: result.events?.registration ? new Date(result.events.registration).toLocaleString("en-US") : "-",
                },
                {
                  label: "Expiration date",
                  value: result.events?.expiration ? new Date(result.events.expiration).toLocaleString("en-US") : "-",
                },
                {
                  label: "Last changed",
                  value: result.events?.lastChanged ? new Date(result.events.lastChanged).toLocaleString("en-US") : "-",
                },
                {
                  label: "Last transfer",
                  value: result.events?.lastTransfer ? new Date(result.events.lastTransfer).toLocaleString("en-US") : "-",
                },
                {
                  label: "Last RDAP update",
                  value: result.events?.lastRdapUpdate ? new Date(result.events.lastRdapUpdate).toLocaleString("en-US") : "-",
                },
              ]}
            />
          </div>
          {result.statuses?.length ? (
            <div className="mini-panel">
              <h3>Domain statuses</h3>
              <div className="chip-list">
                {result.statuses.map((entry) => (
                  <span key={entry} className="chip">
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {result.nameservers?.length ? (
            <div className="mini-panel">
              <h3>Nameservers</h3>
              <div className="chip-list">
                {result.nameservers.map((entry) => (
                  <span key={entry} className="chip">
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {result.contacts?.length ? (
            <div className="mini-panel">
              <h3>RDAP contacts</h3>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Handle</th>
                      <th>Roles</th>
                      <th>Name / Org</th>
                      <th>Email</th>
                      <th>Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.contacts.slice(0, 25).map((contact) => (
                      <tr key={`${contact.handle}-${contact.roles.join("-")}`}>
                        <td>{contact.handle || "-"}</td>
                        <td>{contact.roles.join(", ") || "-"}</td>
                        <td>{contact.organization ?? contact.fullName ?? "-"}</td>
                        <td>{contact.email ?? "-"}</td>
                        <td>{contact.country ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {result.notices?.length ? (
            <div className="mini-panel">
              <h3>Registry notices</h3>
              <ul className="plain-list">
                {result.notices.map((entry) => (
                  <li key={entry}>{entry}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.links?.length ? (
            <div className="mini-panel">
              <h3>Reference links</h3>
              <ul className="plain-list">
                {result.links.slice(0, 10).map((entry) => (
                  <li key={entry}>
                    <a href={entry} target="_blank" rel="noreferrer">
                      {entry}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="mini-panel">
        <div className="panel-head">
          <h3>Recent WHOIS checks</h3>
          <button className="action-button secondary" type="button" onClick={() => setHistory([])}>
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No WHOIS history yet.</p>
        ) : (
          <ul className="plain-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>{entry.domain}</strong>
                  <span className="supporting-text">
                    {entry.registrarName} | Expires:{" "}
                    {entry.expiration ? new Date(entry.expiration).toLocaleDateString("en-US") : "-"} |{" "}
                    {new Date(entry.checkedAt).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() => {
                      setDomain(entry.domain);
                      void runLookup(entry.domain);
                    }}
                  >
                    Re-run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface DnsPropagationPayload {
  ok: boolean;
  domain?: string;
  type?: DnsRecordType;
  checkedAt?: string;
  durationMs?: number;
  timeoutMs?: number;
  resolvers?: Array<{
    resolver: string;
    resolverLabel: string;
    ok: boolean;
    status: number;
    responseTimeMs: number;
    ad: boolean;
    tc: boolean;
    rd: boolean;
    ra: boolean;
    answers: DnsAnswerRecord[];
    authorities: DnsAnswerRecord[];
    answerSet: string[];
    answerFingerprint: string;
    error?: string;
  }>;
  summary?: {
    resolverCount: number;
    successfulResolvers: number;
    failedResolvers: number;
    uniqueAnswerSets: number;
    majorityCount: number;
    propagationPercent: number;
    fullyPropagated: boolean;
    consensusAnswers: string[];
    mismatches: Array<{
      resolver: string;
      resolverLabel: string;
      answerSet: string[];
    }>;
  };
  error?: string;
}

interface DnsPropagationHistoryEntry {
  id: string;
  domain: string;
  type: DnsRecordType;
  propagationPercent: number;
  checkedAt: number;
}

function DnsPropagationCheckerTool() {
  const historyStorageKey = "utiliora-dns-propagation-history-v1";
  const [domain, setDomain] = useState("utiliora.com");
  const [recordType, setRecordType] = useState<DnsRecordType>("A");
  const [timeoutMs, setTimeoutMs] = useState(6000);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("Select domain and record type to inspect propagation.");
  const [result, setResult] = useState<DnsPropagationPayload | null>(null);
  const [history, setHistory] = useState<DnsPropagationHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DnsPropagationHistoryEntry[];
      if (Array.isArray(parsed)) setHistory(parsed.slice(0, 25));
    } catch {
      // Ignore malformed history.
    }
  }, [historyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 25)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey]);

  const runCheck = useCallback(
    async (override?: { domain?: string; recordType?: DnsRecordType }) => {
      const targetDomain = (override?.domain ?? domain).trim();
      const targetType = override?.recordType ?? recordType;
      if (!targetDomain) {
        setStatus("Enter a valid domain.");
        return;
      }

      setLoading(true);
      setStatus("Checking propagation across resolvers...");
      try {
        const params = new URLSearchParams({
          domain: targetDomain,
          type: targetType,
          timeoutMs: String(timeoutMs),
        });
        const response = await fetch(`/api/dns-propagation?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as DnsPropagationPayload;
        setResult(payload);

        if (!response.ok || !payload.ok) {
          setStatus(payload.error ?? "Propagation check failed.");
          trackEvent("tool_dns_propagation_check", { success: false });
          return;
        }

        const percent = payload.summary?.propagationPercent ?? 0;
        const uniqueSets = payload.summary?.uniqueAnswerSets ?? 0;
        setStatus(
          uniqueSets <= 1
            ? `Fully propagated (${percent.toFixed(1)}% resolver consensus).`
            : `Propagation divergence detected (${percent.toFixed(1)}% consensus).`,
        );
        setHistory((current) => [
          {
            id: crypto.randomUUID(),
            domain: payload.domain ?? targetDomain,
            type: payload.type ?? targetType,
            propagationPercent: percent,
            checkedAt: Date.now(),
          },
          ...current,
        ].slice(0, 25));
        trackEvent("tool_dns_propagation_check", {
          success: true,
          type: payload.type ?? targetType,
          propagationPercent: percent,
          uniqueSets,
        });
      } catch {
        setStatus("Propagation check request failed.");
        trackEvent("tool_dns_propagation_check", { success: false });
      } finally {
        setLoading(false);
      }
    },
    [domain, recordType, timeoutMs],
  );

  const exportCsv = () => {
    if (!result?.resolvers?.length) return;
    const rows = result.resolvers.map((resolver) => [
      resolver.resolverLabel,
      resolver.status.toString(),
      resolver.responseTimeMs.toString(),
      resolver.answerSet.join(" | "),
      resolver.error ?? "",
    ]);
    downloadCsv("dns-propagation.csv", ["Resolver", "Status", "Response ms", "Answer set", "Error"], rows);
  };

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Share2}
        title="DNS propagation checker"
        subtitle="Compare DNS answers across major resolvers and quantify propagation consistency."
      />
      <div className="field-grid">
        <label className="field">
          <span>Domain</span>
          <input type="text" value={domain} onChange={(event) => setDomain(event.target.value)} placeholder="example.com" />
        </label>
        <label className="field">
          <span>Record type</span>
          <select value={recordType} onChange={(event) => setRecordType(event.target.value as DnsRecordType)}>
            {DNS_RECORD_TYPE_OPTIONS.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Timeout (ms)</span>
          <input
            type="number"
            min={2000}
            max={12000}
            step={250}
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(Math.max(2000, Math.min(12000, Number(event.target.value) || 6000)))}
          />
        </label>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" disabled={loading} onClick={() => void runCheck()}>
          {loading ? "Checking..." : "Run propagation check"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(result ? JSON.stringify(result, null, 2) : "");
            setStatus(ok ? "Propagation result copied as JSON." : "No result to copy.");
          }}
          disabled={!result}
        >
          <Copy size={15} />
          Copy JSON
        </button>
        <button className="action-button secondary" type="button" onClick={exportCsv} disabled={!result?.resolvers?.length}>
          <Download size={15} />
          Export CSV
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      {result?.ok ? (
        <>
          <ResultList
            rows={[
              { label: "Domain", value: result.domain ?? "-" },
              { label: "Record type", value: result.type ?? "-" },
              {
                label: "Consensus",
                value: `${(result.summary?.propagationPercent ?? 0).toFixed(1)}%`,
              },
              {
                label: "Unique answer sets",
                value: formatNumericValue(result.summary?.uniqueAnswerSets ?? 0),
              },
              {
                label: "Successful resolvers",
                value: formatNumericValue(result.summary?.successfulResolvers ?? 0),
              },
              {
                label: "Check duration",
                value: `${formatNumericValue(result.durationMs ?? 0)} ms`,
              },
            ]}
          />
          {result.summary?.consensusAnswers?.length ? (
            <div className="mini-panel">
              <h3>Consensus answer set</h3>
              <div className="chip-list">
                {result.summary.consensusAnswers.map((entry) => (
                  <span key={entry} className="chip">
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="mini-panel">
            <h3>Resolver results</h3>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Resolver</th>
                    <th>Status</th>
                    <th>Response ms</th>
                    <th>Answers</th>
                    <th>AD</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {result.resolvers?.map((entry) => (
                    <tr key={entry.resolver}>
                      <td>{entry.resolverLabel}</td>
                      <td>{entry.status}</td>
                      <td>{formatNumericValue(entry.responseTimeMs)}</td>
                      <td>{entry.answerSet.join(" | ") || "-"}</td>
                      <td>{entry.ad ? "Yes" : "No"}</td>
                      <td>{entry.error ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {result.summary?.mismatches?.length ? (
            <div className="mini-panel">
              <h3>Propagation mismatches</h3>
              <ul className="plain-list">
                {result.summary.mismatches.map((entry) => (
                  <li key={entry.resolver}>
                    <strong>{entry.resolverLabel}</strong>: {entry.answerSet.join(" | ") || "(no answer)"}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="supporting-text">No propagation mismatches across checked resolvers.</p>
          )}
        </>
      ) : null}
      <div className="mini-panel">
        <div className="panel-head">
          <h3>Recent propagation checks</h3>
          <button className="action-button secondary" type="button" onClick={() => setHistory([])}>
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No propagation history yet.</p>
        ) : (
          <ul className="plain-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>
                    {entry.domain} ({entry.type})
                  </strong>
                  <span className="supporting-text">
                    Consensus: {entry.propagationPercent.toFixed(1)}% |{" "}
                    {new Date(entry.checkedAt).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() => {
                      setDomain(entry.domain);
                      setRecordType(entry.type);
                      void runCheck({ domain: entry.domain, recordType: entry.type });
                    }}
                  >
                    Re-run
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface InternetSpeedSample {
  id: string;
  iteration: number;
  bytes: number;
  durationMs: number;
  latencyMs: number;
  mbps: number;
}

interface InternetSpeedHistoryEntry {
  id: string;
  checkedAt: number;
  avgMbps: number;
  bestMbps: number;
  avgLatencyMs: number;
  sampleCount: number;
  bytesPerSample: number;
}

interface SpeedChartPoint {
  x: number;
  y: number;
  value: number;
  label: string;
}

interface SpeedChartModel {
  width: number;
  height: number;
  padding: number;
  min: number;
  max: number;
  points: SpeedChartPoint[];
  linePath: string;
  areaPath: string;
}

function buildSpeedChartModel(
  values: number[],
  labels: string[],
  width = 360,
  height = 180,
  padding = 22,
): SpeedChartModel | null {
  if (!values.length) return null;
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const spread = Math.max(0, maxRaw - minRaw);
  const paddedSpread = spread === 0 ? Math.max(1, maxRaw * 0.2, 1) : spread * 1.12;
  const min = Math.max(0, spread === 0 ? minRaw - paddedSpread / 2 : minRaw - spread * 0.06);
  const max = min + paddedSpread;
  const innerWidth = Math.max(20, width - padding * 2);
  const innerHeight = Math.max(20, height - padding * 2);

  const points: SpeedChartPoint[] = values.map((value, index) => {
    const x =
      values.length === 1
        ? width / 2
        : padding + (index / Math.max(1, values.length - 1)) * innerWidth;
    const normalized = (value - min) / Math.max(1e-6, max - min);
    const y = padding + (1 - normalized) * innerHeight;
    return {
      x,
      y,
      value,
      label: labels[index] ?? `S${index + 1}`,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${(height - padding).toFixed(2)} L ${points[0].x.toFixed(2)} ${(height - padding).toFixed(2)} Z`
      : "";

  return {
    width,
    height,
    padding,
    min,
    max,
    points,
    linePath,
    areaPath,
  };
}

function SpeedMetricChart({
  title,
  values,
  labels,
  unit,
  lineColor,
  areaColor,
}: {
  title: string;
  values: number[];
  labels: string[];
  unit: string;
  lineColor: string;
  areaColor: string;
}) {
  const chart = useMemo(() => buildSpeedChartModel(values, labels), [labels, values]);
  if (!chart) return null;

  const latestValue = values[values.length - 1] ?? 0;
  const startValue = values[0] ?? 0;
  const delta = latestValue - startValue;
  const deltaSign = delta > 0 ? "+" : "";
  const deltaLabel = `${deltaSign}${delta.toFixed(2)} ${unit}`;

  return (
    <article className="mini-panel" style={{ margin: 0 }}>
      <div className="panel-head">
        <h3>{title}</h3>
        <span className="supporting-text">
          Min {chart.min.toFixed(2)} {unit} | Max {chart.max.toFixed(2)} {unit}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        width="100%"
        height="180"
        role="img"
        aria-label={`${title} chart`}
      >
        <rect x={0} y={0} width={chart.width} height={chart.height} fill="transparent" rx={10} />
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = chart.padding + ratio * (chart.height - chart.padding * 2);
          return (
            <line
              key={`grid-${ratio}`}
              x1={chart.padding}
              y1={y}
              x2={chart.width - chart.padding}
              y2={y}
              stroke="rgba(148, 163, 184, 0.35)"
              strokeWidth={1}
              strokeDasharray="4 6"
            />
          );
        })}
        <path d={chart.areaPath} fill={areaColor} stroke="none" />
        <path d={chart.linePath} fill="none" stroke={lineColor} strokeWidth={2.8} strokeLinecap="round" />
        {chart.points.map((point) => (
          <g key={`${point.label}-${point.x}`}>
            <circle cx={point.x} cy={point.y} r={3.8} fill={lineColor} />
            <title>
              {point.label}: {point.value.toFixed(2)} {unit}
            </title>
          </g>
        ))}
      </svg>
      <p className="supporting-text">
        Latest: {latestValue.toFixed(2)} {unit} | Trend from first sample: {deltaLabel}
      </p>
    </article>
  );
}

function InternetSpeedTestTool() {
  const historyStorageKey = "utiliora-internet-speed-history-v1";
  const abortRef = useRef<AbortController | null>(null);
  const [bytesPerSample, setBytesPerSample] = useState(1_000_000);
  const [iterations, setIterations] = useState(4);
  const [samples, setSamples] = useState<InternetSpeedSample[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Run a test to measure download speed and latency.");
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [history, setHistory] = useState<InternetSpeedHistoryEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as InternetSpeedHistoryEntry[];
      if (Array.isArray(parsed)) {
        setHistory(parsed.slice(0, 15));
      }
    } catch {
      // Ignore malformed history.
    }
  }, [historyStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, 15)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  const averageMbps = useMemo(() => {
    if (!samples.length) return 0;
    return samples.reduce((sum, sample) => sum + sample.mbps, 0) / samples.length;
  }, [samples]);

  const bestMbps = useMemo(() => {
    if (!samples.length) return 0;
    return Math.max(...samples.map((sample) => sample.mbps));
  }, [samples]);

  const worstMbps = useMemo(() => {
    if (!samples.length) return 0;
    return Math.min(...samples.map((sample) => sample.mbps));
  }, [samples]);

  const averageLatencyMs = useMemo(() => {
    if (!samples.length) return 0;
    return samples.reduce((sum, sample) => sum + sample.latencyMs, 0) / samples.length;
  }, [samples]);

  const jitterMs = useMemo(() => {
    if (samples.length < 2) return 0;
    const variance =
      samples.reduce((sum, sample) => sum + Math.pow(sample.latencyMs - averageLatencyMs, 2), 0) / samples.length;
    return Math.sqrt(variance);
  }, [averageLatencyMs, samples]);

  const consistencyScore = useMemo(() => {
    if (samples.length < 2 || averageMbps <= 0) return samples.length ? 100 : 0;
    const variance =
      samples.reduce((sum, sample) => sum + Math.pow(sample.mbps - averageMbps, 2), 0) / samples.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, Math.min(100, 100 - (stdDev / averageMbps) * 100));
  }, [averageMbps, samples]);

  const sampleLabels = useMemo(
    () => samples.map((sample) => `S${sample.iteration}`),
    [samples],
  );

  const networkProfile = useMemo(() => {
    if (!samples.length) {
      return { label: "No test data yet", tone: "info" as const };
    }

    if (averageMbps >= 120 && averageLatencyMs <= 20 && jitterMs <= 8) {
      return { label: "Excellent network profile", tone: "ok" as const };
    }
    if (averageMbps >= 50 && averageLatencyMs <= 40 && jitterMs <= 16) {
      return { label: "Strong network profile", tone: "info" as const };
    }
    if (averageMbps >= 15 && averageLatencyMs <= 80) {
      return { label: "Moderate network profile", tone: "warn" as const };
    }
    return { label: "Weak network profile", tone: "bad" as const };
  }, [averageLatencyMs, averageMbps, jitterMs, samples.length]);

  const runSpeedTest = useCallback(async () => {
    const safeBytes = Math.max(128_000, Math.min(5_000_000, Math.round(bytesPerSample)));
    const safeIterations = Math.max(1, Math.min(10, Math.round(iterations)));

    setRunning(true);
    setProgress(2);
    setStatus("Starting speed test...");
    setSamples([]);
    const nextSamples: InternetSpeedSample[] = [];
    const controller = new AbortController();
    abortRef.current = controller;
    const startedAt = Date.now();

    try {
      for (let index = 0; index < safeIterations; index += 1) {
        setStatus(`Measuring latency (${index + 1}/${safeIterations})...`);
        const pingStart = performance.now();
        const pingResponse = await fetch(`/api/speed-test?bytes=16000&t=${Date.now()}-${index}-ping`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!pingResponse.ok) {
          throw new Error("Latency probe failed.");
        }
        await pingResponse.arrayBuffer();
        const latencyMs = performance.now() - pingStart;

        setStatus(`Downloading sample ${index + 1}/${safeIterations}...`);
        const downloadStart = performance.now();
        const response = await fetch(`/api/speed-test?bytes=${safeBytes}&t=${Date.now()}-${index}-dl`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Download request failed.");
        }
        const buffer = await response.arrayBuffer();
        const durationMs = Math.max(1, performance.now() - downloadStart);
        const mbps = (buffer.byteLength * 8) / (durationMs / 1000) / 1_000_000;

        nextSamples.push({
          id: `${Date.now()}-${index}`,
          iteration: index + 1,
          bytes: buffer.byteLength,
          durationMs,
          latencyMs,
          mbps,
        });
        setSamples([...nextSamples]);
        setProgress(Math.round(((index + 1) / safeIterations) * 100));
      }

      setLastRunAt(Date.now());
      const avg = nextSamples.reduce((sum, sample) => sum + sample.mbps, 0) / Math.max(1, nextSamples.length);
      const best = Math.max(...nextSamples.map((sample) => sample.mbps));
      const avgLatency =
        nextSamples.reduce((sum, sample) => sum + sample.latencyMs, 0) / Math.max(1, nextSamples.length);
      setHistory((current) => [
        {
          id: crypto.randomUUID(),
          checkedAt: Date.now(),
          avgMbps: avg,
          bestMbps: best,
          avgLatencyMs: avgLatency,
          sampleCount: nextSamples.length,
          bytesPerSample: safeBytes,
        },
        ...current,
      ].slice(0, 15));

      const elapsedMs = Date.now() - startedAt;
      setStatus(
        `Speed test complete: ${avg.toFixed(2)} Mbps average over ${safeIterations} sample(s) in ${(elapsedMs / 1000).toFixed(1)}s.`,
      );
      trackEvent("tool_internet_speed_test", {
        success: true,
        samples: safeIterations,
        bytesPerSample: safeBytes,
        avgMbps: Number(avg.toFixed(2)),
      });
    } catch (error) {
      const aborted =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";
      setStatus(aborted ? "Speed test stopped." : "Speed test failed. Try again.");
      trackEvent("tool_internet_speed_test", { success: false });
      if (!nextSamples.length) {
        setProgress(0);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [bytesPerSample, iterations]);

  const stopSpeedTest = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const exportCsv = useCallback(() => {
    if (!samples.length) return;
    const rows = samples.map((sample) => [
      String(sample.iteration),
      formatBytes(sample.bytes),
      sample.durationMs.toFixed(1),
      sample.latencyMs.toFixed(1),
      sample.mbps.toFixed(2),
    ]);
    downloadCsv("internet-speed-test.csv", ["Sample", "Payload", "Download ms", "Latency ms", "Mbps"], rows);
  }, [samples]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={MonitorUp}
        title="Internet speed test"
        subtitle="Measure download throughput, latency, jitter, and consistency using repeated in-browser samples."
      />

      <div className="field-grid">
        <label className="field">
          <span>Payload per sample (bytes)</span>
          <input
            type="number"
            min={128000}
            max={5000000}
            step={64000}
            value={bytesPerSample}
            onChange={(event) => setBytesPerSample(Number(event.target.value))}
          />
          <small className="supporting-text">
            Recommended: 500,000 to 2,000,000 bytes per sample.
          </small>
        </label>
        <label className="field">
          <span>Samples per test</span>
          <input type="number" min={1} max={10} value={iterations} onChange={(event) => setIterations(Number(event.target.value))} />
        </label>
      </div>

      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void runSpeedTest()} disabled={running}>
          {running ? "Running..." : "Run speed test"}
        </button>
        <button className="action-button secondary" type="button" onClick={stopSpeedTest} disabled={!running}>
          Stop
        </button>
        <button className="action-button secondary" type="button" onClick={exportCsv} disabled={!samples.length}>
          <Download size={15} />
          Export CSV
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "Average speed", value: samples.length ? `${averageMbps.toFixed(2)} Mbps` : "-" },
          { label: "Best speed", value: samples.length ? `${bestMbps.toFixed(2)} Mbps` : "-" },
          { label: "Worst speed", value: samples.length ? `${worstMbps.toFixed(2)} Mbps` : "-" },
          { label: "Average latency", value: samples.length ? `${averageLatencyMs.toFixed(1)} ms` : "-" },
          { label: "Jitter", value: samples.length ? `${jitterMs.toFixed(1)} ms` : "-" },
          { label: "Consistency", value: samples.length ? `${consistencyScore.toFixed(1)} / 100` : "-" },
          { label: "Last run", value: lastRunAt ? new Date(lastRunAt).toLocaleString("en-US") : "-" },
        ]}
      />

      {samples.length ? (
        <>
          <p className={`status-badge ${networkProfile.tone}`}>{networkProfile.label}</p>
          <div
            style={{
              display: "grid",
              gap: "0.9rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            }}
          >
            <SpeedMetricChart
              title="Download speed trend"
              values={samples.map((sample) => sample.mbps)}
              labels={sampleLabels}
              unit="Mbps"
              lineColor="#4aa3ff"
              areaColor="rgba(74, 163, 255, 0.18)"
            />
            <SpeedMetricChart
              title="Latency trend"
              values={samples.map((sample) => sample.latencyMs)}
              labels={sampleLabels}
              unit="ms"
              lineColor="#f59e0b"
              areaColor="rgba(245, 158, 11, 0.18)"
            />
          </div>
        </>
      ) : null}

      {samples.length ? (
        <div className="mini-panel">
          <h3>Sample breakdown</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Payload</th>
                  <th>Download (ms)</th>
                  <th>Latency (ms)</th>
                  <th>Speed (Mbps)</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((sample) => (
                  <tr key={sample.id}>
                    <td>{sample.iteration}</td>
                    <td>{formatBytes(sample.bytes)}</td>
                    <td>{sample.durationMs.toFixed(1)}</td>
                    <td>{sample.latencyMs.toFixed(1)}</td>
                    <td>{sample.mbps.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Recent speed tests</h3>
          <button className="action-button secondary" type="button" onClick={() => setHistory([])} disabled={!history.length}>
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No speed test history yet.</p>
        ) : (
          <ul className="plain-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>{entry.avgMbps.toFixed(2)} Mbps average</strong>
                  <span className="supporting-text">
                    Best {entry.bestMbps.toFixed(2)} Mbps | Latency {entry.avgLatencyMs.toFixed(1)} ms |{" "}
                    {entry.sampleCount} sample(s) at {formatBytes(entry.bytesPerSample)} |{" "}
                    {new Date(entry.checkedAt).toLocaleString("en-US")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function DeveloperTool({ id }: { id: DeveloperToolId }) {
  switch (id) {
    case "uuid-generator":
      return <UuidGeneratorTool />;
    case "url-encoder-decoder":
      return <UrlEncoderDecoderTool />;
    case "timestamp-converter":
      return <TimestampConverterTool />;
    case "time-zone-converter":
      return <TimeZoneConverterTool />;
    case "internet-speed-test":
      return <InternetSpeedTestTool />;
    case "markdown-to-html":
      return <MarkdownToHtmlTool />;
    case "user-agent-checker":
      return <UserAgentCheckerTool />;
    case "ip-address-checker":
      return <IpAddressCheckerTool />;
    case "cron-expression-generator":
      return <CronGeneratorTool />;
    case "http-status-checker":
      return <HttpStatusCheckerTool />;
    case "dns-lookup":
      return <DnsLookupTool />;
    case "ssl-checker":
      return <SslCheckerTool />;
    case "whois-lookup":
      return <WhoisLookupTool />;
    case "dns-propagation-checker":
      return <DnsPropagationCheckerTool />;
    default:
      return <p>Developer tool unavailable.</p>;
  }
}

function QrCodeGeneratorTool() {
  const [text, setText] = useState("https://utiliora.com");
  const url = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(text)}`;
  return (
    <section className="tool-surface">
      <h2>QR code generator</h2>
      <label className="field">
        <span>Text or URL</span>
        <input type="text" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="image-preview">
        <NextImage src={url} alt="Generated QR code preview" width={240} height={240} unoptimized />
      </div>
      <a className="action-link" href={url} download="utiliora-qr.png">
        Download QR image
      </a>
    </section>
  );
}

function ColorPickerTool() {
  const [color, setColor] = useState("#2f4f4f");
  return (
    <section className="tool-surface">
      <h2>Color picker</h2>
      <label className="field">
        <span>Pick color</span>
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </label>
      <div className="result-row">
        <span>HEX</span>
        <strong>{color.toUpperCase()}</strong>
      </div>
    </section>
  );
}

function hexToRgb(hex: string): string | null {
  const sanitized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(sanitized)) return null;
  const r = Number.parseInt(sanitized.slice(0, 2), 16);
  const g = Number.parseInt(sanitized.slice(2, 4), 16);
  const b = Number.parseInt(sanitized.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function rgbToHex(rgb: string): string | null {
  const parts = rgb
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value));
  if (parts.length !== 3 || parts.some((value) => value < 0 || value > 255)) return null;
  return `#${parts
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function HexRgbConverterTool() {
  const [hex, setHex] = useState("#336699");
  const [rgb, setRgb] = useState("51, 102, 153");

  const convertHex = () => {
    const converted = hexToRgb(hex);
    setRgb(converted ?? "Invalid HEX");
  };

  const convertRgb = () => {
    const converted = rgbToHex(rgb);
    setHex(converted ?? "#000000");
  };

  return (
    <section className="tool-surface">
      <h2>HEX/RGB converter</h2>
      <div className="field-grid">
        <label className="field">
          <span>HEX</span>
          <input type="text" value={hex} onChange={(event) => setHex(event.target.value)} />
        </label>
        <button className="action-button" type="button" onClick={convertHex}>
          HEX to RGB
        </button>
        <label className="field">
          <span>RGB</span>
          <input type="text" value={rgb} onChange={(event) => setRgb(event.target.value)} />
        </label>
        <button className="action-button secondary" type="button" onClick={convertRgb}>
          RGB to HEX
        </button>
      </div>
    </section>
  );
}

type ImageMode = "resize" | "compress" | "jpg-to-png" | "png-to-webp";

type OutputMimeType = "image/png" | "image/jpeg" | "image/webp";
type OutputFormatChoice = "original" | OutputMimeType;

interface ImageDetails {
  filename: string;
  sizeBytes: number;
  mimeType: string;
  width: number;
  height: number;
}

interface OutputImageDetails extends ImageDetails {
  url: string;
  downloadName: string;
}

interface ImageModeConfig {
  title: string;
  description: string;
  accept: string;
  fixedOutput?: OutputMimeType;
  defaultOutputChoice: OutputFormatChoice;
  supportsResize: boolean;
  supportsQuality: boolean;
}

const IMAGE_MODE_CONFIG: Record<ImageMode, ImageModeConfig> = {
  resize: {
    title: "Image Resizer",
    description: "Resize with live preview while preserving aspect ratio.",
    accept: "image/png,image/jpeg,image/webp",
    defaultOutputChoice: "original",
    supportsResize: true,
    supportsQuality: true,
  },
  compress: {
    title: "Image Compressor",
    description: "Reduce file size with quality control and before/after comparison.",
    accept: "image/png,image/jpeg,image/webp",
    defaultOutputChoice: "image/webp",
    supportsResize: false,
    supportsQuality: true,
  },
  "jpg-to-png": {
    title: "JPG to PNG Converter",
    description: "Convert JPG/JPEG images to PNG with immediate preview.",
    accept: "image/jpeg",
    fixedOutput: "image/png",
    defaultOutputChoice: "image/png",
    supportsResize: false,
    supportsQuality: false,
  },
  "png-to-webp": {
    title: "PNG to WebP Converter",
    description: "Convert PNG images to WebP for lighter web delivery.",
    accept: "image/png",
    fixedOutput: "image/webp",
    defaultOutputChoice: "image/webp",
    supportsResize: false,
    supportsQuality: true,
  },
};

const IMAGE_WORKFLOW_SUGGESTIONS_BY_MODE: Record<
  ImageMode,
  Array<{ targetToolId: ImageToolId; label: string }>
> = {
  resize: [
    { targetToolId: "image-compressor", label: "Send to compressor" },
    { targetToolId: "png-to-webp", label: "Send to PNG -> WebP" },
    { targetToolId: "image-to-pdf", label: "Send to Image -> PDF" },
  ],
  compress: [
    { targetToolId: "png-to-webp", label: "Send to PNG -> WebP" },
    { targetToolId: "image-to-pdf", label: "Send to Image -> PDF" },
    { targetToolId: "image-cropper", label: "Send to cropper" },
  ],
  "jpg-to-png": [
    { targetToolId: "png-to-webp", label: "Send to PNG -> WebP" },
    { targetToolId: "image-cropper", label: "Send to cropper" },
    { targetToolId: "image-to-pdf", label: "Send to Image -> PDF" },
  ],
  "png-to-webp": [
    { targetToolId: "image-compressor", label: "Send to compressor" },
    { targetToolId: "image-cropper", label: "Send to cropper" },
    { targetToolId: "image-to-pdf", label: "Send to Image -> PDF" },
  ],
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeOutputMimeType(value: string): OutputMimeType | null {
  if (value === "image/jpg" || value === "image/jpeg") return "image/jpeg";
  if (value === "image/png") return "image/png";
  if (value === "image/webp") return "image/webp";
  return null;
}

function extensionFromMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

function labelForMimeType(mimeType: string): string {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "JPEG";
  if (mimeType === "image/webp") return "WebP";
  if (mimeType === "image/png") return "PNG";
  return mimeType;
}

function stripFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "");
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("Could not load image."));
    element.src = url;
  });
}

function ImageTransformTool({
  mode,
  incomingFile,
}: {
  mode: ImageMode;
  incomingFile?: ImageWorkflowIncomingFile | null;
}) {
  const config = IMAGE_MODE_CONFIG[mode];
  const sourceToolId = getSourceToolIdFromImageMode(mode);
  const workflowTargetOptions = getImageWorkflowTargetOptions(sourceToolId);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDetails, setSourceDetails] = useState<ImageDetails | null>(null);
  const [resultDetails, setResultDetails] = useState<OutputImageDetails | null>(null);
  const [targetWidth, setTargetWidth] = useState(1200);
  const [quality, setQuality] = useState(0.82);
  const [outputChoice, setOutputChoice] = useState<OutputFormatChoice>(config.defaultOutputChoice);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload an image to begin.");
  const [autoPreview, setAutoPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceUrlRef = useRef("");
  const resultUrlRef = useRef("");
  const processingRunRef = useRef(0);
  const incomingTokenRef = useRef("");
  const [workflowLibrary, setWorkflowLibrary] = useState<SavedImageWorkflow[]>([]);
  const [workflowRunHistory, setWorkflowRunHistory] = useState<ImageWorkflowRunHistoryEntry[]>([]);
  const [workflowName, setWorkflowName] = useState(() => `${getImageToolLabel(sourceToolId)} chain`);
  const [workflowTargets, setWorkflowTargets] = useState<(ImageToolId | "")[]>(
    () => createDefaultWorkflowTargets(sourceToolId),
  );
  const incomingRunContext = incomingFile?.runContext;

  const resolvedOutputMimeType: OutputMimeType = useMemo(() => {
    if (config.fixedOutput) return config.fixedOutput;
    if (outputChoice === "original") {
      return normalizeOutputMimeType(file?.type ?? "") ?? "image/png";
    }
    return outputChoice;
  }, [config.fixedOutput, file?.type, outputChoice]);

  const lossyOutput = resolvedOutputMimeType === "image/jpeg" || resolvedOutputMimeType === "image/webp";

  const computedResizeHeight = useMemo(() => {
    if (!sourceDetails) return null;
    const safeWidth = Math.max(16, Math.round(targetWidth || sourceDetails.width));
    return Math.max(1, Math.round((safeWidth / sourceDetails.width) * sourceDetails.height));
  }, [sourceDetails, targetWidth]);

  const comparisonText = useMemo(() => {
    if (!sourceDetails || !resultDetails) return "";
    const delta = resultDetails.sizeBytes - sourceDetails.sizeBytes;
    if (delta === 0) return "No size change";
    const percentage = (Math.abs(delta) / sourceDetails.sizeBytes) * 100;
    if (delta < 0) {
      return `Saved ${formatBytes(Math.abs(delta))} (${percentage.toFixed(1)}%)`;
    }
    return `Increased by ${formatBytes(delta)} (${percentage.toFixed(1)}%)`;
  }, [sourceDetails, resultDetails]);

  const savedWorkflows = useMemo(
    () => workflowLibrary.filter((workflow) => workflow.sourceToolId === sourceToolId),
    [sourceToolId, workflowLibrary],
  );

  const runHistory = useMemo(
    () =>
      workflowRunHistory
        .filter((entry) => entry.sourceToolId === sourceToolId)
        .slice(0, 12),
    [sourceToolId, workflowRunHistory],
  );

  const nextWorkflowStep = useMemo(
    () => getNextWorkflowStepContext(incomingRunContext, sourceToolId),
    [incomingRunContext, sourceToolId],
  );

  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => {
    setWorkflowLibrary(readImageWorkflowLibrary());
    setWorkflowRunHistory(readImageWorkflowRunHistory());
  }, []);

  useEffect(() => {
    setWorkflowTargets(createDefaultWorkflowTargets(sourceToolId));
    setWorkflowName(`${getImageToolLabel(sourceToolId)} chain`);
  }, [setWorkflowName, setWorkflowTargets, sourceToolId]);

  const clearOutput = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }
    setResultDetails(null);
  }, []);

  const resetAll = useCallback(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = "";
    }
    clearOutput();
    setFile(null);
    setSourceUrl("");
    setSourceDetails(null);
    setProgress(0);
    setStatus("Upload an image to begin.");
    processingRunRef.current += 1;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [clearOutput]);

  const handleSelectedFile = useCallback(
    async (candidate: File | null) => {
      if (!candidate) {
        resetAll();
        return;
      }

      if (mode === "jpg-to-png" && !candidate.type.startsWith("image/jpeg")) {
        setStatus("This converter accepts JPG/JPEG files only.");
        return;
      }
      if (mode === "png-to-webp" && candidate.type !== "image/png") {
        setStatus("This converter accepts PNG files only.");
        return;
      }
      if (!candidate.type.startsWith("image/")) {
        setStatus("Please upload a valid image file.");
        return;
      }

      const newSourceUrl = URL.createObjectURL(candidate);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = newSourceUrl;
      setSourceUrl(newSourceUrl);
      setFile(candidate);
      clearOutput();
      setStatus("Reading image metadata...");
      setProgress(8);

      try {
        const image = await loadImage(newSourceUrl);
        setSourceDetails({
          filename: candidate.name,
          sizeBytes: candidate.size,
          mimeType: candidate.type || "image/png",
          width: image.width,
          height: image.height,
        });
        if (mode === "resize") {
          const recommendedWidth = Math.min(1200, image.width);
          setTargetWidth(recommendedWidth);
        }
        setStatus("Image loaded. Generating converted preview...");
        setProgress(15);
      } catch {
        setStatus("Could not read this image. Try another file.");
      }
    },
    [clearOutput, mode, resetAll],
  );

  useEffect(() => {
    if (!incomingFile || incomingTokenRef.current === incomingFile.token) return;
    incomingTokenRef.current = incomingFile.token;
    setStatus(`Workflow handoff received from ${incomingFile.sourceToolId}.`);
    void handleSelectedFile(incomingFile.file);
  }, [handleSelectedFile, incomingFile]);

  const processImage = useCallback(
    async (trigger: "manual" | "auto") => {
      if (!file || !sourceDetails || !sourceUrl) {
        setStatus("Select an image first.");
        return;
      }

      const runId = ++processingRunRef.current;
      setProcessing(true);

      try {
        setProgress(25);
        setStatus("Loading pixels...");
        const image = await loadImage(sourceUrl);
        if (runId !== processingRunRef.current) return;

        const canvas = document.createElement("canvas");
        const width =
          mode === "resize"
            ? Math.max(16, Math.min(8000, Math.round(targetWidth || sourceDetails.width)))
            : sourceDetails.width;
        const height =
          mode === "resize"
            ? Math.max(1, Math.round((width / sourceDetails.width) * sourceDetails.height))
            : sourceDetails.height;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          setStatus("Canvas context unavailable.");
          return;
        }

        setProgress(50);
        setStatus("Rendering preview...");
        context.drawImage(image, 0, 0, width, height);

        const qualityValue = lossyOutput ? quality : undefined;
        setProgress(72);
        setStatus("Encoding output...");
        let outputMimeType: OutputMimeType = resolvedOutputMimeType;
        let outputBlob = await canvasToBlob(canvas, outputMimeType, qualityValue);

        if (!outputBlob) {
          outputMimeType = "image/png";
          outputBlob = await canvasToBlob(canvas, outputMimeType);
        }
        if (!outputBlob) {
          setStatus("Failed to encode image output.");
          return;
        }

        if (runId !== processingRunRef.current) return;

        const outputUrl = URL.createObjectURL(outputBlob);
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = outputUrl;

        const baseName = stripFileExtension(file.name) || "image";
        const suffix =
          mode === "resize"
            ? "resized"
            : mode === "compress"
              ? "compressed"
              : mode === "jpg-to-png"
                ? "converted"
                : "web-optimized";
        const downloadName = `${baseName}-${suffix}.${extensionFromMimeType(outputMimeType)}`;

        setResultDetails({
          url: outputUrl,
          downloadName,
          filename: downloadName,
          sizeBytes: outputBlob.size,
          mimeType: outputMimeType,
          width,
          height,
        });

        setProgress(100);
        const sizeSummary = `${formatBytes(sourceDetails.sizeBytes)} -> ${formatBytes(outputBlob.size)}`;
        setStatus(`Done (${sizeSummary}). ${trigger === "auto" ? "Auto-preview updated." : "Ready to download."}`);
        trackEvent("tool_image_process", { mode, trigger, outputType: outputMimeType });
      } catch {
        setStatus("Image processing failed. Please retry.");
      } finally {
        if (runId === processingRunRef.current) setProcessing(false);
      }
    },
    [file, lossyOutput, mode, quality, resolvedOutputMimeType, sourceDetails, sourceUrl, targetWidth],
  );

  useEffect(() => {
    if (!autoPreview || !file || !sourceDetails) return;
    const timeout = setTimeout(() => {
      void processImage("auto");
    }, 140);
    return () => clearTimeout(timeout);
  }, [autoPreview, file, processImage, quality, sourceDetails, targetWidth, outputChoice]);

  const persistWorkflowLibrary = useCallback((nextLibrary: SavedImageWorkflow[]) => {
    setWorkflowLibrary(nextLibrary);
    writeImageWorkflowLibrary(nextLibrary);
  }, []);

  const persistWorkflowRunHistory = useCallback((nextHistory: ImageWorkflowRunHistoryEntry[]) => {
    setWorkflowRunHistory(nextHistory);
    writeImageWorkflowRunHistory(nextHistory);
  }, []);

  const canSendToWorkflowTool = useCallback(
    (targetToolId: ImageToolId): boolean => {
      if (!resultDetails) return false;
      if (targetToolId === "png-to-webp") return resultDetails.mimeType === "image/png";
      if (targetToolId === "jpg-to-png") return resultDetails.mimeType === "image/jpeg";
      return true;
    },
    [resultDetails],
  );

  const saveWorkflow = useCallback(() => {
    const normalizedName = sanitizeImageWorkflowName(workflowName);
    const steps = buildSavedWorkflowSteps(sourceToolId, workflowTargets);
    if (!normalizedName) {
      setStatus("Add a workflow name before saving.");
      return;
    }
    if (steps.length < 2) {
      setStatus("Choose at least one next tool for this workflow.");
      return;
    }

    const now = Date.now();
    const existing = workflowLibrary.find(
      (entry) => entry.sourceToolId === sourceToolId && entry.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    const nextWorkflow: SavedImageWorkflow = existing
      ? {
          ...existing,
          steps,
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          name: normalizedName,
          sourceToolId,
          steps,
          createdAt: now,
          updatedAt: now,
          runCount: 0,
          lastRunAt: null,
        };

    const nextLibrary = [nextWorkflow, ...workflowLibrary.filter((entry) => entry.id !== nextWorkflow.id)].slice(0, 60);
    persistWorkflowLibrary(nextLibrary);
    setStatus(`Workflow "${nextWorkflow.name}" saved.`);
    trackEvent("tool_workflow_save", { sourceToolId, steps: steps.length });
  }, [persistWorkflowLibrary, sourceToolId, workflowLibrary, workflowName, workflowTargets]);

  const deleteWorkflow = useCallback(
    (workflowId: string) => {
      const nextLibrary = workflowLibrary.filter((entry) => entry.id !== workflowId);
      persistWorkflowLibrary(nextLibrary);
      setStatus("Workflow removed.");
    },
    [persistWorkflowLibrary, workflowLibrary],
  );

  const markWorkflowRun = useCallback(
    (workflow: SavedImageWorkflow, runContext: ImageWorkflowRunContext) => {
      const now = Date.now();
      const nextLibrary = workflowLibrary.map((entry) =>
        entry.id === workflow.id
          ? {
              ...entry,
              runCount: entry.runCount + 1,
              lastRunAt: now,
              updatedAt: now,
            }
          : entry,
      );
      persistWorkflowLibrary(nextLibrary);

      const historyEntry: ImageWorkflowRunHistoryEntry = {
        id: crypto.randomUUID(),
        runId: runContext.runId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        sourceToolId: workflow.sourceToolId,
        steps: workflow.steps,
        createdAt: now,
      };
      const nextHistory = [historyEntry, ...workflowRunHistory].slice(0, IMAGE_WORKFLOW_RUN_HISTORY_LIMIT);
      persistWorkflowRunHistory(nextHistory);
    },
    [persistWorkflowLibrary, persistWorkflowRunHistory, workflowLibrary, workflowRunHistory],
  );

  const runSavedWorkflow = useCallback(
    async (workflow: SavedImageWorkflow) => {
      if (!resultDetails) return;
      if (workflow.steps.length < 2) {
        setStatus("This workflow has no next step.");
        return;
      }

      const targetToolId = workflow.steps[1];
      if (!canSendToWorkflowTool(targetToolId)) {
        setStatus(`Current output format cannot be sent to ${getImageToolLabel(targetToolId)}.`);
        return;
      }

      const runContext = createImageWorkflowRunContext(workflow, 1);
      setStatus(`Running workflow "${workflow.name}"...`);
      const ok = await handoffImageResultToTool({
        sourceToolId,
        targetToolId,
        fileName: resultDetails.downloadName,
        mimeType: resultDetails.mimeType,
        sourceUrl: resultDetails.url,
        runContext,
      });
      if (!ok) {
        setStatus("Could not start saved workflow.");
      } else {
        markWorkflowRun(workflow, runContext);
        trackEvent("tool_workflow_run", { sourceToolId, workflowId: workflow.id, steps: workflow.steps.length });
      }
    },
    [canSendToWorkflowTool, markWorkflowRun, resultDetails, sourceToolId],
  );

  const rerunWorkflowFromHistory = useCallback(
    async (entry: ImageWorkflowRunHistoryEntry) => {
      const libraryWorkflow = workflowLibrary.find((workflow) => workflow.id === entry.workflowId);
      const fallbackWorkflow: SavedImageWorkflow = {
        id: entry.workflowId,
        name: entry.workflowName,
        sourceToolId: entry.sourceToolId,
        steps: entry.steps,
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt,
        runCount: 0,
        lastRunAt: null,
      };
      await runSavedWorkflow(libraryWorkflow ?? fallbackWorkflow);
    },
    [runSavedWorkflow, workflowLibrary],
  );

  const sendToWorkflowTool = useCallback(
    async (targetToolId: ImageToolId, runContext?: ImageWorkflowRunContext) => {
      if (!resultDetails) return;
      setStatus(`Sending output to ${getImageToolLabel(targetToolId)}...`);
      const ok = await handoffImageResultToTool({
        sourceToolId,
        targetToolId,
        fileName: resultDetails.downloadName,
        mimeType: resultDetails.mimeType,
        sourceUrl: resultDetails.url,
        ...(runContext ? { runContext } : {}),
      });
      if (!ok) {
        setStatus("Could not hand off this output to the next tool.");
      } else {
        trackEvent("tool_workflow_handoff", { sourceMode: mode, targetToolId, inWorkflowRun: Boolean(runContext) });
      }
    },
    [mode, resultDetails, sourceToolId],
  );

  const continueWorkflowRun = useCallback(async () => {
    if (!nextWorkflowStep) return;
    if (!canSendToWorkflowTool(nextWorkflowStep.nextToolId)) {
      setStatus(`Current output format cannot be sent to ${getImageToolLabel(nextWorkflowStep.nextToolId)}.`);
      return;
    }
    await sendToWorkflowTool(nextWorkflowStep.nextToolId, nextWorkflowStep.nextRunContext);
  }, [canSendToWorkflowTool, nextWorkflowStep, sendToWorkflowTool]);

  return (
    <section className="tool-surface">
      <h2>{config.title}</h2>
      <p className="supporting-text">{config.description}</p>

      <label className="field">
        <span>Choose image</span>
        <input
          ref={fileInputRef}
          type="file"
          accept={config.accept}
          onChange={(event) => {
            void handleSelectedFile(event.target.files?.[0] ?? null);
          }}
        />
      </label>

      <div className="field-grid">
        {config.supportsResize ? (
          <label className="field">
            <span>Target width (px)</span>
            <input
              type="number"
              min={16}
              max={8000}
              value={targetWidth}
              onChange={(event) => setTargetWidth(Number(event.target.value))}
            />
            {computedResizeHeight ? (
              <small className="supporting-text">Estimated output: {targetWidth} x {computedResizeHeight}px</small>
            ) : null}
          </label>
        ) : null}

        {!config.fixedOutput ? (
          <label className="field">
            <span>Output format</span>
            <select value={outputChoice} onChange={(event) => setOutputChoice(event.target.value as OutputFormatChoice)}>
              {mode === "resize" ? <option value="original">Keep original format</option> : null}
              {(mode === "resize" || mode === "compress") && <option value="image/webp">WebP</option>}
              {(mode === "resize" || mode === "compress") && <option value="image/jpeg">JPEG</option>}
              {mode === "resize" && <option value="image/png">PNG</option>}
            </select>
          </label>
        ) : (
          <div className="result-row">
            <span>Output format</span>
            <strong>{labelForMimeType(config.fixedOutput)}</strong>
          </div>
        )}

        {config.supportsQuality && lossyOutput ? (
          <label className="field">
            <span>Quality ({quality.toFixed(2)})</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
            <small className="supporting-text">Lower quality means smaller file size.</small>
          </label>
        ) : null}
      </div>

      <div className="button-row">
        <button
          className="action-button"
          type="button"
          disabled={!file || processing}
          onClick={() => {
            void processImage("manual");
          }}
        >
          {processing ? "Processing..." : "Process now"}
        </button>
        <button className="action-button secondary" type="button" onClick={resetAll}>
          Clear
        </button>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={autoPreview}
            onChange={(event) => setAutoPreview(event.target.checked)}
          />
          Auto preview on changes
        </label>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <div className="image-compare-grid">
        <article className="image-card">
          <h3>Original</h3>
          <div className="image-frame">
            {sourceUrl ? (
              <NextImage
                src={sourceUrl}
                alt="Original uploaded image preview"
                width={sourceDetails?.width ?? 800}
                height={sourceDetails?.height ?? 600}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                unoptimized
              />
            ) : (
              <p className="image-placeholder">Select a file to preview the original image.</p>
            )}
          </div>
          {sourceDetails ? (
            <dl className="image-meta">
              <div>
                <dt>Name</dt>
                <dd>{sourceDetails.filename}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{labelForMimeType(sourceDetails.mimeType)}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>
                  {sourceDetails.width} x {sourceDetails.height}
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(sourceDetails.sizeBytes)}</dd>
              </div>
            </dl>
          ) : null}
        </article>

        <article className="image-card">
          <h3>Converted</h3>
          <div className="image-frame">
            {resultDetails ? (
              <NextImage
                src={resultDetails.url}
                alt="Processed image preview"
                width={resultDetails.width}
                height={resultDetails.height}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                unoptimized
              />
            ) : (
              <p className="image-placeholder">Converted output will appear here.</p>
            )}
          </div>
          {resultDetails ? (
            <dl className="image-meta">
              <div>
                <dt>Name</dt>
                <dd>{resultDetails.downloadName}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{labelForMimeType(resultDetails.mimeType)}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>
                  {resultDetails.width} x {resultDetails.height}
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(resultDetails.sizeBytes)}</dd>
              </div>
            </dl>
          ) : null}
        </article>
      </div>

      {comparisonText ? <p className="supporting-text image-summary">{comparisonText}</p> : null}

      {resultDetails ? (
        <>
          <a className="action-link" href={resultDetails.url} download={resultDetails.downloadName}>
            Download {labelForMimeType(resultDetails.mimeType)}
          </a>
          <div className="button-row">
            {IMAGE_WORKFLOW_SUGGESTIONS_BY_MODE[mode].map((suggestion) => (
              <button
                key={suggestion.targetToolId}
                className="action-button secondary"
                type="button"
                disabled={processing || !canSendToWorkflowTool(suggestion.targetToolId)}
                onClick={() => {
                  void sendToWorkflowTool(suggestion.targetToolId);
                }}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
          {nextWorkflowStep ? (
            <div className="button-row">
              <button
                className="action-button secondary"
                type="button"
                disabled={processing || !canSendToWorkflowTool(nextWorkflowStep.nextToolId)}
                onClick={() => {
                  void continueWorkflowRun();
                }}
              >
                Continue workflow -&gt; {getImageToolLabel(nextWorkflowStep.nextToolId)}
              </button>
            </div>
          ) : incomingRunContext && incomingRunContext.steps[incomingRunContext.currentStepIndex] === sourceToolId ? (
            <p className="supporting-text">
              Workflow &quot;{incomingRunContext.workflowName}&quot; completed at {getImageToolLabel(sourceToolId)}.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Workflow chaining</h3>
          <span className="supporting-text">Save reusable chains and rerun them in one click.</span>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Workflow name</span>
            <input
              type="text"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              placeholder={`${getImageToolLabel(sourceToolId)} chain`}
            />
          </label>
          {[0, 1, 2].map((index) => (
            <label key={index} className="field">
              <span>Step {index + 1}</span>
              <select
                value={workflowTargets[index]}
                onChange={(event) => {
                  const value = event.target.value as ImageToolId | "";
                  setWorkflowTargets((current) => {
                    const next = [...current];
                    next[index] = value;
                    return next as Array<ImageToolId | "">;
                  });
                }}
              >
                <option value="">None</option>
                {workflowTargetOptions.map((target) => (
                  <option key={target} value={target}>
                    {getImageToolLabel(target)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="button-row">
          <button className="action-button secondary" type="button" onClick={saveWorkflow}>
            Save workflow
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => setWorkflowTargets(createDefaultWorkflowTargets(sourceToolId))}
          >
            Reset steps
          </button>
        </div>

        {savedWorkflows.length === 0 ? (
          <p className="supporting-text">No saved workflows for this tool yet.</p>
        ) : (
          <ul className="plain-list">
            {savedWorkflows.map((workflow) => (
              <li key={workflow.id}>
                <div className="history-line">
                  <strong>{workflow.name}</strong>
                  <span className="supporting-text">
                    {workflow.steps.map((step) => getImageToolLabel(step)).join(" -> ")} | Runs:{" "}
                    {formatNumericValue(workflow.runCount)}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    disabled={!resultDetails || processing}
                    onClick={() => {
                      void runSavedWorkflow(workflow);
                    }}
                  >
                    Run now
                  </button>
                  <button className="action-button secondary" type="button" onClick={() => deleteWorkflow(workflow.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3>Run history</h3>
        {runHistory.length === 0 ? (
          <p className="supporting-text">No workflow runs yet for this tool.</p>
        ) : (
          <ul className="plain-list">
            {runHistory.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>{entry.workflowName}</strong>
                  <span className="supporting-text">
                    {entry.steps.map((step) => getImageToolLabel(step)).join(" -> ")} |{" "}
                    {new Date(entry.createdAt).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    disabled={!resultDetails || processing}
                    onClick={() => {
                      void rerunWorkflowFromHistory(entry);
                    }}
                  >
                    Re-run from history
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type BackgroundRemovalModel = "isnet" | "isnet_fp16" | "isnet_quint8";

interface BackgroundRemovalRunEntry {
  id: string;
  fileName: string;
  sourceBytes: number;
  outputBytes: number;
  outputMimeType: OutputMimeType;
  model: BackgroundRemovalModel;
  createdAt: number;
  durationMs: number;
}

const BACKGROUND_REMOVER_STORAGE_KEY = "utiliora-background-remover-state-v1";
const BACKGROUND_REMOVER_HISTORY_LIMIT = 24;
const BACKGROUND_REMOVER_CDN_URL = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";

type BackgroundRemovalFn = (
  image: Blob | File,
  configuration?: {
    model?: BackgroundRemovalModel;
    output?: { format?: OutputMimeType; quality?: number };
    progress?: (key: string, current: number, total: number) => void;
  },
) => Promise<Blob>;

function sanitizeBackgroundRemovalRunEntry(candidate: unknown): BackgroundRemovalRunEntry | null {
  if (!candidate || typeof candidate !== "object") return null;
  const entry = candidate as Partial<BackgroundRemovalRunEntry>;
  if (typeof entry.fileName !== "string" || !entry.fileName.trim()) return null;
  const sourceBytes = Number.isFinite(entry.sourceBytes) ? Math.max(0, Math.round(entry.sourceBytes as number)) : 0;
  const outputBytes = Number.isFinite(entry.outputBytes) ? Math.max(0, Math.round(entry.outputBytes as number)) : 0;
  const outputMimeType =
    entry.outputMimeType === "image/png" || entry.outputMimeType === "image/jpeg" || entry.outputMimeType === "image/webp"
      ? entry.outputMimeType
      : "image/png";
  const model: BackgroundRemovalModel =
    entry.model === "isnet" || entry.model === "isnet_fp16" || entry.model === "isnet_quint8"
      ? entry.model
      : "isnet_fp16";
  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    fileName: entry.fileName.slice(0, 180),
    sourceBytes,
    outputBytes,
    outputMimeType,
    model,
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
    durationMs: Number.isFinite(entry.durationMs) ? Math.max(0, Math.round(entry.durationMs as number)) : 0,
  };
}

function BackgroundRemoverTool({ incomingFile }: { incomingFile?: ImageWorkflowIncomingFile | null }) {
  const sourceToolId: ImageToolId = "background-remover";
  const workflowTargetOptions = getImageWorkflowTargetOptions(sourceToolId);
  const sourceUrlRef = useRef("");
  const resultUrlRef = useRef("");
  const runIdRef = useRef(0);
  const incomingTokenRef = useRef("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDetails, setSourceDetails] = useState<ImageDetails | null>(null);
  const [resultDetails, setResultDetails] = useState<OutputImageDetails | null>(null);
  const [model, setModel] = useState<BackgroundRemovalModel>("isnet_fp16");
  const [outputMimeType, setOutputMimeType] = useState<OutputMimeType>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [autoProcess, setAutoProcess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload an image to remove its background.");
  const [history, setHistory] = useState<BackgroundRemovalRunEntry[]>([]);

  const incomingRunContext = incomingFile?.runContext;
  const nextWorkflowStep = useMemo(
    () => getNextWorkflowStepContext(incomingRunContext, sourceToolId),
    [incomingRunContext, sourceToolId],
  );

  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(BACKGROUND_REMOVER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        model?: BackgroundRemovalModel;
        outputMimeType?: OutputMimeType;
        quality?: number;
        autoProcess?: boolean;
        history?: unknown[];
      };
      if (parsed.model === "isnet" || parsed.model === "isnet_fp16" || parsed.model === "isnet_quint8") {
        setModel(parsed.model);
      }
      if (
        parsed.outputMimeType === "image/png" ||
        parsed.outputMimeType === "image/jpeg" ||
        parsed.outputMimeType === "image/webp"
      ) {
        setOutputMimeType(parsed.outputMimeType);
      }
      if (typeof parsed.quality === "number" && Number.isFinite(parsed.quality)) {
        setQuality(Math.max(0.1, Math.min(1, parsed.quality)));
      }
      if (typeof parsed.autoProcess === "boolean") {
        setAutoProcess(parsed.autoProcess);
      }
      if (Array.isArray(parsed.history)) {
        const nextHistory = parsed.history
          .map((entry) => sanitizeBackgroundRemovalRunEntry(entry))
          .filter((entry): entry is BackgroundRemovalRunEntry => Boolean(entry))
          .slice(0, BACKGROUND_REMOVER_HISTORY_LIMIT);
        setHistory(nextHistory);
      }
    } catch {
      // Ignore malformed local settings.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        BACKGROUND_REMOVER_STORAGE_KEY,
        JSON.stringify({
          model,
          outputMimeType,
          quality,
          autoProcess,
          history: history.slice(0, BACKGROUND_REMOVER_HISTORY_LIMIT),
        }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [autoProcess, history, model, outputMimeType, quality]);

  const clearOutput = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }
    setResultDetails(null);
    setProgress(0);
  }, []);

  const clearAll = useCallback(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = "";
    }
    clearOutput();
    setFile(null);
    setSourceUrl("");
    setSourceDetails(null);
    setStatus("Upload an image to remove its background.");
    runIdRef.current += 1;
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [clearOutput]);

  const handleFile = useCallback(
    async (candidate: File | null) => {
      if (!candidate) {
        clearAll();
        return;
      }
      if (!candidate.type.startsWith("image/")) {
        setStatus("Please select a valid image.");
        return;
      }
      const objectUrl = URL.createObjectURL(candidate);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = objectUrl;
      setSourceUrl(objectUrl);
      setFile(candidate);
      clearOutput();
      setStatus("Reading image...");

      try {
        const image = await loadImage(objectUrl);
        setSourceDetails({
          filename: candidate.name,
          sizeBytes: candidate.size,
          mimeType: candidate.type || "image/png",
          width: image.width,
          height: image.height,
        });
        setStatus("Image loaded. Ready to remove background.");
      } catch {
        setStatus("Could not read this image file.");
      }
    },
    [clearAll, clearOutput],
  );

  useEffect(() => {
    if (!incomingFile || incomingTokenRef.current === incomingFile.token) return;
    incomingTokenRef.current = incomingFile.token;
    setStatus(`Workflow handoff received from ${incomingFile.sourceToolId}.`);
    void handleFile(incomingFile.file);
  }, [handleFile, incomingFile]);

  const canSendToWorkflowTool = useCallback(
    (targetToolId: ImageToolId) => {
      if (!resultDetails) return false;
      if (targetToolId === "png-to-webp") return resultDetails.mimeType === "image/png";
      if (targetToolId === "jpg-to-png") return resultDetails.mimeType === "image/jpeg";
      return true;
    },
    [resultDetails],
  );

  const runBackgroundRemoval = useCallback(
    async (trigger: "manual" | "auto") => {
      if (!file || !sourceDetails) {
        setStatus("Select an image first.");
        return;
      }

      const runId = ++runIdRef.current;
      setProcessing(true);
      setProgress(4);
      const startedAt = Date.now();

      try {
        setStatus("Loading background removal model...");
        const bgRuntime = (await import(/* webpackIgnore: true */ BACKGROUND_REMOVER_CDN_URL)) as {
          removeBackground?: BackgroundRemovalFn;
          default?: BackgroundRemovalFn;
        };
        const removeBackground = bgRuntime.removeBackground ?? bgRuntime.default;
        if (typeof removeBackground !== "function") {
          throw new Error("Background removal engine failed to load.");
        }

        setStatus("Running segmentation...");
        const blob = await removeBackground(file, {
          model,
          output: {
            format: outputMimeType,
            quality,
          },
          progress: (key: string, current: number, total: number) => {
            if (runId !== runIdRef.current) return;
            const ratio = total > 0 ? current / total : 0;
            const mapped = Math.max(8, Math.min(94, Math.round(ratio * 100)));
            setProgress(mapped);
            setStatus(`Processing (${key} ${current}/${total})...`);
          },
        });

        if (runId !== runIdRef.current) return;

        const outputUrl = URL.createObjectURL(blob);
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = outputUrl;

        const outputImage = await loadImage(outputUrl);
        const baseName = stripFileExtension(file.name) || "image";
        const downloadName = `${baseName}-background-removed.${extensionFromMimeType(outputMimeType)}`;

        setResultDetails({
          url: outputUrl,
          downloadName,
          filename: downloadName,
          sizeBytes: blob.size,
          mimeType: outputMimeType,
          width: outputImage.width,
          height: outputImage.height,
        });
        setProgress(100);

        const durationMs = Date.now() - startedAt;
        setStatus(
          `Background removed (${formatBytes(sourceDetails.sizeBytes)} -> ${formatBytes(blob.size)}) in ${(durationMs / 1000).toFixed(1)}s.`,
        );
        setHistory((current) =>
          [
            {
              id: crypto.randomUUID(),
              fileName: file.name,
              sourceBytes: sourceDetails.sizeBytes,
              outputBytes: blob.size,
              outputMimeType,
              model,
              createdAt: Date.now(),
              durationMs,
            },
            ...current,
          ].slice(0, BACKGROUND_REMOVER_HISTORY_LIMIT),
        );
        trackEvent("tool_background_remover_run", { trigger, outputMimeType, model });
      } catch (error) {
        const message = error instanceof Error && error.message ? error.message : "Background removal failed.";
        setStatus(message);
      } finally {
        if (runId === runIdRef.current) setProcessing(false);
      }
    },
    [file, model, outputMimeType, quality, sourceDetails],
  );

  useEffect(() => {
    if (!autoProcess || !file || !sourceDetails) return;
    const timeout = window.setTimeout(() => {
      void runBackgroundRemoval("auto");
    }, 240);
    return () => window.clearTimeout(timeout);
  }, [autoProcess, file, model, outputMimeType, quality, runBackgroundRemoval, sourceDetails]);

  const sendToWorkflowTool = useCallback(
    async (targetToolId: ImageToolId) => {
      if (!resultDetails) return;
      if (!canSendToWorkflowTool(targetToolId)) {
        setStatus(`Output format is not compatible with ${getImageToolLabel(targetToolId)}.`);
        return;
      }
      setStatus(`Sending image to ${getImageToolLabel(targetToolId)}...`);
      const ok = await handoffImageResultToTool({
        sourceToolId,
        targetToolId,
        fileName: resultDetails.downloadName,
        mimeType: resultDetails.mimeType,
        sourceUrl: resultDetails.url,
      });
      if (!ok) {
        setStatus(`Could not send result to ${getImageToolLabel(targetToolId)}.`);
      }
    },
    [canSendToWorkflowTool, resultDetails, sourceToolId],
  );

  const continueWorkflowRun = useCallback(async () => {
    if (!nextWorkflowStep || !resultDetails) return;
    if (!canSendToWorkflowTool(nextWorkflowStep.nextToolId)) {
      setStatus(`Current output cannot continue to ${getImageToolLabel(nextWorkflowStep.nextToolId)}.`);
      return;
    }
    setStatus(`Continuing workflow to ${getImageToolLabel(nextWorkflowStep.nextToolId)}...`);
    const ok = await handoffImageResultToTool({
      sourceToolId,
      targetToolId: nextWorkflowStep.nextToolId,
      fileName: resultDetails.downloadName,
      mimeType: resultDetails.mimeType,
      sourceUrl: resultDetails.url,
      runContext: nextWorkflowStep.nextRunContext,
    });
    if (!ok) {
      setStatus("Could not continue workflow.");
    } else {
      trackEvent("tool_background_remover_workflow_continue", { nextToolId: nextWorkflowStep.nextToolId });
    }
  }, [canSendToWorkflowTool, nextWorkflowStep, resultDetails, sourceToolId]);

  const comparisonText = useMemo(() => {
    if (!sourceDetails || !resultDetails) return "";
    const delta = resultDetails.sizeBytes - sourceDetails.sizeBytes;
    if (delta === 0) return "No file size change.";
    const pct = sourceDetails.sizeBytes > 0 ? (Math.abs(delta) / sourceDetails.sizeBytes) * 100 : 0;
    if (delta < 0) return `Saved ${formatBytes(Math.abs(delta))} (${pct.toFixed(1)}%).`;
    return `Increased by ${formatBytes(delta)} (${pct.toFixed(1)}%).`;
  }, [resultDetails, sourceDetails]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Sparkles}
        title="Background remover"
        subtitle="Open-source AI background removal running fully in your browser with local history and workflow handoff."
      />
      <div className="field-grid">
        <label className="field">
          <span>Upload image</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => {
              void handleFile(event.target.files?.[0] ?? null);
            }}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <select value={model} onChange={(event) => setModel(event.target.value as BackgroundRemovalModel)}>
            <option value="isnet_fp16">Balanced (FP16)</option>
            <option value="isnet_quint8">Fast (Quantized)</option>
            <option value="isnet">High quality</option>
          </select>
        </label>
        <label className="field">
          <span>Output format</span>
          <select value={outputMimeType} onChange={(event) => setOutputMimeType(event.target.value as OutputMimeType)}>
            <option value="image/png">PNG (transparent)</option>
            <option value="image/webp">WebP</option>
            <option value="image/jpeg">JPEG</option>
          </select>
        </label>
        <label className="field">
          <span>Quality ({quality.toFixed(2)})</span>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="button-row">
        <button
          className="action-button"
          type="button"
          onClick={() => {
            void runBackgroundRemoval("manual");
          }}
          disabled={!file || processing}
        >
          {processing ? "Removing..." : "Remove background"}
        </button>
        <button className="action-button secondary" type="button" onClick={clearAll}>
          Clear
        </button>
        <label className="checkbox">
          <input type="checkbox" checked={autoProcess} onChange={(event) => setAutoProcess(event.target.checked)} />
          Auto run on setting changes
        </label>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <div className="image-compare-grid">
        <article className="image-card">
          <h3>Original</h3>
          <div className="image-frame">
            {sourceUrl ? (
              <NextImage
                src={sourceUrl}
                alt="Original uploaded image preview"
                width={sourceDetails?.width ?? 800}
                height={sourceDetails?.height ?? 600}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                unoptimized
              />
            ) : (
              <p className="image-placeholder">Upload a file to preview the original image.</p>
            )}
          </div>
          {sourceDetails ? (
            <dl className="image-meta">
              <div>
                <dt>Name</dt>
                <dd>{sourceDetails.filename}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{labelForMimeType(sourceDetails.mimeType)}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>
                  {sourceDetails.width} x {sourceDetails.height}
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(sourceDetails.sizeBytes)}</dd>
              </div>
            </dl>
          ) : null}
        </article>

        <article className="image-card">
          <h3>Result</h3>
          <div className="image-frame">
            {resultDetails ? (
              <NextImage
                src={resultDetails.url}
                alt="Background removed image preview"
                width={resultDetails.width}
                height={resultDetails.height}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                unoptimized
              />
            ) : (
              <p className="image-placeholder">Processed output appears here after background removal.</p>
            )}
          </div>
          {resultDetails ? (
            <dl className="image-meta">
              <div>
                <dt>Name</dt>
                <dd>{resultDetails.downloadName}</dd>
              </div>
              <div>
                <dt>Format</dt>
                <dd>{labelForMimeType(resultDetails.mimeType)}</dd>
              </div>
              <div>
                <dt>Dimensions</dt>
                <dd>
                  {resultDetails.width} x {resultDetails.height}
                </dd>
              </div>
              <div>
                <dt>Size</dt>
                <dd>{formatBytes(resultDetails.sizeBytes)}</dd>
              </div>
            </dl>
          ) : null}
        </article>
      </div>

      {comparisonText ? <p className="supporting-text image-summary">{comparisonText}</p> : null}

      {resultDetails ? (
        <>
          <a className="action-link" href={resultDetails.url} download={resultDetails.downloadName}>
            Download {labelForMimeType(resultDetails.mimeType)}
          </a>
          <div className="button-row">
            {workflowTargetOptions.slice(0, 4).map((targetToolId) => (
              <button
                key={targetToolId}
                className="action-button secondary"
                type="button"
                disabled={processing || !canSendToWorkflowTool(targetToolId)}
                onClick={() => {
                  void sendToWorkflowTool(targetToolId);
                }}
              >
                Send to {getImageToolLabel(targetToolId)}
              </button>
            ))}
          </div>
          {nextWorkflowStep ? (
            <div className="button-row">
              <button
                className="action-button secondary"
                type="button"
                disabled={processing || !canSendToWorkflowTool(nextWorkflowStep.nextToolId)}
                onClick={() => {
                  void continueWorkflowRun();
                }}
              >
                Continue workflow -&gt; {getImageToolLabel(nextWorkflowStep.nextToolId)}
              </button>
            </div>
          ) : incomingRunContext && incomingRunContext.steps[incomingRunContext.currentStepIndex] === sourceToolId ? (
            <p className="supporting-text">
              Workflow &quot;{incomingRunContext.workflowName}&quot; completed at {getImageToolLabel(sourceToolId)}.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Recent background removal runs</h3>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => setHistory([])}
            disabled={history.length === 0}
          >
            Clear history
          </button>
        </div>
        <div className="button-row">
          <button
            className="action-button secondary"
            type="button"
            onClick={() =>
              downloadTextFile(
                "background-remover-history.json",
                JSON.stringify({ exportedAt: new Date().toISOString(), history }, null, 2),
                "application/json;charset=utf-8;",
              )
            }
            disabled={history.length === 0}
          >
            <Download size={15} />
            Export JSON
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No runs yet. Process an image to capture performance and output stats.</p>
        ) : (
          <ul className="plain-list">
            {history.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>{entry.fileName}</strong>
                  <span className="supporting-text">{new Date(entry.createdAt).toLocaleString("en-US")}</span>
                </div>
                <p className="supporting-text">
                  {formatBytes(entry.sourceBytes)} {"->"} {formatBytes(entry.outputBytes)} | {labelForMimeType(entry.outputMimeType)} |{" "}
                  {entry.model} | {(entry.durationMs / 1000).toFixed(1)}s
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type CropAspectPreset = "free" | "1:1" | "4:3" | "16:9" | "3:2";

const CROP_ASPECT_PRESETS: CropAspectPreset[] = ["free", "1:1", "4:3", "16:9", "3:2"];

const CROP_ASPECT_RATIO_MAP: Record<Exclude<CropAspectPreset, "free">, number> = {
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "3:2": 3 / 2,
};

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getCropAspectRatio(preset: CropAspectPreset): number | null {
  if (preset === "free") return null;
  return CROP_ASPECT_RATIO_MAP[preset];
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function clampCropRect(crop: CropRect, details: ImageDetails): CropRect {
  const width = clampInteger(crop.width, 1, details.width);
  const height = clampInteger(crop.height, 1, details.height);
  const x = clampInteger(crop.x, 0, Math.max(0, details.width - width));
  const y = clampInteger(crop.y, 0, Math.max(0, details.height - height));
  return { x, y, width, height };
}

function createCenteredCrop(details: ImageDetails, aspectRatio: number | null, fillRatio = 0.86): CropRect {
  const safeFill = Math.max(0.1, Math.min(1, fillRatio));
  let width = Math.max(1, Math.round(details.width * safeFill));
  let height = Math.max(1, Math.round(details.height * safeFill));

  if (aspectRatio && aspectRatio > 0) {
    let candidateHeight = Math.round(width / aspectRatio);
    if (candidateHeight > details.height * safeFill) {
      candidateHeight = Math.round(details.height * safeFill);
      width = Math.round(candidateHeight * aspectRatio);
    }
    height = Math.max(1, candidateHeight);
    if (height > details.height) {
      height = details.height;
      width = Math.max(1, Math.round(height * aspectRatio));
    }
    if (width > details.width) {
      width = details.width;
      height = Math.max(1, Math.round(width / aspectRatio));
    }
  }

  const x = Math.max(0, Math.round((details.width - width) / 2));
  const y = Math.max(0, Math.round((details.height - height) / 2));
  return clampCropRect({ x, y, width, height }, details);
}

function ImageCropperTool({ incomingFile }: { incomingFile?: ImageWorkflowIncomingFile | null }) {
  const sourceToolId: ImageToolId = "image-cropper";
  const workflowTargetOptions = getImageWorkflowTargetOptions(sourceToolId);
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceDetails, setSourceDetails] = useState<ImageDetails | null>(null);
  const [resultDetails, setResultDetails] = useState<OutputImageDetails | null>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [aspectPreset, setAspectPreset] = useState<CropAspectPreset>("free");
  const [lockAspect, setLockAspect] = useState(false);
  const [scalePercent, setScalePercent] = useState(100);
  const [outputMimeType, setOutputMimeType] = useState<OutputMimeType>("image/png");
  const [quality, setQuality] = useState(0.9);
  const [autoPreview, setAutoPreview] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState("Upload an image to crop.");

  const sourceUrlRef = useRef("");
  const resultUrlRef = useRef("");
  const runIdRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const incomingTokenRef = useRef("");
  const [workflowLibrary, setWorkflowLibrary] = useState<SavedImageWorkflow[]>([]);
  const [workflowRunHistory, setWorkflowRunHistory] = useState<ImageWorkflowRunHistoryEntry[]>([]);
  const [workflowName, setWorkflowName] = useState(() => `${getImageToolLabel(sourceToolId)} chain`);
  const [workflowTargets, setWorkflowTargets] = useState<(ImageToolId | "")[]>(
    () => createDefaultWorkflowTargets(sourceToolId),
  );
  const incomingRunContext = incomingFile?.runContext;

  const lossyOutput = outputMimeType === "image/jpeg" || outputMimeType === "image/webp";

  const savedWorkflows = useMemo(
    () => workflowLibrary.filter((workflow) => workflow.sourceToolId === sourceToolId),
    [sourceToolId, workflowLibrary],
  );

  const runHistory = useMemo(
    () =>
      workflowRunHistory
        .filter((entry) => entry.sourceToolId === sourceToolId)
        .slice(0, 12),
    [sourceToolId, workflowRunHistory],
  );

  const nextWorkflowStep = useMemo(
    () => getNextWorkflowStepContext(incomingRunContext, sourceToolId),
    [incomingRunContext, sourceToolId],
  );

  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

  useEffect(() => {
    setWorkflowLibrary(readImageWorkflowLibrary());
    setWorkflowRunHistory(readImageWorkflowRunHistory());
  }, []);

  const clearOutput = useCallback(() => {
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = "";
    }
    setResultDetails(null);
  }, []);

  const updateCropField = useCallback(
    (field: keyof CropRect, value: number) => {
      if (!sourceDetails) return;
      setCrop((current) => {
        const next: CropRect = { ...current, [field]: value };
        const ratio = lockAspect ? getCropAspectRatio(aspectPreset) : null;
        if (ratio && field === "width") next.height = Math.max(1, Math.round(next.width / ratio));
        if (ratio && field === "height") next.width = Math.max(1, Math.round(next.height * ratio));
        return clampCropRect(next, sourceDetails);
      });
      clearOutput();
    },
    [aspectPreset, clearOutput, lockAspect, sourceDetails],
  );

  const handleFile = useCallback(
    async (candidate: File | null) => {
      if (!candidate) return;
      if (!candidate.type.startsWith("image/")) {
        setStatus("Please upload a valid image.");
        return;
      }
      const objectUrl = URL.createObjectURL(candidate);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = objectUrl;
      setSourceUrl(objectUrl);
      setFile(candidate);
      clearOutput();
      try {
        const image = await loadImage(objectUrl);
        const details: ImageDetails = {
          filename: candidate.name,
          sizeBytes: candidate.size,
          mimeType: candidate.type || "image/png",
          width: image.width,
          height: image.height,
        };
        setSourceDetails(details);
        setCrop(createCenteredCrop(details, getCropAspectRatio(aspectPreset), 0.86));
        setStatus("Image loaded. Adjust crop settings.");
      } catch {
        setStatus("Could not read the image.");
      }
    },
    [aspectPreset, clearOutput],
  );

  useEffect(() => {
    if (!incomingFile || incomingTokenRef.current === incomingFile.token) return;
    incomingTokenRef.current = incomingFile.token;
    setStatus(`Workflow handoff received from ${incomingFile.sourceToolId}.`);
    void handleFile(incomingFile.file);
  }, [handleFile, incomingFile]);

  const processCrop = useCallback(
    async (trigger: "manual" | "auto") => {
      if (!file || !sourceDetails || !sourceUrl) return;
      const runId = ++runIdRef.current;
      setProcessing(true);
      try {
        const image = await loadImage(sourceUrl);
        if (runId !== runIdRef.current) return;
        const safeCrop = clampCropRect(crop, sourceDetails);
        const scaleFactor = Math.max(0.1, Math.min(3, scalePercent / 100));
        const outputWidth = Math.max(1, Math.round(safeCrop.width * scaleFactor));
        const outputHeight = Math.max(1, Math.round(safeCrop.height * scaleFactor));
        const canvas = document.createElement("canvas");
        canvas.width = outputWidth;
        canvas.height = outputHeight;
        const context = canvas.getContext("2d");
        if (!context) {
          setStatus("Canvas context unavailable.");
          return;
        }
        context.drawImage(image, safeCrop.x, safeCrop.y, safeCrop.width, safeCrop.height, 0, 0, outputWidth, outputHeight);
        const blob = await canvasToBlob(canvas, outputMimeType, lossyOutput ? quality : undefined);
        if (!blob) {
          setStatus("Failed to encode cropped output.");
          return;
        }
        const outputUrl = URL.createObjectURL(blob);
        if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
        resultUrlRef.current = outputUrl;
        const baseName = stripFileExtension(file.name) || "image";
        const downloadName = `${baseName}-cropped.${extensionFromMimeType(outputMimeType)}`;
        setResultDetails({
          url: outputUrl,
          downloadName,
          filename: downloadName,
          sizeBytes: blob.size,
          mimeType: outputMimeType,
          width: outputWidth,
          height: outputHeight,
        });
        setStatus(trigger === "auto" ? "Auto preview updated." : "Cropped output ready.");
        trackEvent("tool_image_crop", { outputType: outputMimeType, trigger, aspectPreset, scalePercent });
      } catch {
        setStatus("Cropping failed.");
      } finally {
        if (runId === runIdRef.current) setProcessing(false);
      }
    },
    [aspectPreset, crop, file, lossyOutput, outputMimeType, quality, scalePercent, sourceDetails, sourceUrl],
  );

  useEffect(() => {
    if (!autoPreview || !sourceDetails || !file) return;
    const timeout = setTimeout(() => {
      void processCrop("auto");
    }, 180);
    return () => clearTimeout(timeout);
  }, [autoPreview, crop, file, outputMimeType, processCrop, quality, scalePercent, sourceDetails]);

  const persistWorkflowLibrary = useCallback((nextLibrary: SavedImageWorkflow[]) => {
    setWorkflowLibrary(nextLibrary);
    writeImageWorkflowLibrary(nextLibrary);
  }, []);

  const persistWorkflowRunHistory = useCallback((nextHistory: ImageWorkflowRunHistoryEntry[]) => {
    setWorkflowRunHistory(nextHistory);
    writeImageWorkflowRunHistory(nextHistory);
  }, []);

  const canSendToWorkflowTool = useCallback(
    (targetToolId: ImageToolId): boolean => {
      if (!resultDetails) return false;
      if (targetToolId === "png-to-webp") return resultDetails.mimeType === "image/png";
      if (targetToolId === "jpg-to-png") return resultDetails.mimeType === "image/jpeg";
      return true;
    },
    [resultDetails],
  );

  const saveWorkflow = useCallback(() => {
    const normalizedName = sanitizeImageWorkflowName(workflowName);
    const steps = buildSavedWorkflowSteps(sourceToolId, workflowTargets);
    if (!normalizedName) {
      setStatus("Add a workflow name before saving.");
      return;
    }
    if (steps.length < 2) {
      setStatus("Choose at least one next tool for this workflow.");
      return;
    }

    const now = Date.now();
    const existing = workflowLibrary.find(
      (entry) => entry.sourceToolId === sourceToolId && entry.name.toLowerCase() === normalizedName.toLowerCase(),
    );

    const nextWorkflow: SavedImageWorkflow = existing
      ? {
          ...existing,
          steps,
          updatedAt: now,
        }
      : {
          id: crypto.randomUUID(),
          name: normalizedName,
          sourceToolId,
          steps,
          createdAt: now,
          updatedAt: now,
          runCount: 0,
          lastRunAt: null,
        };

    const nextLibrary = [nextWorkflow, ...workflowLibrary.filter((entry) => entry.id !== nextWorkflow.id)].slice(0, 60);
    persistWorkflowLibrary(nextLibrary);
    setStatus(`Workflow "${nextWorkflow.name}" saved.`);
    trackEvent("tool_workflow_save", { sourceToolId, steps: steps.length });
  }, [persistWorkflowLibrary, sourceToolId, workflowLibrary, workflowName, workflowTargets]);

  const deleteWorkflow = useCallback(
    (workflowId: string) => {
      const nextLibrary = workflowLibrary.filter((entry) => entry.id !== workflowId);
      persistWorkflowLibrary(nextLibrary);
      setStatus("Workflow removed.");
    },
    [persistWorkflowLibrary, workflowLibrary],
  );

  const markWorkflowRun = useCallback(
    (workflow: SavedImageWorkflow, runContext: ImageWorkflowRunContext) => {
      const now = Date.now();
      const nextLibrary = workflowLibrary.map((entry) =>
        entry.id === workflow.id
          ? {
              ...entry,
              runCount: entry.runCount + 1,
              lastRunAt: now,
              updatedAt: now,
            }
          : entry,
      );
      persistWorkflowLibrary(nextLibrary);

      const historyEntry: ImageWorkflowRunHistoryEntry = {
        id: crypto.randomUUID(),
        runId: runContext.runId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        sourceToolId: workflow.sourceToolId,
        steps: workflow.steps,
        createdAt: now,
      };
      const nextHistory = [historyEntry, ...workflowRunHistory].slice(0, IMAGE_WORKFLOW_RUN_HISTORY_LIMIT);
      persistWorkflowRunHistory(nextHistory);
    },
    [persistWorkflowLibrary, persistWorkflowRunHistory, workflowLibrary, workflowRunHistory],
  );

  const runSavedWorkflow = useCallback(
    async (workflow: SavedImageWorkflow) => {
      if (!resultDetails) return;
      if (workflow.steps.length < 2) {
        setStatus("This workflow has no next step.");
        return;
      }
      const targetToolId = workflow.steps[1];
      if (!canSendToWorkflowTool(targetToolId)) {
        setStatus(`Current output format cannot be sent to ${getImageToolLabel(targetToolId)}.`);
        return;
      }
      const runContext = createImageWorkflowRunContext(workflow, 1);
      setStatus(`Running workflow "${workflow.name}"...`);
      const ok = await handoffImageResultToTool({
        sourceToolId,
        targetToolId,
        fileName: resultDetails.downloadName,
        mimeType: resultDetails.mimeType,
        sourceUrl: resultDetails.url,
        runContext,
      });
      if (!ok) {
        setStatus("Could not start saved workflow.");
      } else {
        markWorkflowRun(workflow, runContext);
        trackEvent("tool_workflow_run", { sourceToolId, workflowId: workflow.id, steps: workflow.steps.length });
      }
    },
    [canSendToWorkflowTool, markWorkflowRun, resultDetails, sourceToolId],
  );

  const rerunWorkflowFromHistory = useCallback(
    async (entry: ImageWorkflowRunHistoryEntry) => {
      const libraryWorkflow = workflowLibrary.find((workflow) => workflow.id === entry.workflowId);
      const fallbackWorkflow: SavedImageWorkflow = {
        id: entry.workflowId,
        name: entry.workflowName,
        sourceToolId: entry.sourceToolId,
        steps: entry.steps,
        createdAt: entry.createdAt,
        updatedAt: entry.createdAt,
        runCount: 0,
        lastRunAt: null,
      };
      await runSavedWorkflow(libraryWorkflow ?? fallbackWorkflow);
    },
    [runSavedWorkflow, workflowLibrary],
  );

  const sendToWorkflowTool = useCallback(
    async (targetToolId: ImageToolId, runContext?: ImageWorkflowRunContext) => {
      if (!resultDetails) return;
      setStatus(`Sending output to ${getImageToolLabel(targetToolId)}...`);
      const ok = await handoffImageResultToTool({
        sourceToolId,
        targetToolId,
        fileName: resultDetails.downloadName,
        mimeType: resultDetails.mimeType,
        sourceUrl: resultDetails.url,
        ...(runContext ? { runContext } : {}),
      });
      if (!ok) {
        setStatus("Could not hand off this output to the next tool.");
      } else {
        trackEvent("tool_workflow_handoff", {
          sourceMode: "image-cropper",
          targetToolId,
          inWorkflowRun: Boolean(runContext),
        });
      }
    },
    [resultDetails, sourceToolId],
  );

  const continueWorkflowRun = useCallback(async () => {
    if (!nextWorkflowStep) return;
    if (!canSendToWorkflowTool(nextWorkflowStep.nextToolId)) {
      setStatus(`Current output format cannot be sent to ${getImageToolLabel(nextWorkflowStep.nextToolId)}.`);
      return;
    }
    await sendToWorkflowTool(nextWorkflowStep.nextToolId, nextWorkflowStep.nextRunContext);
  }, [canSendToWorkflowTool, nextWorkflowStep, sendToWorkflowTool]);

  return (
    <section className="tool-surface">
      <ToolHeading icon={MonitorUp} title="Image cropper" subtitle="Crop with ratio presets, precision controls, scaling, and instant downloads." />
      <label className="field">
        <span>Choose image</span>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void handleFile(event.target.files?.[0] ?? null)} />
      </label>
      <div className="chip-list">
        {CROP_ASPECT_PRESETS.map((preset) => (
          <button key={preset} className="chip-button" type="button" onClick={() => {
            setAspectPreset(preset);
            if (preset === "free") setLockAspect(false);
            if (sourceDetails && preset !== "free") {
              setLockAspect(true);
              setCrop(createCenteredCrop(sourceDetails, getCropAspectRatio(preset), 0.86));
            }
          }}>
            {preset}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <label className="field"><span>X</span><input type="number" value={crop.x} onChange={(event) => updateCropField("x", Number(event.target.value))} disabled={!sourceDetails} /></label>
        <label className="field"><span>Y</span><input type="number" value={crop.y} onChange={(event) => updateCropField("y", Number(event.target.value))} disabled={!sourceDetails} /></label>
        <label className="field"><span>Width</span><input type="number" value={crop.width} onChange={(event) => updateCropField("width", Number(event.target.value))} disabled={!sourceDetails} /></label>
        <label className="field"><span>Height</span><input type="number" value={crop.height} onChange={(event) => updateCropField("height", Number(event.target.value))} disabled={!sourceDetails} /></label>
        <label className="field"><span>Scale ({scalePercent}%)</span><input type="range" min={10} max={200} step={5} value={scalePercent} onChange={(event) => setScalePercent(Number(event.target.value))} /></label>
        <label className="field"><span>Format</span><select value={outputMimeType} onChange={(event) => setOutputMimeType(event.target.value as OutputMimeType)}><option value="image/png">PNG</option><option value="image/jpeg">JPEG</option><option value="image/webp">WebP</option></select></label>
      </div>
      {lossyOutput ? <label className="field"><span>Quality ({quality.toFixed(2)})</span><input type="range" min={0.1} max={1} step={0.05} value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label> : null}
      <div className="button-row">
        <label className="checkbox"><input type="checkbox" checked={lockAspect} onChange={(event) => setLockAspect(event.target.checked)} disabled={aspectPreset === "free"} />Lock aspect ratio</label>
        <label className="checkbox"><input type="checkbox" checked={autoPreview} onChange={(event) => setAutoPreview(event.target.checked)} />Auto preview</label>
        <button className="action-button" type="button" onClick={() => void processCrop("manual")} disabled={!sourceDetails || processing}>{processing ? "Cropping..." : "Crop now"}</button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <div className="image-compare-grid">
        <article className="image-card"><h3>Original</h3><div className="image-frame">{sourceUrl ? <NextImage src={sourceUrl} alt="Original crop source" width={sourceDetails?.width ?? 800} height={sourceDetails?.height ?? 600} style={{ width: "100%", height: "100%", objectFit: "contain" }} unoptimized /> : <p className="image-placeholder">Upload an image first.</p>}</div></article>
        <article className="image-card"><h3>Cropped</h3><div className="image-frame">{resultDetails ? <NextImage src={resultDetails.url} alt="Cropped output preview" width={resultDetails.width} height={resultDetails.height} style={{ width: "100%", height: "100%", objectFit: "contain" }} unoptimized /> : <p className="image-placeholder">Crop output appears here.</p>}</div></article>
      </div>
      {resultDetails ? (
        <>
          <a className="action-link" href={resultDetails.url} download={resultDetails.downloadName}>
            Download cropped {labelForMimeType(resultDetails.mimeType)}
          </a>
          <div className="button-row">
            <button className="action-button secondary" type="button" onClick={() => void sendToWorkflowTool("image-compressor")} disabled={processing}>
              Send to compressor
            </button>
            <button className="action-button secondary" type="button" onClick={() => void sendToWorkflowTool("png-to-webp")} disabled={processing || !canSendToWorkflowTool("png-to-webp")}>
              Send to PNG -&gt; WebP
            </button>
            <button className="action-button secondary" type="button" onClick={() => void sendToWorkflowTool("image-to-pdf")} disabled={processing}>
              Send to Image -&gt; PDF
            </button>
          </div>
          {nextWorkflowStep ? (
            <div className="button-row">
              <button
                className="action-button secondary"
                type="button"
                disabled={processing || !canSendToWorkflowTool(nextWorkflowStep.nextToolId)}
                onClick={() => {
                  void continueWorkflowRun();
                }}
              >
                Continue workflow -&gt; {getImageToolLabel(nextWorkflowStep.nextToolId)}
              </button>
            </div>
          ) : incomingRunContext && incomingRunContext.steps[incomingRunContext.currentStepIndex] === sourceToolId ? (
            <p className="supporting-text">
              Workflow &quot;{incomingRunContext.workflowName}&quot; completed at {getImageToolLabel(sourceToolId)}.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Workflow chaining</h3>
          <span className="supporting-text">Save reusable chains and rerun them in one click.</span>
        </div>
        <div className="field-grid">
          <label className="field">
            <span>Workflow name</span>
            <input
              type="text"
              value={workflowName}
              onChange={(event) => setWorkflowName(event.target.value)}
              placeholder={`${getImageToolLabel(sourceToolId)} chain`}
            />
          </label>
          {[0, 1, 2].map((index) => (
            <label key={index} className="field">
              <span>Step {index + 1}</span>
              <select
                value={workflowTargets[index]}
                onChange={(event) => {
                  const value = event.target.value as ImageToolId | "";
                  setWorkflowTargets((current) => {
                    const next = [...current];
                    next[index] = value;
                    return next as Array<ImageToolId | "">;
                  });
                }}
              >
                <option value="">None</option>
                {workflowTargetOptions.map((target) => (
                  <option key={target} value={target}>
                    {getImageToolLabel(target)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <div className="button-row">
          <button className="action-button secondary" type="button" onClick={saveWorkflow}>
            Save workflow
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => setWorkflowTargets(createDefaultWorkflowTargets(sourceToolId))}
          >
            Reset steps
          </button>
        </div>

        {savedWorkflows.length === 0 ? (
          <p className="supporting-text">No saved workflows for this tool yet.</p>
        ) : (
          <ul className="plain-list">
            {savedWorkflows.map((workflow) => (
              <li key={workflow.id}>
                <div className="history-line">
                  <strong>{workflow.name}</strong>
                  <span className="supporting-text">
                    {workflow.steps.map((step) => getImageToolLabel(step)).join(" -> ")} | Runs:{" "}
                    {formatNumericValue(workflow.runCount)}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    disabled={!resultDetails || processing}
                    onClick={() => {
                      void runSavedWorkflow(workflow);
                    }}
                  >
                    Run now
                  </button>
                  <button className="action-button secondary" type="button" onClick={() => deleteWorkflow(workflow.id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3>Run history</h3>
        {runHistory.length === 0 ? (
          <p className="supporting-text">No workflow runs yet for this tool.</p>
        ) : (
          <ul className="plain-list">
            {runHistory.map((entry) => (
              <li key={entry.id}>
                <div className="history-line">
                  <strong>{entry.workflowName}</strong>
                  <span className="supporting-text">
                    {entry.steps.map((step) => getImageToolLabel(step)).join(" -> ")} |{" "}
                    {new Date(entry.createdAt).toLocaleString("en-US")}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    disabled={!resultDetails || processing}
                    onClick={() => {
                      void rerunWorkflowFromHistory(entry);
                    }}
                  >
                    Re-run from history
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

type BarcodeFormat = "CODE128" | "CODE39" | "EAN13" | "EAN8" | "UPC" | "ITF14";

const BARCODE_FORMAT_OPTIONS: Array<{ value: BarcodeFormat; label: string; hint: string }> = [
  { value: "CODE128", label: "CODE128", hint: "General-purpose alphanumeric labels" },
  { value: "CODE39", label: "CODE39", hint: "Warehouse and logistics IDs" },
  { value: "EAN13", label: "EAN13", hint: "Retail products (13 digits)" },
  { value: "EAN8", label: "EAN8", hint: "Compact retail (8 digits)" },
  { value: "UPC", label: "UPC-A", hint: "North American retail labels" },
  { value: "ITF14", label: "ITF-14", hint: "Shipping carton identifiers" },
];

interface BarcodePreviewItem {
  id: string;
  value: string;
  dataUrl?: string;
  width?: number;
  height?: number;
  error?: string;
}

function sanitizeBarcodeFilePart(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "barcode";
}

function BarcodeGeneratorTool() {
  const [rawValues, setRawValues] = useState("UTILIORA-001");
  const [format, setFormat] = useState<BarcodeFormat>("CODE128");
  const [barWidth, setBarWidth] = useState(2);
  const [barHeight, setBarHeight] = useState(110);
  const [margin, setMargin] = useState(10);
  const [lineColor, setLineColor] = useState("#111111");
  const [background, setBackground] = useState("#ffffff");
  const [displayValue, setDisplayValue] = useState(true);
  const [fontSize, setFontSize] = useState(20);
  const [textMargin, setTextMargin] = useState(6);
  const [autoPreview, setAutoPreview] = useState(true);
  const [status, setStatus] = useState("Enter one value per line and generate barcodes.");
  const [items, setItems] = useState<BarcodePreviewItem[]>([]);

  const values = useMemo(() => splitNonEmptyLines(rawValues).slice(0, 25), [rawValues]);
  const successfulItems = useMemo(
    () => items.filter((item): item is BarcodePreviewItem & { dataUrl: string } => Boolean(item.dataUrl)),
    [items],
  );
  const firstItem = successfulItems[0];

  const generate = useCallback(
    (trigger: "manual" | "auto") => {
      if (!values.length) {
        setItems([]);
        setStatus("Add at least one value to generate.");
        return;
      }

      const nextItems = values.map((value, index) => {
        const canvas = document.createElement("canvas");
        try {
          JsBarcode(canvas, value, {
            format,
            width: Math.max(1, Math.min(6, Math.round(barWidth))),
            height: Math.max(40, Math.min(260, Math.round(barHeight))),
            margin: Math.max(0, Math.min(40, Math.round(margin))),
            lineColor,
            background,
            displayValue,
            fontSize: Math.max(8, Math.min(48, Math.round(fontSize))),
            textMargin: Math.max(0, Math.min(24, Math.round(textMargin))),
          });
          return {
            id: `${value}-${index}`,
            value,
            dataUrl: canvas.toDataURL("image/png"),
            width: canvas.width,
            height: canvas.height,
          } satisfies BarcodePreviewItem;
        } catch (error) {
          return {
            id: `${value}-${index}`,
            value,
            error: error instanceof Error ? error.message : "Invalid value for selected format.",
          } satisfies BarcodePreviewItem;
        }
      });

      const successCount = nextItems.filter((item) => item.dataUrl).length;
      setItems(nextItems);
      setStatus(`${successCount}/${nextItems.length} generated (${trigger} run).`);
      trackEvent("tool_barcode_generate", { format, count: nextItems.length, successes: successCount, trigger });
    },
    [background, barHeight, barWidth, displayValue, fontSize, format, lineColor, margin, textMargin, values],
  );

  useEffect(() => {
    if (!autoPreview) return;
    const timeout = setTimeout(() => generate("auto"), 220);
    return () => clearTimeout(timeout);
  }, [
    autoPreview,
    background,
    barHeight,
    barWidth,
    displayValue,
    fontSize,
    format,
    generate,
    lineColor,
    margin,
    rawValues,
    textMargin,
  ]);

  const exportCsv = () => {
    const rows = items.map((item) => [
      item.value,
      item.error ? "error" : "ok",
      item.width ? String(item.width) : "",
      item.height ? String(item.height) : "",
      item.error ?? "",
    ]);
    downloadCsv("barcode-report.csv", ["Value", "Status", "Width", "Height", "Error"], rows);
  };

  return (
    <section className="tool-surface">
      <ToolHeading icon={Hash} title="Barcode generator" subtitle="Generate multiple barcode formats with batch input, styling, and PNG export." />

      <label className="field">
        <span>Values (one per line, up to 25)</span>
        <textarea value={rawValues} onChange={(event) => setRawValues(event.target.value)} rows={5} />
      </label>

      <div className="field-grid">
        <label className="field"><span>Format</span><select value={format} onChange={(event) => setFormat(event.target.value as BarcodeFormat)}>{BARCODE_FORMAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} - {option.hint}</option>)}</select></label>
        <label className="field"><span>Bar width</span><input type="number" min={1} max={6} value={barWidth} onChange={(event) => setBarWidth(Number(event.target.value))} /></label>
        <label className="field"><span>Bar height</span><input type="number" min={40} max={260} value={barHeight} onChange={(event) => setBarHeight(Number(event.target.value))} /></label>
        <label className="field"><span>Margin</span><input type="number" min={0} max={40} value={margin} onChange={(event) => setMargin(Number(event.target.value))} /></label>
        <label className="field"><span>Line color</span><input type="color" value={lineColor} onChange={(event) => setLineColor(event.target.value)} /></label>
        <label className="field"><span>Background</span><input type="color" value={background} onChange={(event) => setBackground(event.target.value)} /></label>
        <label className="field"><span>Font size</span><input type="number" min={8} max={48} value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} /></label>
        <label className="field"><span>Text margin</span><input type="number" min={0} max={24} value={textMargin} onChange={(event) => setTextMargin(Number(event.target.value))} /></label>
      </div>

      <div className="button-row">
        <label className="checkbox"><input type="checkbox" checked={displayValue} onChange={(event) => setDisplayValue(event.target.checked)} />Show value text</label>
        <label className="checkbox"><input type="checkbox" checked={autoPreview} onChange={(event) => setAutoPreview(event.target.checked)} />Auto preview</label>
      </div>

      <div className="button-row">
        <button className="action-button" type="button" onClick={() => generate("manual")}>Generate barcodes</button>
        <button className="action-button secondary" type="button" onClick={exportCsv} disabled={!items.length}><Download size={15} />Export CSV</button>
        <button className="action-button secondary" type="button" disabled={!firstItem} onClick={() => {
          if (!firstItem) return;
          downloadDataUrl(`${sanitizeBarcodeFilePart(firstItem.value)}-${format.toLowerCase()}.png`, firstItem.dataUrl);
        }}><Download size={15} />Download first</button>
        <button className="action-button secondary" type="button" disabled={!successfulItems.length} onClick={() => {
          successfulItems.forEach((item, index) => {
            setTimeout(() => {
              downloadDataUrl(`${sanitizeBarcodeFilePart(item.value)}-${format.toLowerCase()}-${index + 1}.png`, item.dataUrl);
            }, index * 120);
          });
        }}><Download size={15} />Download all</button>
      </div>

      {status ? <p className="supporting-text">{status}</p> : null}
      <ResultList rows={[{ label: "Input rows", value: formatNumericValue(values.length) }, { label: "Generated", value: formatNumericValue(successfulItems.length) }, { label: "Failed", value: formatNumericValue(items.length - successfulItems.length) }, { label: "Format", value: format }]} />

      {items.length ? (
        <div className="image-compare-grid">
          {items.map((item) => (
            <article key={item.id} className="image-card">
              <h3>{item.value}</h3>
              <div className="image-frame">
                {item.dataUrl ? (
                  <NextImage
                    src={item.dataUrl}
                    alt={`Barcode preview for ${item.value}`}
                    width={item.width ?? 640}
                    height={item.height ?? 220}
                    style={{ width: "100%", height: "100%", objectFit: "contain" }}
                    unoptimized
                  />
                ) : (
                  <p className="image-placeholder">Generation failed</p>
                )}
              </div>
              {item.error ? <p className="error-text">{item.error}</p> : null}
              {item.dataUrl ? <button className="action-button secondary" type="button" onClick={() => downloadDataUrl(`${sanitizeBarcodeFilePart(item.value)}-${format.toLowerCase()}.png`, item.dataUrl ?? "")}>Download</button> : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

type PdfPageSizePreset = "a4" | "letter" | "legal" | "fit-image";
type PdfImageEncoding = "jpeg" | "png";
type PageSelectionPreset = "all" | "first-5" | "first-10";

interface ImageToPdfItem {
  id: string;
  file: File;
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
}

interface PdfJpgPagePreview {
  pageNumber: number;
  width: number;
  height: number;
  dataUrl: string;
  estimatedBytes: number;
}

interface PdfJsPageViewport {
  width: number;
  height: number;
}

interface PdfJsTextItem {
  str?: string;
  hasEOL?: boolean;
}

interface PdfJsTextContent {
  items: PdfJsTextItem[];
}

interface PdfJsPage {
  getViewport(params: { scale: number }): PdfJsPageViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfJsPageViewport;
  }): { promise: Promise<void> };
  getTextContent?: () => Promise<PdfJsTextContent>;
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  destroy?: () => Promise<void> | void;
}

interface PdfJsLoadingTask {
  promise: Promise<PdfJsDocument>;
  destroy?: () => Promise<void> | void;
}

interface PdfJsModule {
  version?: string;
  getDocument(params: {
    data: Uint8Array | ArrayBuffer;
    disableWorker?: boolean;
    stopAtErrors?: boolean;
    [key: string]: unknown;
  }): PdfJsLoadingTask;
  GlobalWorkerOptions?: {
    workerSrc: string;
  };
}

const PDF_PAGE_SIZE_PRESETS: Record<
  Exclude<PdfPageSizePreset, "fit-image">,
  { label: string; sizeMm: [number, number] }
> = {
  a4: { label: "A4", sizeMm: [210, 297] },
  letter: { label: "US Letter", sizeMm: [215.9, 279.4] },
  legal: { label: "US Legal", sizeMm: [215.9, 355.6] },
};

const PAGE_SELECTION_PRESETS: Array<{ value: PageSelectionPreset; label: string; hint: string }> = [
  { value: "all", label: "All pages", hint: "Convert every page from the PDF" },
  { value: "first-5", label: "First 5 pages", hint: "Quick preview for long PDFs" },
  { value: "first-10", label: "First 10 pages", hint: "Balanced speed + coverage" },
];

let pdfJsModulePromise: Promise<PdfJsModule> | null = null;
let pdfJsWorkerConfigured = false;
let pdfJsWorkerSourceCandidates: string[] = [];
let pdfJsActiveWorkerSourceIndex = 0;

function ensurePromiseWithResolversPolyfill(): void {
  const promiseCtor = Promise as PromiseConstructor & {
    withResolvers?: <T>() => {
      promise: Promise<T>;
      resolve: (value: T | PromiseLike<T>) => void;
      reject: (reason?: unknown) => void;
    };
  };
  if (typeof promiseCtor.withResolvers === "function") {
    return;
  }

  promiseCtor.withResolvers = function withResolvers<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

function getPdfJsWorkerSourceCandidates(version: string): string[] {
  return [
    "/api/pdfjs-worker",
    `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`,
    `https://unpkg.com/pdfjs-dist@${version}/legacy/build/pdf.worker.min.mjs`,
  ];
}

function assignPdfJsWorkerSource(pdfjs: PdfJsModule, sourceIndex: number): boolean {
  if (!pdfjs.GlobalWorkerOptions) {
    return false;
  }
  const source = pdfJsWorkerSourceCandidates[sourceIndex];
  if (!source) {
    return false;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = source;
  pdfJsActiveWorkerSourceIndex = sourceIndex;
  return true;
}

function configurePdfJsWorker(pdfjs: PdfJsModule): void {
  if (!pdfjs.GlobalWorkerOptions) {
    return;
  }

  if (pdfJsWorkerConfigured) {
    return;
  }

  const version = typeof pdfjs.version === "string" && pdfjs.version ? pdfjs.version : "5.4.624";
  pdfJsWorkerSourceCandidates = getPdfJsWorkerSourceCandidates(version);
  pdfJsActiveWorkerSourceIndex = 0;
  assignPdfJsWorkerSource(pdfjs, pdfJsActiveWorkerSourceIndex);
  pdfJsWorkerConfigured = true;
}

function advancePdfJsWorkerSource(pdfjs: PdfJsModule): boolean {
  if (!pdfjs.GlobalWorkerOptions) {
    return false;
  }
  const nextIndex = pdfJsActiveWorkerSourceIndex + 1;
  if (nextIndex >= pdfJsWorkerSourceCandidates.length) {
    return false;
  }
  return assignPdfJsWorkerSource(pdfjs, nextIndex);
}

function estimateBytesFromDataUrl(dataUrl: string): number {
  const base64Payload = dataUrl.split(",")[1] ?? "";
  return Math.max(0, Math.floor((base64Payload.length * 3) / 4));
}

async function renderImageFileForPdf(
  file: File,
  encoding: PdfImageEncoding,
  quality: number,
): Promise<{ dataUrl: string; width: number; height: number; format: "JPEG" | "PNG" }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context unavailable.");
    }

    if (encoding === "jpeg") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0);

    if (encoding === "jpeg") {
      return {
        dataUrl: canvas.toDataURL("image/jpeg", Math.max(0.1, Math.min(1, quality))),
        width: image.width,
        height: image.height,
        format: "JPEG",
      };
    }

    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: image.width,
      height: image.height,
      format: "PNG",
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function resolvePdfPageSizeMm(
  pagePreset: PdfPageSizePreset,
  width: number,
  height: number,
  fitDpi: number,
): [number, number] {
  if (pagePreset !== "fit-image") {
    return PDF_PAGE_SIZE_PRESETS[pagePreset].sizeMm;
  }

  const dpi = Math.max(72, Math.min(300, fitDpi));
  const mmPerPixel = 25.4 / dpi;
  const widthMm = Math.max(30, Math.min(1200, width * mmPerPixel));
  const heightMm = Math.max(30, Math.min(1200, height * mmPerPixel));
  return [widthMm, heightMm];
}

function applyGrayscaleToCanvas(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const gray = Math.round(
      pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114,
    );
    pixels[index] = gray;
    pixels[index + 1] = gray;
    pixels[index + 2] = gray;
  }
  context.putImageData(imageData, 0, 0);
}

function extractPdfTextLines(items: PdfJsTextItem[]): string[] {
  const lines: string[] = [];
  let currentLine = "";

  for (const item of items) {
    const text = typeof item?.str === "string" ? item.str.trim() : "";
    if (text) {
      if (!currentLine) {
        currentLine = text;
      } else if (/^[,.;:!?)]/.test(text)) {
        currentLine = `${currentLine}${text}`;
      } else {
        currentLine = `${currentLine} ${text}`;
      }
    }

    if (item?.hasEOL && currentLine) {
      lines.push(currentLine.trim());
      currentLine = "";
    }
  }

  if (currentLine) {
    lines.push(currentLine.trim());
  }

  return lines;
}

function parsePageRangeInput(input: string, totalPages: number): number[] | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.toLowerCase() === "all") {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>();
  const chunks = trimmed.split(",");
  for (const rawChunk of chunks) {
    const chunk = rawChunk.trim();
    if (!chunk) continue;

    if (chunk.includes("-")) {
      const [startPart, endPart] = chunk.split("-").map((part) => Number.parseInt(part.trim(), 10));
      if (!Number.isFinite(startPart) || !Number.isFinite(endPart)) return null;
      if (startPart < 1 || endPart < 1 || startPart > endPart) return null;
      if (startPart > totalPages) return null;
      const boundedEnd = Math.min(totalPages, endPart);
      for (let page = startPart; page <= boundedEnd; page += 1) {
        pages.add(page);
      }
      continue;
    }

    const page = Number.parseInt(chunk, 10);
    if (!Number.isFinite(page) || page < 1 || page > totalPages) return null;
    pages.add(page);
  }

  return Array.from(pages).sort((a, b) => a - b);
}

function buildPageRangeFromPreset(preset: PageSelectionPreset): string {
  if (preset === "first-5") return "1-5";
  if (preset === "first-10") return "1-10";
  return "all";
}

async function loadPdfJsModule(): Promise<PdfJsModule> {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = (async () => {
      ensurePromiseWithResolversPolyfill();
      const pdfJsModule = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;
      configurePdfJsWorker(pdfJsModule);
      return pdfJsModule;
    })();
  }
  return pdfJsModulePromise;
}

async function readPdfFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

async function closePdfDocumentResources(
  loadingTask: PdfJsLoadingTask | null,
  pdfDocument: PdfJsDocument | null,
): Promise<void> {
  if (pdfDocument?.destroy) {
    try {
      await pdfDocument.destroy();
    } catch {
      // Ignore PDF resource cleanup failures.
    }
  }
  if (loadingTask?.destroy) {
    try {
      await loadingTask.destroy();
    } catch {
      // Ignore PDF loading task cleanup failures.
    }
  }
}

async function openPdfDocumentWithFallback(
  pdfjs: PdfJsModule,
  bytes: Uint8Array,
): Promise<{ loadingTask: PdfJsLoadingTask; pdfDocument: PdfJsDocument }> {
  const attempts: Array<Record<string, unknown>> = [
    { stopAtErrors: false, disableStream: true, disableAutoFetch: true },
    { stopAtErrors: false },
    { stopAtErrors: true },
  ];
  let lastError: unknown = null;
  const sourceAttempts = Math.max(1, pdfJsWorkerSourceCandidates.length);

  for (let sourceAttempt = 0; sourceAttempt < sourceAttempts; sourceAttempt += 1) {
    for (const options of attempts) {
      const loadingTask = pdfjs.getDocument({
        data: bytes.slice(),
        ...options,
      });
      try {
        const pdfDocument = await loadingTask.promise;
        return { loadingTask, pdfDocument };
      } catch (error) {
        lastError = error;
        if (loadingTask.destroy) {
          try {
            await loadingTask.destroy();
          } catch {
            // Ignore failed fallback cleanup.
          }
        }
      }
    }
    if (!advancePdfJsWorkerSource(pdfjs)) {
      break;
    }
  }

  throw lastError ?? new Error("Unable to open PDF document.");
}

async function loadJsZipModule() {
  const jsZipModule = await import("jszip");
  return jsZipModule.default;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&#x0*[dD];/g, "")
    .replace(/&#x0*[aA];/g, "\n")
    .replace(/&#13;/g, "")
    .replace(/&#10;/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function normalizeDocumentText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTextFromHtmlMarkup(markup: string): string {
  if (typeof DOMParser === "undefined") {
    return normalizeDocumentText(decodeBasicHtmlEntities(stripTagsFromMarkup(markup)));
  }
  const parser = new DOMParser();
  const documentNode = parser.parseFromString(markup, "text/html");
  const blockNodes = Array.from(documentNode.body.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,tr,blockquote,pre,div"));
  if (!blockNodes.length) {
    return normalizeDocumentText(documentNode.body.textContent ?? "");
  }

  const lines = blockNodes
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean);
  return normalizeDocumentText(lines.join("\n"));
}

async function extractTextFromDocx(file: File): Promise<string> {
  const JSZip = await loadJsZipModule();
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("Could not locate word/document.xml in DOCX.");
  }

  let documentXml = await documentXmlFile.async("string");
  documentXml = documentXml
    .replace(/<w:tab\/>/g, "\t")
    .replace(/<w:br\/>/g, "\n")
    .replace(/<w:cr\/>/g, "\n");

  const rawParagraphs = documentXml.split("</w:p>");
  const paragraphs: string[] = [];
  for (const rawParagraph of rawParagraphs) {
    const matches = Array.from(rawParagraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g));
    const text = matches.map((match) => decodeXmlEntities(match[1] ?? "")).join("");
    const normalized = normalizeDocumentText(text);
    if (normalized) {
      paragraphs.push(normalized);
    }
  }

  return normalizeDocumentText(paragraphs.join("\n\n"));
}

async function extractTextFromDocumentFile(file: File): Promise<{ text: string; source: string }> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".docx")) {
    const docxText = await extractTextFromDocx(file);
    return { text: docxText, source: "DOCX" };
  }

  const rawText = await file.text();
  const looksLikeHtml = /<\s*html|<\s*body|<\s*p|<\s*div/i.test(rawText);
  if (lowerName.endsWith(".doc") || lowerName.endsWith(".html") || lowerName.endsWith(".htm") || looksLikeHtml) {
    return { text: extractTextFromHtmlMarkup(rawText), source: lowerName.endsWith(".doc") ? "DOC (HTML)" : "HTML" };
  }

  return { text: normalizeDocumentText(rawText), source: "Text" };
}

interface PdfDocumentTextExtractionOptions {
  pageRangeInput?: string;
  maxPages?: number;
  includePageMarkers?: boolean;
  onProgress?: (options: { processed: number; total: number; pageNumber: number }) => void;
}

interface PdfDocumentTextExtractionResult {
  text: string;
  totalPages: number;
  selectedPages: number[];
}

async function extractTextFromPdfDocument(
  file: File,
  options: PdfDocumentTextExtractionOptions = {},
): Promise<PdfDocumentTextExtractionResult> {
  let loadingTask: PdfJsLoadingTask | null = null;
  let pdfDocument: PdfJsDocument | null = null;
  try {
    const pdfjs = await loadPdfJsModule();
    const bytes = await readPdfFileBytes(file);
    const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
    loadingTask = opened.loadingTask;
    pdfDocument = opened.pdfDocument;
    const totalPages = pdfDocument.numPages;

    const rawSelectedPages = parsePageRangeInput(options.pageRangeInput ?? "all", totalPages);
    if (!rawSelectedPages?.length) {
      throw new Error("Invalid page range.");
    }
    const safeMaxPages = Math.max(1, Math.min(300, Math.round(options.maxPages ?? 120)));
    const selectedPages = rawSelectedPages.slice(0, safeMaxPages);
    if (!selectedPages.length) {
      throw new Error("No pages selected.");
    }

    const includePageMarkers = options.includePageMarkers ?? true;
    const sections: string[] = [];

    for (let index = 0; index < selectedPages.length; index += 1) {
      const pageNumber = selectedPages[index];
      const page = await pdfDocument.getPage(pageNumber);
      const textContent = page.getTextContent ? await page.getTextContent() : null;
      const items = textContent && Array.isArray(textContent.items) ? textContent.items : [];
      const lines = extractPdfTextLines(items as PdfJsTextItem[]);
      const content = lines.length ? lines.join("\n") : "[No extractable text on this page]";
      sections.push(includePageMarkers ? `Page ${pageNumber}\n${content}` : content);
      options.onProgress?.({
        processed: index + 1,
        total: selectedPages.length,
        pageNumber,
      });
    }

    return {
      text: normalizeDocumentText(sections.join("\n\n")),
      totalPages,
      selectedPages,
    };
  } finally {
    await closePdfDocumentResources(loadingTask, pdfDocument);
  }
}

function ImageToPdfTool({ incomingFile }: { incomingFile?: ImageWorkflowIncomingFile | null }) {
  const [items, setItems] = useState<ImageToPdfItem[]>([]);
  const [pdfName, setPdfName] = useState("utiliora-images");
  const [pagePreset, setPagePreset] = useState<PdfPageSizePreset>("a4");
  const [marginMm, setMarginMm] = useState(10);
  const [fitDpi, setFitDpi] = useState(150);
  const [encoding, setEncoding] = useState<PdfImageEncoding>("jpeg");
  const [quality, setQuality] = useState(0.9);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload one or more images to generate a PDF.");
  const [lastPdfSizeBytes, setLastPdfSizeBytes] = useState<number | null>(null);
  const [lastGeneratedPages, setLastGeneratedPages] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<ImageToPdfItem[]>([]);
  const incomingTokenRef = useRef("");

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

  const addFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const candidates = files.filter((file) => file.type.startsWith("image/"));
    if (!candidates.length) {
      setStatus("Please select image files only.");
      return;
    }

    setStatus(`Reading ${candidates.length} image${candidates.length > 1 ? "s" : ""}...`);
    const nextItems: ImageToPdfItem[] = [];
    for (let index = 0; index < candidates.length; index += 1) {
      const file = candidates[index];
      const objectUrl = URL.createObjectURL(file);
      try {
        const image = await loadImage(objectUrl);
        nextItems.push({
          id: `${Date.now()}-${index}-${file.name}`,
          file,
          url: objectUrl,
          width: image.width,
          height: image.height,
          sizeBytes: file.size,
        });
      } catch {
        URL.revokeObjectURL(objectUrl);
      }
    }

    if (!nextItems.length) {
      setStatus("No readable images were found in your selection.");
      return;
    }

    setItems((previous) => [...previous, ...nextItems].slice(0, 60));
    setStatus(`Loaded ${nextItems.length} image${nextItems.length > 1 ? "s" : ""}.`);
    trackEvent("tool_image_to_pdf_upload", { count: nextItems.length });
  }, []);

  const handleSelectedFiles = useCallback(
    async (list: FileList | null) => {
      if (!list?.length) return;
      await addFiles(Array.from(list));
    },
    [addFiles],
  );

  useEffect(() => {
    if (!incomingFile || incomingTokenRef.current === incomingFile.token) return;
    incomingTokenRef.current = incomingFile.token;
    setStatus(`Workflow handoff received from ${incomingFile.sourceToolId}.`);
    void addFiles([incomingFile.file]);
  }, [addFiles, incomingFile]);

  const clearAll = useCallback(() => {
    setItems((previous) => {
      previous.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
    setLastGeneratedPages(0);
    setLastPdfSizeBytes(null);
    setProgress(0);
    setStatus("Cleared. Upload images to start again.");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((previous) => {
      const target = previous.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return previous.filter((item) => item.id !== id);
    });
  }, []);

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    setItems((previous) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= previous.length) return previous;
      const clone = [...previous];
      const [moved] = clone.splice(index, 1);
      clone.splice(nextIndex, 0, moved);
      return clone;
    });
  }, []);

  const generatePdf = useCallback(async () => {
    if (!items.length) {
      setStatus("Add at least one image before generating.");
      return;
    }

    setProcessing(true);
    setProgress(5);
    setStatus("Preparing PDF document...");

    try {
      const { jsPDF } = await import("jspdf");
      const firstItem = items[0];
      const firstPageSize = resolvePdfPageSizeMm(pagePreset, firstItem.width, firstItem.height, fitDpi);
      const firstLandscape = firstItem.width > firstItem.height;
      const firstFormat: [number, number] = firstLandscape
        ? [firstPageSize[1], firstPageSize[0]]
        : firstPageSize;

      const pdfDocument = new jsPDF({
        unit: "mm",
        format: firstFormat,
        compress: true,
      });

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const pageSize = resolvePdfPageSizeMm(pagePreset, item.width, item.height, fitDpi);
        const useLandscape = item.width > item.height;
        const format: [number, number] = useLandscape ? [pageSize[1], pageSize[0]] : pageSize;
        if (index > 0) {
          pdfDocument.addPage(format);
        } else {
          const current = pdfDocument.internal.pageSize;
          if (
            Math.abs(current.getWidth() - format[0]) > 0.01 ||
            Math.abs(current.getHeight() - format[1]) > 0.01
          ) {
            pdfDocument.deletePage(1);
            pdfDocument.addPage(format);
            pdfDocument.setPage(1);
          }
        }

        setStatus(`Rendering image ${index + 1}/${items.length}...`);
        setProgress(Math.round((index / Math.max(1, items.length)) * 70) + 10);

        const rendered = await renderImageFileForPdf(item.file, encoding, quality);
        const pageWidth = pdfDocument.internal.pageSize.getWidth();
        const pageHeight = pdfDocument.internal.pageSize.getHeight();
        const safeMargin = Math.max(0, Math.min(30, marginMm));
        const drawAreaWidth = Math.max(10, pageWidth - safeMargin * 2);
        const drawAreaHeight = Math.max(10, pageHeight - safeMargin * 2);
        const widthRatio = drawAreaWidth / rendered.width;
        const heightRatio = drawAreaHeight / rendered.height;
        const scale = Math.min(widthRatio, heightRatio);
        const drawWidth = rendered.width * scale;
        const drawHeight = rendered.height * scale;
        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;

        pdfDocument.addImage(
          rendered.dataUrl,
          rendered.format,
          x,
          y,
          drawWidth,
          drawHeight,
          undefined,
          "FAST",
        );
      }

      setStatus("Finalizing PDF file...");
      setProgress(92);
      const outputBlob = pdfDocument.output("blob");
      const baseName = stripFileExtension(pdfName.trim()) || "images";
      const filename = `${baseName}.pdf`;
      const outputUrl = URL.createObjectURL(outputBlob);
      const anchor = document.createElement("a");
      anchor.href = outputUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(outputUrl);

      setProgress(100);
      setLastGeneratedPages(items.length);
      setLastPdfSizeBytes(outputBlob.size);
      setStatus(`PDF ready: ${filename} (${formatBytes(outputBlob.size)}).`);
      trackEvent("tool_image_to_pdf_generate", {
        pages: items.length,
        pagePreset,
        encoding,
      });
    } catch {
      setStatus("PDF generation failed. Try fewer or smaller images.");
    } finally {
      setProcessing(false);
    }
  }, [encoding, fitDpi, items, marginMm, pagePreset, pdfName, quality]);

  const totalInputBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.sizeBytes, 0),
    [items],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="Image to PDF converter"
        subtitle="Combine many images into one PDF with page-size controls, margins, and order management."
      />

      <label className="field">
        <span>Upload images (JPG, PNG, WebP)</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          onChange={(event) => {
            void handleSelectedFiles(event.target.files);
          }}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>PDF filename</span>
          <input type="text" value={pdfName} onChange={(event) => setPdfName(event.target.value)} />
        </label>
        <label className="field">
          <span>Page size</span>
          <select value={pagePreset} onChange={(event) => setPagePreset(event.target.value as PdfPageSizePreset)}>
            <option value="a4">A4</option>
            <option value="letter">US Letter</option>
            <option value="legal">US Legal</option>
            <option value="fit-image">Match each image size</option>
          </select>
        </label>
        <label className="field">
          <span>Margin ({marginMm} mm)</span>
          <input
            type="range"
            min={0}
            max={30}
            step={1}
            value={marginMm}
            onChange={(event) => setMarginMm(Number(event.target.value))}
          />
        </label>
        {pagePreset === "fit-image" ? (
          <label className="field">
            <span>Fit DPI ({fitDpi})</span>
            <input
              type="range"
              min={72}
              max={300}
              step={2}
              value={fitDpi}
              onChange={(event) => setFitDpi(Number(event.target.value))}
            />
            <small className="supporting-text">Higher DPI creates physically smaller pages.</small>
          </label>
        ) : null}
        <label className="field">
          <span>Embed format</span>
          <select value={encoding} onChange={(event) => setEncoding(event.target.value as PdfImageEncoding)}>
            <option value="jpeg">JPEG (smaller files)</option>
            <option value="png">PNG (lossless)</option>
          </select>
        </label>
        {encoding === "jpeg" ? (
          <label className="field">
            <span>JPEG quality ({quality.toFixed(2)})</span>
            <input
              type="range"
              min={0.4}
              max={1}
              step={0.02}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
            />
          </label>
        ) : null}
      </div>

      <div className="button-row">
        <button className="action-button" type="button" disabled={!items.length || processing} onClick={() => void generatePdf()}>
          {processing ? "Generating PDF..." : "Generate PDF"}
        </button>
        <button className="action-button secondary" type="button" onClick={clearAll} disabled={!items.length || processing}>
          <Trash2 size={15} />
          Clear images
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "Images loaded", value: formatNumericValue(items.length) },
          { label: "Total input size", value: formatBytes(totalInputBytes) },
          {
            label: "Page size mode",
            value: pagePreset === "fit-image" ? "Match image size" : PDF_PAGE_SIZE_PRESETS[pagePreset].label,
          },
          { label: "Last PDF pages", value: lastGeneratedPages ? formatNumericValue(lastGeneratedPages) : "-" },
          { label: "Last PDF size", value: lastPdfSizeBytes ? formatBytes(lastPdfSizeBytes) : "-" },
        ]}
      />

      {items.length ? (
        <div className="image-compare-grid">
          {items.map((item, index) => (
            <article key={item.id} className="image-card">
              <h3>
                {index + 1}. {item.file.name}
              </h3>
              <div className="image-frame">
                <NextImage
                  src={item.url}
                  alt={`Source image ${item.file.name}`}
                  width={item.width}
                  height={item.height}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  unoptimized
                />
              </div>
              <dl className="image-meta">
                <div>
                  <dt>Dimensions</dt>
                  <dd>
                    {item.width} x {item.height}
                  </dd>
                </div>
                <div>
                  <dt>File size</dt>
                  <dd>{formatBytes(item.sizeBytes)}</dd>
                </div>
              </dl>
              <div className="button-row">
                <button className="action-button secondary" type="button" onClick={() => moveItem(index, -1)} disabled={index === 0 || processing}>
                  Move up
                </button>
                <button
                  className="action-button secondary"
                  type="button"
                  onClick={() => moveItem(index, 1)}
                  disabled={index === items.length - 1 || processing}
                >
                  Move down
                </button>
                <button className="action-button secondary" type="button" onClick={() => removeItem(item.id)} disabled={processing}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

interface PdfMergeItem {
  id: string;
  file: File;
  pageCount: number | null;
  sizeBytes: number;
}

function PdfMergeTool() {
  const [items, setItems] = useState<PdfMergeItem[]>([]);
  const [outputName, setOutputName] = useState("merged-document");
  const [renderScalePercent, setRenderScalePercent] = useState(140);
  const [jpegQuality, setJpegQuality] = useState(0.86);
  const [fitDpi, setFitDpi] = useState(150);
  const [maxPages, setMaxPages] = useState(160);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload two or more PDFs to merge.");
  const [lastOutputSize, setLastOutputSize] = useState<number | null>(null);
  const [lastOutputPages, setLastOutputPages] = useState(0);

  const inspectPdfPageCount = useCallback(async (file: File): Promise<number | null> => {
    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    try {
      const pdfjs = await loadPdfJsModule();
      const bytes = await readPdfFileBytes(file);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;
      return pdfDocument.numPages;
    } catch {
      return null;
    } finally {
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, []);

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      const pdfFiles = files.filter(
        (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
      );
      if (!pdfFiles.length) {
        setStatus("Please select valid PDF files.");
        return;
      }

      setStatus(`Reading ${pdfFiles.length} PDF file${pdfFiles.length > 1 ? "s" : ""}...`);
      const nextItems: PdfMergeItem[] = [];
      for (let index = 0; index < pdfFiles.length; index += 1) {
        const file = pdfFiles[index];
        const pageCount = await inspectPdfPageCount(file);
        nextItems.push({
          id: `${Date.now()}-${index}-${file.name}`,
          file,
          pageCount,
          sizeBytes: file.size,
        });
      }

      setItems((current) => [...current, ...nextItems].slice(0, 40));
      setStatus(`Loaded ${nextItems.length} PDF file${nextItems.length > 1 ? "s" : ""}.`);
      trackEvent("tool_pdf_merge_upload", { count: nextItems.length });
    },
    [inspectPdfPageCount],
  );

  const handleFileInput = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList?.length) return;
      await addFiles(Array.from(fileList));
    },
    [addFiles],
  );

  const moveItem = useCallback((index: number, direction: -1 | 1) => {
    setItems((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const clone = [...current];
      const [moved] = clone.splice(index, 1);
      clone.splice(nextIndex, 0, moved);
      return clone;
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
    setProgress(0);
    setLastOutputPages(0);
    setLastOutputSize(null);
    setStatus("Cleared PDF queue.");
  }, []);

  const totalInputBytes = useMemo(
    () => items.reduce((sum, item) => sum + item.sizeBytes, 0),
    [items],
  );
  const estimatedSourcePages = useMemo(
    () => items.reduce((sum, item) => sum + Math.max(0, item.pageCount ?? 0), 0),
    [items],
  );

  const mergePdfs = useCallback(async () => {
    if (!items.length) {
      setStatus("Add at least one PDF file.");
      return;
    }

    setProcessing(true);
    setProgress(4);
    setStatus("Preparing PDF merge...");
    const startedAt = Date.now();

    let totalProcessedPages = 0;
    let output: JsPdfType | null = null;

    try {
      const pdfjs = await loadPdfJsModule();
      const { jsPDF } = await import("jspdf");
      const safeScale = Math.max(80, Math.min(260, renderScalePercent)) / 100;
      const safeQuality = Math.max(0.5, Math.min(1, jpegQuality));
      const safeMaxPages = Math.max(1, Math.min(500, Math.round(maxPages)));
      const estimatedWorkPages = Math.max(1, Math.min(safeMaxPages, estimatedSourcePages || safeMaxPages));

      let reachedLimit = false;

      for (let fileIndex = 0; fileIndex < items.length; fileIndex += 1) {
        const item = items[fileIndex];
        let loadingTask: PdfJsLoadingTask | null = null;
        let pdfDocument: PdfJsDocument | null = null;
        try {
          setStatus(`Reading ${item.file.name} (${fileIndex + 1}/${items.length})...`);
          const bytes = await readPdfFileBytes(item.file);
          const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
          loadingTask = opened.loadingTask;
          pdfDocument = opened.pdfDocument;
          const pages = pdfDocument.numPages;

          for (let pageNumber = 1; pageNumber <= pages; pageNumber += 1) {
            if (totalProcessedPages >= safeMaxPages) {
              reachedLimit = true;
              break;
            }

            setStatus(
              `Merging ${item.file.name} page ${pageNumber}/${pages} (${totalProcessedPages + 1}/${safeMaxPages})...`,
            );
            const page = await pdfDocument.getPage(pageNumber);
            const viewport = page.getViewport({ scale: safeScale });
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.floor(viewport.width));
            canvas.height = Math.max(1, Math.floor(viewport.height));
            const context = canvas.getContext("2d");
            if (!context) {
              throw new Error("Canvas context unavailable.");
            }
            await page.render({ canvasContext: context, viewport }).promise;

            const pageSizeMm = resolvePdfPageSizeMm("fit-image", canvas.width, canvas.height, fitDpi);
            const landscape = canvas.width > canvas.height;
            const pageFormat: [number, number] = landscape ? [pageSizeMm[1], pageSizeMm[0]] : pageSizeMm;
            if (!output) {
              output = new jsPDF({
                unit: "mm",
                format: pageFormat,
                compress: true,
              });
            } else {
              output.addPage(pageFormat);
            }

            const pageWidth = output.internal.pageSize.getWidth();
            const pageHeight = output.internal.pageSize.getHeight();
            const imageData = canvas.toDataURL("image/jpeg", safeQuality);
            output.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");

            totalProcessedPages += 1;
            const progressRatio = Math.min(0.98, totalProcessedPages / estimatedWorkPages);
            setProgress(Math.round(progressRatio * 100));
          }
        } finally {
          await closePdfDocumentResources(loadingTask, pdfDocument);
        }

        if (reachedLimit) {
          break;
        }
      }

      if (!output || totalProcessedPages === 0) {
        setStatus("Could not merge PDFs. Please verify your files.");
        return;
      }

      setStatus("Finalizing merged PDF...");
      setProgress(99);
      const blob = output.output("blob");
      const filenameBase = stripFileExtension(outputName.trim()) || "merged-document";
      const filename = `${filenameBase}.pdf`;
      const outputUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = outputUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(outputUrl);

      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      setLastOutputPages(totalProcessedPages);
      setLastOutputSize(blob.size);
      setProgress(100);
      setStatus(`Merged ${totalProcessedPages} page(s) in ${elapsed}s. Downloaded ${filename}.`);
      trackEvent("tool_pdf_merge_generate", {
        files: items.length,
        pages: totalProcessedPages,
        scalePercent: renderScalePercent,
      });
    } catch {
      setStatus("PDF merge failed. Try fewer/smaller files or lower render scale.");
    } finally {
      setProcessing(false);
    }
  }, [estimatedSourcePages, fitDpi, items, jpegQuality, maxPages, outputName, renderScalePercent]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="PDF merge"
        subtitle="Combine multiple PDFs in order, then download a single merged file."
      />

      <label className="field">
        <span>Upload PDF files</span>
        <input type="file" accept="application/pdf" multiple onChange={(event) => void handleFileInput(event.target.files)} />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Output filename</span>
          <input type="text" value={outputName} onChange={(event) => setOutputName(event.target.value)} />
        </label>
        <label className="field">
          <span>Render scale ({renderScalePercent}%)</span>
          <input
            type="range"
            min={80}
            max={260}
            step={10}
            value={renderScalePercent}
            onChange={(event) => setRenderScalePercent(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>JPEG quality ({jpegQuality.toFixed(2)})</span>
          <input
            type="range"
            min={0.5}
            max={1}
            step={0.02}
            value={jpegQuality}
            onChange={(event) => setJpegQuality(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Fit DPI ({fitDpi})</span>
          <input type="range" min={90} max={240} step={5} value={fitDpi} onChange={(event) => setFitDpi(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Max output pages</span>
          <input
            type="number"
            min={1}
            max={500}
            value={maxPages}
            onChange={(event) => setMaxPages(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void mergePdfs()} disabled={!items.length || processing}>
          {processing ? "Merging..." : "Merge PDFs"}
        </button>
        <button className="action-button secondary" type="button" onClick={clearAll} disabled={!items.length || processing}>
          <Trash2 size={15} />
          Clear queue
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "PDF files loaded", value: formatNumericValue(items.length) },
          { label: "Estimated source pages", value: formatNumericValue(estimatedSourcePages) },
          { label: "Source size total", value: formatBytes(totalInputBytes) },
          { label: "Last output pages", value: lastOutputPages ? formatNumericValue(lastOutputPages) : "-" },
          { label: "Last output size", value: lastOutputSize ? formatBytes(lastOutputSize) : "-" },
        ]}
      />

      {items.length ? (
        <div className="mini-panel">
          <h3>Merge order</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>File</th>
                  <th>Pages</th>
                  <th>Size</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.file.name}</td>
                    <td>{item.pageCount === null ? "Unknown" : formatNumericValue(item.pageCount)}</td>
                    <td>{formatBytes(item.sizeBytes)}</td>
                    <td>
                      <div className="button-row">
                        <button
                          className="action-button secondary"
                          type="button"
                          onClick={() => moveItem(index, -1)}
                          disabled={index === 0 || processing}
                        >
                          Up
                        </button>
                        <button
                          className="action-button secondary"
                          type="button"
                          onClick={() => moveItem(index, 1)}
                          disabled={index === items.length - 1 || processing}
                        >
                          Down
                        </button>
                        <button
                          className="action-button secondary"
                          type="button"
                          onClick={() => removeItem(item.id)}
                          disabled={processing}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type PdfSplitMode = "range" | "single-pages" | "fixed-chunk";

const PDF_SPLIT_MODE_OPTIONS: Array<{ value: PdfSplitMode; label: string; hint: string }> = [
  { value: "range", label: "Custom range", hint: "Export one PDF from selected pages" },
  { value: "single-pages", label: "Single-page files", hint: "Create one PDF per page" },
  { value: "fixed-chunk", label: "Fixed chunk size", hint: "Split into equal page groups" },
];

function PdfSplitTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [splitMode, setSplitMode] = useState<PdfSplitMode>("range");
  const [pageRangeInput, setPageRangeInput] = useState("1-3");
  const [chunkSize, setChunkSize] = useState(5);
  const [renderScalePercent, setRenderScalePercent] = useState(140);
  const [jpegQuality, setJpegQuality] = useState(0.86);
  const [fitDpi, setFitDpi] = useState(150);
  const [maxOutputPages, setMaxOutputPages] = useState(160);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload a PDF to split into smaller files.");
  const [lastOutputFiles, setLastOutputFiles] = useState(0);
  const [lastOutputPages, setLastOutputPages] = useState(0);
  const [lastOutputBytes, setLastOutputBytes] = useState(0);

  const inspectPdfMeta = useCallback(async (nextFile: File) => {
    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    try {
      setStatus("Reading PDF metadata...");
      const pdfjs = await loadPdfJsModule();
      const bytes = await readPdfFileBytes(nextFile);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;
      setPageCount(pdfDocument.numPages);
      setStatus(`PDF loaded with ${pdfDocument.numPages} page(s).`);
    } catch {
      setPageCount(0);
      setStatus("Could not read PDF metadata.");
    } finally {
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, []);

  const handleSelectedFile = useCallback(
    (candidate: File | null) => {
      if (!candidate) {
        setFile(null);
        setPdfName("");
        setPageCount(0);
        setStatus("Upload a PDF to split into smaller files.");
        return;
      }

      if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
        setStatus("Please choose a valid PDF file.");
        return;
      }

      setFile(candidate);
      setPdfName(stripFileExtension(candidate.name));
      setProgress(0);
      setLastOutputFiles(0);
      setLastOutputPages(0);
      setLastOutputBytes(0);
      void inspectPdfMeta(candidate);
      trackEvent("tool_pdf_split_upload", { size: candidate.size });
    },
    [inspectPdfMeta],
  );

  const splitPdf = useCallback(async () => {
    if (!file) {
      setStatus("Upload a PDF file first.");
      return;
    }
    if (!pageCount) {
      setStatus("PDF page count is not available yet.");
      return;
    }

    const safeMaxOutputPages = Math.max(1, Math.min(500, Math.round(maxOutputPages)));
    const safeScale = Math.max(80, Math.min(260, renderScalePercent)) / 100;
    const safeQuality = Math.max(0.5, Math.min(1, jpegQuality));
    const safeChunkSize = Math.max(1, Math.min(200, Math.round(chunkSize || 1)));

    let groups: number[][] = [];
    if (splitMode === "range") {
      const pages = parsePageRangeInput(pageRangeInput, pageCount);
      if (!pages?.length) {
        setStatus("Invalid page range. Example: 1-3,5,8");
        return;
      }
      groups = [pages.slice(0, safeMaxOutputPages)];
    } else if (splitMode === "single-pages") {
      const pages = Array.from({ length: Math.min(pageCount, safeMaxOutputPages) }, (_item, index) => index + 1);
      groups = pages.map((page) => [page]);
    } else {
      const allPages = Array.from({ length: Math.min(pageCount, safeMaxOutputPages) }, (_item, index) => index + 1);
      for (let index = 0; index < allPages.length; index += safeChunkSize) {
        groups.push(allPages.slice(index, index + safeChunkSize));
      }
    }

    const pagesToProcess = groups.flat().slice(0, safeMaxOutputPages);
    if (!pagesToProcess.length) {
      setStatus("No pages selected for split output.");
      return;
    }

    setProcessing(true);
    setProgress(3);
    setStatus("Preparing split output...");

    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    let processedPages = 0;
    let outputBytes = 0;

    try {
      const pdfjs = await loadPdfJsModule();
      const { jsPDF } = await import("jspdf");
      const bytes = await readPdfFileBytes(file);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
        const pages = groups[groupIndex];
        if (!pages.length) continue;

        let outputDoc: JsPdfType | null = null;
        for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
          const pageNumber = pages[pageIndex];
          setStatus(
            `Rendering page ${pageNumber} (${processedPages + 1}/${pagesToProcess.length}) for split file ${groupIndex + 1}/${groups.length}...`,
          );

          const page = await pdfDocument.getPage(pageNumber);
          const viewport = page.getViewport({ scale: safeScale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas context unavailable.");
          }
          await page.render({ canvasContext: context, viewport }).promise;

          const pageSizeMm = resolvePdfPageSizeMm("fit-image", canvas.width, canvas.height, fitDpi);
          const landscape = canvas.width > canvas.height;
          const pageFormat: [number, number] = landscape ? [pageSizeMm[1], pageSizeMm[0]] : pageSizeMm;

          if (!outputDoc) {
            outputDoc = new jsPDF({
              unit: "mm",
              format: pageFormat,
              compress: true,
            });
          } else {
            outputDoc.addPage(pageFormat);
          }

          const pageWidth = outputDoc.internal.pageSize.getWidth();
          const pageHeight = outputDoc.internal.pageSize.getHeight();
          const imageData = canvas.toDataURL("image/jpeg", safeQuality);
          outputDoc.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");

          processedPages += 1;
          const progressRatio = Math.min(0.97, processedPages / Math.max(1, pagesToProcess.length));
          setProgress(Math.round(progressRatio * 100));
        }

        if (!outputDoc) continue;
        const blob = outputDoc.output("blob");
        outputBytes += blob.size;

        const baseName = stripFileExtension(pdfName.trim()) || "split-document";
        let filename = `${baseName}-part-${groupIndex + 1}.pdf`;
        if (splitMode === "single-pages") {
          filename = `${baseName}-page-${pages[0]}.pdf`;
        } else if (splitMode === "range" && pages.length) {
          const firstPage = pages[0];
          const lastPage = pages[pages.length - 1];
          filename = `${baseName}-pages-${firstPage}${lastPage !== firstPage ? `-${lastPage}` : ""}.pdf`;
        }

        const outputUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = outputUrl;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(outputUrl);
        await new Promise((resolve) => setTimeout(resolve, 70));
      }

      setProgress(100);
      setLastOutputFiles(groups.length);
      setLastOutputPages(processedPages);
      setLastOutputBytes(outputBytes);
      setStatus(`Created ${groups.length} file(s) from ${processedPages} page(s).`);
      trackEvent("tool_pdf_split_generate", {
        mode: splitMode,
        files: groups.length,
        pages: processedPages,
      });
    } catch {
      setStatus("PDF split failed. Try lower scale or fewer pages.");
    } finally {
      setProcessing(false);
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, [
    chunkSize,
    file,
    fitDpi,
    jpegQuality,
    maxOutputPages,
    pageCount,
    pageRangeInput,
    pdfName,
    renderScalePercent,
    splitMode,
  ]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="PDF split"
        subtitle="Split PDFs by custom range, fixed chunk size, or single-page export mode."
      />

      <label className="field">
        <span>Upload PDF</span>
        <input type="file" accept="application/pdf" onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)} />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Split mode</span>
          <select value={splitMode} onChange={(event) => setSplitMode(event.target.value as PdfSplitMode)}>
            {PDF_SPLIT_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.hint}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Output filename base</span>
          <input type="text" value={pdfName} onChange={(event) => setPdfName(event.target.value)} />
        </label>
        {splitMode === "range" ? (
          <label className="field">
            <span>Page range</span>
            <input type="text" value={pageRangeInput} onChange={(event) => setPageRangeInput(event.target.value)} placeholder="1-3,5,8" />
            <small className="supporting-text">Use commas and ranges. Example: 1-3,5,8</small>
          </label>
        ) : null}
        {splitMode === "fixed-chunk" ? (
          <label className="field">
            <span>Chunk size (pages/file)</span>
            <input type="number" min={1} max={200} value={chunkSize} onChange={(event) => setChunkSize(Number(event.target.value))} />
          </label>
        ) : null}
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Render scale ({renderScalePercent}%)</span>
          <input type="range" min={80} max={260} step={10} value={renderScalePercent} onChange={(event) => setRenderScalePercent(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>JPEG quality ({jpegQuality.toFixed(2)})</span>
          <input type="range" min={0.5} max={1} step={0.02} value={jpegQuality} onChange={(event) => setJpegQuality(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Fit DPI ({fitDpi})</span>
          <input type="range" min={90} max={240} step={5} value={fitDpi} onChange={(event) => setFitDpi(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Max output pages</span>
          <input type="number" min={1} max={500} value={maxOutputPages} onChange={(event) => setMaxOutputPages(Number(event.target.value))} />
        </label>
      </div>

      <div className="button-row">
        <button className="action-button" type="button" disabled={!file || processing || !pageCount} onClick={() => void splitPdf()}>
          {processing ? "Splitting..." : "Split PDF"}
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "Loaded PDF pages", value: pageCount ? formatNumericValue(pageCount) : "-" },
          { label: "Split mode", value: PDF_SPLIT_MODE_OPTIONS.find((entry) => entry.value === splitMode)?.label ?? splitMode },
          { label: "Last output files", value: lastOutputFiles ? formatNumericValue(lastOutputFiles) : "-" },
          { label: "Last output pages", value: lastOutputPages ? formatNumericValue(lastOutputPages) : "-" },
          { label: "Last output size", value: lastOutputBytes ? formatBytes(lastOutputBytes) : "-" },
        ]}
      />
    </section>
  );
}

type PdfCompressionPreset = "balanced" | "high-quality" | "small-size" | "smallest-size";

const PDF_COMPRESSION_PRESETS: Array<{
  value: PdfCompressionPreset;
  label: string;
  hint: string;
  scalePercent: number;
  quality: number;
  fitDpi: number;
}> = [
  {
    value: "balanced",
    label: "Balanced",
    hint: "Good quality with meaningful size reduction",
    scalePercent: 110,
    quality: 0.74,
    fitDpi: 130,
  },
  {
    value: "high-quality",
    label: "High quality",
    hint: "Best visual quality, lighter size reduction",
    scalePercent: 130,
    quality: 0.88,
    fitDpi: 160,
  },
  {
    value: "small-size",
    label: "Small size",
    hint: "Aggressive compression for sharing",
    scalePercent: 95,
    quality: 0.62,
    fitDpi: 118,
  },
  {
    value: "smallest-size",
    label: "Smallest size",
    hint: "Maximum shrink with lower visual detail",
    scalePercent: 80,
    quality: 0.5,
    fitDpi: 100,
  },
];

function getPdfCompressionPreset(preset: PdfCompressionPreset) {
  return PDF_COMPRESSION_PRESETS.find((entry) => entry.value === preset) ?? PDF_COMPRESSION_PRESETS[0];
}

function PdfCompressorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [preset, setPreset] = useState<PdfCompressionPreset>("balanced");
  const [renderScalePercent, setRenderScalePercent] = useState(110);
  const [jpegQuality, setJpegQuality] = useState(0.74);
  const [fitDpi, setFitDpi] = useState(130);
  const [maxPages, setMaxPages] = useState(160);
  const [grayscale, setGrayscale] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload a PDF to compress.");
  const [sourceBytes, setSourceBytes] = useState(0);
  const [lastOutputBytes, setLastOutputBytes] = useState<number | null>(null);
  const [lastProcessedPages, setLastProcessedPages] = useState(0);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);

  const inspectPdfMeta = useCallback(async (nextFile: File) => {
    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    try {
      setStatus("Reading PDF metadata...");
      const pdfjs = await loadPdfJsModule();
      const bytes = await readPdfFileBytes(nextFile);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;
      setPageCount(pdfDocument.numPages);
      setStatus(`PDF loaded with ${pdfDocument.numPages} page(s).`);
    } catch {
      setPageCount(0);
      setStatus("Could not read PDF metadata.");
    } finally {
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, []);

  const handleSelectedFile = useCallback(
    (candidate: File | null) => {
      if (!candidate) {
        setFile(null);
        setPdfName("");
        setPageCount(0);
        setSourceBytes(0);
        setLastOutputBytes(null);
        setLastProcessedPages(0);
        setLastRunMs(null);
        setStatus("Upload a PDF to compress.");
        return;
      }
      if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
        setStatus("Please choose a valid PDF file.");
        return;
      }

      setFile(candidate);
      setPdfName(stripFileExtension(candidate.name));
      setSourceBytes(candidate.size);
      setProgress(0);
      setLastOutputBytes(null);
      setLastProcessedPages(0);
      setLastRunMs(null);
      void inspectPdfMeta(candidate);
      trackEvent("tool_pdf_compressor_upload", { size: candidate.size });
    },
    [inspectPdfMeta],
  );

  const handlePresetChange = useCallback((nextPreset: PdfCompressionPreset) => {
    const config = getPdfCompressionPreset(nextPreset);
    setPreset(nextPreset);
    setRenderScalePercent(config.scalePercent);
    setJpegQuality(config.quality);
    setFitDpi(config.fitDpi);
  }, []);

  const plannedPages = useMemo(
    () => Math.min(pageCount, Math.max(1, Math.min(500, Math.round(maxPages || 1)))),
    [maxPages, pageCount],
  );

  const sizeChangeLabel = useMemo(() => {
    if (!lastOutputBytes || !sourceBytes) return "-";
    const delta = sourceBytes - lastOutputBytes;
    const percent = Math.abs(delta / sourceBytes) * 100;
    if (delta >= 0) {
      return `Reduced by ${formatBytes(delta)} (${percent.toFixed(1)}%)`;
    }
    return `Increased by ${formatBytes(Math.abs(delta))} (${percent.toFixed(1)}%)`;
  }, [lastOutputBytes, sourceBytes]);

  const compressPdf = useCallback(async () => {
    if (!file) {
      setStatus("Upload a PDF file first.");
      return;
    }
    if (!pageCount) {
      setStatus("PDF page count is not available yet.");
      return;
    }

    const safeScale = Math.max(80, Math.min(260, renderScalePercent)) / 100;
    const safeQuality = Math.max(0.4, Math.min(0.98, jpegQuality));
    const safeFitDpi = Math.max(90, Math.min(240, fitDpi));
    const safeMaxPages = Math.max(1, Math.min(500, Math.round(maxPages)));
    const pagesToProcess = Math.min(pageCount, safeMaxPages);

    setProcessing(true);
    setProgress(3);
    setStatus("Preparing PDF compression...");
    const startedAt = Date.now();

    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    let output: JsPdfType | null = null;

    try {
      const pdfjs = await loadPdfJsModule();
      const { jsPDF } = await import("jspdf");
      const bytes = await readPdfFileBytes(file);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;

      for (let pageNumber = 1; pageNumber <= pagesToProcess; pageNumber += 1) {
        setStatus(`Compressing page ${pageNumber}/${pagesToProcess}...`);
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale: safeScale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas context unavailable.");
        }

        await page.render({ canvasContext: context, viewport }).promise;
        if (grayscale) {
          applyGrayscaleToCanvas(context, canvas.width, canvas.height);
        }

        const pageSizeMm = resolvePdfPageSizeMm("fit-image", canvas.width, canvas.height, safeFitDpi);
        const landscape = canvas.width > canvas.height;
        const pageFormat: [number, number] = landscape ? [pageSizeMm[1], pageSizeMm[0]] : pageSizeMm;
        if (!output) {
          output = new jsPDF({
            unit: "mm",
            format: pageFormat,
            compress: true,
          });
        } else {
          output.addPage(pageFormat);
        }

        const pageWidth = output.internal.pageSize.getWidth();
        const pageHeight = output.internal.pageSize.getHeight();
        const imageData = canvas.toDataURL("image/jpeg", safeQuality);
        output.addImage(imageData, "JPEG", 0, 0, pageWidth, pageHeight, undefined, "FAST");

        const progressRatio = Math.min(0.96, pageNumber / Math.max(1, pagesToProcess));
        setProgress(Math.round(progressRatio * 100));
      }

      if (!output) {
        setStatus("Could not build compressed PDF.");
        return;
      }

      setStatus("Finalizing compressed PDF...");
      setProgress(99);
      const blob = output.output("blob");
      const sourceBase = stripFileExtension(file.name) || "document";
      const defaultName = `${sourceBase}-compressed`;
      const filenameBase = stripFileExtension(pdfName.trim()) || defaultName;
      const filename = `${filenameBase}.pdf`;
      const outputUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = outputUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(outputUrl);

      const elapsed = Date.now() - startedAt;
      setProgress(100);
      setLastOutputBytes(blob.size);
      setLastProcessedPages(pagesToProcess);
      setLastRunMs(elapsed);
      setStatus(`Compressed ${pagesToProcess} page(s) in ${(elapsed / 1000).toFixed(1)}s. Downloaded ${filename}.`);
      trackEvent("tool_pdf_compressor_generate", {
        pages: pagesToProcess,
        preset,
        scalePercent: renderScalePercent,
        quality: jpegQuality,
        grayscale,
      });
    } catch {
      setStatus("PDF compression failed. Try fewer pages or lower scale.");
    } finally {
      setProcessing(false);
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, [
    file,
    fitDpi,
    grayscale,
    jpegQuality,
    maxPages,
    pageCount,
    pdfName,
    preset,
    renderScalePercent,
  ]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="PDF compressor"
        subtitle="Compress PDFs in-browser with quality presets, grayscale option, and page limits."
      />

      <label className="field">
        <span>Upload PDF</span>
        <input type="file" accept="application/pdf" onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)} />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Compression preset</span>
          <select value={preset} onChange={(event) => handlePresetChange(event.target.value as PdfCompressionPreset)}>
            {PDF_COMPRESSION_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.hint}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Output filename</span>
          <input type="text" value={pdfName} onChange={(event) => setPdfName(event.target.value)} />
        </label>
        <label className="field">
          <span>Max pages per run</span>
          <input type="number" min={1} max={500} value={maxPages} onChange={(event) => setMaxPages(Number(event.target.value))} />
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Render scale ({renderScalePercent}%)</span>
          <input type="range" min={80} max={260} step={10} value={renderScalePercent} onChange={(event) => setRenderScalePercent(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>JPEG quality ({jpegQuality.toFixed(2)})</span>
          <input type="range" min={0.4} max={0.98} step={0.02} value={jpegQuality} onChange={(event) => setJpegQuality(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Fit DPI ({fitDpi})</span>
          <input type="range" min={90} max={240} step={5} value={fitDpi} onChange={(event) => setFitDpi(Number(event.target.value))} />
        </label>
      </div>

      <label className="checkbox"><input type="checkbox" checked={grayscale} onChange={(event) => setGrayscale(event.target.checked)} />Convert pages to grayscale before export</label>

      <div className="button-row">
        <button className="action-button" type="button" disabled={!file || processing || !pageCount} onClick={() => void compressPdf()}>
          {processing ? "Compressing..." : "Compress PDF"}
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "Loaded PDF pages", value: pageCount ? formatNumericValue(pageCount) : "-" },
          { label: "Pages to process", value: pageCount ? formatNumericValue(plannedPages) : "-" },
          { label: "Source size", value: sourceBytes ? formatBytes(sourceBytes) : "-" },
          { label: "Last output size", value: lastOutputBytes ? formatBytes(lastOutputBytes) : "-" },
          { label: "Size change", value: sizeChangeLabel },
          { label: "Last output pages", value: lastProcessedPages ? formatNumericValue(lastProcessedPages) : "-" },
          { label: "Last run", value: lastRunMs ? `${(lastRunMs / 1000).toFixed(1)}s` : "-" },
        ]}
      />
    </section>
  );
}

function PdfToWordTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [selectionPreset, setSelectionPreset] = useState<PageSelectionPreset>("all");
  const [pageRangeInput, setPageRangeInput] = useState("all");
  const [maxPages, setMaxPages] = useState(60);
  const [includePageHeadings, setIncludePageHeadings] = useState(true);
  const [preserveLineBreaks, setPreserveLineBreaks] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload a PDF to export Word-compatible text.");
  const [sourceBytes, setSourceBytes] = useState(0);
  const [lastDocBytes, setLastDocBytes] = useState<number | null>(null);
  const [lastPages, setLastPages] = useState(0);
  const [lastWords, setLastWords] = useState(0);
  const [lastChars, setLastChars] = useState(0);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);
  const [previewText, setPreviewText] = useState("");

  const inspectPdfMeta = useCallback(async (nextFile: File) => {
    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    try {
      setStatus("Reading PDF metadata...");
      const pdfjs = await loadPdfJsModule();
      const bytes = await readPdfFileBytes(nextFile);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;
      setPageCount(pdfDocument.numPages);
      setStatus(`PDF loaded with ${pdfDocument.numPages} page(s).`);
    } catch {
      setPageCount(0);
      setStatus("Could not read PDF metadata.");
    } finally {
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, []);

  const handleSelectedFile = useCallback(
    (candidate: File | null) => {
      if (!candidate) {
        setFile(null);
        setPdfName("");
        setPageCount(0);
        setSourceBytes(0);
        setLastDocBytes(null);
        setLastPages(0);
        setLastWords(0);
        setLastChars(0);
        setLastRunMs(null);
        setPreviewText("");
        setStatus("Upload a PDF to export Word-compatible text.");
        return;
      }

      if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
        setStatus("Please choose a valid PDF file.");
        return;
      }

      setFile(candidate);
      setPdfName(stripFileExtension(candidate.name));
      setSourceBytes(candidate.size);
      setProgress(0);
      setLastDocBytes(null);
      setLastPages(0);
      setLastWords(0);
      setLastChars(0);
      setLastRunMs(null);
      setPreviewText("");
      void inspectPdfMeta(candidate);
      trackEvent("tool_pdf_to_word_upload", { size: candidate.size });
    },
    [inspectPdfMeta],
  );

  const exportToWord = useCallback(async () => {
    if (!file) {
      setStatus("Upload a PDF file first.");
      return;
    }
    if (!pageCount) {
      setStatus("PDF page count is not available yet.");
      return;
    }

    const selectedPages = parsePageRangeInput(pageRangeInput, pageCount);
    if (!selectedPages?.length) {
      setStatus("Invalid page range. Example: 1-3,5,8");
      return;
    }

    const boundedSelection = selectedPages.slice(0, Math.max(1, Math.min(120, Math.round(maxPages || 1))));
    if (!boundedSelection.length) {
      setStatus("No pages selected for export.");
      return;
    }

    setProcessing(true);
    setProgress(3);
    setStatus(`Extracting text from ${boundedSelection.length} page(s)...`);
    const startedAt = Date.now();

    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    try {
      const pdfjs = await loadPdfJsModule();
      const bytes = await readPdfFileBytes(file);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;

      const sections: Array<{ pageNumber: number; lines: string[] }> = [];
      for (let index = 0; index < boundedSelection.length; index += 1) {
        const pageNumber = boundedSelection[index];
        setStatus(`Extracting page ${pageNumber} (${index + 1}/${boundedSelection.length})...`);
        const page = await pdfDocument.getPage(pageNumber);
        if (!page.getTextContent) {
          sections.push({ pageNumber, lines: [] });
          continue;
        }
        const textContent = await page.getTextContent();
        const items = Array.isArray(textContent.items) ? textContent.items : [];
        const lines = extractPdfTextLines(items);
        sections.push({ pageNumber, lines });
        const progressRatio = Math.min(0.92, (index + 1) / boundedSelection.length);
        setProgress(Math.round(progressRatio * 100));
      }

      const title = escapeHtml(stripFileExtension(pdfName.trim()) || "converted-document");
      const documentLines: string[] = [];
      for (const section of sections) {
        if (includePageHeadings) {
          documentLines.push(`Page ${section.pageNumber}`);
        }
        if (section.lines.length) {
          if (preserveLineBreaks) {
            documentLines.push(...section.lines);
          } else {
            documentLines.push(section.lines.join(" "));
          }
        } else {
          documentLines.push("[No extractable text on this page]");
        }
        documentLines.push("");
      }

      const combinedText = documentLines.join("\n").trim();
      const htmlSections = sections
        .map((section) => {
          const heading = includePageHeadings ? `<h2>Page ${section.pageNumber}</h2>` : "";
          if (!section.lines.length) {
            return `<section>${heading}<p><em>No extractable text on this page.</em></p></section>`;
          }
          const content = preserveLineBreaks
            ? section.lines.map((line) => escapeHtml(line)).join("<br/>")
            : escapeHtml(section.lines.join(" "));
          return `<section>${heading}<p>${content}</p></section>`;
        })
        .join("<hr/>");

      const htmlDocument = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; line-height: 1.45; margin: 24px; color: #111; }
    h1 { margin: 0 0 12px; font-size: 22px; }
    h2 { margin: 20px 0 8px; font-size: 16px; }
    p { margin: 0 0 12px; white-space: normal; }
    hr { border: 0; border-top: 1px solid #d0d0d0; margin: 18px 0; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  ${htmlSections || "<p><em>No text extracted.</em></p>"}
</body>
</html>`;

      setStatus("Preparing Word file...");
      setProgress(98);
      const blob = new Blob(["\ufeff", htmlDocument], { type: "application/msword" });
      const filenameBase = stripFileExtension(pdfName.trim()) || "converted-document";
      const filename = `${filenameBase}.doc`;
      const outputUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = outputUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(outputUrl);

      const elapsed = Date.now() - startedAt;
      setProgress(100);
      setLastDocBytes(blob.size);
      setLastPages(sections.length);
      setLastWords(countWords(combinedText));
      setLastChars(countCharacters(combinedText, true));
      setLastRunMs(elapsed);
      setPreviewText(combinedText.slice(0, 1800));
      setStatus(`Exported ${filename} from ${sections.length} page(s) in ${(elapsed / 1000).toFixed(1)}s.`);
      trackEvent("tool_pdf_to_word_export", {
        pages: sections.length,
        words: countWords(combinedText),
        preserveLineBreaks,
      });
    } catch {
      setStatus("PDF to Word conversion failed. Try fewer pages.");
    } finally {
      setProcessing(false);
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, [file, includePageHeadings, maxPages, pageCount, pageRangeInput, pdfName, preserveLineBreaks]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="PDF to Word converter"
        subtitle="Extract PDF text and export it as a Word-compatible .doc file."
      />

      <label className="field">
        <span>Upload PDF</span>
        <input type="file" accept="application/pdf" onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)} />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Page selection preset</span>
          <select
            value={selectionPreset}
            onChange={(event) => {
              const preset = event.target.value as PageSelectionPreset;
              setSelectionPreset(preset);
              setPageRangeInput(buildPageRangeFromPreset(preset));
            }}
          >
            {PAGE_SELECTION_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.hint}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Page range</span>
          <input type="text" value={pageRangeInput} onChange={(event) => setPageRangeInput(event.target.value)} placeholder="all or 1-3,5,8" />
          <small className="supporting-text">Use commas and ranges, for example: 1-4,7,10</small>
        </label>
        <label className="field">
          <span>Max pages per run</span>
          <input type="number" min={1} max={120} value={maxPages} onChange={(event) => setMaxPages(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Output filename</span>
          <input type="text" value={pdfName} onChange={(event) => setPdfName(event.target.value)} />
        </label>
      </div>

      <div className="button-row">
        <label className="checkbox"><input type="checkbox" checked={includePageHeadings} onChange={(event) => setIncludePageHeadings(event.target.checked)} />Include page headings</label>
        <label className="checkbox"><input type="checkbox" checked={preserveLineBreaks} onChange={(event) => setPreserveLineBreaks(event.target.checked)} />Preserve line breaks</label>
      </div>

      <div className="button-row">
        <button className="action-button" type="button" disabled={!file || processing || !pageCount} onClick={() => void exportToWord()}>
          {processing ? "Converting..." : "Export Word file"}
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "PDF pages", value: pageCount ? formatNumericValue(pageCount) : "-" },
          { label: "Source size", value: sourceBytes ? formatBytes(sourceBytes) : "-" },
          { label: "Last export pages", value: lastPages ? formatNumericValue(lastPages) : "-" },
          { label: "Last export words", value: lastWords ? formatNumericValue(lastWords) : "-" },
          { label: "Last export characters", value: lastChars ? formatNumericValue(lastChars) : "-" },
          { label: "Last file size", value: lastDocBytes ? formatBytes(lastDocBytes) : "-" },
          { label: "Last run", value: lastRunMs ? `${(lastRunMs / 1000).toFixed(1)}s` : "-" },
        ]}
      />

      {previewText ? (
        <label className="field">
          <span>Extract preview</span>
          <textarea value={previewText} readOnly rows={8} />
        </label>
      ) : null}
    </section>
  );
}

type PdfWordPagePreset = Exclude<PdfPageSizePreset, "fit-image">;

function WordToPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [documentSource, setDocumentSource] = useState("-");
  const [documentText, setDocumentText] = useState("");
  const [outputName, setOutputName] = useState("converted-document");
  const [pagePreset, setPagePreset] = useState<PdfWordPagePreset>("a4");
  const [fontSizePt, setFontSizePt] = useState(12);
  const [lineHeight, setLineHeight] = useState(1.4);
  const [marginMm, setMarginMm] = useState(14);
  const [maxChars, setMaxChars] = useState(120000);
  const [parsing, setParsing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload a Word-compatible document to convert.");
  const [sourceBytes, setSourceBytes] = useState(0);
  const [sourceWords, setSourceWords] = useState(0);
  const [sourceChars, setSourceChars] = useState(0);
  const [lastOutputBytes, setLastOutputBytes] = useState<number | null>(null);
  const [lastOutputPages, setLastOutputPages] = useState(0);
  const [lastRunMs, setLastRunMs] = useState<number | null>(null);

  const isBusy = parsing || processing;
  const safeMaxChars = Math.max(1000, Math.min(400000, Math.round(maxChars || 1000)));
  const charsToRender = useMemo(
    () => Math.min(normalizeDocumentText(documentText).length, safeMaxChars),
    [documentText, safeMaxChars],
  );

  const parseFile = useCallback(async (nextFile: File) => {
    setParsing(true);
    setProgress(8);
    setStatus("Extracting document text...");
    try {
      const extracted = await extractTextFromDocumentFile(nextFile);
      const normalized = normalizeDocumentText(extracted.text);
      setDocumentSource(extracted.source);
      setDocumentText(normalized);
      setSourceWords(countWords(normalized));
      setSourceChars(countCharacters(normalized, true));
      setProgress(100);
      if (normalized) {
        setStatus(
          `Loaded ${extracted.source} content with ${formatNumericValue(countWords(normalized))} words.`,
        );
      } else {
        setStatus("No readable text found in the selected document.");
      }
    } catch {
      setDocumentSource("-");
      setDocumentText("");
      setSourceWords(0);
      setSourceChars(0);
      setStatus("Could not read this document. Try DOCX, DOC (HTML), TXT, Markdown, or HTML.");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleSelectedFile = useCallback(
    (candidate: File | null) => {
      if (!candidate) {
        setFile(null);
        setDocumentSource("-");
        setDocumentText("");
        setOutputName("converted-document");
        setSourceBytes(0);
        setSourceWords(0);
        setSourceChars(0);
        setLastOutputBytes(null);
        setLastOutputPages(0);
        setLastRunMs(null);
        setStatus("Upload a Word-compatible document to convert.");
        return;
      }

      setFile(candidate);
      setSourceBytes(candidate.size);
      setOutputName(stripFileExtension(candidate.name) || "converted-document");
      setProgress(0);
      setLastOutputBytes(null);
      setLastOutputPages(0);
      setLastRunMs(null);
      void parseFile(candidate);
      const lowerName = candidate.name.toLowerCase();
      const extension = lowerName.includes(".") ? lowerName.slice(lowerName.lastIndexOf(".") + 1) : "unknown";
      trackEvent("tool_word_to_pdf_upload", { size: candidate.size, extension });
    },
    [parseFile],
  );

  const convertToPdf = useCallback(async () => {
    if (!file) {
      setStatus("Upload a document first.");
      return;
    }

    const normalized = normalizeDocumentText(documentText);
    const textToRender = normalized.slice(0, safeMaxChars);
    if (!textToRender) {
      setStatus("No text available to convert.");
      return;
    }

    const safeMargin = Math.max(6, Math.min(40, marginMm));
    const safeFontSize = Math.max(8, Math.min(20, fontSizePt));
    const safeLineHeightMultiplier = Math.max(1.1, Math.min(2.4, lineHeight));
    const startedAt = Date.now();

    setProcessing(true);
    setProgress(5);
    setStatus("Building PDF document...");

    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        unit: "mm",
        format: PDF_PAGE_SIZE_PRESETS[pagePreset].sizeMm,
        compress: true,
      });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(safeFontSize);

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const maxLineWidth = Math.max(40, pageWidth - safeMargin * 2);
      const lineHeightMm = Math.max(3.8, safeFontSize * safeLineHeightMultiplier * 0.352778);
      const paragraphGapMm = Math.max(1.8, lineHeightMm * 0.45);
      const paragraphs = textToRender.split(/\n+/).map((entry) => entry.trim()).filter(Boolean);

      let y = safeMargin;
      for (let index = 0; index < paragraphs.length; index += 1) {
        const paragraph = paragraphs[index];
        const lines = pdf.splitTextToSize(paragraph, maxLineWidth) as string[];
        for (const line of lines) {
          if (y + lineHeightMm > pageHeight - safeMargin) {
            pdf.addPage();
            y = safeMargin;
          }
          pdf.text(line || " ", safeMargin, y);
          y += lineHeightMm;
        }

        y += paragraphGapMm;
        if (y > pageHeight - safeMargin) {
          pdf.addPage();
          y = safeMargin;
        }

        const progressRatio = Math.min(0.95, (index + 1) / Math.max(1, paragraphs.length));
        setProgress(Math.round(progressRatio * 100));
      }

      setStatus("Finalizing PDF download...");
      setProgress(99);
      const blob = pdf.output("blob");
      const filenameBase = stripFileExtension(outputName.trim()) || "converted-document";
      const filename = `${filenameBase}.pdf`;
      const outputUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = outputUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(outputUrl);

      const elapsed = Date.now() - startedAt;
      setProgress(100);
      setLastOutputBytes(blob.size);
      setLastOutputPages(pdf.getNumberOfPages());
      setLastRunMs(elapsed);
      setStatus(`Converted ${filename} in ${(elapsed / 1000).toFixed(1)}s.`);
      trackEvent("tool_word_to_pdf_convert", {
        source: documentSource,
        pages: pdf.getNumberOfPages(),
        chars: textToRender.length,
        pagePreset,
      });
    } catch {
      setStatus("Word to PDF conversion failed. Try fewer characters or simpler content.");
    } finally {
      setProcessing(false);
    }
  }, [documentSource, documentText, file, fontSizePt, lineHeight, marginMm, outputName, pagePreset, safeMaxChars]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="Word to PDF converter"
        subtitle="Convert DOCX, DOC (HTML), TXT, Markdown, or HTML text into a downloadable PDF."
      />

      <label className="field">
        <span>Upload document</span>
        <input
          type="file"
          accept=".doc,.docx,.txt,.md,.html,.htm,.rtf,text/plain,text/markdown,text/html,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Output filename</span>
          <input type="text" value={outputName} onChange={(event) => setOutputName(event.target.value)} />
        </label>
        <label className="field">
          <span>Page size</span>
          <select value={pagePreset} onChange={(event) => setPagePreset(event.target.value as PdfWordPagePreset)}>
            {(Object.entries(PDF_PAGE_SIZE_PRESETS) as Array<[PdfWordPagePreset, { label: string }]>).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Font size ({fontSizePt} pt)</span>
          <input type="range" min={8} max={20} step={1} value={fontSizePt} onChange={(event) => setFontSizePt(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Line height ({lineHeight.toFixed(2)})</span>
          <input type="range" min={1.1} max={2.4} step={0.05} value={lineHeight} onChange={(event) => setLineHeight(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Margins ({marginMm} mm)</span>
          <input type="range" min={6} max={40} step={1} value={marginMm} onChange={(event) => setMarginMm(Number(event.target.value))} />
        </label>
        <label className="field">
          <span>Max characters per run</span>
          <input type="number" min={1000} max={400000} step={500} value={maxChars} onChange={(event) => setMaxChars(Number(event.target.value))} />
        </label>
      </div>

      <div className="button-row">
        <button className="action-button secondary" type="button" onClick={() => file && void parseFile(file)} disabled={!file || isBusy}>
          {parsing ? "Reading..." : "Re-read document"}
        </button>
        <button className="action-button" type="button" onClick={() => void convertToPdf()} disabled={!documentText || isBusy}>
          {processing ? "Converting..." : "Convert to PDF"}
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "Detected format", value: documentSource },
          { label: "Source size", value: sourceBytes ? formatBytes(sourceBytes) : "-" },
          { label: "Source words", value: sourceWords ? formatNumericValue(sourceWords) : "-" },
          { label: "Source characters", value: sourceChars ? formatNumericValue(sourceChars) : "-" },
          { label: "Characters to render", value: documentText ? formatNumericValue(charsToRender) : "-" },
          { label: "Last output pages", value: lastOutputPages ? formatNumericValue(lastOutputPages) : "-" },
          { label: "Last output size", value: lastOutputBytes ? formatBytes(lastOutputBytes) : "-" },
          { label: "Last run", value: lastRunMs ? `${(lastRunMs / 1000).toFixed(1)}s` : "-" },
        ]}
      />

      <label className="field">
        <span>Document text (editable before conversion)</span>
        <textarea value={documentText} onChange={(event) => setDocumentText(event.target.value)} rows={10} />
        <small className="supporting-text">
          DOCX and DOC formatting is flattened to text paragraphs before PDF export.
        </small>
      </label>
    </section>
  );
}

function PdfToJpgTool() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfName, setPdfName] = useState("");
  const [pageCount, setPageCount] = useState(0);
  const [pageRangeInput, setPageRangeInput] = useState("all");
  const [selectionPreset, setSelectionPreset] = useState<PageSelectionPreset>("all");
  const [scalePercent, setScalePercent] = useState(150);
  const [quality, setQuality] = useState(0.9);
  const [maxPages, setMaxPages] = useState(20);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Upload a PDF to extract JPG pages.");
  const [pages, setPages] = useState<PdfJpgPagePreview[]>([]);
  const [sourceBytes, setSourceBytes] = useState(0);
  const [lastRenderMs, setLastRenderMs] = useState<number | null>(null);
  const [renderedRangeSummary, setRenderedRangeSummary] = useState("None");

  const totalJpgBytes = useMemo(
    () => pages.reduce((sum, page) => sum + page.estimatedBytes, 0),
    [pages],
  );

  const inspectPdfMeta = useCallback(async (nextFile: File) => {
    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    try {
      setStatus("Inspecting PDF pages...");
      const pdfjs = await loadPdfJsModule();
      const bytes = await readPdfFileBytes(nextFile);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;
      const count = pdfDocument.numPages;
      setPageCount(count);
      setStatus(`PDF loaded with ${count} pages.`);
      setRenderedRangeSummary("None");
    } catch {
      setPageCount(0);
      setStatus("Unable to read PDF file.");
    } finally {
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, []);

  const handleSelectedFile = useCallback(
    (candidate: File | null) => {
      if (!candidate) {
        setFile(null);
        setPdfName("");
        setPages([]);
        setPageCount(0);
        setSourceBytes(0);
        setStatus("Upload a PDF to extract JPG pages.");
        return;
      }
      if (candidate.type !== "application/pdf" && !candidate.name.toLowerCase().endsWith(".pdf")) {
        setStatus("Please choose a valid PDF document.");
        return;
      }

      setFile(candidate);
      setPdfName(stripFileExtension(candidate.name));
      setPages([]);
      setProgress(0);
      setSourceBytes(candidate.size);
      void inspectPdfMeta(candidate);
      trackEvent("tool_pdf_to_jpg_upload", { size: candidate.size });
    },
    [inspectPdfMeta],
  );

  const convertPdf = useCallback(async () => {
    if (!file) {
      setStatus("Upload a PDF file first.");
      return;
    }
    if (!pageCount) {
      setStatus("PDF page count is not ready yet.");
      return;
    }

    const selectedPages = parsePageRangeInput(pageRangeInput, pageCount);
    if (!selectedPages || !selectedPages.length) {
      setStatus("Invalid page range. Example: 1-3,5,8");
      return;
    }

    const boundedSelection = selectedPages.slice(0, Math.max(1, Math.min(100, maxPages)));
    setProcessing(true);
    setProgress(5);
    setStatus(`Rendering ${boundedSelection.length} page${boundedSelection.length > 1 ? "s" : ""}...`);
    const startedAt = Date.now();

    let loadingTask: PdfJsLoadingTask | null = null;
    let pdfDocument: PdfJsDocument | null = null;
    try {
      const pdfjs = await loadPdfJsModule();
      const bytes = await readPdfFileBytes(file);
      const opened = await openPdfDocumentWithFallback(pdfjs, bytes);
      loadingTask = opened.loadingTask;
      pdfDocument = opened.pdfDocument;
      const nextPages: PdfJpgPagePreview[] = [];
      const scale = Math.max(0.5, Math.min(4, scalePercent / 100));

      for (let index = 0; index < boundedSelection.length; index += 1) {
        const pageNumber = boundedSelection[index];
        setStatus(`Rendering page ${pageNumber} (${index + 1}/${boundedSelection.length})...`);
        setProgress(Math.round((index / Math.max(1, boundedSelection.length)) * 75) + 10);
        const page = await pdfDocument.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.floor(viewport.width));
        canvas.height = Math.max(1, Math.floor(viewport.height));
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas context unavailable.");
        }

        await page.render({ canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/jpeg", Math.max(0.4, Math.min(1, quality)));
        nextPages.push({
          pageNumber,
          width: canvas.width,
          height: canvas.height,
          dataUrl,
          estimatedBytes: estimateBytesFromDataUrl(dataUrl),
        });
      }

      const elapsed = Date.now() - startedAt;
      setPages(nextPages);
      setProgress(100);
      setLastRenderMs(elapsed);
      const summary =
        boundedSelection.length > 1
          ? `${boundedSelection[0]}-${boundedSelection[boundedSelection.length - 1]} (${boundedSelection.length} pages)`
          : `${boundedSelection[0]}`;
      setRenderedRangeSummary(summary);
      setStatus(`Rendered ${nextPages.length} JPG page${nextPages.length > 1 ? "s" : ""} in ${(elapsed / 1000).toFixed(1)}s.`);
      trackEvent("tool_pdf_to_jpg_convert", {
        pages: nextPages.length,
        scalePercent,
        quality,
      });
    } catch {
      setStatus("PDF to JPG conversion failed. Try a smaller range.");
    } finally {
      setProcessing(false);
      await closePdfDocumentResources(loadingTask, pdfDocument);
    }
  }, [file, maxPages, pageCount, pageRangeInput, quality, scalePercent]);

  const downloadAll = useCallback(() => {
    if (!pages.length) return;
    pages.forEach((page, index) => {
      setTimeout(() => {
        const baseName = stripFileExtension(pdfName.trim()) || "document";
        downloadDataUrl(`${baseName}-page-${page.pageNumber}.jpg`, page.dataUrl);
      }, index * 110);
    });
  }, [pages, pdfName]);

  const sendPageToWorkflowTool = useCallback(
    async (page: PdfJpgPagePreview, targetToolId: ImageToolId) => {
      const baseName = stripFileExtension(pdfName.trim()) || "document";
      setStatus(`Sending page ${page.pageNumber} to ${targetToolId}...`);
      const ok = await handoffImageResultToTool({
        sourceToolId: "pdf-to-jpg",
        targetToolId,
        fileName: `${baseName}-page-${page.pageNumber}.jpg`,
        mimeType: "image/jpeg",
        sourceUrl: page.dataUrl,
      });
      if (!ok) {
        setStatus("Could not hand off selected page.");
      } else {
        trackEvent("tool_workflow_handoff", { sourceMode: "pdf-to-jpg", targetToolId });
      }
    },
    [pdfName],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={MonitorUp}
        title="PDF to JPG converter"
        subtitle="Extract PDF pages as JPG with page-range targeting, resolution controls, and batch download."
      />

      <label className="field">
        <span>Upload PDF</span>
        <input
          type="file"
          accept="application/pdf"
          onChange={(event) => handleSelectedFile(event.target.files?.[0] ?? null)}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>Page selection preset</span>
          <select
            value={selectionPreset}
            onChange={(event) => {
              const preset = event.target.value as PageSelectionPreset;
              setSelectionPreset(preset);
              setPageRangeInput(buildPageRangeFromPreset(preset));
            }}
          >
            {PAGE_SELECTION_PRESETS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} - {option.hint}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Page range</span>
          <input
            type="text"
            value={pageRangeInput}
            onChange={(event) => setPageRangeInput(event.target.value)}
            placeholder="all or 1-3,5,8"
          />
          <small className="supporting-text">Use commas and ranges, for example: 1-4,7,10</small>
        </label>
        <label className="field">
          <span>Scale ({scalePercent}%)</span>
          <input
            type="range"
            min={50}
            max={300}
            step={10}
            value={scalePercent}
            onChange={(event) => setScalePercent(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>JPG quality ({quality.toFixed(2)})</span>
          <input
            type="range"
            min={0.4}
            max={1}
            step={0.02}
            value={quality}
            onChange={(event) => setQuality(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Max pages per run</span>
          <input
            type="number"
            min={1}
            max={100}
            value={maxPages}
            onChange={(event) => setMaxPages(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="button-row">
        <button className="action-button" type="button" disabled={!file || processing} onClick={() => void convertPdf()}>
          {processing ? "Converting..." : "Convert to JPG"}
        </button>
        <button className="action-button secondary" type="button" onClick={downloadAll} disabled={!pages.length}>
          <Download size={15} />
          Download all pages
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setPages([]);
            setProgress(0);
            setRenderedRangeSummary("None");
            setStatus("Cleared extracted pages.");
          }}
          disabled={!pages.length || processing}
        >
          <Trash2 size={15} />
          Clear output
        </button>
      </div>

      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>

      <ResultList
        rows={[
          { label: "PDF pages", value: pageCount ? formatNumericValue(pageCount) : "-" },
          { label: "Source size", value: sourceBytes ? formatBytes(sourceBytes) : "-" },
          { label: "Rendered pages", value: formatNumericValue(pages.length) },
          { label: "Rendered range", value: renderedRangeSummary },
          { label: "Output estimate", value: pages.length ? formatBytes(totalJpgBytes) : "-" },
          { label: "Last run", value: lastRenderMs ? `${(lastRenderMs / 1000).toFixed(1)}s` : "-" },
        ]}
      />

      {pages.length ? (
        <div className="image-compare-grid">
          {pages.map((page) => (
            <article key={page.pageNumber} className="image-card">
              <h3>Page {page.pageNumber}</h3>
              <div className="image-frame">
                <NextImage
                  src={page.dataUrl}
                  alt={`PDF page ${page.pageNumber} converted to JPG`}
                  width={page.width}
                  height={page.height}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                  unoptimized
                />
              </div>
              <dl className="image-meta">
                <div>
                  <dt>Resolution</dt>
                  <dd>
                    {page.width} x {page.height}
                  </dd>
                </div>
                <div>
                  <dt>Estimated size</dt>
                  <dd>{formatBytes(page.estimatedBytes)}</dd>
                </div>
              </dl>
              <button
                className="action-button secondary"
                type="button"
                onClick={() => {
                  const baseName = stripFileExtension(pdfName.trim()) || "document";
                  downloadDataUrl(`${baseName}-page-${page.pageNumber}.jpg`, page.dataUrl);
                }}
              >
                <Download size={15} />
                Download page
              </button>
              <button
                className="action-button secondary"
                type="button"
                onClick={() => {
                  void sendPageToWorkflowTool(page, "image-cropper");
                }}
                disabled={processing}
              >
                Send to cropper
              </button>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ImageTool({ id }: { id: ImageToolId }) {
  const [incomingFile, setIncomingFile] = useState<ImageWorkflowIncomingFile | null>(null);

  useEffect(() => {
    const handoff = consumeImageWorkflowHandoff(id);
    setIncomingFile(handoff);
  }, [id]);

  switch (id) {
    case "qr-code-generator":
      return <QrCodeGeneratorTool />;
    case "color-picker":
      return <ColorPickerTool />;
    case "hex-rgb-converter":
      return <HexRgbConverterTool />;
    case "background-remover":
      return <BackgroundRemoverTool incomingFile={incomingFile} />;
    case "image-resizer":
      return <ImageTransformTool mode="resize" incomingFile={incomingFile} />;
    case "image-compressor":
      return <ImageTransformTool mode="compress" incomingFile={incomingFile} />;
    case "jpg-to-png":
      return <ImageTransformTool mode="jpg-to-png" incomingFile={incomingFile} />;
    case "png-to-webp":
      return <ImageTransformTool mode="png-to-webp" incomingFile={incomingFile} />;
    case "image-cropper":
      return <ImageCropperTool incomingFile={incomingFile} />;
    case "barcode-generator":
      return <BarcodeGeneratorTool />;
    case "image-to-pdf":
      return <ImageToPdfTool incomingFile={incomingFile} />;
    case "pdf-merge":
      return <PdfMergeTool />;
    case "pdf-split":
      return <PdfSplitTool />;
    case "pdf-compressor":
      return <PdfCompressorTool />;
    case "pdf-to-word":
      return <PdfToWordTool />;
    case "word-to-pdf":
      return <WordToPdfTool />;
    case "pdf-to-jpg":
      return <PdfToJpgTool />;
    default:
      return <p>Image tool unavailable.</p>;
  }
}

function PomodoroTool() {
  type PomodoroMode = "focus" | "short-break" | "long-break";
  type PomodoroStats = {
    dateKey: string;
    completedFocusSessions: number;
    focusMinutes: number;
    completedBreaks: number;
    breakMinutes: number;
  };
  type PomodoroRuntimeState = {
    mode?: PomodoroMode;
    secondsLeft?: number;
    running?: boolean;
    completedFocusInCycle?: number;
    currentTask?: string;
    needsAttention?: boolean;
    snapshotAt?: number;
  };

  const toolSession = useToolSession({
    toolKey: "pomodoro",
    defaultSessionLabel: "Focus session",
    newSessionPrefix: "focus",
  });
  const settingsKey = toolSession.storageKey("utiliora-pomodoro-settings-v4");
  const statsKey = toolSession.storageKey("utiliora-pomodoro-stats-v3");
  const runtimeKey = toolSession.storageKey("utiliora-pomodoro-runtime-v1");
  const legacySettingsKey = "utiliora-pomodoro-settings-v3";
  const legacyStatsKey = "utiliora-pomodoro-stats-v2";
  const todayKey = new Date().toISOString().slice(0, 10);
  const popupRef = useRef<Window | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const skipPausedResetRef = useRef(true);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );

  const [focusMinutes, setFocusMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(4);
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
  const [enableSystemNotifications, setEnableSystemNotifications] = useState(false);
  const [enableSoundAlerts, setEnableSoundAlerts] = useState(true);
  const [enableWarnings, setEnableWarnings] = useState(true);
  const [warningSeconds, setWarningSeconds] = useState(60);
  const [keepScreenAwake, setKeepScreenAwake] = useState(false);
  const [showMiniWindow, setShowMiniWindow] = useState(false);
  const [needsAttention, setNeedsAttention] = useState(false);
  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [completedFocusInCycle, setCompletedFocusInCycle] = useState(0);
  const [currentTask, setCurrentTask] = useState("");
  const [status, setStatus] = useState("Ready to focus.");
  const [stats, setStats] = useState<PomodoroStats>({
    dateKey: todayKey,
    completedFocusSessions: 0,
    focusMinutes: 0,
    completedBreaks: 0,
    breakMinutes: 0,
  });

  const durationForMode = useCallback(
    (targetMode: PomodoroMode): number => {
      if (targetMode === "focus") return focusMinutes;
      if (targetMode === "short-break") return shortBreakMinutes;
      return longBreakMinutes;
    },
    [focusMinutes, longBreakMinutes, shortBreakMinutes],
  );

  const totalPhaseSeconds = useMemo(() => Math.max(1, durationForMode(mode) * 60), [durationForMode, mode]);
  const progressPercent = Math.min(100, Math.max(0, ((totalPhaseSeconds - secondsLeft) / totalPhaseSeconds) * 100));
  const secondsElapsed = Math.max(0, totalPhaseSeconds - secondsLeft);

  const ensureAudioContext = useCallback(() => {
    if (audioContextRef.current) return audioContextRef.current;
    const ContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!ContextCtor) return null;
    const next = new ContextCtor();
    audioContextRef.current = next;
    return next;
  }, []);

  const playBeepPattern = useCallback(
    (kind: "warning" | "complete") => {
      if (!enableSoundAlerts) return;
      const context = ensureAudioContext();
      if (!context) return;
      const start = context.currentTime + 0.02;
      const beeps =
        kind === "warning"
          ? [
              { frequency: 660, offset: 0, duration: 0.12 },
              { frequency: 780, offset: 0.16, duration: 0.12 },
            ]
          : [
              { frequency: 523, offset: 0, duration: 0.14 },
              { frequency: 659, offset: 0.16, duration: 0.14 },
              { frequency: 784, offset: 0.32, duration: 0.14 },
            ];

      beeps.forEach((beep) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = beep.frequency;
        gain.gain.setValueAtTime(0.0001, start + beep.offset);
        gain.gain.exponentialRampToValueAtTime(0.06, start + beep.offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + beep.offset + beep.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start + beep.offset);
        oscillator.stop(start + beep.offset + beep.duration + 0.03);
      });
    },
    [enableSoundAlerts, ensureAudioContext],
  );

  const pushSystemNotification = useCallback(
    (title: string, body: string, requireInteraction = false) => {
      if (!enableSystemNotifications) return;
      if (!("Notification" in window)) return;
      if (Notification.permission !== "granted") return;
      const notification = new Notification(title, {
        body,
        tag: "utiliora-pomodoro",
        requireInteraction,
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    },
    [enableSystemNotifications],
  );

  const releaseWakeLock = useCallback(async () => {
    if (!wakeLockRef.current) return;
    try {
      await wakeLockRef.current.release();
    } catch {
      // Ignore wake lock release failures.
    } finally {
      wakeLockRef.current = null;
    }
  }, []);

  const openMiniWindow = useCallback(() => {
    const popup = window.open("", "utiliora-pomodoro-mini", "noopener,noreferrer,width=320,height=240");
    if (!popup) {
      setStatus("Enable popups to open mini timer window.");
      return false;
    }
    popup.document.open();
    popup.document.write(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pomodoro Mini Timer</title>
  <style>
    body {
      margin: 0;
      font-family: "Segoe UI", Arial, sans-serif;
      background: #f7fafc;
      color: #1a1f27;
      padding: 16px;
      display: grid;
      gap: 10px;
    }
    .mode { color: #445569; font-weight: 600; font-size: 14px; }
    .time { font-size: 42px; font-weight: 700; line-height: 1; font-family: Consolas, monospace; }
    .task { color: #445569; min-height: 18px; }
    .bar { width: 100%; height: 9px; border-radius: 999px; overflow: hidden; border: 1px solid #c8d2df; background: #e8eef5; }
    .bar > span { display: block; height: 100%; width: 0%; background: linear-gradient(90deg, #1f6ad8, #1c4ca4); }
  </style>
</head>
<body>
  <div class="mode" id="mini-mode">Focus</div>
  <div class="time" id="mini-time">00:00</div>
  <div class="task" id="mini-task"></div>
  <div class="bar"><span id="mini-progress"></span></div>
</body>
</html>`);
    popup.document.close();
    popupRef.current = popup;
    setStatus("Mini timer opened. Keep it above other windows if your OS allows.");
    return true;
  }, []);

  const updateMiniWindow = useCallback(
    (modeLabel: string, mm: string, ss: string) => {
      const popup = popupRef.current;
      if (!popup || popup.closed) return;
      const modeNode = popup.document.getElementById("mini-mode");
      const timeNode = popup.document.getElementById("mini-time");
      const taskNode = popup.document.getElementById("mini-task");
      const progressNode = popup.document.getElementById("mini-progress");
      if (modeNode) modeNode.textContent = `${modeLabel} ${running ? "(running)" : "(paused)"}`;
      if (timeNode) timeNode.textContent = `${mm}:${ss}`;
      if (taskNode) taskNode.textContent = currentTask.trim() ? `Task: ${currentTask.trim()}` : "Task: none";
      if (progressNode) (progressNode as HTMLElement).style.width = `${progressPercent}%`;
    },
    [currentTask, progressPercent, running],
  );

  useEffect(() => {
    if (!toolSession.isReady) return;
    setIsSessionHydrated(false);

    const clampInteger = (value: unknown, min: number, max: number, fallback: number): number => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) return fallback;
      return Math.max(min, Math.min(max, Math.round(numeric)));
    };

    let nextFocusMinutes = 25;
    let nextShortBreakMinutes = 5;
    let nextLongBreakMinutes = 15;
    let nextSessionsBeforeLongBreak = 4;
    let nextAutoStartBreaks = false;
    let nextAutoStartFocus = false;
    let nextEnableSystemNotifications = false;
    let nextEnableSoundAlerts = true;
    let nextEnableWarnings = true;
    let nextWarningSeconds = 60;
    let nextKeepScreenAwake = false;
    let nextMode: PomodoroMode = "focus";
    let nextSecondsLeft = nextFocusMinutes * 60;
    let nextRunning = false;
    let nextCompletedFocusInCycle = 0;
    let nextCurrentTask = "";
    let nextNeedsAttention = false;
    let nextStatus = "Ready to focus.";
    let nextStats: PomodoroStats = {
      dateKey: todayKey,
      completedFocusSessions: 0,
      focusMinutes: 0,
      completedBreaks: 0,
      breakMinutes: 0,
    };

    const durationForLoadedMode = (targetMode: PomodoroMode): number => {
      if (targetMode === "focus") return nextFocusMinutes;
      if (targetMode === "short-break") return nextShortBreakMinutes;
      return nextLongBreakMinutes;
    };

    try {
      const rawSettings =
        localStorage.getItem(settingsKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacySettingsKey) : null);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as {
          focusMinutes?: number;
          shortBreakMinutes?: number;
          longBreakMinutes?: number;
          sessionsBeforeLongBreak?: number;
          autoStartBreaks?: boolean;
          autoStartFocus?: boolean;
          enableSystemNotifications?: boolean;
          enableSoundAlerts?: boolean;
          enableWarnings?: boolean;
          warningSeconds?: number;
          keepScreenAwake?: boolean;
        };
        nextFocusMinutes = clampInteger(parsed.focusMinutes, 10, 90, nextFocusMinutes);
        nextShortBreakMinutes = clampInteger(parsed.shortBreakMinutes, 3, 30, nextShortBreakMinutes);
        nextLongBreakMinutes = clampInteger(parsed.longBreakMinutes, 10, 45, nextLongBreakMinutes);
        nextSessionsBeforeLongBreak = clampInteger(parsed.sessionsBeforeLongBreak, 2, 8, nextSessionsBeforeLongBreak);
        nextAutoStartBreaks = Boolean(parsed.autoStartBreaks);
        nextAutoStartFocus = Boolean(parsed.autoStartFocus);
        nextEnableSystemNotifications = Boolean(parsed.enableSystemNotifications);
        nextEnableSoundAlerts = parsed.enableSoundAlerts ?? nextEnableSoundAlerts;
        nextEnableWarnings = parsed.enableWarnings ?? nextEnableWarnings;
        nextWarningSeconds = clampInteger(parsed.warningSeconds, 10, 300, nextWarningSeconds);
        nextKeepScreenAwake = Boolean(parsed.keepScreenAwake);
      }

      const rawStats =
        localStorage.getItem(statsKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacyStatsKey) : null);
      if (rawStats) {
        const parsedStats = JSON.parse(rawStats) as Partial<PomodoroStats>;
        if (parsedStats.dateKey === todayKey) {
          nextStats = {
            dateKey: todayKey,
            completedFocusSessions: Math.max(0, Math.round(parsedStats.completedFocusSessions ?? 0)),
            focusMinutes: Math.max(0, Math.round(parsedStats.focusMinutes ?? 0)),
            completedBreaks: Math.max(0, Math.round(parsedStats.completedBreaks ?? 0)),
            breakMinutes: Math.max(0, Math.round(parsedStats.breakMinutes ?? 0)),
          };
        }
      }

      const rawRuntime = localStorage.getItem(runtimeKey);
      if (rawRuntime) {
        const parsedRuntime = JSON.parse(rawRuntime) as PomodoroRuntimeState;
        if (parsedRuntime.mode === "focus" || parsedRuntime.mode === "short-break" || parsedRuntime.mode === "long-break") {
          nextMode = parsedRuntime.mode;
        }
        const phaseMaxSeconds = Math.max(1, durationForLoadedMode(nextMode) * 60);
        const rawSeconds = clampInteger(parsedRuntime.secondsLeft, 0, phaseMaxSeconds, phaseMaxSeconds);
        let recoveredSeconds = rawSeconds;
        if (parsedRuntime.running && typeof parsedRuntime.snapshotAt === "number") {
          const elapsedSeconds = Math.max(0, Math.floor((Date.now() - parsedRuntime.snapshotAt) / 1000));
          recoveredSeconds = Math.max(0, rawSeconds - elapsedSeconds);
          if (elapsedSeconds > 0) {
            nextStatus =
              recoveredSeconds > 0
                ? "Recovered your running timer session."
                : "Recovered timer reached the end while you were away.";
          }
        }
        nextSecondsLeft = recoveredSeconds;
        nextRunning = Boolean(parsedRuntime.running) && recoveredSeconds > 0;
        nextCompletedFocusInCycle = Math.max(0, clampInteger(parsedRuntime.completedFocusInCycle, 0, 500, 0));
        nextCurrentTask = typeof parsedRuntime.currentTask === "string" ? parsedRuntime.currentTask.slice(0, 200) : "";
        nextNeedsAttention = Boolean(parsedRuntime.needsAttention) || (Boolean(parsedRuntime.running) && recoveredSeconds === 0);
      } else {
        nextSecondsLeft = durationForLoadedMode(nextMode) * 60;
      }
    } catch {
      // Ignore malformed local data.
    }

    setFocusMinutes(nextFocusMinutes);
    setShortBreakMinutes(nextShortBreakMinutes);
    setLongBreakMinutes(nextLongBreakMinutes);
    setSessionsBeforeLongBreak(nextSessionsBeforeLongBreak);
    setAutoStartBreaks(nextAutoStartBreaks);
    setAutoStartFocus(nextAutoStartFocus);
    setEnableSystemNotifications(nextEnableSystemNotifications);
    setEnableSoundAlerts(nextEnableSoundAlerts);
    setEnableWarnings(nextEnableWarnings);
    setWarningSeconds(nextWarningSeconds);
    setKeepScreenAwake(nextKeepScreenAwake);
    setMode(nextMode);
    setSecondsLeft(nextSecondsLeft);
    setRunning(nextRunning);
    setCompletedFocusInCycle(nextCompletedFocusInCycle);
    setCurrentTask(nextCurrentTask);
    setNeedsAttention(nextNeedsAttention);
    setStatus(nextStatus);
    setStats(nextStats);
    skipPausedResetRef.current = true;

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
    setIsSessionHydrated(true);
  }, [
    legacySettingsKey,
    legacyStatsKey,
    runtimeKey,
    settingsKey,
    statsKey,
    todayKey,
    toolSession.isReady,
    toolSession.sessionId,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          focusMinutes,
          shortBreakMinutes,
          longBreakMinutes,
          sessionsBeforeLongBreak,
          autoStartBreaks,
          autoStartFocus,
          enableSystemNotifications,
          enableSoundAlerts,
          enableWarnings,
          warningSeconds,
          keepScreenAwake,
        }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [
    autoStartBreaks,
    autoStartFocus,
    focusMinutes,
    isSessionHydrated,
    keepScreenAwake,
    longBreakMinutes,
    sessionsBeforeLongBreak,
    settingsKey,
    shortBreakMinutes,
    toolSession.isReady,
    enableSystemNotifications,
    enableSoundAlerts,
    enableWarnings,
    warningSeconds,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(statsKey, JSON.stringify(stats));
    } catch {
      // Ignore storage failures.
    }
  }, [isSessionHydrated, stats, statsKey, toolSession.isReady]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(
        runtimeKey,
        JSON.stringify({
          mode,
          secondsLeft: Math.max(0, Math.round(secondsLeft)),
          running,
          completedFocusInCycle,
          currentTask: currentTask.slice(0, 200),
          needsAttention,
          snapshotAt: Date.now(),
        } satisfies PomodoroRuntimeState),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [
    completedFocusInCycle,
    currentTask,
    isSessionHydrated,
    mode,
    needsAttention,
    running,
    runtimeKey,
    secondsLeft,
    toolSession.isReady,
  ]);

  useEffect(() => {
    if (!isSessionHydrated || running) return;
    if (skipPausedResetRef.current) {
      skipPausedResetRef.current = false;
      return;
    }
    setSecondsLeft(durationForMode(mode) * 60);
  }, [durationForMode, isSessionHydrated, mode, running]);

  useEffect(() => {
    if (!running) return;
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((current) => Math.max(0, current - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [running, secondsLeft]);

  useEffect(() => {
    if (!keepScreenAwake || !running) {
      void releaseWakeLock();
      return;
    }
    const nav = navigator as Navigator & {
      wakeLock?: { request(type: "screen"): Promise<{ release(): Promise<void> }> };
    };
    if (!nav.wakeLock?.request) return;
    let cancelled = false;
    nav.wakeLock
      .request("screen")
      .then((sentinel) => {
        if (cancelled) {
          void sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
      })
      .catch(() => {
        setStatus("Wake lock request blocked. Keep this tab in foreground.");
      });
    return () => {
      cancelled = true;
      void releaseWakeLock();
    };
  }, [keepScreenAwake, releaseWakeLock, running]);

  useEffect(() => {
    const baseTitle = "Utiliora";
    const modeLabel = mode === "focus" ? "Focus" : mode === "short-break" ? "Short Break" : "Long Break";
    const mm = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    document.title = needsAttention ? `Time up - ${modeLabel} | ${baseTitle}` : `${mm}:${ss} ${modeLabel} | ${baseTitle}`;
    return () => {
      document.title = baseTitle;
    };
  }, [mode, needsAttention, secondsLeft]);

  useEffect(() => {
    if (!showMiniWindow) {
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
      popupRef.current = null;
      return;
    }
    if (!popupRef.current || popupRef.current.closed) {
      const opened = openMiniWindow();
      if (!opened) {
        setShowMiniWindow(false);
      }
    }
  }, [openMiniWindow, showMiniWindow]);

  const completePhase = useCallback(() => {
    setRunning(false);
    setNeedsAttention(true);
    if (mode === "focus") {
      const nextCount = completedFocusInCycle + 1;
      const nextMode: PomodoroMode = nextCount % sessionsBeforeLongBreak === 0 ? "long-break" : "short-break";
      const focusMinutesCompleted = durationForMode("focus");
      setCompletedFocusInCycle(nextCount);
      setMode(nextMode);
      setSecondsLeft(durationForMode(nextMode) * 60);
      setRunning(autoStartBreaks);
      playBeepPattern("complete");
      setStatus(
        nextMode === "long-break"
          ? "Focus complete. Long break started."
          : "Focus complete. Short break started.",
      );
      pushSystemNotification(
        "Focus session completed",
        nextMode === "long-break"
          ? "Time for a long break."
          : "Time for a short break.",
        true,
      );
      setStats((current) => {
        const safeCurrent =
          current.dateKey === todayKey
            ? current
            : { dateKey: todayKey, completedFocusSessions: 0, focusMinutes: 0, completedBreaks: 0, breakMinutes: 0 };
        return {
          ...safeCurrent,
          completedFocusSessions: safeCurrent.completedFocusSessions + 1,
          focusMinutes: safeCurrent.focusMinutes + focusMinutesCompleted,
        };
      });
    } else {
      setMode("focus");
      setSecondsLeft(durationForMode("focus") * 60);
      setRunning(autoStartFocus);
      playBeepPattern("complete");
      setStatus("Break complete. Back to focus.");
      pushSystemNotification("Break complete", "Back to focus mode.", true);
      setStats((current) => {
        const safeCurrent =
          current.dateKey === todayKey
            ? current
            : { dateKey: todayKey, completedFocusSessions: 0, focusMinutes: 0, completedBreaks: 0, breakMinutes: 0 };
        return {
          ...safeCurrent,
          completedBreaks: safeCurrent.completedBreaks + 1,
          breakMinutes: safeCurrent.breakMinutes + durationForMode(mode),
        };
      });
    }
  }, [
    autoStartBreaks,
    autoStartFocus,
    completedFocusInCycle,
    durationForMode,
    mode,
    playBeepPattern,
    pushSystemNotification,
    sessionsBeforeLongBreak,
    todayKey,
  ]);

  useEffect(() => {
    if (running && secondsLeft === 0) {
      completePhase();
      trackEvent("pomodoro_phase_complete", { mode });
    }
  }, [completePhase, mode, running, secondsLeft]);

  useEffect(() => {
    if (!running || !enableWarnings) return;
    if (secondsLeft !== warningSeconds) return;
    if (secondsLeft <= 0) return;
    const warningMessage = mode === "focus" ? "Focus session ending soon." : "Break ending soon.";
    setStatus(warningMessage);
    playBeepPattern("warning");
    pushSystemNotification(
      mode === "focus" ? "Focus warning" : "Break warning",
      `${Math.max(1, Math.round(warningSeconds / 60))} minute warning.`,
    );
  }, [enableWarnings, mode, playBeepPattern, pushSystemNotification, running, secondsLeft, warningSeconds]);

  useEffect(() => {
    const target = popupRef.current;
    if (!showMiniWindow || !target || target.closed) return;
    const modeLabel = mode === "focus" ? "Focus" : mode === "short-break" ? "Short Break" : "Long Break";
    const mm = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, "0");
    const ss = (secondsLeft % 60).toString().padStart(2, "0");
    updateMiniWindow(modeLabel, mm, ss);
  }, [mode, secondsLeft, showMiniWindow, updateMiniWindow]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.code === "Space") {
        event.preventDefault();
        setRunning((current) => !current);
        setNeedsAttention(false);
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        completePhase();
        setStatus("Skipped current phase.");
      } else if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        setRunning(false);
        setMode("focus");
        setSecondsLeft(durationForMode("focus") * 60);
        setNeedsAttention(false);
        setStatus("Timer reset to focus phase.");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completePhase, durationForMode]);

  useEffect(() => {
    return () => {
      if (popupRef.current && !popupRef.current.closed) popupRef.current.close();
      void releaseWakeLock();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [releaseWakeLock]);

  const modeLabel =
    mode === "focus" ? "Focus" : mode === "short-break" ? "Short Break" : "Long Break";

  const mm = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={RefreshCw}
        title="Pomodoro timer"
        subtitle="Advanced focus timer with alerts, warning cues, wake lock, mini window mode, and keyboard shortcuts."
      />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each session is saved locally and pinned to this /productivity-tools URL."
        onSelectSession={(nextSessionId) => {
          toolSession.selectSession(nextSessionId);
          setStatus("Switched focus session.");
        }}
        onCreateSession={() => {
          toolSession.createSession();
          setStatus("Created a new focus session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />
      <div className="preset-row">
        <span className="supporting-text">Presets:</span>
        <button
          className="chip-button"
          type="button"
          onClick={() => {
            setFocusMinutes(25);
            setShortBreakMinutes(5);
            setLongBreakMinutes(15);
            setSessionsBeforeLongBreak(4);
            setStatus("Applied classic Pomodoro preset.");
          }}
        >
          Classic 25/5
        </button>
        <button
          className="chip-button"
          type="button"
          onClick={() => {
            setFocusMinutes(50);
            setShortBreakMinutes(10);
            setLongBreakMinutes(20);
            setSessionsBeforeLongBreak(3);
            setStatus("Applied deep work preset.");
          }}
        >
          Deep Work 50/10
        </button>
        <button
          className="chip-button"
          type="button"
          onClick={() => {
            setFocusMinutes(90);
            setShortBreakMinutes(15);
            setLongBreakMinutes(25);
            setSessionsBeforeLongBreak(2);
            setStatus("Applied maker block preset.");
          }}
        >
          Maker 90/15
        </button>
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Focus (minutes)</span>
          <input
            type="number"
            min={10}
            max={90}
            value={focusMinutes}
            onChange={(event) => setFocusMinutes(Math.max(10, Math.min(90, Number(event.target.value) || 25)))}
          />
        </label>
        <label className="field">
          <span>Short break (minutes)</span>
          <input
            type="number"
            min={3}
            max={30}
            value={shortBreakMinutes}
            onChange={(event) =>
              setShortBreakMinutes(Math.max(3, Math.min(30, Number(event.target.value) || 5)))
            }
          />
        </label>
        <label className="field">
          <span>Long break (minutes)</span>
          <input
            type="number"
            min={10}
            max={45}
            value={longBreakMinutes}
            onChange={(event) =>
              setLongBreakMinutes(Math.max(10, Math.min(45, Number(event.target.value) || 15)))
            }
          />
        </label>
        <label className="field">
          <span>Sessions before long break</span>
          <input
            type="number"
            min={2}
            max={8}
            value={sessionsBeforeLongBreak}
            onChange={(event) =>
              setSessionsBeforeLongBreak(Math.max(2, Math.min(8, Number(event.target.value) || 4)))
            }
          />
        </label>
        <label className="field">
          <span>Warning before phase ends (seconds)</span>
          <input
            type="number"
            min={10}
            max={300}
            step={5}
            value={warningSeconds}
            onChange={(event) => setWarningSeconds(Math.max(10, Math.min(300, Number(event.target.value) || 60)))}
          />
        </label>
      </div>
      <label className="field">
        <span>Current focus task</span>
        <input
          type="text"
          value={currentTask}
          placeholder="What are you focusing on now?"
          onChange={(event) => setCurrentTask(event.target.value)}
        />
      </label>
      <div className="button-row">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={autoStartBreaks}
            onChange={(event) => setAutoStartBreaks(event.target.checked)}
          />
          Auto-start breaks
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={autoStartFocus}
            onChange={(event) => setAutoStartFocus(event.target.checked)}
          />
          Auto-start focus
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={enableWarnings}
            onChange={(event) => setEnableWarnings(event.target.checked)}
          />
          Warning alerts
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={enableSoundAlerts}
            onChange={(event) => setEnableSoundAlerts(event.target.checked)}
          />
          Sound alerts
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={keepScreenAwake}
            onChange={(event) => setKeepScreenAwake(event.target.checked)}
          />
          Keep screen awake
        </label>
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            if (!("Notification" in window)) {
              setStatus("System notifications are not supported in this browser.");
              setNotificationPermission("unsupported");
              return;
            }
            const permission = await Notification.requestPermission();
            setNotificationPermission(permission);
            if (permission === "granted") {
              setEnableSystemNotifications(true);
              setStatus("System notifications enabled.");
            } else {
              setEnableSystemNotifications(false);
              setStatus("System notifications are blocked.");
            }
          }}
        >
          {notificationPermission === "granted" ? <Bell size={15} /> : <BellOff size={15} />}
          {notificationPermission === "granted" ? "Notifications ready" : "Enable notifications"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const next = !showMiniWindow;
            setShowMiniWindow(next);
            if (!next) setStatus("Mini timer closed.");
          }}
        >
          <MonitorUp size={15} />
          {showMiniWindow ? "Close mini timer" : "Open mini timer"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            playBeepPattern("warning");
            setStatus("Played test alert sound.");
          }}
          disabled={!enableSoundAlerts}
        >
          {enableSoundAlerts ? <Volume2 size={15} /> : <VolumeX size={15} />}
          Test sound
        </button>
      </div>
      <div className="timer-value" aria-live="polite">
        {mm}:{ss}
      </div>
      <div className="progress-panel" aria-hidden>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>
      <ResultList
        rows={[
          { label: "Session", value: toolSession.sessionLabel },
          { label: "Current phase", value: modeLabel },
          { label: "Task", value: currentTask.trim() || "No task set" },
          { label: "Progress", value: `${progressPercent.toFixed(0)}%` },
          { label: "Elapsed this phase", value: `${formatNumericValue(secondsElapsed)} sec` },
          { label: "Completed focus sessions today", value: formatNumericValue(stats.completedFocusSessions) },
          { label: "Focused minutes today", value: formatNumericValue(stats.focusMinutes) },
          { label: "Completed breaks today", value: formatNumericValue(stats.completedBreaks) },
          { label: "Break minutes today", value: formatNumericValue(stats.breakMinutes) },
          { label: "System notifications", value: notificationPermission },
          { label: "Wake lock", value: keepScreenAwake ? "Enabled" : "Disabled" },
        ]}
      />
      <div className="button-row">
        <span className="supporting-text">Jump to phase:</span>
        <button
          className="chip-button"
          type="button"
          onClick={() => {
            setRunning(false);
            setMode("focus");
            setSecondsLeft(durationForMode("focus") * 60);
            setNeedsAttention(false);
          }}
        >
          Focus
        </button>
        <button
          className="chip-button"
          type="button"
          onClick={() => {
            setRunning(false);
            setMode("short-break");
            setSecondsLeft(durationForMode("short-break") * 60);
            setNeedsAttention(false);
          }}
        >
          Short break
        </button>
        <button
          className="chip-button"
          type="button"
          onClick={() => {
            setRunning(false);
            setMode("long-break");
            setSecondsLeft(durationForMode("long-break") * 60);
            setNeedsAttention(false);
          }}
        >
          Long break
        </button>
      </div>
      <div className="button-row">
        <button
          className="action-button"
          type="button"
          onClick={() => {
            setRunning(true);
            setNeedsAttention(false);
            if (enableSoundAlerts) ensureAudioContext();
          }}
        >
          Start
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setRunning(false);
            setNeedsAttention(false);
          }}
        >
          Pause
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            completePhase();
            setStatus("Skipped current phase.");
          }}
        >
          Skip phase (S)
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setRunning(false);
            setMode("focus");
            setSecondsLeft(durationForMode("focus") * 60);
            setNeedsAttention(false);
            setStatus("Timer reset to focus phase.");
          }}
        >
          Reset (R)
        </button>
      </div>
      <p className="supporting-text">
        {status} Shortcuts: `Space` start/pause, `S` skip, `R` reset.
      </p>
      {needsAttention ? (
        <p className="status-badge warn">Timer needs attention. Next phase is ready.</p>
      ) : null}
    </section>
  );
}

interface TranslatorHistoryEntry {
  id: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedSourceLanguage: string;
  inputText: string;
  translatedText: string;
  provider: string;
  createdAt: number;
}

interface TextTranslateApiSuccessPayload {
  ok: true;
  provider: string;
  sourceLanguage: string;
  detectedSourceLanguage?: string;
  targetLanguage: string;
  translatedText: string;
  chunks: number;
}

interface TextTranslateApiErrorPayload {
  ok: false;
  error?: string;
  details?: string[];
}

type TextTranslateApiPayload = TextTranslateApiSuccessPayload | TextTranslateApiErrorPayload;

const TRANSLATOR_HISTORY_LIMIT = 24;
const TRANSLATOR_MAX_INPUT_LENGTH = 20_000;

function sanitizeTranslatorHistoryEntry(candidate: unknown): TranslatorHistoryEntry | null {
  if (!candidate || typeof candidate !== "object") return null;
  const entry = candidate as Partial<TranslatorHistoryEntry>;
  if (typeof entry.inputText !== "string" || typeof entry.translatedText !== "string") return null;

  const sourceLanguage = resolveTranslationLanguage(entry.sourceLanguage, TRANSLATION_AUTO_LANGUAGE_CODE, {
    allowAuto: true,
    supportedOnly: true,
  });
  const targetLanguage = resolveTranslationLanguage(entry.targetLanguage, "en", {
    allowAuto: false,
    supportedOnly: true,
  });
  const detectedSourceLanguage = resolveTranslationLanguage(entry.detectedSourceLanguage, "", {
    allowAuto: false,
    supportedOnly: true,
  });

  const inputText = entry.inputText.slice(0, TRANSLATOR_MAX_INPUT_LENGTH);
  const translatedText = entry.translatedText.slice(0, TRANSLATOR_MAX_INPUT_LENGTH);
  if (!inputText.trim() || !translatedText.trim()) return null;

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    sourceLanguage,
    targetLanguage,
    detectedSourceLanguage,
    inputText,
    translatedText,
    provider: typeof entry.provider === "string" && entry.provider ? entry.provider : "unknown",
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
  };
}

function TextTranslatorTool() {
  const toolSession = useToolSession({
    toolKey: "text-translator",
    defaultSessionLabel: "Translator workspace",
    newSessionPrefix: "translator",
  });
  const workspaceStorageKey = toolSession.storageKey("utiliora-text-translator-workspace-v1");
  const historyStorageKey = toolSession.storageKey("utiliora-text-translator-history-v1");
  const legacyWorkspaceStorageKey = "utiliora-text-translator-workspace-v1";
  const legacyHistoryStorageKey = "utiliora-text-translator-history-v1";
  const abortRef = useRef<AbortController | null>(null);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState(TRANSLATION_AUTO_LANGUAGE_CODE);
  const [targetLanguage, setTargetLanguage] = useState("es");
  const [translatedText, setTranslatedText] = useState("");
  const [detectedSourceLanguage, setDetectedSourceLanguage] = useState("");
  const [provider, setProvider] = useState("");
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [history, setHistory] = useState<TranslatorHistoryEntry[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");

  useEffect(() => {
    if (!toolSession.isReady) return;
    setIsSessionHydrated(false);

    let nextInput = "";
    let nextSource = TRANSLATION_AUTO_LANGUAGE_CODE;
    let nextTarget = "es";
    let nextTranslated = "";
    let nextDetectedSource = "";
    let nextProvider = "";
    let nextAutoTranslate = true;
    let nextHistory: TranslatorHistoryEntry[] = [];

    try {
      const rawWorkspace =
        localStorage.getItem(workspaceStorageKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacyWorkspaceStorageKey) : null);
      if (rawWorkspace) {
        const parsed = JSON.parse(rawWorkspace) as {
          inputText?: string;
          sourceLanguage?: string;
          targetLanguage?: string;
          translatedText?: string;
          detectedSourceLanguage?: string;
          provider?: string;
          autoTranslate?: boolean;
        };
        nextInput = typeof parsed.inputText === "string" ? parsed.inputText.slice(0, TRANSLATOR_MAX_INPUT_LENGTH) : "";
        nextSource = resolveTranslationLanguage(parsed.sourceLanguage, TRANSLATION_AUTO_LANGUAGE_CODE, {
          allowAuto: true,
          supportedOnly: true,
        });
        nextTarget = resolveTranslationLanguage(parsed.targetLanguage, "es", {
          allowAuto: false,
          supportedOnly: true,
        });
        nextTranslated =
          typeof parsed.translatedText === "string" ? parsed.translatedText.slice(0, TRANSLATOR_MAX_INPUT_LENGTH) : "";
        nextDetectedSource = resolveTranslationLanguage(parsed.detectedSourceLanguage, "", {
          allowAuto: false,
          supportedOnly: true,
        });
        nextProvider = typeof parsed.provider === "string" ? parsed.provider : "";
        nextAutoTranslate = parsed.autoTranslate ?? true;
      }

      const rawHistory =
        localStorage.getItem(historyStorageKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacyHistoryStorageKey) : null);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory) as unknown[];
        if (Array.isArray(parsed)) {
          nextHistory = parsed
            .map((entry) => sanitizeTranslatorHistoryEntry(entry))
            .filter((entry): entry is TranslatorHistoryEntry => Boolean(entry))
            .slice(0, TRANSLATOR_HISTORY_LIMIT);
        }
      }
    } catch {
      // Ignore malformed translator session state.
    }

    setInputText(nextInput);
    setSourceLanguage(nextSource);
    setTargetLanguage(nextTarget);
    setTranslatedText(nextTranslated);
    setDetectedSourceLanguage(nextDetectedSource);
    setProvider(nextProvider);
    setAutoTranslate(nextAutoTranslate);
    setHistory(nextHistory);
    setStatus("");
    setCopyStatus("");
    setIsTranslating(false);
    setIsSessionHydrated(true);
  }, [
    historyStorageKey,
    legacyHistoryStorageKey,
    legacyWorkspaceStorageKey,
    toolSession.isReady,
    toolSession.sessionId,
    workspaceStorageKey,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(
        workspaceStorageKey,
        JSON.stringify({
          inputText,
          sourceLanguage,
          targetLanguage,
          translatedText,
          detectedSourceLanguage,
          provider,
          autoTranslate,
        }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [
    autoTranslate,
    detectedSourceLanguage,
    inputText,
    isSessionHydrated,
    provider,
    sourceLanguage,
    targetLanguage,
    toolSession.isReady,
    translatedText,
    workspaceStorageKey,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, TRANSLATOR_HISTORY_LIMIT)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey, isSessionHydrated, toolSession.isReady]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  const pushHistoryEntry = useCallback(
    (entry: Omit<TranslatorHistoryEntry, "id" | "createdAt">) => {
      if (!entry.inputText.trim() || !entry.translatedText.trim()) return;
      setHistory((current) => {
        const existingIndex = current.findIndex(
          (candidate) =>
            candidate.sourceLanguage === entry.sourceLanguage &&
            candidate.targetLanguage === entry.targetLanguage &&
            candidate.inputText === entry.inputText &&
            candidate.translatedText === entry.translatedText,
        );

        const nextEntry: TranslatorHistoryEntry = {
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          ...entry,
        };

        if (existingIndex >= 0) {
          const existing = current[existingIndex];
          const merged: TranslatorHistoryEntry = {
            ...existing,
            ...nextEntry,
            id: existing.id,
          };
          const next = [merged, ...current.filter((_, index) => index !== existingIndex)];
          return next.slice(0, TRANSLATOR_HISTORY_LIMIT);
        }

        return [nextEntry, ...current].slice(0, TRANSLATOR_HISTORY_LIMIT);
      });
    },
    [],
  );

  const translateText = useCallback(
    async (trigger: "manual" | "auto") => {
      const text = inputText.slice(0, TRANSLATOR_MAX_INPUT_LENGTH);
      if (!text.trim()) {
        setTranslatedText("");
        setDetectedSourceLanguage("");
        setProvider("");
        if (trigger === "manual") {
          setStatus("Enter text to translate.");
        }
        return;
      }

      if (sourceLanguage !== TRANSLATION_AUTO_LANGUAGE_CODE && sourceLanguage === targetLanguage) {
        setTranslatedText(text);
        setDetectedSourceLanguage(sourceLanguage);
        setProvider("identity");
        setStatus("Source and target are the same; text was kept unchanged.");
        pushHistoryEntry({
          sourceLanguage,
          targetLanguage,
          detectedSourceLanguage: sourceLanguage,
          inputText: text,
          translatedText: text,
          provider: "identity",
        });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setIsTranslating(true);
      setStatus(trigger === "auto" ? "Translating..." : "Translating text...");

      try {
        const response = await fetch("/api/text-translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            sourceLanguage,
            targetLanguage,
          }),
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => null)) as TextTranslateApiPayload | null;
        if (!response.ok || !payload || payload.ok !== true) {
          const message = payload && payload.ok === false && typeof payload.error === "string"
            ? payload.error
            : "Translation failed. Please try again.";
          throw new Error(message);
        }

        const normalizedDetected =
          resolveTranslationLanguage(payload.detectedSourceLanguage, "", {
            allowAuto: false,
            supportedOnly: true,
          }) ||
          (sourceLanguage === TRANSLATION_AUTO_LANGUAGE_CODE ? "" : sourceLanguage);

        const normalizedProvider = payload.provider || "unknown";
        setTranslatedText(payload.translatedText);
        setDetectedSourceLanguage(normalizedDetected);
        setProvider(normalizedProvider);
        setStatus(`Translated via ${normalizedProvider}.`);
        setCopyStatus("");
        trackEvent("text_translator_translate", {
          provider: normalizedProvider,
          chunks: payload.chunks,
          source: sourceLanguage,
          target: targetLanguage,
          trigger,
        });
        pushHistoryEntry({
          sourceLanguage,
          targetLanguage,
          detectedSourceLanguage: normalizedDetected,
          inputText: text,
          translatedText: payload.translatedText,
          provider: normalizedProvider,
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "name" in error &&
          (error as { name?: string }).name === "AbortError"
        ) {
          return;
        }
        const message = error instanceof Error && error.message ? error.message : "Translation failed.";
        setStatus(message);
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        setIsTranslating(false);
      }
    },
    [inputText, pushHistoryEntry, sourceLanguage, targetLanguage],
  );

  useEffect(() => {
    if (!isSessionHydrated || !autoTranslate) return;
    if (!inputText.trim()) return;
    const timeout = window.setTimeout(() => {
      void translateText("auto");
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [autoTranslate, inputText, isSessionHydrated, sourceLanguage, targetLanguage, translateText]);

  const sourceWordCount = countWords(inputText);
  const translatedWordCount = countWords(translatedText);
  const sourceCharacterCount = inputText.length;
  const translatedCharacterCount = translatedText.length;
  const effectiveDetectedSource =
    detectedSourceLanguage ||
    (sourceLanguage !== TRANSLATION_AUTO_LANGUAGE_CODE ? sourceLanguage : "");

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Languages}
        title="Text translator"
        subtitle="Translate text with auto-detect, multi-provider fallback, session workspaces, and persistent local history."
      />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each translator session is saved locally and linked to this /productivity-tools URL."
        onSelectSession={(nextSessionId) => {
          abortRef.current?.abort();
          abortRef.current = null;
          toolSession.selectSession(nextSessionId);
          setStatus("Switched translator session.");
        }}
        onCreateSession={() => {
          abortRef.current?.abort();
          abortRef.current = null;
          toolSession.createSession();
          setStatus("Created a new translator session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />
      <div className="field-grid">
        <label className="field">
          <span>Source language</span>
          <select
            value={sourceLanguage}
            onChange={(event) =>
              setSourceLanguage(
                resolveTranslationLanguage(event.target.value, TRANSLATION_AUTO_LANGUAGE_CODE, {
                  allowAuto: true,
                  supportedOnly: true,
                }),
              )
            }
          >
            <option value={TRANSLATION_AUTO_LANGUAGE_CODE}>Auto detect</option>
            {TRANSLATION_LANGUAGE_OPTIONS.map((entry) => (
              <option key={`source-${entry.code}`} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Target language</span>
          <select
            value={targetLanguage}
            onChange={(event) =>
              setTargetLanguage(
                resolveTranslationLanguage(event.target.value, "en", {
                  allowAuto: false,
                  supportedOnly: true,
                }),
              )
            }
          >
            {TRANSLATION_LANGUAGE_OPTIONS.map((entry) => (
              <option key={`target-${entry.code}`} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Auto translate</span>
          <select value={autoTranslate ? "on" : "off"} onChange={(event) => setAutoTranslate(event.target.value === "on")}>
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </label>
        <label className="field">
          <span>Detected source</span>
          <input type="text" readOnly value={effectiveDetectedSource ? getTranslationLanguageLabel(effectiveDetectedSource) : "Waiting for translation"} />
        </label>
      </div>
      <label className="field">
        <span>Source text</span>
        <textarea
          rows={8}
          value={inputText}
          placeholder="Enter text to translate..."
          onChange={(event) => setInputText(event.target.value.slice(0, TRANSLATOR_MAX_INPUT_LENGTH))}
        />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void translateText("manual")} disabled={isTranslating}>
          {isTranslating ? "Translating..." : "Translate"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const nextTarget = sourceLanguage === TRANSLATION_AUTO_LANGUAGE_CODE
              ? resolveTranslationLanguage(effectiveDetectedSource, "en", { allowAuto: false, supportedOnly: true })
              : sourceLanguage;
            if (nextTarget === targetLanguage) {
              setStatus("Source and target are currently the same. Choose a different language before swapping.");
              return;
            }
            setSourceLanguage(targetLanguage);
            setTargetLanguage(nextTarget);
            if (translatedText.trim()) {
              setInputText(translatedText);
              setTranslatedText(inputText);
            }
            setStatus("Swapped source and target languages.");
          }}
        >
          Swap languages
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setInputText("");
            setTranslatedText("");
            setDetectedSourceLanguage("");
            setProvider("");
            setStatus("Cleared translator content.");
            setCopyStatus("");
          }}
        >
          Clear text
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const copied = await copyTextToClipboard(translatedText);
            setCopyStatus(copied ? "Copied translated text." : "Could not copy translated text.");
          }}
          disabled={!translatedText.trim()}
        >
          <Copy size={15} />
          Copy output
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadTextFile(
              `translation-${targetLanguage}.txt`,
              translatedText,
              "text/plain;charset=utf-8;",
            )
          }
          disabled={!translatedText.trim()}
        >
          <Download size={15} />
          TXT
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadTextFile(
              `translation-history-${toolSession.sessionId}.json`,
              JSON.stringify(
                {
                  version: 1,
                  exportedAt: new Date().toISOString(),
                  sessionId: toolSession.sessionId,
                  history,
                },
                null,
                2,
              ),
              "application/json;charset=utf-8;",
            )
          }
          disabled={history.length === 0}
        >
          <Download size={15} />
          History JSON
        </button>
      </div>
      <label className="field">
        <span>Translated text</span>
        <textarea rows={8} value={translatedText} readOnly placeholder="Translation appears here..." />
      </label>
      {status ? <p className="supporting-text">{status}</p> : null}
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
      <ResultList
        rows={[
          { label: "Session", value: toolSession.sessionLabel },
          { label: "Source language", value: getTranslationLanguageLabel(sourceLanguage) },
          { label: "Target language", value: getTranslationLanguageLabel(targetLanguage) },
          {
            label: "Detected source",
            value: effectiveDetectedSource ? getTranslationLanguageLabel(effectiveDetectedSource) : "Unknown",
          },
          { label: "Source characters", value: formatNumericValue(sourceCharacterCount) },
          { label: "Source words", value: formatNumericValue(sourceWordCount) },
          { label: "Output characters", value: formatNumericValue(translatedCharacterCount) },
          { label: "Output words", value: formatNumericValue(translatedWordCount) },
          { label: "Provider", value: provider || "Not run yet" },
          { label: "Saved history", value: formatNumericValue(history.length) },
        ]}
      />
      <div className="mini-panel">
        <div className="panel-head">
          <h3>Saved translations</h3>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => {
              setHistory([]);
              setStatus("Cleared saved translation history.");
            }}
            disabled={history.length === 0}
          >
            Clear history
          </button>
        </div>
        {history.length === 0 ? (
          <p className="supporting-text">No saved translations yet. Run a translation to populate this workspace history.</p>
        ) : (
          <ul className="plain-list">
            {history.map((entry) => {
              const sourceLabel = getTranslationLanguageLabel(entry.sourceLanguage);
              const targetLabel = getTranslationLanguageLabel(entry.targetLanguage);
              const detectedLabel = entry.detectedSourceLanguage
                ? getTranslationLanguageLabel(entry.detectedSourceLanguage)
                : "Unknown";
              return (
                <li key={entry.id}>
                  <div className="history-line">
                    <strong>
                      {sourceLabel} {"->"} {targetLabel}
                    </strong>
                    <span className="supporting-text">{new Date(entry.createdAt).toLocaleString("en-US")}</span>
                  </div>
                  <p className="supporting-text">Input: {buildTranslationPreview(entry.inputText, 150)}</p>
                  <p className="supporting-text">Output: {buildTranslationPreview(entry.translatedText, 150)}</p>
                  <p className="supporting-text">
                    Provider: {entry.provider} | Detected source: {detectedLabel}
                  </p>
                  <div className="button-row">
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => {
                        setSourceLanguage(entry.sourceLanguage);
                        setTargetLanguage(entry.targetLanguage);
                        setInputText(entry.inputText);
                        setTranslatedText(entry.translatedText);
                        setDetectedSourceLanguage(entry.detectedSourceLanguage);
                        setProvider(entry.provider);
                        setStatus("Loaded translation from history.");
                      }}
                    >
                      Load
                    </button>
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={async () => {
                        const copied = await copyTextToClipboard(entry.translatedText);
                        setCopyStatus(copied ? "Copied history translation output." : "Could not copy history translation.");
                      }}
                    >
                      <Copy size={15} />
                      Copy
                    </button>
                    <button
                      className="action-button secondary"
                      type="button"
                      onClick={() => {
                        setHistory((current) => current.filter((candidate) => candidate.id !== entry.id));
                        setStatus("Deleted translation from history.");
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

interface DocumentTranslatorHistoryEntry {
  id: string;
  documentName: string;
  documentSource: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedSourceLanguage: string;
  providerSummary: string;
  sourceChars: number;
  translatedChars: number;
  chunkCount: number;
  durationMs: number;
  sourcePreview: string;
  translatedPreview: string;
  sourceExcerpt: string;
  translatedExcerpt: string;
  createdAt: number;
}

const DOCUMENT_TRANSLATOR_DEFAULT_CHUNK_SIZE = 3200;
const DOCUMENT_TRANSLATOR_HISTORY_EXCERPT_LIMIT = 12_000;

function sanitizeDocumentTranslatorHistoryEntry(candidate: unknown): DocumentTranslatorHistoryEntry | null {
  if (!candidate || typeof candidate !== "object") return null;
  const entry = candidate as Partial<DocumentTranslatorHistoryEntry>;
  if (typeof entry.documentName !== "string") return null;
  const sourceLanguage = resolveTranslationLanguage(entry.sourceLanguage, TRANSLATION_AUTO_LANGUAGE_CODE, {
    allowAuto: true,
    supportedOnly: true,
  });
  const targetLanguage = resolveTranslationLanguage(entry.targetLanguage, "en", {
    allowAuto: false,
    supportedOnly: true,
  });
  const detectedSourceLanguage = resolveTranslationLanguage(entry.detectedSourceLanguage, "", {
    allowAuto: false,
    supportedOnly: true,
  });
  const sourcePreview =
    typeof entry.sourcePreview === "string"
      ? entry.sourcePreview.slice(0, 320)
      : typeof entry.sourceExcerpt === "string"
        ? buildTranslationPreview(entry.sourceExcerpt, 320)
        : "";
  const translatedPreview =
    typeof entry.translatedPreview === "string"
      ? entry.translatedPreview.slice(0, 320)
      : typeof entry.translatedExcerpt === "string"
        ? buildTranslationPreview(entry.translatedExcerpt, 320)
        : "";
  const sourceExcerpt =
    typeof entry.sourceExcerpt === "string"
      ? entry.sourceExcerpt.slice(0, DOCUMENT_TRANSLATOR_HISTORY_EXCERPT_LIMIT)
      : sourcePreview;
  const translatedExcerpt =
    typeof entry.translatedExcerpt === "string"
      ? entry.translatedExcerpt.slice(0, DOCUMENT_TRANSLATOR_HISTORY_EXCERPT_LIMIT)
      : translatedPreview;
  if (!sourcePreview.trim() || !translatedPreview.trim()) return null;

  return {
    id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    documentName: entry.documentName.slice(0, 140) || "Document",
    documentSource: typeof entry.documentSource === "string" ? entry.documentSource.slice(0, 80) : "Unknown",
    sourceLanguage,
    targetLanguage,
    detectedSourceLanguage,
    providerSummary: typeof entry.providerSummary === "string" ? entry.providerSummary.slice(0, 180) : "unknown",
    sourceChars: Number.isFinite(entry.sourceChars) ? Math.max(0, Math.round(entry.sourceChars as number)) : 0,
    translatedChars: Number.isFinite(entry.translatedChars) ? Math.max(0, Math.round(entry.translatedChars as number)) : 0,
    chunkCount: Number.isFinite(entry.chunkCount) ? Math.max(0, Math.round(entry.chunkCount as number)) : 0,
    durationMs: Number.isFinite(entry.durationMs) ? Math.max(0, Math.round(entry.durationMs as number)) : 0,
    sourcePreview,
    translatedPreview,
    sourceExcerpt,
    translatedExcerpt,
    createdAt: typeof entry.createdAt === "number" ? entry.createdAt : Date.now(),
  };
}

interface DocumentTranslatorWorkspaceSnapshot {
  documentName: string;
  documentSource: string;
  sourceText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  detectedSourceLanguage: string;
  providerSummary: string;
  glossaryInput: string;
  chunkSize: number;
  pageRangeInput: string;
  maxPdfPages: number;
  includePdfPageMarkers: boolean;
  includeSourceOnDocExport: boolean;
  sourceTotalPages: number;
  sourceSelectedPages: number;
  lastChunkCount: number;
  lastDurationMs: number;
}

function sanitizeDocumentTranslatorWorkspaceSnapshot(candidate: unknown): DocumentTranslatorWorkspaceSnapshot {
  const entry = candidate && typeof candidate === "object"
    ? (candidate as Partial<DocumentTranslatorWorkspaceSnapshot>)
    : {};
  const sourceText = sanitizeDocumentTranslationText(typeof entry.sourceText === "string" ? entry.sourceText : "").slice(
    0,
    DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH,
  );
  const translatedText = sanitizeDocumentTranslationText(
    typeof entry.translatedText === "string" ? entry.translatedText : "",
  ).slice(0, DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH);
  const sourceLanguage = resolveTranslationLanguage(entry.sourceLanguage, TRANSLATION_AUTO_LANGUAGE_CODE, {
    allowAuto: true,
    supportedOnly: true,
  });
  const targetLanguage = resolveTranslationLanguage(entry.targetLanguage, "en", {
    allowAuto: false,
    supportedOnly: true,
  });
  const detectedSourceLanguage = resolveTranslationLanguage(entry.detectedSourceLanguage, "", {
    allowAuto: false,
    supportedOnly: true,
  });
  const chunkSize = Number.isFinite(entry.chunkSize)
    ? Math.max(600, Math.min(4000, Math.round(entry.chunkSize as number)))
    : DOCUMENT_TRANSLATOR_DEFAULT_CHUNK_SIZE;
  const maxPdfPages = Number.isFinite(entry.maxPdfPages)
    ? Math.max(1, Math.min(300, Math.round(entry.maxPdfPages as number)))
    : 80;
  const sourceTotalPages = Number.isFinite(entry.sourceTotalPages)
    ? Math.max(0, Math.min(3000, Math.round(entry.sourceTotalPages as number)))
    : 0;
  const sourceSelectedPages = Number.isFinite(entry.sourceSelectedPages)
    ? Math.max(0, Math.min(sourceTotalPages || 3000, Math.round(entry.sourceSelectedPages as number)))
    : 0;
  return {
    documentName: typeof entry.documentName === "string" ? entry.documentName.slice(0, 140) || "Untitled document" : "Untitled document",
    documentSource: typeof entry.documentSource === "string" ? entry.documentSource.slice(0, 120) || "No file loaded" : "No file loaded",
    sourceText,
    translatedText,
    sourceLanguage,
    targetLanguage,
    detectedSourceLanguage,
    providerSummary: typeof entry.providerSummary === "string" ? entry.providerSummary.slice(0, 220) : "",
    glossaryInput: typeof entry.glossaryInput === "string" ? entry.glossaryInput.slice(0, 10_000) : "",
    chunkSize,
    pageRangeInput: typeof entry.pageRangeInput === "string" ? entry.pageRangeInput.slice(0, 80) || "all" : "all",
    maxPdfPages,
    includePdfPageMarkers: entry.includePdfPageMarkers ?? true,
    includeSourceOnDocExport: entry.includeSourceOnDocExport ?? true,
    sourceTotalPages,
    sourceSelectedPages,
    lastChunkCount: Number.isFinite(entry.lastChunkCount) ? Math.max(0, Math.round(entry.lastChunkCount as number)) : 0,
    lastDurationMs: Number.isFinite(entry.lastDurationMs) ? Math.max(0, Math.round(entry.lastDurationMs as number)) : 0,
  };
}

function DocumentTranslatorTool() {
  const toolSession = useToolSession({
    toolKey: "document-translator",
    defaultSessionLabel: "Document translation workspace",
    newSessionPrefix: "doc-translator",
  });
  const workspaceStorageKey = toolSession.storageKey("utiliora-document-translator-workspace-v1");
  const historyStorageKey = toolSession.storageKey("utiliora-document-translator-history-v1");
  const legacyWorkspaceStorageKey = "utiliora-document-translator-workspace-v1";
  const legacyHistoryStorageKey = "utiliora-document-translator-history-v1";
  const importRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [documentName, setDocumentName] = useState("Untitled document");
  const [documentSource, setDocumentSource] = useState("No file loaded");
  const [sourceText, setSourceText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState(TRANSLATION_AUTO_LANGUAGE_CODE);
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [detectedSourceLanguage, setDetectedSourceLanguage] = useState("");
  const [providerSummary, setProviderSummary] = useState("");
  const [glossaryInput, setGlossaryInput] = useState("");
  const [chunkSize, setChunkSize] = useState(DOCUMENT_TRANSLATOR_DEFAULT_CHUNK_SIZE);
  const [pageRangeInput, setPageRangeInput] = useState("all");
  const [maxPdfPages, setMaxPdfPages] = useState(80);
  const [includePdfPageMarkers, setIncludePdfPageMarkers] = useState(true);
  const [includeSourceOnDocExport, setIncludeSourceOnDocExport] = useState(true);
  const [sourceTotalPages, setSourceTotalPages] = useState(0);
  const [sourceSelectedPages, setSourceSelectedPages] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastChunkCount, setLastChunkCount] = useState(0);
  const [lastDurationMs, setLastDurationMs] = useState(0);
  const [status, setStatus] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [history, setHistory] = useState<DocumentTranslatorHistoryEntry[]>([]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  useEffect(() => {
    if (!toolSession.isReady) return;
    setIsSessionHydrated(false);
    abortRef.current?.abort();
    abortRef.current = null;
    setActiveFile(null);
    setIsParsing(false);
    setIsTranslating(false);
    setProgress(0);
    setStatus("");
    setCopyStatus("");

    let nextWorkspace = sanitizeDocumentTranslatorWorkspaceSnapshot(null);
    let nextHistory: DocumentTranslatorHistoryEntry[] = [];
    try {
      const rawWorkspace =
        localStorage.getItem(workspaceStorageKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacyWorkspaceStorageKey) : null);
      if (rawWorkspace) {
        nextWorkspace = sanitizeDocumentTranslatorWorkspaceSnapshot(JSON.parse(rawWorkspace));
      }
      const rawHistory =
        localStorage.getItem(historyStorageKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacyHistoryStorageKey) : null);
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory) as unknown[];
        if (Array.isArray(parsed)) {
          nextHistory = parsed
            .map((entry) => sanitizeDocumentTranslatorHistoryEntry(entry))
            .filter((entry): entry is DocumentTranslatorHistoryEntry => Boolean(entry))
            .slice(0, DOCUMENT_TRANSLATOR_HISTORY_LIMIT);
        }
      }
    } catch {
      // Ignore malformed workspace data.
    }

    setDocumentName(nextWorkspace.documentName);
    setDocumentSource(nextWorkspace.documentSource);
    setSourceText(nextWorkspace.sourceText);
    setTranslatedText(nextWorkspace.translatedText);
    setSourceLanguage(nextWorkspace.sourceLanguage);
    setTargetLanguage(nextWorkspace.targetLanguage);
    setDetectedSourceLanguage(nextWorkspace.detectedSourceLanguage);
    setProviderSummary(nextWorkspace.providerSummary);
    setGlossaryInput(nextWorkspace.glossaryInput);
    setChunkSize(nextWorkspace.chunkSize);
    setPageRangeInput(nextWorkspace.pageRangeInput);
    setMaxPdfPages(nextWorkspace.maxPdfPages);
    setIncludePdfPageMarkers(nextWorkspace.includePdfPageMarkers);
    setIncludeSourceOnDocExport(nextWorkspace.includeSourceOnDocExport);
    setSourceTotalPages(nextWorkspace.sourceTotalPages);
    setSourceSelectedPages(nextWorkspace.sourceSelectedPages);
    setLastChunkCount(nextWorkspace.lastChunkCount);
    setLastDurationMs(nextWorkspace.lastDurationMs);
    setHistory(nextHistory);
    setIsSessionHydrated(true);
  }, [
    historyStorageKey,
    legacyHistoryStorageKey,
    legacyWorkspaceStorageKey,
    toolSession.isReady,
    toolSession.sessionId,
    workspaceStorageKey,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(
        workspaceStorageKey,
        JSON.stringify({
          documentName,
          documentSource,
          sourceText,
          translatedText,
          sourceLanguage,
          targetLanguage,
          detectedSourceLanguage,
          providerSummary,
          glossaryInput,
          chunkSize,
          pageRangeInput,
          maxPdfPages,
          includePdfPageMarkers,
          includeSourceOnDocExport,
          sourceTotalPages,
          sourceSelectedPages,
          lastChunkCount,
          lastDurationMs,
        } satisfies DocumentTranslatorWorkspaceSnapshot),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [
    chunkSize,
    detectedSourceLanguage,
    documentName,
    documentSource,
    glossaryInput,
    includePdfPageMarkers,
    includeSourceOnDocExport,
    isSessionHydrated,
    lastChunkCount,
    lastDurationMs,
    maxPdfPages,
    pageRangeInput,
    providerSummary,
    sourceLanguage,
    sourceSelectedPages,
    sourceText,
    sourceTotalPages,
    targetLanguage,
    toolSession.isReady,
    translatedText,
    workspaceStorageKey,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(history.slice(0, DOCUMENT_TRANSLATOR_HISTORY_LIMIT)));
    } catch {
      // Ignore storage failures.
    }
  }, [history, historyStorageKey, isSessionHydrated, toolSession.isReady]);

  const glossaryTerms = useMemo(() => parseGlossaryTerms(glossaryInput), [glossaryInput]);
  const effectiveDetectedSource =
    detectedSourceLanguage ||
    (sourceLanguage !== TRANSLATION_AUTO_LANGUAGE_CODE ? sourceLanguage : "");
  const isBusy = isParsing || isTranslating;

  const sourceStats = useMemo(() => {
    const normalized = sanitizeDocumentTranslationText(sourceText);
    return { words: countWords(normalized), chars: normalized.length };
  }, [sourceText]);

  const translatedStats = useMemo(() => {
    const normalized = sanitizeDocumentTranslationText(translatedText);
    return { words: countWords(normalized), chars: normalized.length };
  }, [translatedText]);

  const pushHistoryEntry = useCallback((entry: Omit<DocumentTranslatorHistoryEntry, "id" | "createdAt">) => {
    if (!entry.sourcePreview.trim() || !entry.translatedPreview.trim()) return;
    setHistory((current) => [
      { id: crypto.randomUUID(), createdAt: Date.now(), ...entry },
      ...current,
    ].slice(0, DOCUMENT_TRANSLATOR_HISTORY_LIMIT));
  }, []);

  const parseFile = useCallback(async (file: File) => {
    setIsParsing(true);
    setProgress(5);
    setStatus("Extracting readable text...");
    const lowerName = file.name.toLowerCase();
    const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";
    try {
      let extractedText = "";
      let sourceLabel = "Text";
      let totalPages = 0;
      let selectedPages = 0;

      if (isPdf) {
        const extracted = await extractTextFromPdfDocument(file, {
          pageRangeInput,
          maxPages: maxPdfPages,
          includePageMarkers: includePdfPageMarkers,
          onProgress: ({ processed, total }) => {
            const ratio = total > 0 ? processed / total : 0;
            setProgress(Math.max(6, Math.min(80, Math.round(ratio * 75))));
          },
        });
        extractedText = extracted.text;
        totalPages = extracted.totalPages;
        selectedPages = extracted.selectedPages.length;
        sourceLabel = `PDF (${selectedPages}/${totalPages} pages)`;
      } else {
        const extracted = await extractTextFromDocumentFile(file);
        extractedText = extracted.text;
        sourceLabel = extracted.source;
        setProgress(70);
      }

      const normalized = sanitizeDocumentTranslationText(extractedText);
      const bounded = normalized.slice(0, DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH);
      const wasTrimmed = bounded.length < normalized.length;
      setDocumentName(stripFileExtension(file.name) || "Untitled document");
      setDocumentSource(sourceLabel);
      setSourceText(bounded);
      setTranslatedText("");
      setDetectedSourceLanguage("");
      setProviderSummary("");
      setSourceTotalPages(totalPages);
      setSourceSelectedPages(selectedPages);
      setLastChunkCount(0);
      setLastDurationMs(0);
      setProgress(100);
      if (!bounded) {
        setStatus("No readable text found in this document.");
      } else if (wasTrimmed) {
        setStatus(`Loaded ${sourceLabel}. Input was trimmed to ${formatNumericValue(DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH)} characters.`);
      } else {
        setStatus(`Loaded ${sourceLabel} with ${formatNumericValue(countWords(bounded))} words.`);
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : "Could not read this document.";
      setStatus(isPdf ? `Could not read this PDF. ${message}` : "Could not read this document.");
      setProgress(0);
    } finally {
      setIsParsing(false);
    }
  }, [includePdfPageMarkers, maxPdfPages, pageRangeInput]);

  const translateDocument = useCallback(async () => {
    const normalizedSource = sanitizeDocumentTranslationText(sourceText).slice(0, DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH);
    if (!normalizedSource) {
      setStatus("Load or paste document text before translating.");
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsTranslating(true);
    setProgress(2);
    setStatus("Preparing translation chunks...");
    setCopyStatus("");
    const startedAt = Date.now();

    try {
      const protectedText = protectGlossaryTerms(normalizedSource, glossaryTerms);
      const chunks = splitDocumentIntoTranslationChunks(protectedText.text, chunkSize);
      if (!chunks.length) {
        setStatus("Source text is empty after normalization.");
        setProgress(0);
        return;
      }

      const translatedChunks: string[] = [];
      const providerCounts: Record<string, number> = {};
      let resolvedDetectedSource = "";

      for (let index = 0; index < chunks.length; index += 1) {
        const response = await fetch("/api/text-translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: chunks[index], sourceLanguage, targetLanguage }),
          signal: controller.signal,
        });
        const payload = (await response.json().catch(() => null)) as TextTranslateApiPayload | null;
        if (!response.ok || !payload || payload.ok !== true) {
          const message = payload && payload.ok === false && typeof payload.error === "string"
            ? payload.error
            : `Translation failed on chunk ${index + 1}.`;
          throw new Error(message);
        }
        translatedChunks.push(payload.translatedText);
        providerCounts[payload.provider || "unknown"] = (providerCounts[payload.provider || "unknown"] ?? 0) + 1;
        if (!resolvedDetectedSource) {
          resolvedDetectedSource = resolveTranslationLanguage(payload.detectedSourceLanguage, "", {
            allowAuto: false,
            supportedOnly: true,
          });
        }
        const ratio = (index + 1) / Math.max(1, chunks.length);
        setProgress(Math.max(4, Math.min(94, Math.round(ratio * 90) + 4)));
        setStatus(`Translating chunk ${index + 1}/${chunks.length}...`);
      }

      const normalizedTranslated = sanitizeDocumentTranslationText(
        restoreGlossaryTokens(translatedChunks.join(""), protectedText.tokenMap),
      ).slice(0, DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH);
      const durationMs = Date.now() - startedAt;
      const detected = resolvedDetectedSource || (sourceLanguage !== TRANSLATION_AUTO_LANGUAGE_CODE ? sourceLanguage : "");
      const summary = summarizeProviderCounts(providerCounts);

      setTranslatedText(normalizedTranslated);
      setDetectedSourceLanguage(detected);
      setProviderSummary(summary);
      setLastChunkCount(chunks.length);
      setLastDurationMs(durationMs);
      setProgress(100);
      setStatus(`Translated ${formatNumericValue(chunks.length)} chunks via ${summary} in ${(durationMs / 1000).toFixed(1)}s.`);
      pushHistoryEntry({
        documentName,
        documentSource,
        sourceLanguage,
        targetLanguage,
        detectedSourceLanguage: detected,
        providerSummary: summary,
        sourceChars: normalizedSource.length,
        translatedChars: normalizedTranslated.length,
        chunkCount: chunks.length,
        durationMs,
        sourcePreview: buildTranslationPreview(normalizedSource, 260),
        translatedPreview: buildTranslationPreview(normalizedTranslated, 260),
        sourceExcerpt: normalizedSource.slice(0, DOCUMENT_TRANSLATOR_HISTORY_EXCERPT_LIMIT),
        translatedExcerpt: normalizedTranslated.slice(0, DOCUMENT_TRANSLATOR_HISTORY_EXCERPT_LIMIT),
      });
    } catch (error) {
      if (typeof error === "object" && error !== null && "name" in error && (error as { name?: string }).name === "AbortError") {
        setStatus("Translation stopped.");
      } else {
        const message = error instanceof Error && error.message ? error.message : "Translation failed.";
        setStatus(message);
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsTranslating(false);
    }
  }, [chunkSize, documentName, documentSource, glossaryTerms, pushHistoryEntry, sourceLanguage, sourceText, targetLanguage]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="Document translator"
        subtitle="Translate PDF, DOCX, HTML, and text files with glossary locking and chunk-level progress."
      />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each document translator session is saved locally and linked to this /productivity-tools URL."
        onSelectSession={(nextSessionId) => {
          abortRef.current?.abort();
          abortRef.current = null;
          toolSession.selectSession(nextSessionId);
          setStatus("Switched document translator session.");
        }}
        onCreateSession={() => {
          abortRef.current?.abort();
          abortRef.current = null;
          toolSession.createSession();
          setStatus("Created a new document translator session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />
      <label className="field">
        <span>Upload document</span>
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md,.html,.htm,text/plain,text/markdown,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (!file) return;
            setActiveFile(file);
            setProgress(0);
            void parseFile(file);
            event.target.value = "";
          }}
        />
      </label>
      <div className="field-grid">
        <label className="field">
          <span>Document title</span>
          <input type="text" value={documentName} onChange={(event) => setDocumentName(event.target.value.slice(0, 140))} />
        </label>
        <label className="field">
          <span>Source language</span>
          <select value={sourceLanguage} onChange={(event) => setSourceLanguage(resolveTranslationLanguage(event.target.value, TRANSLATION_AUTO_LANGUAGE_CODE, { allowAuto: true, supportedOnly: true }))}>
            <option value={TRANSLATION_AUTO_LANGUAGE_CODE}>Auto detect</option>
            {TRANSLATION_LANGUAGE_OPTIONS.map((entry) => (
              <option key={`doc-source-${entry.code}`} value={entry.code}>{entry.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Target language</span>
          <select value={targetLanguage} onChange={(event) => setTargetLanguage(resolveTranslationLanguage(event.target.value, "en", { allowAuto: false, supportedOnly: true }))}>
            {TRANSLATION_LANGUAGE_OPTIONS.map((entry) => (
              <option key={`doc-target-${entry.code}`} value={entry.code}>{entry.label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Chunk size</span>
          <input type="number" min={600} max={4000} step={50} value={chunkSize} onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            setChunkSize(Number.isFinite(parsed) ? Math.max(600, Math.min(4000, parsed)) : DOCUMENT_TRANSLATOR_DEFAULT_CHUNK_SIZE);
          }} />
        </label>
        <label className="field">
          <span>PDF page range</span>
          <input type="text" value={pageRangeInput} onChange={(event) => setPageRangeInput(event.target.value.slice(0, 80))} />
        </label>
        <label className="field">
          <span>Max PDF pages</span>
          <input type="number" min={1} max={300} step={1} value={maxPdfPages} onChange={(event) => {
            const parsed = Number.parseInt(event.target.value, 10);
            setMaxPdfPages(Number.isFinite(parsed) ? Math.max(1, Math.min(300, parsed)) : 80);
          }} />
        </label>
      </div>
      <label className="field">
        <span>Source document text</span>
        <textarea rows={8} value={sourceText} onChange={(event) => setSourceText(event.target.value.slice(0, DOCUMENT_TRANSLATOR_MAX_TEXT_LENGTH))} />
      </label>
      <label className="field">
        <span>Glossary lock terms (one per line)</span>
        <textarea rows={3} value={glossaryInput} onChange={(event) => setGlossaryInput(event.target.value.slice(0, 10000))} />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => void translateDocument()} disabled={isBusy || !sourceText.trim()}>
          {isTranslating ? "Translating..." : "Translate document"}
        </button>
        <button className="action-button secondary" type="button" onClick={() => activeFile && void parseFile(activeFile)} disabled={!activeFile || isBusy}>
          {isParsing ? "Re-reading..." : "Re-read upload"}
        </button>
        <button className="action-button secondary" type="button" onClick={() => abortRef.current?.abort()} disabled={!isBusy}>Stop</button>
        <button className="action-button secondary" type="button" onClick={async () => {
          const copied = await copyTextToClipboard(translatedText);
          setCopyStatus(copied ? "Copied translated text." : "Could not copy translated text.");
        }} disabled={!translatedText.trim()}>
          <Copy size={15} />
          Copy
        </button>
        <button className="action-button secondary" type="button" onClick={() => downloadTextFile(`${stripFileExtension(documentName.trim()) || "translated-document"}-${targetLanguage}.txt`, translatedText, "text/plain;charset=utf-8;")} disabled={!translatedText.trim()}>
          <Download size={15} />
          TXT
        </button>
        <button className="action-button secondary" type="button" onClick={() => downloadTextFile(`${stripFileExtension(documentName.trim()) || "translated-document"}.doc`, buildDocumentTranslationWordMarkup({
          title: documentName,
          sourceLanguageLabel: getTranslationLanguageLabel(sourceLanguage),
          targetLanguageLabel: getTranslationLanguageLabel(targetLanguage),
          translatedText,
          sourceText,
          includeSourceText: includeSourceOnDocExport,
          includeHeader: true,
        }), "application/msword;charset=utf-8;")} disabled={!translatedText.trim()}>
          <Download size={15} />
          DOC
        </button>
        <button className="action-button secondary" type="button" onClick={() => downloadTextFile(`document-translator-${toolSession.sessionId}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), sessionId: toolSession.sessionId, workspace: { documentName, documentSource, sourceText, translatedText, sourceLanguage, targetLanguage, detectedSourceLanguage, providerSummary, glossaryInput, chunkSize, pageRangeInput, maxPdfPages, includePdfPageMarkers, includeSourceOnDocExport, sourceTotalPages, sourceSelectedPages, lastChunkCount, lastDurationMs }, history }, null, 2), "application/json;charset=utf-8;")}>
          <Download size={15} />
          Export JSON
        </button>
        <button className="action-button secondary" type="button" onClick={() => importRef.current?.click()}>
          <Plus size={15} />
          Import JSON
        </button>
        <input
          ref={importRef}
          type="file"
          hidden
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const payload = JSON.parse(await file.text()) as unknown;
              const historySource = Array.isArray(payload)
                ? payload
                : payload && typeof payload === "object" && Array.isArray((payload as { history?: unknown[] }).history)
                  ? ((payload as { history: unknown[] }).history ?? [])
                  : [];
              const importedHistory = historySource
                .map((entry) => sanitizeDocumentTranslatorHistoryEntry(entry))
                .filter((entry): entry is DocumentTranslatorHistoryEntry => Boolean(entry))
                .slice(0, DOCUMENT_TRANSLATOR_HISTORY_LIMIT);
              if (importedHistory.length) {
                setHistory((current) => [...importedHistory, ...current].slice(0, DOCUMENT_TRANSLATOR_HISTORY_LIMIT));
                setStatus(`Imported ${importedHistory.length} history entries.`);
              } else {
                setStatus("Could not import this JSON file.");
              }
            } catch {
              setStatus("Could not import this JSON file.");
            } finally {
              event.target.value = "";
            }
          }}
        />
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Include source text in DOC export</span>
          <select value={includeSourceOnDocExport ? "yes" : "no"} onChange={(event) => setIncludeSourceOnDocExport(event.target.value === "yes")}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        <label className="field">
          <span>Detected source</span>
          <input type="text" readOnly value={effectiveDetectedSource ? getTranslationLanguageLabel(effectiveDetectedSource) : "Unknown"} />
        </label>
      </div>
      <label className="field">
        <span>Translated text</span>
        <textarea rows={8} value={translatedText} readOnly placeholder="Translation output appears here..." />
      </label>
      <div className="progress-panel" aria-live="polite">
        <p className="supporting-text">{status || "Load a document and run translation."}</p>
        <div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="supporting-text">{progress}% complete</small>
      </div>
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
      <ResultList
        rows={[
          { label: "Session", value: toolSession.sessionLabel },
          { label: "Document source", value: documentSource },
          { label: "Source words", value: formatNumericValue(sourceStats.words) },
          { label: "Source characters", value: formatNumericValue(sourceStats.chars) },
          { label: "Translated words", value: formatNumericValue(translatedStats.words) },
          { label: "Translated characters", value: formatNumericValue(translatedStats.chars) },
          { label: "Glossary terms", value: formatNumericValue(glossaryTerms.length) },
          { label: "Provider summary", value: providerSummary || "Not run yet" },
          { label: "Chunks last run", value: formatNumericValue(lastChunkCount) },
          { label: "Last run", value: lastDurationMs ? `${(lastDurationMs / 1000).toFixed(1)}s` : "-" },
          { label: "Saved history", value: formatNumericValue(history.length) },
        ]}
      />
    </section>
  );
}
type TodoPriority = "high" | "medium" | "low";
type TodoPriorityFilter = TodoPriority | "all";
type TodoFilter = "all" | "active" | "completed" | "overdue" | "today";
const TODO_PRIORITY_WEIGHT: Record<TodoPriority, number> = { high: 3, medium: 2, low: 1 };

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: TodoPriority;
  dueDate: string;
  project: string;
  tags: string[];
  notes: string;
  createdAt: number;
  completedAt?: number;
}

interface TodoEditDraft {
  text: string;
  priority: TodoPriority;
  dueDate: string;
  project: string;
  tagsInput: string;
  notes: string;
}

function parseTodoTags(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 8);
}

function sanitizeTodoProject(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 40);
}

function sanitizeTodoItem(candidate: unknown): TodoItem | null {
  if (!candidate || typeof candidate !== "object") return null;
  const item = candidate as Partial<TodoItem>;
  if (typeof item.text !== "string") return null;
  const text = item.text.trim();
  if (!text) return null;
  const priority: TodoPriority =
    item.priority === "high" || item.priority === "medium" || item.priority === "low"
      ? item.priority
      : "medium";
  return {
    id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
    text: text.slice(0, 300),
    done: Boolean(item.done),
    priority,
    dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
    project: sanitizeTodoProject(typeof item.project === "string" ? item.project : ""),
    tags: Array.isArray(item.tags)
      ? item.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 8)
      : [],
    notes: typeof item.notes === "string" ? item.notes.trim().slice(0, 1200) : "",
    createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
    completedAt: typeof item.completedAt === "number" ? item.completedAt : undefined,
  };
}

function TodoListTool() {
  const toolSession = useToolSession({
    toolKey: "todo",
    defaultSessionLabel: "Task board",
    newSessionPrefix: "tasks",
  });
  const storageKey = toolSession.storageKey("utiliora-todos-v3");
  const uiStateKey = toolSession.storageKey("utiliora-todos-ui-v1");
  const legacyStorageKey = "utiliora-todos-v2";
  const importRef = useRef<HTMLInputElement | null>(null);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [project, setProject] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [noteInput, setNoteInput] = useState("");
  const [items, setItems] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<TodoPriorityFilter>("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TodoEditDraft>({
    text: "",
    priority: "medium",
    dueDate: "",
    project: "",
    tagsInput: "",
    notes: "",
  });

  const isOverdue = useCallback((item: TodoItem) => {
    if (!item.dueDate || item.done) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(item.dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }, []);

  useEffect(() => {
    if (!toolSession.isReady) return;
    setIsSessionHydrated(false);
    setEditingId(null);
    setEditDraft({ text: "", priority: "medium", dueDate: "", project: "", tagsInput: "", notes: "" });
    setValue("");
    setPriority("medium");
    setDueDate("");
    setProject("");
    setTagInput("");
    setNoteInput("");
    setFilter("all");
    setPriorityFilter("all");
    setProjectFilter("all");
    setSearch("");
    setStatus("");

    let nextItems: TodoItem[] = [];
    try {
      const stored =
        localStorage.getItem(storageKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID ? localStorage.getItem(legacyStorageKey) : null);
      if (stored) {
        const parsed = JSON.parse(stored) as unknown[];
        if (Array.isArray(parsed)) {
          nextItems = parsed
            .map((entry) => sanitizeTodoItem(entry))
            .filter((entry): entry is TodoItem => Boolean(entry));
        }
      }
      const rawUi = localStorage.getItem(uiStateKey);
      if (rawUi) {
        const parsedUi = JSON.parse(rawUi) as {
          value?: string;
          priority?: TodoPriority;
          dueDate?: string;
          project?: string;
          tagInput?: string;
          noteInput?: string;
          filter?: TodoFilter;
          priorityFilter?: TodoPriorityFilter;
          projectFilter?: string;
          search?: string;
        };
        setValue(typeof parsedUi.value === "string" ? parsedUi.value : "");
        setPriority(
          parsedUi.priority === "high" || parsedUi.priority === "medium" || parsedUi.priority === "low"
            ? parsedUi.priority
            : "medium",
        );
        setDueDate(typeof parsedUi.dueDate === "string" ? parsedUi.dueDate : "");
        setProject(typeof parsedUi.project === "string" ? parsedUi.project : "");
        setTagInput(typeof parsedUi.tagInput === "string" ? parsedUi.tagInput : "");
        setNoteInput(typeof parsedUi.noteInput === "string" ? parsedUi.noteInput : "");
        setFilter(
          parsedUi.filter === "active" ||
            parsedUi.filter === "completed" ||
            parsedUi.filter === "overdue" ||
            parsedUi.filter === "today"
            ? parsedUi.filter
            : "all",
        );
        setPriorityFilter(
          parsedUi.priorityFilter === "high" ||
            parsedUi.priorityFilter === "medium" ||
            parsedUi.priorityFilter === "low"
            ? parsedUi.priorityFilter
            : "all",
        );
        setProjectFilter(typeof parsedUi.projectFilter === "string" && parsedUi.projectFilter ? parsedUi.projectFilter : "all");
        setSearch(typeof parsedUi.search === "string" ? parsedUi.search : "");
      }
    } catch {
      // Ignore malformed stored tasks.
    }
    setItems(nextItems);
    setIsSessionHydrated(true);
  }, [legacyStorageKey, storageKey, toolSession.isReady, toolSession.sessionId, uiStateKey]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore storage failures.
    }
  }, [isSessionHydrated, items, storageKey, toolSession.isReady]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(
        uiStateKey,
        JSON.stringify({
          value,
          priority,
          dueDate,
          project,
          tagInput,
          noteInput,
          filter,
          priorityFilter,
          projectFilter,
          search,
        }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [
    dueDate,
    filter,
    isSessionHydrated,
    noteInput,
    priority,
    priorityFilter,
    project,
    projectFilter,
    search,
    tagInput,
    toolSession.isReady,
    uiStateKey,
    value,
  ]);

  const projectOptions = useMemo(() => {
    const projectSet = new Set<string>(["Inbox"]);
    items.forEach((item) => {
      if (!item.project) return;
      projectSet.add(item.project);
    });
    return [...projectSet].sort((left, right) => left.localeCompare(right));
  }, [items]);

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (filter === "active" && item.done) return false;
        if (filter === "completed" && !item.done) return false;
        if (filter === "overdue" && !isOverdue(item)) return false;
        if (filter === "today" && item.dueDate !== todayKey) return false;
        if (priorityFilter !== "all" && item.priority !== priorityFilter) return false;
        const projectName = item.project || "Inbox";
        if (projectFilter !== "all" && projectName !== projectFilter) return false;
        if (!searchTerm) return true;
        const haystack = `${item.text} ${item.project} ${item.tags.join(" ")} ${item.notes}`.toLowerCase();
        return haystack.includes(searchTerm);
      })
      .sort((left, right) => {
        if (left.done !== right.done) return left.done ? 1 : -1;
        if (TODO_PRIORITY_WEIGHT[left.priority] !== TODO_PRIORITY_WEIGHT[right.priority]) {
          return TODO_PRIORITY_WEIGHT[right.priority] - TODO_PRIORITY_WEIGHT[left.priority];
        }
        if (left.dueDate && right.dueDate) return left.dueDate.localeCompare(right.dueDate);
        if (left.dueDate) return -1;
        if (right.dueDate) return 1;
        return right.createdAt - left.createdAt;
      });
  }, [filter, isOverdue, items, priorityFilter, projectFilter, search, todayKey]);

  const stats = useMemo(() => {
    const completed = items.filter((item) => item.done).length;
    const active = items.length - completed;
    const overdue = items.filter((item) => isOverdue(item)).length;
    const dueToday = items.filter((item) => item.dueDate === todayKey && !item.done).length;
    const highPriorityActive = items.filter((item) => item.priority === "high" && !item.done).length;
    const tagged = items.filter((item) => item.tags.length > 0).length;
    const completionRate = items.length ? (completed / items.length) * 100 : 0;
    return {
      completed,
      active,
      overdue,
      total: items.length,
      dueToday,
      completionRate,
      highPriorityActive,
      tagged,
      projects: Math.max(0, projectOptions.length - 1),
    };
  }, [isOverdue, items, projectOptions.length, todayKey]);

  const addTask = () => {
    const text = value.trim();
    if (!text) {
      setStatus("Enter a task before adding.");
      return;
    }
    const normalizedProject = sanitizeTodoProject(project);
    const normalizedTags = parseTodoTags(tagInput);
    const nextItem: TodoItem = {
      id: crypto.randomUUID(),
      text,
      done: false,
      priority,
      dueDate,
      project: normalizedProject,
      tags: normalizedTags,
      notes: noteInput.trim().slice(0, 1200),
      createdAt: Date.now(),
    };
    setItems((current) => [nextItem, ...current]);
    setValue("");
    setDueDate("");
    setPriority("medium");
    setProject("");
    setTagInput("");
    setNoteInput("");
    setStatus("Task added.");
    trackEvent("todo_add", {
      priority: nextItem.priority,
      hasDueDate: Boolean(nextItem.dueDate),
      hasProject: Boolean(nextItem.project),
      hasTags: nextItem.tags.length > 0,
    });
  };

  const beginEditing = (item: TodoItem) => {
    setEditingId(item.id);
    setEditDraft({
      text: item.text,
      priority: item.priority,
      dueDate: item.dueDate,
      project: item.project,
      tagsInput: item.tags.join(", "),
      notes: item.notes,
    });
    setStatus("Editing task.");
  };

  const saveEditing = () => {
    if (!editingId) return;
    const trimmedText = editDraft.text.trim();
    if (!trimmedText) {
      setStatus("Task text cannot be empty.");
      return;
    }
    setItems((current) =>
      current.map((item) =>
        item.id === editingId
          ? {
              ...item,
              text: trimmedText.slice(0, 300),
              priority: editDraft.priority,
              dueDate: editDraft.dueDate,
              project: sanitizeTodoProject(editDraft.project),
              tags: parseTodoTags(editDraft.tagsInput),
              notes: editDraft.notes.trim().slice(0, 1200),
            }
          : item,
      ),
    );
    setEditingId(null);
    setStatus("Task updated.");
  };

  const cancelEditing = () => {
    setEditingId(null);
    setStatus("Edit cancelled.");
  };

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Tags}
        title="Simple to-do list"
        subtitle="Workspace-ready task manager with projects, tags, notes, filters, and durable local persistence."
      />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each task board session is saved locally and linked to this /productivity-tools URL."
        onSelectSession={(nextSessionId) => {
          toolSession.selectSession(nextSessionId);
          setStatus("Switched task board session.");
        }}
        onCreateSession={() => {
          toolSession.createSession();
          setStatus("Created a new task board session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />
      <div className="field-grid">
        <label className="field">
          <span>Task</span>
          <input
            type="text"
            value={value}
            placeholder="Add a task..."
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addTask();
              }
            }}
          />
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value as TodoPriority)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="field">
          <span>Due date</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Project</span>
          <input
            type="text"
            value={project}
            placeholder="Inbox, Marketing, Sprint 4..."
            onChange={(event) => setProject(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Tags (comma separated)</span>
          <input
            type="text"
            value={tagInput}
            placeholder="client, urgent"
            onChange={(event) => setTagInput(event.target.value)}
          />
        </label>
      </div>
      <label className="field">
        <span>Task notes (optional)</span>
        <textarea
          rows={2}
          value={noteInput}
          placeholder="Context, acceptance criteria, links..."
          onChange={(event) => setNoteInput(event.target.value)}
        />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={addTask}>
          Add task
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setItems((current) => current.map((item) => ({ ...item, done: true, completedAt: Date.now() })));
            setStatus("Marked all tasks as completed.");
          }}
          disabled={items.length === 0}
        >
          Complete all
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            const before = items.length;
            setItems((current) => current.filter((item) => !item.done));
            setStatus(before ? "Cleared completed tasks." : "No completed tasks to clear.");
          }}
          disabled={items.every((item) => !item.done)}
        >
          Clear completed
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadCsv(
              "todo-list.csv",
              ["Task", "Priority", "Due Date", "Project", "Tags", "Notes", "Done", "Created At"],
              items.map((item) => [
                item.text,
                item.priority,
                item.dueDate,
                item.project,
                item.tags.join(" | "),
                item.notes.replace(/\r?\n/g, " "),
                item.done ? "yes" : "no",
                new Date(item.createdAt).toISOString(),
              ]),
            )
          }
          disabled={items.length === 0}
        >
          <Download size={15} />
          CSV
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() =>
            downloadTextFile(
              "todo-backup.json",
              JSON.stringify(
                {
                  version: 3,
                  sessionId: toolSession.sessionId,
                  exportedAt: new Date().toISOString(),
                  items,
                },
                null,
                2,
              ),
              "application/json;charset=utf-8;",
            )
          }
          disabled={items.length === 0}
        >
          <Download size={15} />
          JSON
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => importRef.current?.click()}
        >
          <Plus size={15} />
          Import JSON
        </button>
        <input
          ref={importRef}
          type="file"
          hidden
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const payload = JSON.parse(await file.text()) as unknown;
              const source = Array.isArray(payload)
                ? payload
                : Array.isArray((payload as { items?: unknown[] }).items)
                  ? ((payload as { items: unknown[] }).items ?? [])
                  : [];
              const sanitized = source
                .map((entry) => sanitizeTodoItem(entry))
                .filter((entry): entry is TodoItem => Boolean(entry));
              if (!sanitized.length) throw new Error("Empty");
              setItems((current) => [...sanitized, ...current]);
              setStatus(`Imported ${sanitized.length} task${sanitized.length === 1 ? "" : "s"}.`);
            } catch {
              setStatus("Could not import tasks from that file.");
            } finally {
              event.target.value = "";
            }
          }}
        />
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Filter</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as TodoFilter)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as TodoPriorityFilter)}>
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="field">
          <span>Project</span>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="all">All projects</option>
            {projectOptions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Search</span>
          <input
            type="text"
            value={search}
            placeholder="Search tasks..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <ResultList
        rows={[
          { label: "Session", value: toolSession.sessionLabel },
          { label: "Total tasks", value: formatNumericValue(stats.total) },
          { label: "Active tasks", value: formatNumericValue(stats.active) },
          { label: "Completed tasks", value: formatNumericValue(stats.completed) },
          { label: "Overdue tasks", value: formatNumericValue(stats.overdue) },
          { label: "Due today", value: formatNumericValue(stats.dueToday) },
          { label: "High priority open", value: formatNumericValue(stats.highPriorityActive) },
          { label: "Tagged tasks", value: formatNumericValue(stats.tagged) },
          { label: "Projects", value: formatNumericValue(stats.projects) },
          { label: "Completion rate", value: `${stats.completionRate.toFixed(1)}%` },
        ]}
      />
      <ul className="todo-list">
        {filteredItems.map((item) => (
          <li key={item.id}>
            {editingId === item.id ? (
              <div className="todo-main">
                <div className="todo-edit-grid">
                  <label className="field">
                    <span>Task</span>
                    <input
                      type="text"
                      value={editDraft.text}
                      onChange={(event) => setEditDraft((current) => ({ ...current, text: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Priority</span>
                    <select
                      value={editDraft.priority}
                      onChange={(event) =>
                        setEditDraft((current) => ({ ...current, priority: event.target.value as TodoPriority }))
                      }
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Due date</span>
                    <input
                      type="date"
                      value={editDraft.dueDate}
                      onChange={(event) => setEditDraft((current) => ({ ...current, dueDate: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Project</span>
                    <input
                      type="text"
                      value={editDraft.project}
                      onChange={(event) => setEditDraft((current) => ({ ...current, project: event.target.value }))}
                    />
                  </label>
                  <label className="field">
                    <span>Tags</span>
                    <input
                      type="text"
                      value={editDraft.tagsInput}
                      onChange={(event) => setEditDraft((current) => ({ ...current, tagsInput: event.target.value }))}
                    />
                  </label>
                </div>
                <label className="field">
                  <span>Notes</span>
                  <textarea
                    rows={2}
                    value={editDraft.notes}
                    onChange={(event) => setEditDraft((current) => ({ ...current, notes: event.target.value }))}
                  />
                </label>
                <div className="button-row">
                  <button className="action-button secondary" type="button" onClick={saveEditing}>
                    Save
                  </button>
                  <button className="action-button secondary" type="button" onClick={cancelEditing}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="todo-main">
                  <label className="todo-check">
                    <input
                      type="checkbox"
                      checked={item.done}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((candidate) =>
                            candidate.id === item.id
                              ? {
                                  ...candidate,
                                  done: event.target.checked,
                                  completedAt: event.target.checked ? Date.now() : undefined,
                                }
                              : candidate,
                          ),
                        )
                      }
                    />
                    <span className={item.done ? "done" : ""}>{item.text}</span>
                  </label>
                  {item.notes ? <p className="todo-details">{item.notes}</p> : null}
                  <div className="todo-tags">
                    <span className="chip">{item.project || "Inbox"}</span>
                    {item.tags.map((tag) => (
                      <span key={`${item.id}-${tag}`} className="chip">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="todo-meta">
                  <span className={`status-badge ${item.priority === "high" ? "bad" : item.priority === "medium" ? "warn" : "info"}`}>
                    {item.priority}
                  </span>
                  {item.dueDate ? (
                    <span className={`status-badge ${isOverdue(item) ? "bad" : "ok"}`}>
                      due {item.dueDate}
                    </span>
                  ) : null}
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Edit task ${item.text}`}
                    onClick={() => beginEditing(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    aria-label={`Delete task ${item.text}`}
                    onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {filteredItems.length === 0 ? <p className="supporting-text">No tasks for this view.</p> : null}
    </section>
  );
}

interface NoteItem {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  pinned: boolean;
  tags: string[];
}

type MarkdownFormatAction =
  | "heading"
  | "bold"
  | "italic"
  | "link"
  | "quote"
  | "bullet-list"
  | "check-list"
  | "inline-code"
  | "code-block"
  | "date-stamp";

interface NoteTemplate {
  id: string;
  label: string;
  title: string;
  content: string;
}

const NOTE_TEMPLATES: NoteTemplate[] = [
  {
    id: "meeting",
    label: "Meeting",
    title: "Team meeting notes",
    content: `## Agenda
- 

## Decisions
- 

## Action items
- [ ] `,
  },
  {
    id: "journal",
    label: "Daily log",
    title: "Daily journal",
    content: `## Wins
- 

## Challenges
- 

## Tomorrow plan
- [ ] `,
  },
  {
    id: "launch",
    label: "Launch plan",
    title: "Product launch checklist",
    content: `## Launch objective

## Checklist
- [ ] QA pass
- [ ] Release notes
- [ ] Comms ready

## Risks
- `,
  },
];

function createNote(title: string, content = ""): NoteItem {
  return {
    id: crypto.randomUUID(),
    title,
    content,
    updatedAt: Date.now(),
    pinned: false,
    tags: [],
  };
}

function parseTagsFromInput(value: string): string[] {
  return [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 10);
}

function sanitizeStoredNote(candidate: unknown): NoteItem | null {
  if (!candidate || typeof candidate !== "object") return null;
  const note = candidate as Partial<NoteItem>;
  if (typeof note.id !== "string" || typeof note.title !== "string" || typeof note.content !== "string") {
    return null;
  }
  const parsedTags = Array.isArray(note.tags)
    ? note.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean).slice(0, 10)
    : [];
  return {
    id: note.id,
    title: note.title || "Untitled note",
    content: note.content,
    updatedAt: typeof note.updatedAt === "number" ? note.updatedAt : Date.now(),
    pinned: Boolean(note.pinned),
    tags: parsedTags,
  };
}

function applyMarkdownFormatting(
  content: string,
  selectionStart: number,
  selectionEnd: number,
  action: MarkdownFormatAction,
): { value: string; nextStart: number; nextEnd: number } {
  const start = Math.max(0, Math.min(selectionStart, content.length));
  const end = Math.max(start, Math.min(selectionEnd, content.length));
  const before = content.slice(0, start);
  const selected = content.slice(start, end);
  const after = content.slice(end);
  const fallbackLine = selected || "text";

  let insertion = selected;
  switch (action) {
    case "heading":
      insertion = `## ${selected || "Heading"}`;
      break;
    case "bold":
      insertion = `**${selected || "bold text"}**`;
      break;
    case "italic":
      insertion = `_${selected || "italic text"}_`;
      break;
    case "link":
      insertion = `[${selected || "link text"}](https://example.com)`;
      break;
    case "quote":
      insertion = selected
        ? selected.split(/\r?\n/).map((line) => `> ${line}`).join("\n")
        : "> Quote";
      break;
    case "bullet-list":
      insertion = selected
        ? selected.split(/\r?\n/).map((line) => (line.trim() ? `- ${line}` : "- ")).join("\n")
        : "- list item";
      break;
    case "check-list":
      insertion = selected
        ? selected.split(/\r?\n/).map((line) => `- [ ] ${line}`).join("\n")
        : "- [ ] task";
      break;
    case "inline-code":
      insertion = `\`${selected || "code"}\``;
      break;
    case "code-block":
      insertion = `\n\`\`\`\n${selected || "code"}\n\`\`\`\n`;
      break;
    case "date-stamp":
      insertion = `\n${new Date().toLocaleString("en-US")}\n`;
      break;
    default:
      insertion = fallbackLine;
      break;
  }

  const value = `${before}${insertion}${after}`;
  const nextEnd = before.length + insertion.length;
  return { value, nextStart: nextEnd, nextEnd };
}

function NotesPadTool() {
  const toolSession = useToolSession({
    toolKey: "notes",
    defaultSessionLabel: "Notebook",
    newSessionPrefix: "notes",
  });
  const storageKey = toolSession.storageKey("utiliora-notes-v4");
  const uiStateKey = toolSession.storageKey("utiliora-notes-ui-v1");
  const legacyStorageKey = "utiliora-notes-v3";
  const legacyStorageKeyV2 = "utiliora-notes-v2";
  const importRef = useRef<HTMLInputElement | null>(null);
  const workspaceImportRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const defaultNote = useMemo(() => createNote("Untitled note"), []);
  const [isSessionHydrated, setIsSessionHydrated] = useState(false);
  const [notes, setNotes] = useState<NoteItem[]>([defaultNote]);
  const [activeId, setActiveId] = useState<string>(defaultNote.id);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!toolSession.isReady) return;
    setIsSessionHydrated(false);

    let nextNotes: NoteItem[] = [defaultNote];
    let nextActiveId = defaultNote.id;
    let nextSearch = "";
    let nextTagFilter = "all";
    let nextShowPinnedOnly = false;
    let nextPreviewMode = false;
    let nextFocusMode = false;
    let nextStatus = "";

    try {
      const source =
        localStorage.getItem(storageKey) ??
        (toolSession.sessionId === TOOL_SESSION_DEFAULT_ID
          ? localStorage.getItem(legacyStorageKey) ?? localStorage.getItem(legacyStorageKeyV2)
          : null);
      if (source) {
        const parsed = JSON.parse(source) as unknown[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .map((item) => sanitizeStoredNote(item))
            .filter((item): item is NoteItem => Boolean(item));
          if (normalized.length) {
            nextNotes = normalized;
            nextActiveId = normalized[0].id;
          }
        }
      }

      const rawUi = localStorage.getItem(uiStateKey);
      if (rawUi) {
        const parsedUi = JSON.parse(rawUi) as {
          activeId?: string;
          search?: string;
          tagFilter?: string;
          showPinnedOnly?: boolean;
          previewMode?: boolean;
          focusMode?: boolean;
        };
        nextSearch = typeof parsedUi.search === "string" ? parsedUi.search : "";
        nextTagFilter = typeof parsedUi.tagFilter === "string" ? parsedUi.tagFilter : "all";
        nextShowPinnedOnly = Boolean(parsedUi.showPinnedOnly);
        nextPreviewMode = Boolean(parsedUi.previewMode);
        nextFocusMode = Boolean(parsedUi.focusMode);
        if (typeof parsedUi.activeId === "string" && parsedUi.activeId) {
          nextActiveId = parsedUi.activeId;
        }
      }

      const params = new URLSearchParams(window.location.search);
      const sharedPayload = params.get("noteShare");
      if (sharedPayload) {
        const decoded = decodeBase64Url(sharedPayload);
        if (decoded) {
          const parsedShare = JSON.parse(decoded) as Partial<NoteItem>;
          const imported = createNote(
            parsedShare.title?.trim() || "Shared note",
            typeof parsedShare.content === "string" ? parsedShare.content : "",
          );
            imported.tags = Array.isArray(parsedShare.tags)
              ? parsedShare.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 10)
              : [];
          nextNotes = [imported, ...nextNotes];
          nextActiveId = imported.id;
          nextStatus = "Imported shared note from URL.";
          params.delete("noteShare");
          const cleanQuery = params.toString();
          const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", cleanUrl);
        }
      }
    } catch {
      // Ignore malformed notes or share links.
    }

    if (!nextNotes.some((note) => note.id === nextActiveId)) {
      nextActiveId = nextNotes[0]?.id ?? defaultNote.id;
    }

    setNotes(nextNotes);
    setActiveId(nextActiveId);
    setSearch(nextSearch);
    setTagFilter(nextTagFilter);
    setShowPinnedOnly(nextShowPinnedOnly);
    setPreviewMode(nextPreviewMode);
    setFocusMode(nextFocusMode);
    setStatus(nextStatus);
    setIsSessionHydrated(true);
  }, [
    defaultNote,
    legacyStorageKey,
    legacyStorageKeyV2,
    storageKey,
    toolSession.isReady,
    toolSession.sessionId,
    uiStateKey,
  ]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      // Ignore storage failures.
    }
  }, [isSessionHydrated, notes, storageKey, toolSession.isReady]);

  useEffect(() => {
    if (!toolSession.isReady || !isSessionHydrated) return;
    try {
      localStorage.setItem(
        uiStateKey,
        JSON.stringify({
          activeId,
          search,
          tagFilter,
          showPinnedOnly,
          previewMode,
          focusMode,
        }),
      );
    } catch {
      // Ignore storage failures.
    }
  }, [
    activeId,
    focusMode,
    isSessionHydrated,
    previewMode,
    search,
    showPinnedOnly,
    tagFilter,
    toolSession.isReady,
    uiStateKey,
  ]);

  useEffect(() => {
    if (notes.some((note) => note.id === activeId)) return;
    setActiveId(notes[0]?.id ?? defaultNote.id);
  }, [activeId, defaultNote.id, notes]);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeId) ?? notes[0] ?? null,
    [activeId, notes],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((note) => {
      note.tags.forEach((tag) => set.add(tag));
    });
    return [...set].sort((left, right) => left.localeCompare(right));
  }, [notes]);

  const filteredNotes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return [...notes]
      .filter((note) => {
        if (showPinnedOnly && !note.pinned) return false;
        if (tagFilter !== "all" && !note.tags.includes(tagFilter)) return false;
        if (!needle) return true;
        return (
          note.title.toLowerCase().includes(needle) ||
          note.content.toLowerCase().includes(needle) ||
          note.tags.some((tag) => tag.toLowerCase().includes(needle))
        );
      })
      .sort((left, right) => {
        if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
        return right.updatedAt - left.updatedAt;
      });
  }, [notes, search, showPinnedOnly, tagFilter]);

  const updateActiveNote = useCallback((patch: Partial<NoteItem>) => {
    if (!activeNote) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id ? { ...note, ...patch, updatedAt: Date.now() } : note,
      ),
    );
  }, [activeNote]);

  const createNoteFromTemplate = useCallback((template?: NoteTemplate) => {
    const note = createNote(template?.title ?? `New note ${notes.length + 1}`, template?.content ?? "");
    setNotes((current) => [note, ...current]);
    setActiveId(note.id);
    setStatus(template ? `Created note from ${template.label} template.` : "Created a new note.");
    trackEvent("notes_create", { template: template?.id ?? "blank" });
  }, [notes.length]);

  const exportActiveNote = useCallback(() => {
    if (!activeNote) return;
    downloadTextFile(
      `${(activeNote.title || "note").replace(/[^\w.-]+/g, "-").toLowerCase()}.md`,
      activeNote.content,
    );
    setStatus("Exported note as Markdown.");
  }, [activeNote]);

  const exportWorkspace = useCallback(() => {
    downloadTextFile(
      `notes-workspace-${toolSession.sessionId}.json`,
      JSON.stringify(
        {
          version: 4,
          sessionId: toolSession.sessionId,
          exportedAt: new Date().toISOString(),
          notes,
        },
        null,
        2,
      ),
      "application/json;charset=utf-8;",
    );
    setStatus("Exported notebook workspace JSON.");
  }, [notes, toolSession.sessionId]);

  const applyFormatting = useCallback((action: MarkdownFormatAction) => {
    if (!activeNote || !editorRef.current) return;
    const textarea = editorRef.current;
    const result = applyMarkdownFormatting(
      activeNote.content,
      textarea.selectionStart ?? 0,
      textarea.selectionEnd ?? 0,
      action,
    );
    updateActiveNote({ content: result.value });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.nextStart, result.nextEnd);
    });
  }, [activeNote, updateActiveNote]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const useMod = event.ctrlKey || event.metaKey;
      if (!useMod) return;
      const key = event.key.toLowerCase();
      if (key === "b") {
        event.preventDefault();
        applyFormatting("bold");
      } else if (key === "i") {
        event.preventDefault();
        applyFormatting("italic");
      } else if (key === "k") {
        event.preventDefault();
        applyFormatting("link");
      } else if (key === "s") {
        event.preventDefault();
        exportActiveNote();
      } else if (event.shiftKey && key === "n") {
        event.preventDefault();
        createNoteFromTemplate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [applyFormatting, createNoteFromTemplate, exportActiveNote]);

  const activeWordCount = countWords(activeNote?.content ?? "");
  const activeCharCount = activeNote?.content.length ?? 0;
  const readingMinutes = Math.max(1, Math.ceil(activeWordCount / 220));
  const renderedPreview = useMemo(
    () => markdownToHtml(activeNote?.content ?? ""),
    [activeNote?.content],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Type}
        title="Notes pad"
        subtitle="Write in markdown with shortcuts, smart templates, shareable links, and instant previews."
      />
      <ToolSessionControls
        sessionId={toolSession.sessionId}
        sessionLabel={toolSession.sessionLabel}
        sessions={toolSession.sessions}
        description="Each notebook session is saved locally and linked to this /productivity-tools URL."
        onSelectSession={(nextSessionId) => {
          toolSession.selectSession(nextSessionId);
          setStatus("Switched notebook session.");
        }}
        onCreateSession={() => {
          toolSession.createSession();
          setStatus("Created a new notebook session.");
        }}
        onRenameSession={(nextLabel) => toolSession.renameSession(nextLabel)}
      />
      <div className="button-row">
        <button
          className="action-button"
          type="button"
          onClick={() => createNoteFromTemplate()}
        >
          New note (Ctrl/Cmd+Shift+N)
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            if (!activeNote) return;
            const duplicate: NoteItem = {
              ...activeNote,
              id: crypto.randomUUID(),
              title: `${activeNote.title} (copy)`,
              updatedAt: Date.now(),
            };
            setNotes((current) => [duplicate, ...current]);
            setActiveId(duplicate.id);
            setStatus("Duplicated active note.");
          }}
          disabled={!activeNote}
        >
          Duplicate
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => updateActiveNote({ pinned: !(activeNote?.pinned ?? false) })}
          disabled={!activeNote}
        >
          {activeNote?.pinned ? "Unpin" : "Pin"}
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            if (!activeNote) return;
            setNotes((current) => {
              const next = current.filter((note) => note.id !== activeNote.id);
              if (next.length === 0) {
                const replacement = createNote("Untitled note");
                setActiveId(replacement.id);
                setStatus("Deleted note and created a new empty note.");
                return [replacement];
              }
              setActiveId(next[0].id);
              setStatus("Deleted note.");
              return next;
            });
          }}
          disabled={!activeNote}
        >
          Delete
        </button>
        <button className="action-button secondary" type="button" onClick={() => setFocusMode((current) => !current)}>
          {focusMode ? "Exit focus mode" : "Focus mode"}
        </button>
      </div>
      <div className="preset-row">
        <span className="supporting-text">Quick starts:</span>
        {NOTE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className="chip-button"
            type="button"
            onClick={() => createNoteFromTemplate(template)}
          >
            {template.label}
          </button>
        ))}
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Search notes</span>
          <input
            type="text"
            value={search}
            placeholder="Search title or content..."
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Filter by tag</span>
          <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
            <option value="all">All tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={showPinnedOnly}
            onChange={(event) => setShowPinnedOnly(event.target.checked)}
          />
          Pinned only
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={previewMode}
            onChange={(event) => setPreviewMode(event.target.checked)}
          />
          Markdown preview
        </label>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
      <div className={`split-panel${focusMode ? " notes-focus" : ""}`}>
        <div className="mini-panel notes-list-panel">
          <h3>Notes</h3>
          <ul className="plain-list">
            {filteredNotes.map((note) => (
              <li key={note.id}>
                <button
                  className="chip-button"
                  type="button"
                  onClick={() => setActiveId(note.id)}
                  aria-pressed={note.id === activeId}
                >
                  {note.title}
                </button>
                <div className="chip-list">
                  {note.pinned ? <span className="status-badge info">Pinned</span> : null}
                  {note.tags.map((tag) => (
                    <span key={`${note.id}-${tag}`} className="chip">
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="supporting-text">{new Date(note.updatedAt).toLocaleString("en-US")}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="notes-editor">
          {activeNote ? (
            <>
              <label className="field">
                <span>Note title</span>
                <input
                  type="text"
                  value={activeNote.title}
                  onChange={(event) => updateActiveNote({ title: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Tags (comma separated)</span>
                <input
                  type="text"
                  value={activeNote.tags.join(", ")}
                  placeholder="ideas, planning, urgent"
                  onChange={(event) => updateActiveNote({ tags: parseTagsFromInput(event.target.value) })}
                />
              </label>
              <div className="notes-toolbar" role="toolbar" aria-label="Markdown formatting shortcuts">
                <button className="chip-button" type="button" onClick={() => applyFormatting("heading")}>
                  H2
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("bold")}>
                  Bold
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("italic")}>
                  Italic
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("link")}>
                  Link
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("quote")}>
                  Quote
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("bullet-list")}>
                  List
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("check-list")}>
                  Checklist
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("inline-code")}>
                  Inline code
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("code-block")}>
                  Code block
                </button>
                <button className="chip-button" type="button" onClick={() => applyFormatting("date-stamp")}>
                  Timestamp
                </button>
              </div>
              <label className="field">
                <span>Your note (autosaved locally, markdown supported)</span>
                <textarea
                  ref={editorRef}
                  value={activeNote.content}
                  onChange={(event) => updateActiveNote({ content: event.target.value })}
                  rows={16}
                />
              </label>
            </>
          ) : (
            <p className="supporting-text">Select a note to begin editing.</p>
          )}
        </div>
      </div>
      {previewMode && activeNote ? (
        <div className="preview">
          <h3>Preview</h3>
          <div className="preview-box" dangerouslySetInnerHTML={{ __html: renderedPreview }} />
        </div>
      ) : null}
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const ok = await copyTextToClipboard(activeNote?.content ?? "");
            setStatus(ok ? "Note content copied." : "Nothing to copy.");
          }}
          disabled={!activeNote}
        >
          <Copy size={15} />
          Copy note
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={exportActiveNote}
          disabled={!activeNote}
        >
          <Download size={15} />
          Export .md (Ctrl/Cmd+S)
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => importRef.current?.click()}
        >
          <Plus size={15} />
          Import text
        </button>
        <button className="action-button secondary" type="button" onClick={exportWorkspace}>
          <Download size={15} />
          Export workspace JSON
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => workspaceImportRef.current?.click()}
        >
          <Plus size={15} />
          Import workspace JSON
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            if (!activeNote) return;
            const payload = encodeBase64Url(
              JSON.stringify({
                title: activeNote.title,
                content: activeNote.content,
                tags: activeNote.tags,
              }),
            );
            if (payload.length > 3500) {
              setStatus("This note is too large for URL sharing. Export it instead.");
              return;
            }
            const url = new URL(window.location.href);
            url.searchParams.set("noteShare", payload);
            const copied = await copyTextToClipboard(url.toString());
            setStatus(copied ? "Shareable link copied." : "Could not copy share link.");
          }}
          disabled={!activeNote}
        >
          <Share2 size={15} />
          Copy share link
        </button>
        <input
          ref={importRef}
          type="file"
          hidden
          accept=".txt,.md,text/plain,text/markdown"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const content = await file.text();
              const title = file.name.replace(/\.[^/.]+$/, "");
              const imported = createNote(title || `Imported note ${notes.length + 1}`, content);
              setNotes((current) => [imported, ...current]);
              setActiveId(imported.id);
              setStatus("Imported note from file.");
            } catch {
              setStatus("Could not import this file.");
            } finally {
              event.target.value = "";
            }
          }}
        />
        <input
          ref={workspaceImportRef}
          type="file"
          hidden
          accept=".json,application/json"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            try {
              const payload = JSON.parse(await file.text()) as unknown;
              const source = Array.isArray(payload)
                ? payload
                : Array.isArray((payload as { notes?: unknown[] }).notes)
                  ? ((payload as { notes: unknown[] }).notes ?? [])
                  : [];
              const normalized = source
                .map((entry) => sanitizeStoredNote(entry))
                .filter((entry): entry is NoteItem => Boolean(entry));
              if (!normalized.length) throw new Error("Empty");
              setNotes(normalized);
              setActiveId(normalized[0].id);
              setStatus(`Imported notebook workspace with ${normalized.length} note${normalized.length === 1 ? "" : "s"}.`);
            } catch {
              setStatus("Could not import notebook JSON.");
            } finally {
              event.target.value = "";
            }
          }}
        />
      </div>
      <ResultList
        rows={[
          { label: "Session", value: toolSession.sessionLabel },
          { label: "Total notes", value: formatNumericValue(notes.length) },
          { label: "Pinned notes", value: formatNumericValue(notes.filter((note) => note.pinned).length) },
          { label: "Words in active note", value: formatNumericValue(activeWordCount) },
          { label: "Characters in active note", value: formatNumericValue(activeCharCount) },
          { label: "Estimated reading time", value: `${readingMinutes} min` },
          { label: "Last edited", value: activeNote ? new Date(activeNote.updatedAt).toLocaleString("en-US") : "-" },
        ]}
      />
      <p className="supporting-text">
        Notes are kept locally in this browser session workspace unless you export or share them. Shortcuts: Ctrl/Cmd+B,
        I, K, S and Ctrl/Cmd+Shift+N.
      </p>
    </section>
  );
}

type ResumeTemplate = "modern" | "minimal" | "compact" | "executive" | "creative";

interface ResumePersonalInfo {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
}

interface ResumeExperience {
  id: string;
  role: string;
  company: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  highlights: string;
}

interface ResumeEducation {
  id: string;
  school: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  details: string;
}

interface ResumeLink {
  id: string;
  label: string;
  url: string;
}

interface ResumeData {
  template: ResumeTemplate;
  personal: ResumePersonalInfo;
  skills: string[];
  experience: ResumeExperience[];
  education: ResumeEducation[];
  links: ResumeLink[];
}

function createDefaultResumeData(): ResumeData {
  return {
    template: "modern",
    personal: {
      fullName: "",
      headline: "",
      email: "",
      phone: "",
      location: "",
      website: "",
      summary: "",
    },
    skills: [],
    experience: [
      {
        id: crypto.randomUUID(),
        role: "",
        company: "",
        location: "",
        startDate: "",
        endDate: "",
        current: false,
        highlights: "",
      },
    ],
    education: [
      {
        id: crypto.randomUUID(),
        school: "",
        degree: "",
        field: "",
        startDate: "",
        endDate: "",
        details: "",
      },
    ],
    links: [{ id: crypto.randomUUID(), label: "Portfolio", url: "" }],
  };
}

interface ResumeStarterProfile {
  id: string;
  label: string;
  description: string;
  template: ResumeTemplate;
  personal: ResumePersonalInfo;
  skills: string[];
  experience: Array<Omit<ResumeExperience, "id">>;
  education: Array<Omit<ResumeEducation, "id">>;
  links: Array<Omit<ResumeLink, "id">>;
}

const RESUME_STARTER_PROFILES: ResumeStarterProfile[] = [
  {
    id: "software-engineer",
    label: "Software engineer",
    description: "Backend/frontend impact-focused profile.",
    template: "modern",
    personal: {
      fullName: "Alex Morgan",
      headline: "Senior Software Engineer",
      email: "alex@domain.com",
      phone: "+1 (555) 210-3000",
      location: "Seattle, WA",
      website: "https://alexmorgan.dev",
      summary:
        "Product-oriented software engineer with 8+ years delivering scalable web platforms, performance optimizations, and high-availability services used by millions.",
    },
    skills: ["TypeScript", "React", "Next.js", "Node.js", "PostgreSQL", "AWS", "Redis", "Docker"],
    experience: [
      {
        role: "Senior Software Engineer",
        company: "Orbit Commerce",
        location: "Remote",
        startDate: "2022-01",
        endDate: "",
        current: true,
        highlights:
          "Led migration from monolith to modular services, improving deployment frequency by 3x.\nOptimized checkout APIs and cut P95 latency by 41%.\nMentored 5 engineers and established engineering quality standards.",
      },
      {
        role: "Software Engineer",
        company: "Nimbus Labs",
        location: "Austin, TX",
        startDate: "2018-05",
        endDate: "2021-12",
        current: false,
        highlights:
          "Built analytics dashboard used by 2,500+ business users.\nReduced cloud spend by 28% through workload and caching optimizations.\nImplemented CI/CD pipelines reducing release rollback incidents by 35%.",
      },
    ],
    education: [
      {
        school: "University of Texas",
        degree: "B.S.",
        field: "Computer Science",
        startDate: "2013-09",
        endDate: "2017-05",
        details: "Graduated with honors. Capstone: distributed event processing platform.",
      },
    ],
    links: [
      { label: "GitHub", url: "https://github.com/alexmorgan" },
      { label: "LinkedIn", url: "https://linkedin.com/in/alexmorgan" },
    ],
  },
  {
    id: "product-manager",
    label: "Product manager",
    description: "Growth and execution-oriented product profile.",
    template: "executive",
    personal: {
      fullName: "Jordan Lee",
      headline: "Senior Product Manager",
      email: "jordan@domain.com",
      phone: "+1 (555) 770-1221",
      location: "San Francisco, CA",
      website: "https://jordanlee.pm",
      summary:
        "Data-driven product manager with 7+ years shipping B2B SaaS initiatives, improving activation and retention through customer insight, experimentation, and cross-functional execution.",
    },
    skills: ["Roadmapping", "Product Discovery", "SQL", "A/B Testing", "Analytics", "Go-to-market", "Agile", "UX Research"],
    experience: [
      {
        role: "Senior Product Manager",
        company: "Atlas Ops",
        location: "Remote",
        startDate: "2021-03",
        endDate: "",
        current: true,
        highlights:
          "Defined and launched onboarding redesign that increased activation by 22%.\nPrioritized and delivered enterprise permissions suite adding $1.8M ARR.\nEstablished product health dashboard used in weekly leadership reviews.",
      },
      {
        role: "Product Manager",
        company: "Metricflow",
        location: "New York, NY",
        startDate: "2018-01",
        endDate: "2021-02",
        current: false,
        highlights:
          "Owned reporting product line with 40k MAU.\nDrove churn reduction project lowering monthly churn from 4.1% to 2.9%.\nBuilt partner integration roadmap and delivered first 6 integrations in two quarters.",
      },
    ],
    education: [
      {
        school: "University of Michigan",
        degree: "B.A.",
        field: "Economics",
        startDate: "2011-09",
        endDate: "2015-05",
        details: "Minor in Computer Science.",
      },
    ],
    links: [
      { label: "LinkedIn", url: "https://linkedin.com/in/jordanlee" },
      { label: "Portfolio", url: "https://jordanlee.pm/case-studies" },
    ],
  },
  {
    id: "ux-designer",
    label: "UX designer",
    description: "Research and product design profile.",
    template: "creative",
    personal: {
      fullName: "Taylor Brooks",
      headline: "Senior UX/UI Designer",
      email: "taylor@domain.com",
      phone: "+1 (555) 640-9302",
      location: "Chicago, IL",
      website: "https://taylor.design",
      summary:
        "UX/UI designer with 6+ years shaping intuitive B2B and consumer experiences. Strong in user research, interaction design, and design systems that improve product adoption.",
    },
    skills: ["Figma", "Design Systems", "Interaction Design", "UX Research", "Prototyping", "Usability Testing", "Accessibility", "Storytelling"],
    experience: [
      {
        role: "Senior UX Designer",
        company: "Northstar Health",
        location: "Remote",
        startDate: "2022-02",
        endDate: "",
        current: true,
        highlights:
          "Redesigned patient onboarding flow, reducing abandonment by 31%.\nBuilt cross-platform design system with 50+ reusable components.\nPartnered with engineering to improve accessibility from WCAG A to AA.",
      },
      {
        role: "Product Designer",
        company: "Beacon Suite",
        location: "Chicago, IL",
        startDate: "2019-06",
        endDate: "2022-01",
        current: false,
        highlights:
          "Led end-to-end design for analytics workspace used by 15k users.\nImplemented user research program and improved SUS score from 62 to 81.\nProduced interactive prototypes accelerating stakeholder alignment.",
      },
    ],
    education: [
      {
        school: "Illinois Institute of Art",
        degree: "BFA",
        field: "Interaction Design",
        startDate: "2014-09",
        endDate: "2018-05",
        details: "Dean's list, interaction and visual design specialization.",
      },
    ],
    links: [
      { label: "Portfolio", url: "https://taylor.design/work" },
      { label: "LinkedIn", url: "https://linkedin.com/in/taylorbrooks" },
    ],
  },
];

function createResumeFromStarter(starter: ResumeStarterProfile): ResumeData {
  return {
    template: starter.template,
    personal: starter.personal,
    skills: starter.skills,
    experience: starter.experience.map((item) => ({ ...item, id: crypto.randomUUID() })),
    education: starter.education.map((item) => ({ ...item, id: crypto.randomUUID() })),
    links: starter.links.map((item) => ({ ...item, id: crypto.randomUUID() })),
  };
}

function suggestExperienceHighlights(role: string, company: string): string {
  const safeRole = role || "core";
  const safeCompany = company || "the organization";
  return [
    `Led ${safeRole.toLowerCase()} initiatives at ${safeCompany}, improving team velocity by 30%.`,
    `Delivered a measurable project outcome that reduced cycle time by 25% and improved quality.`,
    `Partnered cross-functionally to launch high-impact work with clear business KPIs and stakeholder alignment.`,
  ].join("\n");
}

function generateProfessionalSummary(resume: ResumeData): string {
  const topSkills = resume.skills.slice(0, 5).join(", ");
  const latestExperience = resume.experience.find((item) => item.role || item.company);
  const role = latestExperience?.role || resume.personal.headline || "professional";
  const company = latestExperience?.company ? ` at ${latestExperience.company}` : "";
  const skillText = topSkills ? ` with strengths in ${topSkills}` : "";
  return `${role}${company} focused on delivering measurable outcomes${skillText}. Experienced in cross-functional execution, stakeholder communication, and turning complex goals into reliable results.`;
}

function sanitizeResumeData(raw: unknown): ResumeData | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ResumeData>;
  const defaults = createDefaultResumeData();
  const template: ResumeTemplate =
    candidate.template === "minimal" ||
    candidate.template === "compact" ||
    candidate.template === "modern" ||
    candidate.template === "executive" ||
    candidate.template === "creative"
      ? candidate.template
      : defaults.template;

  const personalCandidate = (candidate.personal ?? {}) as Partial<ResumePersonalInfo>;
  const personal: ResumePersonalInfo = {
    fullName: typeof personalCandidate.fullName === "string" ? personalCandidate.fullName : defaults.personal.fullName,
    headline: typeof personalCandidate.headline === "string" ? personalCandidate.headline : defaults.personal.headline,
    email: typeof personalCandidate.email === "string" ? personalCandidate.email : defaults.personal.email,
    phone: typeof personalCandidate.phone === "string" ? personalCandidate.phone : defaults.personal.phone,
    location: typeof personalCandidate.location === "string" ? personalCandidate.location : defaults.personal.location,
    website: typeof personalCandidate.website === "string" ? personalCandidate.website : defaults.personal.website,
    summary: typeof personalCandidate.summary === "string" ? personalCandidate.summary : defaults.personal.summary,
  };

  const skills = Array.isArray(candidate.skills)
    ? candidate.skills
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 50)
    : defaults.skills;

  const experienceSource = Array.isArray(candidate.experience) ? (candidate.experience as unknown[]) : [];
  const experience = experienceSource
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
          const entry = item as Partial<ResumeExperience>;
          return {
            id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
            role: typeof entry.role === "string" ? entry.role : "",
            company: typeof entry.company === "string" ? entry.company : "",
            location: typeof entry.location === "string" ? entry.location : "",
            startDate: typeof entry.startDate === "string" ? entry.startDate : "",
            endDate: typeof entry.endDate === "string" ? entry.endDate : "",
            current: Boolean(entry.current),
            highlights: typeof entry.highlights === "string" ? entry.highlights : "",
          };
        })
    .slice(0, 12);

  const educationSource = Array.isArray(candidate.education) ? (candidate.education as unknown[]) : [];
  const education = educationSource
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
          const entry = item as Partial<ResumeEducation>;
          return {
            id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
            school: typeof entry.school === "string" ? entry.school : "",
            degree: typeof entry.degree === "string" ? entry.degree : "",
            field: typeof entry.field === "string" ? entry.field : "",
            startDate: typeof entry.startDate === "string" ? entry.startDate : "",
            endDate: typeof entry.endDate === "string" ? entry.endDate : "",
            details: typeof entry.details === "string" ? entry.details : "",
          };
        })
    .slice(0, 8);

  const linksSource = Array.isArray(candidate.links) ? (candidate.links as unknown[]) : [];
  const links = linksSource
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
          const entry = item as Partial<ResumeLink>;
          return {
            id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
            label: typeof entry.label === "string" ? entry.label : "",
            url: typeof entry.url === "string" ? entry.url : "",
          };
        })
    .slice(0, 12);

  return {
    template,
    personal,
    skills,
    experience: experience.length ? experience : defaults.experience,
    education: education.length ? education : defaults.education,
    links,
  };
}

function formatMonthLabel(value: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  const isoMonthPattern = /^\d{4}-\d{2}$/;
  const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
  const normalized = isoMonthPattern.test(trimmed) ? `${trimmed}-01` : isoDatePattern.test(trimmed) ? trimmed : "";
  if (!normalized) return trimmed;
  const date = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(date.getTime())) return trimmed;
  return date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

function formatDateRange(startDate: string, endDate: string, current: boolean): string {
  const startLabel = formatMonthLabel(startDate) || "Start";
  const endLabel = current ? "Present" : formatMonthLabel(endDate) || "End";
  return `${startLabel} - ${endLabel}`;
}

function extractImportantKeywords(text: string): string[] {
  const matches = text.toLowerCase().match(/[a-z0-9][a-z0-9+#./-]{2,}/g) ?? [];
  const stopWords = new Set([
    "about",
    "after",
    "again",
    "been",
    "below",
    "being",
    "both",
    "each",
    "from",
    "have",
    "into",
    "just",
    "more",
    "only",
    "over",
    "such",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "with",
    "your",
  ]);
  const counts = new Map<string, number>();
  for (const item of matches) {
    if (stopWords.has(item)) continue;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([keyword]) => keyword);
}

function buildResumePlainText(resume: ResumeData): string {
  return [
    resume.personal.fullName,
    resume.personal.headline,
    resume.personal.summary,
    resume.skills.join(" "),
    resume.experience
      .map((item) => `${item.role} ${item.company} ${item.location} ${item.highlights}`)
      .join(" "),
    resume.education.map((item) => `${item.school} ${item.degree} ${item.field} ${item.details}`).join(" "),
    resume.links.map((item) => `${item.label} ${item.url}`).join(" "),
  ]
    .join(" ")
    .trim();
}

function buildResumePrintHtml(resume: ResumeData): string {
  const skillHtml = resume.skills.map((skill) => `<span class="pill">${escapeHtml(skill)}</span>`).join("");
  const linksHtml = resume.links
    .filter((item) => item.label.trim() || item.url.trim())
    .map(
      (item) => `<li><strong>${escapeHtml(item.label || "Link")}:</strong> ${escapeHtml(item.url || "-")}</li>`,
    )
    .join("");
  const experienceHtml = resume.experience
    .filter((item) => item.role.trim() || item.company.trim() || item.highlights.trim())
    .map((item) => {
      const bulletHtml = item.highlights
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join("");
      return `<article class="entry">
  <div class="entry-head">
    <h3>${escapeHtml(item.role || "Role")}</h3>
    <p>${escapeHtml(item.company || "Company")}</p>
  </div>
  <p class="muted">${escapeHtml(formatDateRange(item.startDate, item.endDate, item.current))}${
    item.location ? ` | ${escapeHtml(item.location)}` : ""
  }</p>
  ${bulletHtml ? `<ul>${bulletHtml}</ul>` : ""}
</article>`;
    })
    .join("");
  const educationHtml = resume.education
    .filter((item) => item.school.trim() || item.degree.trim() || item.field.trim() || item.details.trim())
    .map((item) => {
      const heading = [item.degree, item.field].filter(Boolean).join(", ");
      return `<article class="entry">
  <div class="entry-head">
    <h3>${escapeHtml(item.school || "School")}</h3>
    <p>${escapeHtml(heading || "Program")}</p>
  </div>
  <p class="muted">${escapeHtml(formatDateRange(item.startDate, item.endDate, false))}</p>
  ${item.details ? `<p>${escapeHtml(item.details)}</p>` : ""}
</article>`;
    })
    .join("");

  return `<main class="resume-doc resume-template-${resume.template}">
<header class="resume-header">
  <h1>${escapeHtml(resume.personal.fullName || "Your Name")}</h1>
  <p class="resume-headline">${escapeHtml(resume.personal.headline || "Professional headline")}</p>
  <p class="muted">${escapeHtml(
    [resume.personal.email, resume.personal.phone, resume.personal.location, resume.personal.website]
      .filter(Boolean)
      .join(" | "),
  )}</p>
</header>
${resume.personal.summary ? `<section><h2>Profile</h2><p>${escapeHtml(resume.personal.summary)}</p></section>` : ""}
${skillHtml ? `<section><h2>Skills</h2><div class="pill-row">${skillHtml}</div></section>` : ""}
${experienceHtml ? `<section><h2>Experience</h2>${experienceHtml}</section>` : ""}
${educationHtml ? `<section><h2>Education</h2>${educationHtml}</section>` : ""}
${linksHtml ? `<section><h2>Links</h2><ul>${linksHtml}</ul></section>` : ""}
</main>`;
}

function ResumeBuilderTool() {
  const storageKey = "utiliora-resume-builder-v1";
  const importRef = useRef<HTMLInputElement | null>(null);
  const [resume, setResume] = useState<ResumeData>(() => createDefaultResumeData());
  const [skillDraft, setSkillDraft] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const sanitized = sanitizeResumeData(JSON.parse(stored));
      if (sanitized) setResume(sanitized);
    } catch {
      // Ignore malformed resume data.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(resume));
    } catch {
      // Ignore storage failures.
    }
  }, [resume, storageKey]);

  const updatePersonal = <K extends keyof ResumePersonalInfo>(field: K, value: ResumePersonalInfo[K]) => {
    setResume((current) => ({ ...current, personal: { ...current.personal, [field]: value } }));
  };

  const updateExperience = (id: string, patch: Partial<ResumeExperience>) => {
    setResume((current) => ({
      ...current,
      experience: current.experience.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateEducation = (id: string, patch: Partial<ResumeEducation>) => {
    setResume((current) => ({
      ...current,
      education: current.education.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const updateLink = (id: string, patch: Partial<ResumeLink>) => {
    setResume((current) => ({
      ...current,
      links: current.links.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const resumeKeywords = useMemo(() => extractImportantKeywords(buildResumePlainText(resume)), [resume]);
  const jobKeywords = useMemo(() => extractImportantKeywords(jobDescription).slice(0, 35), [jobDescription]);
  const matchedKeywords = useMemo(() => {
    const resumeSet = new Set(resumeKeywords);
    return jobKeywords.filter((item) => resumeSet.has(item));
  }, [jobKeywords, resumeKeywords]);
  const coveragePercent = jobKeywords.length ? (matchedKeywords.length / jobKeywords.length) * 100 : 0;
  const missingKeywords = useMemo(() => {
    const matched = new Set(matchedKeywords);
    return jobKeywords.filter((keyword) => !matched.has(keyword));
  }, [jobKeywords, matchedKeywords]);

  const resumeScoreChecks = useMemo(
    () => [
      {
        label: "Header details",
        ok: Boolean(
          resume.personal.fullName.trim() &&
            resume.personal.headline.trim() &&
            (resume.personal.email.trim() || resume.personal.phone.trim()),
        ),
      },
      { label: "Summary quality", ok: resume.personal.summary.trim().length >= 80 },
      { label: "Skills depth", ok: resume.skills.length >= 6 },
      {
        label: "Experience coverage",
        ok:
          resume.experience.filter((item) => item.role.trim() || item.company.trim()).length >= 2 &&
          resume.experience.some((item) => item.highlights.trim().split(/\r?\n/).filter(Boolean).length >= 2),
      },
      { label: "Education", ok: resume.education.some((item) => item.school.trim() || item.degree.trim()) },
      { label: "Portfolio links", ok: resume.links.some((item) => item.url.trim()) },
    ],
    [resume],
  );
  const resumeQualityScore = useMemo(() => {
    const passed = resumeScoreChecks.filter((item) => item.ok).length;
    return Math.round((passed / resumeScoreChecks.length) * 100);
  }, [resumeScoreChecks]);

  const printResume = () => {
    const opened = openPrintWindow(
      `${resume.personal.fullName || "Resume"} - Utiliora`,
      buildResumePrintHtml(resume),
      `
      .resume-doc { max-width: 900px; margin: 0 auto; display: grid; gap: 14px; }
      .resume-header { border-bottom: 1px solid #d3dbe5; padding-bottom: 10px; }
      .resume-header h1 { margin: 0; font-size: 28px; }
      .resume-headline { margin: 4px 0 0; font-weight: 600; }
      h2 { font-size: 16px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.04em; }
      .entry { margin-bottom: 10px; }
      .entry-head { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
      .entry-head h3 { margin: 0; font-size: 15px; }
      .entry-head p { margin: 0; font-weight: 600; }
      .pill-row { display: flex; flex-wrap: wrap; gap: 6px; }
      .pill { border: 1px solid #d3dbe5; border-radius: 999px; padding: 3px 8px; font-size: 12px; }
      ul { margin: 6px 0 0; padding-left: 18px; }
      .resume-template-compact .entry-head { display: block; }
      .resume-template-minimal h2 { text-transform: none; letter-spacing: 0; }
      .resume-template-executive .resume-header { border-bottom: 2px solid #1f3347; }
      .resume-template-executive h2 { color: #1f3347; }
      .resume-template-creative .resume-header { border-bottom: 2px solid #236f6a; }
      .resume-template-creative h2 { color: #236f6a; }
      .resume-template-creative .pill { border-color: #236f6a; color: #236f6a; }
      `,
    );
    if (!opened) {
      setStatus("Enable popups to print or save PDF.");
      return;
    }
    setStatus("Opened print view. Choose Save as PDF.");
    trackEvent("resume_print_open", { template: resume.template });
  };

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={FileText}
        title="Resume builder"
        subtitle="Build modern resumes with templates, ATS keyword matching, and print-ready output."
      />
      <div className="button-row">
        <span className="supporting-text">Template:</span>
        {[
          { id: "modern", label: "Modern" },
          { id: "minimal", label: "Minimal" },
          { id: "compact", label: "Compact" },
          { id: "executive", label: "Executive" },
          { id: "creative", label: "Creative" },
        ].map((option) => (
          <button
            key={option.id}
            className="chip-button"
            type="button"
            onClick={() => setResume((current) => ({ ...current, template: option.id as ResumeTemplate }))}
            aria-pressed={resume.template === option.id}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="preset-row">
        <span className="supporting-text">Starter profiles:</span>
        {RESUME_STARTER_PROFILES.map((starter) => (
          <button
            key={starter.id}
            className="chip-button"
            type="button"
            onClick={() => {
              setResume(createResumeFromStarter(starter));
              setStatus(`Loaded ${starter.label} starter profile.`);
            }}
            title={starter.description}
          >
            {starter.label}
          </button>
        ))}
      </div>
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            downloadTextFile("resume-data.json", JSON.stringify(resume, null, 2), "application/json;charset=utf-8;");
            setStatus("Resume JSON exported.");
          }}
        >
          <Download size={15} />
          Export JSON
        </button>
        <button className="action-button secondary" type="button" onClick={() => importRef.current?.click()}>
          <Plus size={15} />
          Import JSON
        </button>
        <button className="action-button" type="button" onClick={printResume}>
          <Printer size={15} />
          Print / PDF
        </button>
      </div>
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const raw = await file.text();
            const sanitized = sanitizeResumeData(JSON.parse(raw));
            if (!sanitized) throw new Error("Invalid format");
            setResume(sanitized);
            setStatus("Imported resume JSON.");
          } catch {
            setStatus("Could not import this JSON file.");
          } finally {
            event.target.value = "";
          }
        }}
      />
      <div className="split-panel">
        <div className="resume-editor">
          <div className="field-grid">
            <label className="field">
              <span>Full name</span>
              <input type="text" value={resume.personal.fullName} onChange={(event) => updatePersonal("fullName", event.target.value)} />
            </label>
            <label className="field">
              <span>Professional title</span>
              <input type="text" value={resume.personal.headline} onChange={(event) => updatePersonal("headline", event.target.value)} />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={resume.personal.email} onChange={(event) => updatePersonal("email", event.target.value)} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input type="text" value={resume.personal.phone} onChange={(event) => updatePersonal("phone", event.target.value)} />
            </label>
            <label className="field">
              <span>Location</span>
              <input type="text" value={resume.personal.location} onChange={(event) => updatePersonal("location", event.target.value)} />
            </label>
            <label className="field">
              <span>Website</span>
              <input type="url" value={resume.personal.website} onChange={(event) => updatePersonal("website", event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Summary</span>
            <textarea rows={4} value={resume.personal.summary} onChange={(event) => updatePersonal("summary", event.target.value)} />
          </label>
          <div className="button-row">
            <button
              className="action-button secondary"
              type="button"
              onClick={() => {
                const generated = generateProfessionalSummary(resume);
                updatePersonal("summary", generated);
                setStatus("Generated a professional summary from your current profile.");
              }}
            >
              <Sparkles size={15} />
              Generate summary
            </button>
          </div>
          <div className="mini-panel">
            <h3>Resume quality score</h3>
            <div className="progress-panel" aria-hidden>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${resumeQualityScore}%` }} />
              </div>
            </div>
            <p className="supporting-text">Current score: {resumeQualityScore}%</p>
            <div className="chip-list">
              {resumeScoreChecks.map((check) => (
                <span key={check.label} className={`status-badge ${check.ok ? "ok" : "warn"}`}>
                  {check.ok ? "Done" : "Needs work"} - {check.label}
                </span>
              ))}
            </div>
          </div>
          <div className="mini-panel">
            <h3>Skills</h3>
            <div className="button-row">
              <label className="field" style={{ flex: "1 1 240px" }}>
                <span>Add skills (comma separated)</span>
                <input
                  type="text"
                  value={skillDraft}
                  onChange={(event) => setSkillDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const tokens = skillDraft.split(",").map((item) => item.trim()).filter(Boolean);
                      if (!tokens.length) return;
                      setResume((current) => ({
                        ...current,
                        skills: [...new Set([...current.skills, ...tokens])].slice(0, 50),
                      }));
                      setSkillDraft("");
                    }
                  }}
                />
              </label>
              <button
                className="action-button"
                type="button"
                onClick={() => {
                  const tokens = skillDraft.split(",").map((item) => item.trim()).filter(Boolean);
                  if (!tokens.length) return;
                  setResume((current) => ({
                    ...current,
                    skills: [...new Set([...current.skills, ...tokens])].slice(0, 50),
                  }));
                  setSkillDraft("");
                }}
              >
                Add skill
              </button>
            </div>
            <div className="chip-list">
              {resume.skills.map((skill) => (
                <button
                  key={skill}
                  className="chip-button"
                  type="button"
                  onClick={() => setResume((current) => ({ ...current, skills: current.skills.filter((item) => item !== skill) }))}
                >
                  {skill} x
                </button>
              ))}
            </div>
          </div>
          <div className="mini-panel">
            <div className="panel-head">
              <h3 className="mini-heading">
                <Briefcase size={16} />
                Experience
              </h3>
              <button
                className="action-button secondary"
                type="button"
                onClick={() =>
                  setResume((current) => ({
                    ...current,
                    experience: [
                      ...current.experience,
                      {
                        id: crypto.randomUUID(),
                        role: "",
                        company: "",
                        location: "",
                        startDate: "",
                        endDate: "",
                        current: false,
                        highlights: "",
                      },
                    ],
                  }))
                }
              >
                <Plus size={15} />
                Add role
              </button>
            </div>
            {resume.experience.map((item) => (
              <article key={item.id} className="resume-row">
                <div className="field-grid">
                  <label className="field">
                    <span>Role</span>
                    <input type="text" value={item.role} onChange={(event) => updateExperience(item.id, { role: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Company</span>
                    <input type="text" value={item.company} onChange={(event) => updateExperience(item.id, { company: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Location</span>
                    <input type="text" value={item.location} onChange={(event) => updateExperience(item.id, { location: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Start</span>
                    <input type="month" value={item.startDate} onChange={(event) => updateExperience(item.id, { startDate: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>End</span>
                    <input
                      type="month"
                      value={item.endDate}
                      disabled={item.current}
                      onChange={(event) => updateExperience(item.id, { endDate: event.target.value, current: false })}
                    />
                  </label>
                  <label className="checkbox">
                    <input type="checkbox" checked={item.current} onChange={(event) => updateExperience(item.id, { current: event.target.checked, endDate: event.target.checked ? "" : item.endDate })} />
                    Current role
                  </label>
                </div>
                <label className="field">
                  <span>Highlights (one bullet per line)</span>
                  <textarea rows={4} value={item.highlights} onChange={(event) => updateExperience(item.id, { highlights: event.target.value })} />
                </label>
                <div className="button-row">
                  <button
                    className="action-button secondary"
                    type="button"
                    onClick={() =>
                      updateExperience(item.id, {
                        highlights: suggestExperienceHighlights(item.role, item.company),
                      })
                    }
                  >
                    <Sparkles size={15} />
                    Suggest bullets
                  </button>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  disabled={resume.experience.length <= 1}
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      experience:
                        current.experience.length > 1
                          ? current.experience.filter((entry) => entry.id !== item.id)
                          : current.experience,
                    }))
                  }
                >
                  <Trash2 size={14} />
                  Remove role
                </button>
              </article>
            ))}
          </div>
          <div className="mini-panel">
            <div className="panel-head">
              <h3 className="mini-heading">
                <GraduationCap size={16} />
                Education
              </h3>
              <button
                className="action-button secondary"
                type="button"
                onClick={() =>
                  setResume((current) => ({
                    ...current,
                    education: [
                      ...current.education,
                      {
                        id: crypto.randomUUID(),
                        school: "",
                        degree: "",
                        field: "",
                        startDate: "",
                        endDate: "",
                        details: "",
                      },
                    ],
                  }))
                }
              >
                <Plus size={15} />
                Add school
              </button>
            </div>
            {resume.education.map((item) => (
              <article key={item.id} className="resume-row">
                <div className="field-grid">
                  <label className="field">
                    <span>School</span>
                    <input type="text" value={item.school} onChange={(event) => updateEducation(item.id, { school: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Degree</span>
                    <input type="text" value={item.degree} onChange={(event) => updateEducation(item.id, { degree: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Field</span>
                    <input type="text" value={item.field} onChange={(event) => updateEducation(item.id, { field: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Start</span>
                    <input type="month" value={item.startDate} onChange={(event) => updateEducation(item.id, { startDate: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>End</span>
                    <input type="month" value={item.endDate} onChange={(event) => updateEducation(item.id, { endDate: event.target.value })} />
                  </label>
                </div>
                <label className="field">
                  <span>Details</span>
                  <textarea rows={3} value={item.details} onChange={(event) => updateEducation(item.id, { details: event.target.value })} />
                </label>
                <button
                  className="icon-button"
                  type="button"
                  disabled={resume.education.length <= 1}
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      education:
                        current.education.length > 1
                          ? current.education.filter((entry) => entry.id !== item.id)
                          : current.education,
                    }))
                  }
                >
                  <Trash2 size={14} />
                  Remove school
                </button>
              </article>
            ))}
          </div>
          <div className="mini-panel">
            <div className="panel-head">
              <h3>Links</h3>
              <button
                className="action-button secondary"
                type="button"
                onClick={() =>
                  setResume((current) => ({
                    ...current,
                    links: [...current.links, { id: crypto.randomUUID(), label: "", url: "" }],
                  }))
                }
              >
                <Plus size={15} />
                Add link
              </button>
            </div>
            {resume.links.map((item) => (
              <article key={item.id} className="resume-row">
                <div className="field-grid">
                  <label className="field">
                    <span>Label</span>
                    <input type="text" value={item.label} onChange={(event) => updateLink(item.id, { label: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>URL</span>
                    <input type="url" value={item.url} onChange={(event) => updateLink(item.id, { url: event.target.value })} />
                  </label>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      links: current.links.filter((entry) => entry.id !== item.id),
                    }))
                  }
                >
                  <Trash2 size={14} />
                  Remove link
                </button>
              </article>
            ))}
          </div>
          <div className="mini-panel">
            <h3>ATS keyword check</h3>
            <label className="field">
              <span>Paste target job description</span>
              <textarea rows={5} value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} />
            </label>
            <ResultList
              rows={[
                { label: "Target keywords", value: formatNumericValue(jobKeywords.length) },
                { label: "Matched keywords", value: formatNumericValue(matchedKeywords.length) },
                { label: "Coverage", value: `${coveragePercent.toFixed(1)}%` },
              ]}
            />
            {jobKeywords.length > 0 ? (
              <>
                <p className="supporting-text">
                  Missing keywords to consider: {missingKeywords.length ? missingKeywords.length : 0}
                </p>
                <div className="chip-list">
                  {missingKeywords.slice(0, 15).map((keyword) => (
                    <span key={keyword} className="status-badge warn">
                      {keyword}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="supporting-text">Add a job description to benchmark keyword coverage.</p>
            )}
          </div>
        </div>
        <aside className={`resume-preview resume-template-${resume.template}`}>
          <h3>Live preview</h3>
          <header className="resume-header">
            <h4>{resume.personal.fullName || "Your Name"}</h4>
            <p>{resume.personal.headline || "Professional headline"}</p>
            <p className="supporting-text">
              {[resume.personal.email, resume.personal.phone, resume.personal.location, resume.personal.website]
                .filter(Boolean)
                .join(" | ") || "Contact details"}
            </p>
          </header>
          {resume.personal.summary ? (
            <section className="resume-section">
              <h5>Summary</h5>
              <p>{resume.personal.summary}</p>
            </section>
          ) : null}
          {resume.skills.length ? (
            <section className="resume-section">
              <h5>Skills</h5>
              <div className="chip-list">
                {resume.skills.map((item) => (
                  <span key={item} className="chip">
                    {item}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
          <section className="resume-section">
            <h5>Experience</h5>
            {resume.experience
              .filter((item) => item.role || item.company || item.highlights)
              .map((item) => (
                <article key={item.id} className="resume-entry">
                  <div className="resume-entry-head">
                    <strong>{item.role || "Role"}</strong>
                    <span>{item.company || "Company"}</span>
                  </div>
                  <p className="supporting-text">
                    {formatDateRange(item.startDate, item.endDate, item.current)}
                    {item.location ? ` | ${item.location}` : ""}
                  </p>
                  <ul className="plain-list">
                    {item.highlights
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, index) => (
                        <li key={`${item.id}-${index}`}>{line}</li>
                      ))}
                  </ul>
                </article>
              ))}
          </section>
          <section className="resume-section">
            <h5>Education</h5>
            {resume.education
              .filter((item) => item.school || item.degree || item.field || item.details)
              .map((item) => (
                <article key={item.id} className="resume-entry">
                  <div className="resume-entry-head">
                    <strong>{item.school || "School"}</strong>
                    <span>{[item.degree, item.field].filter(Boolean).join(", ") || "Program"}</span>
                  </div>
                  <p className="supporting-text">{formatDateRange(item.startDate, item.endDate, false)}</p>
                  {item.details ? <p>{item.details}</p> : null}
                </article>
              ))}
          </section>
          {resume.links.some((item) => item.label || item.url) ? (
            <section className="resume-section">
              <h5>Links</h5>
              <ul className="plain-list">
                {resume.links
                  .filter((item) => item.label || item.url)
                  .map((item) => (
                    <li key={item.id}>
                      <strong>{item.label || "Link"}:</strong> {item.url || "-"}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
          <ResultList
            rows={[
              {
                label: "Filled sections",
                value: formatNumericValue(
                  [
                    resume.personal.summary.trim() ? 1 : 0,
                    resume.skills.length ? 1 : 0,
                    resume.experience.some((item) => item.role || item.company || item.highlights) ? 1 : 0,
                    resume.education.some((item) => item.school || item.degree || item.field || item.details) ? 1 : 0,
                    resume.links.some((item) => item.label || item.url) ? 1 : 0,
                  ].reduce((sum, item) => sum + item, 0),
                ),
              },
              { label: "Skills", value: formatNumericValue(resume.skills.length) },
              { label: "Quality score", value: `${resumeQualityScore}%` },
              {
                label: "ATS match",
                value: jobKeywords.length ? `${coveragePercent.toFixed(1)}%` : "Add target role",
              },
            ]}
          />
        </aside>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

interface InvoiceData {
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  businessName: string;
  businessEmail: string;
  businessAddress: string;
  clientName: string;
  clientEmail: string;
  clientAddress: string;
  taxPercent: string;
  discountType: "percent" | "fixed";
  discountValue: string;
  shipping: string;
  notes: string;
  paymentTerms: string;
  logoDataUrl: string;
  logoFileName: string;
  items: InvoiceLineItem[];
}

interface CurrencyOption {
  code: string;
  name: string;
}

const INVOICE_AFRICAN_PRIORITY: CurrencyOption[] = [
  { code: "DZD", name: "Algerian Dinar" },
  { code: "AOA", name: "Angolan Kwanza" },
  { code: "BWP", name: "Botswana Pula" },
  { code: "BIF", name: "Burundian Franc" },
  { code: "CVE", name: "Cape Verdean Escudo" },
  { code: "CDF", name: "Congolese Franc" },
  { code: "EGP", name: "Egyptian Pound" },
  { code: "ETB", name: "Ethiopian Birr" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "MAD", name: "Moroccan Dirham" },
  { code: "MUR", name: "Mauritian Rupee" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "RWF", name: "Rwandan Franc" },
  { code: "ZAR", name: "South African Rand" },
  { code: "TZS", name: "Tanzanian Shilling" },
  { code: "TND", name: "Tunisian Dinar" },
  { code: "UGX", name: "Ugandan Shilling" },
  { code: "XAF", name: "Central African CFA Franc" },
  { code: "XOF", name: "West African CFA Franc" },
  { code: "ZMW", name: "Zambian Kwacha" },
  { code: "ZWL", name: "Zimbabwean Dollar" },
];

function mergeCurrencyOptions(...lists: CurrencyOption[][]): CurrencyOption[] {
  const map = new Map<string, string>();
  lists.forEach((list) => {
    list.forEach((currency) => {
      if (!/^[A-Z]{3}$/.test(currency.code)) return;
      if (!currency.name.trim()) return;
      if (!map.has(currency.code)) {
        map.set(currency.code, currency.name.trim());
      }
    });
  });
  return [...map.entries()]
    .map(([code, name]) => ({ code, name }))
    .sort((left, right) => left.code.localeCompare(right.code));
}

function getInvoiceClientFallbackCurrencies(): CurrencyOption[] {
  const intlWithSupported = Intl as typeof Intl & { supportedValuesOf?: (key: "currency") => string[] };
  const supported = intlWithSupported.supportedValuesOf?.("currency") ?? [];
  const displayNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "currency" }) : null;
  const fromIntl = supported
    .map((code) => ({
      code,
      name: displayNames?.of(code) ?? code,
    }))
    .filter((item) => /^[A-Z]{3}$/.test(item.code) && item.name);
  if (fromIntl.length) {
    return mergeCurrencyOptions(fromIntl, INVOICE_AFRICAN_PRIORITY);
  }
  return mergeCurrencyOptions(
    [
      { code: "USD", name: "United States Dollar" },
      { code: "EUR", name: "Euro" },
      { code: "GBP", name: "Pound Sterling" },
      { code: "JPY", name: "Japanese Yen" },
      { code: "CAD", name: "Canadian Dollar" },
      { code: "AUD", name: "Australian Dollar" },
      { code: "INR", name: "Indian Rupee" },
      { code: "BRL", name: "Brazilian Real" },
      { code: "CNY", name: "Chinese Yuan" },
    ],
    INVOICE_AFRICAN_PRIORITY,
  );
}

interface InvoiceWorkspace {
  id: string;
  label: string;
  updatedAt: number;
  invoice: InvoiceData;
}

interface InvoiceWorkspaceStorage {
  activeWorkspaceId: string;
  workspaces: InvoiceWorkspace[];
}

function createInvoiceWorkspace(label: string, invoice?: InvoiceData): InvoiceWorkspace {
  return {
    id: crypto.randomUUID(),
    label,
    updatedAt: Date.now(),
    invoice: invoice ?? createDefaultInvoiceData(),
  };
}

function deriveWorkspaceLabel(invoice: InvoiceData, fallback = "Draft invoice"): string {
  const fromNumber = invoice.invoiceNumber.trim();
  if (fromNumber) return fromNumber;
  const fromClient = invoice.clientName.trim();
  if (fromClient) return `Invoice - ${fromClient}`;
  return fallback;
}

function sanitizeInvoiceWorkspace(raw: unknown): InvoiceWorkspace | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<InvoiceWorkspace>;
  const sanitizedInvoice = sanitizeInvoiceData(candidate.invoice);
  if (!sanitizedInvoice) return null;
  return {
    id: typeof candidate.id === "string" && candidate.id ? candidate.id : crypto.randomUUID(),
    label:
      typeof candidate.label === "string" && candidate.label.trim()
        ? candidate.label.trim()
        : deriveWorkspaceLabel(sanitizedInvoice),
    updatedAt: typeof candidate.updatedAt === "number" ? candidate.updatedAt : Date.now(),
    invoice: sanitizedInvoice,
  };
}

const INVOICE_LOCAL_CURRENCIES = getInvoiceClientFallbackCurrencies();

function createDefaultInvoiceData(): InvoiceData {
  const today = new Date();
  const due = new Date(today);
  due.setDate(due.getDate() + 14);
  const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
  return {
    invoiceNumber: `INV-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`,
    issueDate: toIsoDate(today),
    dueDate: toIsoDate(due),
    currency: "USD",
    businessName: "",
    businessEmail: "",
    businessAddress: "",
    clientName: "",
    clientEmail: "",
    clientAddress: "",
    taxPercent: "0",
    discountType: "percent",
    discountValue: "0",
    shipping: "0",
    notes: "",
    paymentTerms: "Payment due within 14 days.",
    logoDataUrl: "",
    logoFileName: "",
    items: [{ id: crypto.randomUUID(), description: "Service work", quantity: "1", unitPrice: "0" }],
  };
}

function sanitizeInvoiceData(raw: unknown): InvoiceData | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<InvoiceData>;
  const defaults = createDefaultInvoiceData();
  const itemCandidates = Array.isArray(candidate.items) ? (candidate.items as unknown[]) : [];
  const items = itemCandidates
    .filter((item) => Boolean(item) && typeof item === "object")
    .map((item) => {
      const entry = item as Partial<InvoiceLineItem>;
      return {
        id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
        description: typeof entry.description === "string" ? entry.description : "",
        quantity: typeof entry.quantity === "string" ? entry.quantity : "1",
        unitPrice: typeof entry.unitPrice === "string" ? entry.unitPrice : "0",
      };
    })
    .slice(0, 40);
  return {
    invoiceNumber: typeof candidate.invoiceNumber === "string" ? candidate.invoiceNumber : defaults.invoiceNumber,
    issueDate: typeof candidate.issueDate === "string" ? candidate.issueDate : defaults.issueDate,
    dueDate: typeof candidate.dueDate === "string" ? candidate.dueDate : defaults.dueDate,
    currency: typeof candidate.currency === "string" && candidate.currency ? candidate.currency : defaults.currency,
    businessName: typeof candidate.businessName === "string" ? candidate.businessName : defaults.businessName,
    businessEmail: typeof candidate.businessEmail === "string" ? candidate.businessEmail : defaults.businessEmail,
    businessAddress: typeof candidate.businessAddress === "string" ? candidate.businessAddress : defaults.businessAddress,
    clientName: typeof candidate.clientName === "string" ? candidate.clientName : defaults.clientName,
    clientEmail: typeof candidate.clientEmail === "string" ? candidate.clientEmail : defaults.clientEmail,
    clientAddress: typeof candidate.clientAddress === "string" ? candidate.clientAddress : defaults.clientAddress,
    taxPercent: typeof candidate.taxPercent === "string" ? candidate.taxPercent : defaults.taxPercent,
    discountType: candidate.discountType === "fixed" ? "fixed" : "percent",
    discountValue: typeof candidate.discountValue === "string" ? candidate.discountValue : defaults.discountValue,
    shipping: typeof candidate.shipping === "string" ? candidate.shipping : defaults.shipping,
    notes: typeof candidate.notes === "string" ? candidate.notes : defaults.notes,
    paymentTerms: typeof candidate.paymentTerms === "string" ? candidate.paymentTerms : defaults.paymentTerms,
    logoDataUrl: typeof candidate.logoDataUrl === "string" ? candidate.logoDataUrl : defaults.logoDataUrl,
    logoFileName: typeof candidate.logoFileName === "string" ? candidate.logoFileName : defaults.logoFileName,
    items: items.length ? items : defaults.items,
  };
}

function InvoiceGeneratorTool() {
  const storageKey = "utiliora-invoice-workspaces-v1";
  const legacyStorageKey = "utiliora-invoice-generator-v1";
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const [invoice, setInvoice] = useState<InvoiceData>(() => createDefaultInvoiceData());
  const [workspaces, setWorkspaces] = useState<InvoiceWorkspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [status, setStatus] = useState("");
  const [currencyOptions, setCurrencyOptions] = useState<CurrencyOption[]>(INVOICE_LOCAL_CURRENCIES);
  const [currencySource, setCurrencySource] = useState("local-fallback");
  const [currencySearch, setCurrencySearch] = useState("");
  const activeIndex = Math.max(0, workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId));

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<InvoiceWorkspaceStorage>;
        const normalizedWorkspaces = Array.isArray(parsed.workspaces)
          ? parsed.workspaces
              .map((item) => sanitizeInvoiceWorkspace(item))
              .filter((item): item is InvoiceWorkspace => Boolean(item))
          : [];
        if (normalizedWorkspaces.length) {
          const selectedId =
            typeof parsed.activeWorkspaceId === "string" &&
            normalizedWorkspaces.some((workspace) => workspace.id === parsed.activeWorkspaceId)
              ? parsed.activeWorkspaceId
              : normalizedWorkspaces[0].id;
          const selected =
            normalizedWorkspaces.find((workspace) => workspace.id === selectedId) ?? normalizedWorkspaces[0];
          setWorkspaces(normalizedWorkspaces);
          setActiveWorkspaceId(selected.id);
          setInvoice(selected.invoice);
          return;
        }
      }

      const legacy = localStorage.getItem(legacyStorageKey);
      if (legacy) {
        const sanitizedLegacy = sanitizeInvoiceData(JSON.parse(legacy));
        if (sanitizedLegacy) {
          const migrated = createInvoiceWorkspace(deriveWorkspaceLabel(sanitizedLegacy), sanitizedLegacy);
          setWorkspaces([migrated]);
          setActiveWorkspaceId(migrated.id);
          setInvoice(migrated.invoice);
          return;
        }
      }

      const fallbackWorkspace = createInvoiceWorkspace("Draft invoice", createDefaultInvoiceData());
      setWorkspaces([fallbackWorkspace]);
      setActiveWorkspaceId(fallbackWorkspace.id);
    } catch {
      // Ignore malformed invoice data.
    }
  }, [legacyStorageKey, storageKey]);

  useEffect(() => {
    if (!workspaces.length) return;
    try {
      const payload: InvoiceWorkspaceStorage = {
        activeWorkspaceId:
          activeWorkspaceId && workspaces.some((workspace) => workspace.id === activeWorkspaceId)
            ? activeWorkspaceId
            : workspaces[0].id,
        workspaces,
      };
      localStorage.setItem(storageKey, JSON.stringify(payload));
    } catch {
      // Ignore storage failures.
    }
  }, [activeWorkspaceId, storageKey, workspaces]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setWorkspaces((current) =>
      current.map((workspace) =>
        workspace.id === activeWorkspaceId
          ? {
              ...workspace,
              invoice,
              label: deriveWorkspaceLabel(invoice, workspace.label),
              updatedAt: Date.now(),
            }
          : workspace,
      ),
    );
  }, [activeWorkspaceId, invoice]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const loadCurrencies = async () => {
      try {
        const response = await fetch("/api/currencies", { signal: controller.signal });
        if (!response.ok) throw new Error("Currency API unavailable");
        const payload = (await response.json()) as {
          ok?: boolean;
          source?: string;
          currencies?: Array<{ code?: string; name?: string }>;
        };
        const normalized = (payload.currencies ?? [])
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            code: typeof item.code === "string" ? item.code.trim().toUpperCase() : "",
            name: typeof item.name === "string" ? item.name.trim() : "",
          }))
          .filter((item) => /^[A-Z]{3}$/.test(item.code) && item.name)
          .sort((left, right) => left.code.localeCompare(right.code));
        if (!normalized.length) throw new Error("No currencies returned");
        if (!cancelled) {
          setCurrencyOptions(mergeCurrencyOptions(normalized, INVOICE_AFRICAN_PRIORITY));
          setCurrencySource(payload.source || "api");
        }
      } catch {
        if (!cancelled) {
          setCurrencyOptions(INVOICE_LOCAL_CURRENCIES);
          setCurrencySource("local-fallback");
        }
      }
    };
    void loadCurrencies();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (currencyOptions.some((item) => item.code === invoice.currency)) return;
    if (!currencyOptions.length) return;
    setInvoice((current) => ({ ...current, currency: currencyOptions[0].code }));
  }, [currencyOptions, invoice.currency]);

  const updateInvoice = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
    setInvoice((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (id: string, patch: Partial<InvoiceLineItem>) => {
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

  const activateWorkspace = useCallback(
    (workspaceId: string) => {
      const target = workspaces.find((workspace) => workspace.id === workspaceId);
      if (!target) return;
      setActiveWorkspaceId(target.id);
      setInvoice(target.invoice);
      setStatus(`Opened ${target.label}.`);
    },
    [workspaces],
  );

  const createWorkspaceFromCurrent = useCallback(
    (mode: "new" | "duplicate") => {
      const duplicateNumber = (() => {
        const now = new Date();
        return `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`;
      })();
      const nextInvoice = mode === "new" ? createDefaultInvoiceData() : { ...invoice, invoiceNumber: duplicateNumber };
      const nextWorkspace = createInvoiceWorkspace(
        mode === "new" ? "Draft invoice" : `${deriveWorkspaceLabel(invoice)} copy`,
        nextInvoice,
      );
      setWorkspaces((current) => [...current, nextWorkspace]);
      setActiveWorkspaceId(nextWorkspace.id);
      setInvoice(nextWorkspace.invoice);
      setStatus(mode === "new" ? "Created a new invoice workspace." : "Duplicated invoice workspace.");
    },
    [invoice],
  );

  const removeActiveWorkspace = useCallback(() => {
    if (!activeWorkspaceId) return;
    if (workspaces.length <= 1) {
      const replacement = createInvoiceWorkspace("Draft invoice");
      setWorkspaces([replacement]);
      setActiveWorkspaceId(replacement.id);
      setInvoice(replacement.invoice);
      setStatus("Reset to a fresh invoice workspace.");
      return;
    }
    const currentIndex = workspaces.findIndex((workspace) => workspace.id === activeWorkspaceId);
    const nextList = workspaces.filter((workspace) => workspace.id !== activeWorkspaceId);
    const nextWorkspace = nextList[Math.min(Math.max(currentIndex, 0), nextList.length - 1)] ?? nextList[0];
    setWorkspaces(nextList);
    if (nextWorkspace) {
      setActiveWorkspaceId(nextWorkspace.id);
      setInvoice(nextWorkspace.invoice);
      setStatus("Removed current workspace.");
    }
  }, [activeWorkspaceId, workspaces]);

  const financials = useMemo(() => {
    const subtotal = invoice.items.reduce((sum, item) => {
      const quantity = Math.max(0, safeNumberValue(item.quantity));
      const unitPrice = Math.max(0, safeNumberValue(item.unitPrice));
      return sum + quantity * unitPrice;
    }, 0);
    const shipping = Math.max(0, safeNumberValue(invoice.shipping));
    const discountValue = Math.max(0, safeNumberValue(invoice.discountValue));
    const discount =
      invoice.discountType === "percent"
        ? (subtotal * Math.min(100, discountValue)) / 100
        : Math.min(discountValue, subtotal);
    const taxableBase = Math.max(0, subtotal - discount + shipping);
    const tax = (taxableBase * Math.max(0, safeNumberValue(invoice.taxPercent))) / 100;
    const total = taxableBase + tax;
    return { subtotal, shipping, discount, taxableBase, tax, total };
  }, [invoice.discountType, invoice.discountValue, invoice.items, invoice.shipping, invoice.taxPercent]);

  const dueStatus = useMemo(() => {
    if (!invoice.dueDate) return "No due date";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(invoice.dueDate);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
    if (diffDays === 0) return "Due today";
    return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
  }, [invoice.dueDate]);

  const buildInvoiceNumber = useCallback(() => {
    const now = new Date();
    return `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 900 + 100)}`;
  }, []);

  const reminderMessage = useMemo(() => {
    return `Hi ${invoice.clientName || "there"}, this is a friendly reminder that invoice ${
      invoice.invoiceNumber || ""
    } for ${formatCurrencyWithCode(financials.total, invoice.currency)} is due on ${
      invoice.dueDate || "the due date"
    }. Please let me know if you need anything from me to process payment.`;
  }, [financials.total, invoice.clientName, invoice.currency, invoice.dueDate, invoice.invoiceNumber]);

  const visibleCurrencies = useMemo(() => {
    const term = currencySearch.trim().toLowerCase();
    const selected = currencyOptions.find((option) => option.code === invoice.currency) ?? null;
    if (!term) return currencyOptions;
    const filtered = currencyOptions.filter(
      (option) =>
        option.code.toLowerCase().includes(term) || option.name.toLowerCase().includes(term),
    );
    if (selected && !filtered.some((option) => option.code === selected.code)) {
      return [selected, ...filtered];
    }
    return filtered;
  }, [currencyOptions, currencySearch, invoice.currency]);

  const printInvoice = () => {
    const logoHtml = invoice.logoDataUrl
      ? `<img class="invoice-logo" src="${escapeHtml(invoice.logoDataUrl)}" alt="${escapeHtml(invoice.logoFileName || "Business logo")}" />`
      : "";
    const rowsHtml = invoice.items
      .map((item) => {
        const quantity = Math.max(0, safeNumberValue(item.quantity));
        const unitPrice = Math.max(0, safeNumberValue(item.unitPrice));
        const lineTotal = quantity * unitPrice;
        return `<tr>
  <td>${escapeHtml(item.description || "-")}</td>
  <td>${formatNumericValue(quantity)}</td>
  <td>${escapeHtml(formatCurrencyWithCode(unitPrice, invoice.currency))}</td>
  <td>${escapeHtml(formatCurrencyWithCode(lineTotal, invoice.currency))}</td>
</tr>`;
      })
      .join("");
    const bodyHtml = `<main class="invoice-doc">
<header>
  ${logoHtml}
  <h1>Invoice ${escapeHtml(invoice.invoiceNumber || "")}</h1>
  <p class="muted">Issue: ${escapeHtml(invoice.issueDate || "-")} | Due: ${escapeHtml(invoice.dueDate || "-")}</p>
</header>
<section class="cols">
  <article><h2>From</h2><p>${escapeHtml(invoice.businessName || "-")}</p><p>${escapeHtml(invoice.businessEmail || "-")}</p><p>${escapeHtml(invoice.businessAddress || "-")}</p></article>
  <article><h2>Bill To</h2><p>${escapeHtml(invoice.clientName || "-")}</p><p>${escapeHtml(invoice.clientEmail || "-")}</p><p>${escapeHtml(invoice.clientAddress || "-")}</p></article>
</section>
<table>
  <thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>
<section class="totals">
  <p><span>Subtotal</span><strong>${escapeHtml(formatCurrencyWithCode(financials.subtotal, invoice.currency))}</strong></p>
  <p><span>Discount</span><strong>${escapeHtml(formatCurrencyWithCode(financials.discount, invoice.currency))}</strong></p>
  <p><span>Shipping</span><strong>${escapeHtml(formatCurrencyWithCode(financials.shipping, invoice.currency))}</strong></p>
  <p><span>Tax</span><strong>${escapeHtml(formatCurrencyWithCode(financials.tax, invoice.currency))}</strong></p>
  <p class="grand"><span>Amount Due</span><strong>${escapeHtml(formatCurrencyWithCode(financials.total, invoice.currency))}</strong></p>
</section>
${invoice.paymentTerms ? `<p><strong>Terms:</strong> ${escapeHtml(invoice.paymentTerms)}</p>` : ""}
${invoice.notes ? `<p><strong>Notes:</strong> ${escapeHtml(invoice.notes)}</p>` : ""}
</main>`;
    const opened = openPrintWindow(
      `Invoice ${invoice.invoiceNumber || ""}`,
      bodyHtml,
      `
      .invoice-doc { max-width: 960px; margin: 0 auto; display: grid; gap: 14px; }
      .invoice-logo { max-height: 72px; max-width: 220px; object-fit: contain; display: block; margin-bottom: 8px; }
      .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .totals { margin-left: auto; max-width: 360px; width: 100%; }
      .totals p { display: flex; justify-content: space-between; margin: 4px 0; }
      .totals .grand { font-size: 18px; border-top: 1px solid #d3dbe5; padding-top: 8px; margin-top: 8px; }
      `,
    );
    if (!opened) {
      setStatus("Enable popups to print or save PDF.");
      return;
    }
    setStatus("Opened print view. Choose Save as PDF.");
    trackEvent("invoice_print_open", { currency: invoice.currency, items: invoice.items.length });
  };

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Receipt}
        title="Invoice generator"
        subtitle="Create client-ready invoices with taxes, discounts, due tracking, and print-to-PDF."
      />
      <div className="mini-panel">
        <div className="panel-head">
          <h3>Invoice workspaces</h3>
          <span className="supporting-text">
            {formatNumericValue(workspaces.length)} saved
          </span>
        </div>
        <div className="button-row">
          <button className="action-button secondary" type="button" onClick={() => createWorkspaceFromCurrent("new")}>
            <Plus size={15} />
            New invoice
          </button>
          <button className="action-button secondary" type="button" onClick={() => createWorkspaceFromCurrent("duplicate")}>
            <Copy size={15} />
            Duplicate
          </button>
          <button className="action-button secondary" type="button" onClick={removeActiveWorkspace}>
            <Trash2 size={15} />
            Delete current
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => {
              if (!workspaces.length) return;
              const next = workspaces[(activeIndex - 1 + workspaces.length) % workspaces.length];
              activateWorkspace(next.id);
            }}
            disabled={workspaces.length < 2}
          >
            Prev
          </button>
          <button
            className="action-button secondary"
            type="button"
            onClick={() => {
              if (!workspaces.length) return;
              const next = workspaces[(activeIndex + 1) % workspaces.length];
              activateWorkspace(next.id);
            }}
            disabled={workspaces.length < 2}
          >
            Next
          </button>
        </div>
        <div className="chip-list">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className="chip-button"
              type="button"
              onClick={() => activateWorkspace(workspace.id)}
              aria-pressed={workspace.id === activeWorkspaceId}
            >
              {workspace.label}
            </button>
          ))}
        </div>
      </div>
      <div className="button-row">
        <button className="action-button" type="button" onClick={printInvoice}>
          <Printer size={15} />
          Print / PDF
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            downloadTextFile("invoice-data.json", JSON.stringify(invoice, null, 2), "application/json;charset=utf-8;");
            setStatus("Invoice JSON exported.");
          }}
        >
          <Download size={15} />
          Export JSON
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            downloadCsv(
              "invoice-line-items.csv",
              ["Description", "Quantity", "Unit Price", "Line Total"],
              invoice.items.map((item) => {
                const quantity = Math.max(0, safeNumberValue(item.quantity));
                const unitPrice = Math.max(0, safeNumberValue(item.unitPrice));
                return [item.description, String(quantity), String(unitPrice), String(quantity * unitPrice)];
              }),
            );
            setStatus("Line items CSV exported.");
          }}
        >
          <Download size={15} />
          CSV
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            const copied = await copyTextToClipboard(reminderMessage);
            setStatus(copied ? "Payment reminder copied." : "Unable to copy payment reminder.");
          }}
        >
          <Copy size={15} />
          Copy reminder
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            updateInvoice("invoiceNumber", buildInvoiceNumber());
            setStatus("Generated a new invoice number.");
          }}
        >
          <RefreshCw size={15} />
          New number
        </button>
      </div>
      <div className="split-panel">
        <div className="invoice-editor">
          <div className="field-grid">
            <label className="field">
              <span>Invoice number</span>
              <input type="text" value={invoice.invoiceNumber} onChange={(event) => updateInvoice("invoiceNumber", event.target.value)} />
            </label>
            <label className="field">
              <span>Issue date</span>
              <input type="date" value={invoice.issueDate} onChange={(event) => updateInvoice("issueDate", event.target.value)} />
            </label>
            <label className="field">
              <span>Due date</span>
              <input type="date" value={invoice.dueDate} onChange={(event) => updateInvoice("dueDate", event.target.value)} />
            </label>
            <label className="field">
              <span>Currency</span>
              <input
                type="text"
                value={currencySearch}
                placeholder="Search currency by code or name"
                onChange={(event) => setCurrencySearch(event.target.value)}
              />
              <select value={invoice.currency} onChange={(event) => updateInvoice("currency", event.target.value)}>
                {visibleCurrencies.length ? (
                  visibleCurrencies.map((currency) => (
                    <option key={currency.code} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))
                ) : (
                  <option value={invoice.currency}>{invoice.currency}</option>
                )}
              </select>
              <small className="supporting-text">
                Source: {currencySource}. Loaded {formatNumericValue(currencyOptions.length)} currencies.
              </small>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>From (business name)</span>
              <input type="text" value={invoice.businessName} onChange={(event) => updateInvoice("businessName", event.target.value)} />
            </label>
            <label className="field">
              <span>Business email</span>
              <input type="email" value={invoice.businessEmail} onChange={(event) => updateInvoice("businessEmail", event.target.value)} />
            </label>
            <label className="field">
              <span>Bill to (client)</span>
              <input type="text" value={invoice.clientName} onChange={(event) => updateInvoice("clientName", event.target.value)} />
            </label>
            <label className="field">
              <span>Client email</span>
              <input type="email" value={invoice.clientEmail} onChange={(event) => updateInvoice("clientEmail", event.target.value)} />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Business address</span>
              <textarea rows={3} value={invoice.businessAddress} onChange={(event) => updateInvoice("businessAddress", event.target.value)} />
            </label>
            <label className="field">
              <span>Client address</span>
              <textarea rows={3} value={invoice.clientAddress} onChange={(event) => updateInvoice("clientAddress", event.target.value)} />
            </label>
          </div>
          <div className="mini-panel">
            <div className="panel-head">
              <h3>Branding</h3>
            </div>
            <div className="button-row">
              <button
                className="action-button secondary"
                type="button"
                onClick={() => logoInputRef.current?.click()}
              >
                <Plus size={15} />
                Upload logo
              </button>
              <button
                className="action-button secondary"
                type="button"
                onClick={() => {
                  updateInvoice("logoDataUrl", "");
                  updateInvoice("logoFileName", "");
                  setStatus("Removed invoice logo.");
                }}
                disabled={!invoice.logoDataUrl}
              >
                <Trash2 size={15} />
                Remove logo
              </button>
              <input
                ref={logoInputRef}
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > 1_500_000) {
                    setStatus("Logo is too large. Please keep it under 1.5 MB.");
                    event.target.value = "";
                    return;
                  }
                  try {
                    const dataUrl = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader();
                      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
                      reader.onerror = () => reject(new Error("read-failed"));
                      reader.readAsDataURL(file);
                    });
                    if (!dataUrl) throw new Error("invalid-data-url");
                    updateInvoice("logoDataUrl", dataUrl);
                    updateInvoice("logoFileName", file.name);
                    setStatus("Logo updated for this invoice.");
                  } catch {
                    setStatus("Could not read that logo file.");
                  } finally {
                    event.target.value = "";
                  }
                }}
              />
            </div>
            {invoice.logoDataUrl ? (
              <NextImage
                className="invoice-logo-preview"
                src={invoice.logoDataUrl}
                alt={invoice.logoFileName || "Invoice logo"}
                width={220}
                height={72}
                unoptimized
              />
            ) : (
              <p className="supporting-text">No logo selected.</p>
            )}
          </div>
          <div className="mini-panel">
            <div className="panel-head">
              <h3>Line items</h3>
              <button
                className="action-button secondary"
                type="button"
                onClick={() =>
                  setInvoice((current) => ({
                    ...current,
                    items: [...current.items, { id: crypto.randomUUID(), description: "", quantity: "1", unitPrice: "0" }],
                  }))
                }
              >
                <Plus size={15} />
                Add item
              </button>
            </div>
            {invoice.items.map((item) => (
              <article key={item.id} className="resume-row">
                <div className="field-grid">
                  <label className="field">
                    <span>Description</span>
                    <input type="text" value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Quantity</span>
                    <input type="number" min={0} step={0.01} value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Unit price</span>
                    <input type="number" min={0} step={0.01} value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} />
                  </label>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  disabled={invoice.items.length <= 1}
                  onClick={() =>
                    setInvoice((current) => ({
                      ...current,
                      items: current.items.length > 1 ? current.items.filter((entry) => entry.id !== item.id) : current.items,
                    }))
                  }
                >
                  <Trash2 size={14} />
                  Remove item
                </button>
              </article>
            ))}
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Tax (%)</span>
              <input type="number" min={0} step={0.01} value={invoice.taxPercent} onChange={(event) => updateInvoice("taxPercent", event.target.value)} />
            </label>
            <label className="field">
              <span>Discount type</span>
              <select value={invoice.discountType} onChange={(event) => updateInvoice("discountType", event.target.value as "percent" | "fixed")}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed amount</option>
              </select>
            </label>
            <label className="field">
              <span>Discount {invoice.discountType === "percent" ? "(%)" : "(amount)"}</span>
              <input type="number" min={0} step={0.01} value={invoice.discountValue} onChange={(event) => updateInvoice("discountValue", event.target.value)} />
            </label>
            <label className="field">
              <span>Shipping</span>
              <input type="number" min={0} step={0.01} value={invoice.shipping} onChange={(event) => updateInvoice("shipping", event.target.value)} />
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              <span>Payment terms</span>
              <textarea rows={2} value={invoice.paymentTerms} onChange={(event) => updateInvoice("paymentTerms", event.target.value)} />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea rows={2} value={invoice.notes} onChange={(event) => updateInvoice("notes", event.target.value)} />
            </label>
          </div>
        </div>
        <aside className="invoice-preview">
          <h3>Invoice preview</h3>
          {invoice.logoDataUrl ? (
            <NextImage
              className="invoice-logo-preview"
              src={invoice.logoDataUrl}
              alt={invoice.logoFileName || "Invoice logo"}
              width={220}
              height={72}
              unoptimized
            />
          ) : null}
          <p className="supporting-text">
            <strong>{invoice.invoiceNumber || "Invoice Number"}</strong> | {invoice.issueDate || "-"} to {invoice.dueDate || "-"}
          </p>
          <p className={`status-badge ${dueStatus.startsWith("Overdue") ? "bad" : dueStatus === "Due today" ? "warn" : "ok"}`}>{dueStatus}</p>
          <div className="invoice-identity-grid">
            <div className="mini-panel">
              <h4>From</h4>
              <p>{invoice.businessName || "-"}</p>
              <p>{invoice.businessEmail || "-"}</p>
              <p>{invoice.businessAddress || "-"}</p>
            </div>
            <div className="mini-panel">
              <h4>Bill To</h4>
              <p>{invoice.clientName || "-"}</p>
              <p>{invoice.clientEmail || "-"}</p>
              <p>{invoice.clientAddress || "-"}</p>
            </div>
          </div>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => {
                  const quantity = Math.max(0, safeNumberValue(item.quantity));
                  const unitPrice = Math.max(0, safeNumberValue(item.unitPrice));
                  const lineTotal = quantity * unitPrice;
                  return (
                    <tr key={item.id}>
                      <td>{item.description || "-"}</td>
                      <td>{formatNumericValue(quantity)}</td>
                      <td>{formatCurrencyWithCode(unitPrice, invoice.currency)}</td>
                      <td>{formatCurrencyWithCode(lineTotal, invoice.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mini-panel invoice-totals">
            <p>
              <span>Subtotal</span>
              <strong>{formatCurrencyWithCode(financials.subtotal, invoice.currency)}</strong>
            </p>
            <p>
              <span>Discount</span>
              <strong>{formatCurrencyWithCode(financials.discount, invoice.currency)}</strong>
            </p>
            <p>
              <span>Shipping</span>
              <strong>{formatCurrencyWithCode(financials.shipping, invoice.currency)}</strong>
            </p>
            <p>
              <span>Tax</span>
              <strong>{formatCurrencyWithCode(financials.tax, invoice.currency)}</strong>
            </p>
            <p className="invoice-total-final">
              <span>Amount due</span>
              <strong>{formatCurrencyWithCode(financials.total, invoice.currency)}</strong>
            </p>
          </div>
          {invoice.paymentTerms ? <p className="supporting-text"><strong>Terms:</strong> {invoice.paymentTerms}</p> : null}
          {invoice.notes ? <p className="supporting-text"><strong>Notes:</strong> {invoice.notes}</p> : null}
          <ResultList
            rows={[
              { label: "Line items", value: formatNumericValue(invoice.items.length) },
              { label: "Discount mode", value: invoice.discountType === "percent" ? "Percent" : "Fixed" },
              { label: "Amount due", value: formatCurrencyWithCode(financials.total, invoice.currency) },
            ]}
          />
        </aside>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}
    </section>
  );
}

interface MeetingSlotCandidate {
  id: string;
  instant: Date;
  endInstant: Date;
  overlapCount: number;
  overlapPercent: number;
  matchingZones: string[];
  exact: boolean;
}

function MeetingTimePlannerTool() {
  const browserTimeZone = useMemo(
    () => normalizeTimeZoneValue(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", "UTC"),
    [],
  );
  const timeZoneOptions = useMemo(() => getSupportedTimeZoneOptions(browserTimeZone), [browserTimeZone]);
  const hourOptions = useMemo(() => Array.from({ length: 24 }, (_item, index) => index), []);
  const endHourOptions = useMemo(() => Array.from({ length: 24 }, (_item, index) => index + 1), []);

  const [hostTimeZone, setHostTimeZone] = useState(browserTimeZone);
  const [meetingDate, setMeetingDate] = useState(() => formatDateTimeLocalForZone(new Date(), browserTimeZone).slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [hostStartHour, setHostStartHour] = useState(8);
  const [hostEndHour, setHostEndHour] = useState(18);
  const [participantStartHour, setParticipantStartHour] = useState(8);
  const [participantEndHour, setParticipantEndHour] = useState(20);
  const [participantZoneInput, setParticipantZoneInput] = useState("America/New_York");
  const [participantZones, setParticipantZones] = useState<string[]>([
    "America/New_York",
    "Europe/London",
    "Asia/Dubai",
    "Asia/Singapore",
  ]);
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (timeZoneOptions.some((option) => option.value === hostTimeZone)) return;
    setHostTimeZone(browserTimeZone);
  }, [browserTimeZone, hostTimeZone, timeZoneOptions]);

  const normalizedHostZone = useMemo(() => normalizeTimeZoneValue(hostTimeZone, browserTimeZone), [browserTimeZone, hostTimeZone]);
  const normalizedParticipantZones = useMemo(
    () =>
      Array.from(new Set(participantZones.map((zone) => normalizeTimeZoneValue(zone, "")).filter(Boolean))).filter(
        (zone) => zone !== normalizedHostZone,
      ),
    [normalizedHostZone, participantZones],
  );

  const safeDurationMinutes = Math.max(15, Math.min(720, Math.round(durationMinutes || 60)));
  const normalizedHostStartHour = Math.max(0, Math.min(23, Math.round(hostStartHour)));
  const normalizedHostEndHour = Math.max(normalizedHostStartHour + 1, Math.min(24, Math.round(hostEndHour)));
  const normalizedParticipantStartHour = Math.max(0, Math.min(23, Math.round(participantStartHour)));
  const normalizedParticipantEndHour = Math.max(normalizedParticipantStartHour + 1, Math.min(24, Math.round(participantEndHour)));

  const candidateSlots = useMemo(() => {
    if (!meetingDate) return [] as MeetingSlotCandidate[];

    const startMinutes = normalizedHostStartHour * 60;
    const endMinutes = normalizedHostEndHour * 60;
    const lastStartMinutes = endMinutes - safeDurationMinutes;
    if (lastStartMinutes < startMinutes) return [] as MeetingSlotCandidate[];

    const participantsForScoring = normalizedParticipantZones;
    const slots: MeetingSlotCandidate[] = [];

    for (let minute = startMinutes; minute <= lastStartMinutes; minute += 30) {
      const hourPart = Math.floor(minute / 60)
        .toString()
        .padStart(2, "0");
      const minutePart = (minute % 60).toString().padStart(2, "0");
      const localDateTime = `${meetingDate}T${hourPart}:${minutePart}`;
      const resolved = resolveZonedDateTime(localDateTime, normalizedHostZone);
      if (!resolved.date) continue;

      const instant = resolved.date;
      const endInstant = new Date(instant.getTime() + safeDurationMinutes * 60_000);

      const matchingZones = participantsForScoring.filter((zone) => {
        const startParts = getDatePartsInTimeZone(instant, zone);
        const endParts = getDatePartsInTimeZone(endInstant, zone);
        const startDayStamp = getDayStampForZone(instant, zone);
        const endDayStamp = getDayStampForZone(endInstant, zone);

        const localStartMinutes = startParts.hour * 60 + startParts.minute;
        const localEndMinutes = endParts.hour * 60 + endParts.minute + (endDayStamp - startDayStamp) * 1440;
        return (
          localStartMinutes >= normalizedParticipantStartHour * 60 &&
          localEndMinutes <= normalizedParticipantEndHour * 60
        );
      });

      const overlapBase = participantsForScoring.length || 1;
      slots.push({
        id: `${instant.getTime()}`,
        instant,
        endInstant,
        overlapCount: matchingZones.length,
        overlapPercent: (matchingZones.length / overlapBase) * 100,
        matchingZones,
        exact: resolved.exact,
      });
    }

    return slots.sort((left, right) => {
      if (right.overlapCount !== left.overlapCount) return right.overlapCount - left.overlapCount;
      return left.instant.getTime() - right.instant.getTime();
    });
  }, [
    meetingDate,
    normalizedHostEndHour,
    normalizedHostStartHour,
    normalizedHostZone,
    normalizedParticipantEndHour,
    normalizedParticipantStartHour,
    normalizedParticipantZones,
    safeDurationMinutes,
  ]);

  useEffect(() => {
    if (!candidateSlots.length) {
      setSelectedSlotId("");
      return;
    }
    if (candidateSlots.some((slot) => slot.id === selectedSlotId)) return;
    setSelectedSlotId(candidateSlots[0].id);
  }, [candidateSlots, selectedSlotId]);

  const selectedSlot = useMemo(
    () => candidateSlots.find((slot) => slot.id === selectedSlotId) ?? candidateSlots[0] ?? null,
    [candidateSlots, selectedSlotId],
  );

  const slotDetailRows = useMemo(() => {
    if (!selectedSlot) return [];
    const rows = [normalizedHostZone, ...normalizedParticipantZones].map((zone) => {
      const startParts = getDatePartsInTimeZone(selectedSlot.instant, zone);
      const endParts = getDatePartsInTimeZone(selectedSlot.endInstant, zone);
      const startDayStamp = getDayStampForZone(selectedSlot.instant, zone);
      const endDayStamp = getDayStampForZone(selectedSlot.endInstant, zone);
      const localStartMinutes = startParts.hour * 60 + startParts.minute;
      const localEndMinutes = endParts.hour * 60 + endParts.minute + (endDayStamp - startDayStamp) * 1440;
      const inPreferredWindow =
        zone === normalizedHostZone
          ? localStartMinutes >= normalizedHostStartHour * 60 &&
            localEndMinutes <= normalizedHostEndHour * 60
          : localStartMinutes >= normalizedParticipantStartHour * 60 &&
            localEndMinutes <= normalizedParticipantEndHour * 60;

      return {
        zone,
        start: formatTimeZoneDate(selectedSlot.instant, zone),
        end: formatTimeZoneDate(selectedSlot.endInstant, zone),
        offset: formatOffsetMinutes(getTimeZoneOffsetMinutes(selectedSlot.instant, zone)),
        inPreferredWindow,
        role: zone === normalizedHostZone ? "Host" : "Participant",
      };
    });
    return rows;
  }, [
    normalizedHostEndHour,
    normalizedHostStartHour,
    normalizedHostZone,
    normalizedParticipantEndHour,
    normalizedParticipantStartHour,
    normalizedParticipantZones,
    selectedSlot,
  ]);

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Briefcase}
        title="Meeting time planner"
        subtitle="Find the best cross-timezone meeting slots by overlap score and local-business-hour fit."
      />

      <div className="field-grid">
        <label className="field">
          <span>Meeting date</span>
          <input type="date" value={meetingDate} onChange={(event) => setMeetingDate(event.target.value)} />
        </label>
        <label className="field">
          <span>Duration (minutes)</span>
          <input
            type="number"
            min={15}
            max={720}
            step={15}
            value={safeDurationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
          />
        </label>
        <label className="field">
          <span>Host timezone</span>
          <select value={hostTimeZone} onChange={(event) => setHostTimeZone(event.target.value)}>
            {timeZoneOptions.map((option) => (
              <option key={`meeting-host-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-grid">
        <label className="field">
          <span>Host availability start</span>
          <select value={normalizedHostStartHour} onChange={(event) => setHostStartHour(Number(event.target.value))}>
            {hourOptions.map((hour) => (
              <option key={`host-start-${hour}`} value={hour}>
                {hour.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Host availability end</span>
          <select value={normalizedHostEndHour} onChange={(event) => setHostEndHour(Number(event.target.value))}>
            {endHourOptions.map((hour) => (
              <option key={`host-end-${hour}`} value={hour}>
                {hour.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Participant preferred start</span>
          <select value={normalizedParticipantStartHour} onChange={(event) => setParticipantStartHour(Number(event.target.value))}>
            {hourOptions.map((hour) => (
              <option key={`participant-start-${hour}`} value={hour}>
                {hour.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Participant preferred end</span>
          <select value={normalizedParticipantEndHour} onChange={(event) => setParticipantEndHour(Number(event.target.value))}>
            {endHourOptions.map((hour) => (
              <option key={`participant-end-${hour}`} value={hour}>
                {hour.toString().padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mini-panel">
        <div className="panel-head">
          <h3>Participant timezones</h3>
          <div className="button-row">
            <label className="field">
              <span>Add timezone</span>
              <select value={participantZoneInput} onChange={(event) => setParticipantZoneInput(event.target.value)}>
                {timeZoneOptions.map((option) => (
                  <option key={`participant-input-${option.value}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="action-button secondary"
              type="button"
              onClick={() => {
                const normalized = normalizeTimeZoneValue(participantZoneInput, "");
                if (!normalized) return;
                if (normalized === normalizedHostZone) {
                  setStatus("Host timezone is already included separately.");
                  return;
                }
                setParticipantZones((current) => Array.from(new Set([...current, normalized])).slice(0, 12));
                setStatus(`Added ${normalized}.`);
              }}
            >
              Add participant zone
            </button>
            <button
              className="action-button secondary"
              type="button"
              onClick={() => {
                setParticipantZones(TIME_ZONE_COMPARE_DEFAULTS.filter((zone) => zone !== normalizedHostZone));
                setStatus("Reset participant timezone list.");
              }}
            >
              Reset zones
            </button>
          </div>
        </div>
        <div className="chip-list">
          {normalizedParticipantZones.length === 0 ? <span className="chip">No participant zones selected</span> : null}
          {normalizedParticipantZones.map((zone) => (
            <button
              key={`participant-chip-${zone}`}
              className="chip-button"
              type="button"
              onClick={() => setParticipantZones((current) => current.filter((entry) => entry !== zone))}
            >
              {zone} x
            </button>
          ))}
        </div>
      </div>

      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setMeetingDate(formatDateTimeLocalForZone(new Date(), normalizedHostZone).slice(0, 10));
            setStatus(`Loaded today's date in ${normalizedHostZone}.`);
          }}
        >
          Use today
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={async () => {
            if (!selectedSlot) return;
            const summary = [
              `Host slot: ${formatTimeZoneDate(selectedSlot.instant, normalizedHostZone)} -> ${formatTimeZoneDate(
                selectedSlot.endInstant,
                normalizedHostZone,
              )}`,
              `Overlap: ${selectedSlot.overlapCount}/${Math.max(1, normalizedParticipantZones.length)} participant zones`,
              ...slotDetailRows.map((row) => `${row.zone}: ${row.start} -> ${row.end}`),
            ].join("\n");
            const ok = await copyTextToClipboard(summary);
            setStatus(ok ? "Selected slot details copied." : "No slot selected to copy.");
          }}
          disabled={!selectedSlot}
        >
          <Copy size={15} />
          Copy selected slot
        </button>
      </div>
      {status ? <p className="supporting-text">{status}</p> : null}

      <ResultList
        rows={[
          { label: "Host timezone", value: normalizedHostZone },
          { label: "Participant zones", value: formatNumericValue(normalizedParticipantZones.length) },
          { label: "Candidate slots", value: formatNumericValue(candidateSlots.length) },
          {
            label: "Best overlap",
            value: candidateSlots.length
              ? `${formatNumericValue(candidateSlots[0].overlapCount)} / ${formatNumericValue(Math.max(1, normalizedParticipantZones.length))}`
              : "-",
          },
          {
            label: "Top slot (host local)",
            value: candidateSlots.length ? formatTimeZoneDate(candidateSlots[0].instant, normalizedHostZone) : "-",
          },
        ]}
      />

      {candidateSlots.length === 0 ? (
        <p className="supporting-text">
          No slots match the selected host window. Increase host availability or shorten meeting duration.
        </p>
      ) : (
        <div className="mini-panel">
          <h3>Top recommended slots</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Host local start</th>
                  <th>UTC start</th>
                  <th>Overlap score</th>
                  <th>Exact match</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {candidateSlots.slice(0, 16).map((slot, index) => (
                  <tr key={slot.id}>
                    <td>{index + 1}</td>
                    <td>{formatTimeZoneDate(slot.instant, normalizedHostZone)}</td>
                    <td>{slot.instant.toISOString()}</td>
                    <td>
                      {formatNumericValue(slot.overlapCount)} / {formatNumericValue(Math.max(1, normalizedParticipantZones.length))} (
                      {slot.overlapPercent.toFixed(0)}%)
                    </td>
                    <td>{slot.exact ? "Yes" : "Approximate"}</td>
                    <td>
                      <button
                        className="action-button secondary"
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedSlot ? (
        <div className="mini-panel">
          <h3>Selected slot details</h3>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Timezone</th>
                  <th>Local start</th>
                  <th>Local end</th>
                  <th>Offset</th>
                  <th>Preferred window</th>
                </tr>
              </thead>
              <tbody>
                {slotDetailRows.map((row) => (
                  <tr key={`${row.role}-${row.zone}`}>
                    <td>{row.role}</td>
                    <td>{row.zone}</td>
                    <td>{row.start}</td>
                    <td>{row.end}</td>
                    <td>{row.offset}</td>
                    <td>{row.inPreferredWindow ? "Inside" : "Outside"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="supporting-text">
            Host window: {normalizedHostStartHour.toString().padStart(2, "0")}:00-{normalizedHostEndHour
              .toString()
              .padStart(2, "0")}
            :00 | Participant preferred window: {normalizedParticipantStartHour.toString().padStart(2, "0")}:00-
            {normalizedParticipantEndHour.toString().padStart(2, "0")}:00
          </p>
        </div>
      ) : null}
    </section>
  );
}

function ProductivityTool({ id }: { id: ProductivityToolId }) {
  switch (id) {
    case "pomodoro-timer":
      return <PomodoroTool />;
    case "meeting-time-planner":
      return <MeetingTimePlannerTool />;
    case "simple-todo-list":
      return <TodoListTool />;
    case "notes-pad":
      return <NotesPadTool />;
    case "text-translator":
      return <TextTranslatorTool />;
    case "document-translator":
      return <DocumentTranslatorTool />;
    case "resume-builder":
      return <ResumeBuilderTool />;
    case "invoice-generator":
      return <InvoiceGeneratorTool />;
    default:
      return <p>Productivity tool unavailable.</p>;
  }
}

export function ToolRenderer({ tool }: ToolRendererProps) {
  const engine = tool.engine;
  switch (engine.kind) {
    case "calculator":
      return <CalculatorTool id={engine.id} />;
    case "unit-converter":
      return <UnitConverterTool quantity={engine.quantity} />;
    case "number-converter":
      return <NumberConverterTool mode={engine.mode} />;
    case "text-tool":
      return <TextTool id={engine.id} />;
    case "developer-tool":
      return <DeveloperTool id={engine.id} />;
    case "image-tool":
      return <ImageTool id={engine.id} />;
    case "productivity-tool":
      return <ProductivityTool id={engine.id} />;
    default:
      return <p>Tool renderer unavailable.</p>;
  }
}

