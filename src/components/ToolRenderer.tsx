"use client";

import NextImage from "next/image";
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
  getLoanAmortizationSchedule,
  getSavingsGoalTimeline,
  runCalculator,
  type ResultRow,
} from "@/lib/calculations";
import { trackEvent } from "@/lib/analytics";
import { convertNumber, convertUnitValue, getUnitsForQuantity } from "@/lib/converters";
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
  "image-resizer": "image-resizer",
  "image-compressor": "image-compressor",
  "jpg-to-png": "jpg-to-png-converter",
  "png-to-webp": "png-to-webp-converter",
  "image-cropper": "image-cropper",
  "barcode-generator": "barcode-generator",
  "image-to-pdf": "image-to-pdf-converter",
  "pdf-to-jpg": "pdf-to-jpg-converter",
};

const IMAGE_TOOL_LABELS: Record<ImageToolId, string> = {
  "qr-code-generator": "QR Code Generator",
  "color-picker": "Color Picker",
  "hex-rgb-converter": "HEX-RGB Converter",
  "image-resizer": "Image Resizer",
  "image-compressor": "Image Compressor",
  "jpg-to-png": "JPG -> PNG",
  "png-to-webp": "PNG -> WebP",
  "image-cropper": "Image Cropper",
  "barcode-generator": "Barcode Generator",
  "image-to-pdf": "Image -> PDF",
  "pdf-to-jpg": "PDF -> JPG",
};

const IMAGE_WORKFLOW_TARGET_OPTIONS: Partial<Record<ImageToolId, ImageToolId[]>> = {
  "image-resizer": ["image-compressor", "png-to-webp", "image-cropper", "image-to-pdf", "jpg-to-png"],
  "image-compressor": ["png-to-webp", "image-cropper", "image-to-pdf", "image-resizer", "jpg-to-png"],
  "jpg-to-png": ["png-to-webp", "image-cropper", "image-to-pdf", "image-compressor", "image-resizer"],
  "png-to-webp": ["image-compressor", "image-cropper", "image-to-pdf", "image-resizer", "jpg-to-png"],
  "image-cropper": ["image-compressor", "png-to-webp", "image-to-pdf", "image-resizer", "jpg-to-png"],
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

function CalculatorTool({ id }: { id: CalculatorId }) {
  const fields = calculatorFields[id];
  const supportsDisplayCurrency = CALCULATORS_WITH_DISPLAY_CURRENCY.has(id);
  const defaultValues = useMemo(() => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue])), [fields]);
  const storageKey = `utiliora-calculator-values-${id}`;
  const autoModeKey = `utiliora-calculator-auto-${id}`;
  const currencyStorageKey = `utiliora-calculator-currency-${id}`;
  const isCurrencyConverter = id === "currency-converter-calculator";
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

  useEffect(() => {
    setValues(defaultValues);
    setSelectedCurrency("USD");
    setResultRows(runCalculator(id, defaultValues, { currency: "USD" }));
    setShowFullTable(false);
    setRateStatus("");
    setRateMeta(null);
  }, [defaultValues, id]);

  useEffect(() => {
    try {
      const savedValues = localStorage.getItem(storageKey);
      const savedAutoMode = localStorage.getItem(autoModeKey);
      const savedCurrency = localStorage.getItem(currencyStorageKey);
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
    }
  }, [autoModeKey, currencyStorageKey, defaultValues, fields, id, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
      localStorage.setItem(autoModeKey, autoCalculate ? "true" : "false");
      localStorage.setItem(currencyStorageKey, selectedCurrency);
    } catch {
      // Ignore storage failures.
    }
  }, [autoCalculate, autoModeKey, currencyStorageKey, selectedCurrency, storageKey, values]);

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

  const visibleLoanRows = showFullTable ? loanSchedule : loanSchedule.slice(0, 24);

  return (
    <section className="tool-surface">
      <ToolHeading icon={Calculator} title="Calculator workspace" subtitle={calculatorSubtitles[id]} />

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
  const units = useMemo(() => getUnitsForQuantity(quantity), [quantity]);
  const [inputValue, setInputValue] = useState("1");
  const [from, setFrom] = useState(units[0]?.value ?? "");
  const [to, setTo] = useState(units[1]?.value ?? units[0]?.value ?? "");
  const [precision, setPrecision] = useState("6");
  const [status, setStatus] = useState("");
  const [weightHistory, setWeightHistory] = useState<WeightHistoryEntry[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const isWeightConverter = quantity === "weight";
  const historyStorageKey = "utiliora-weight-converter-history-v1";

  useEffect(() => {
    const defaultFrom = units[0]?.value ?? "";
    const defaultTo = units[1]?.value ?? defaultFrom;
    setFrom(defaultFrom);
    setTo(defaultTo);
    setInputValue("1");
    setStatus("");
  }, [quantity, units]);

  useEffect(() => {
    if (!isWeightConverter) {
      setHistoryLoaded(true);
      return;
    }

    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (!raw) {
        setHistoryLoaded(true);
        return;
      }
      const parsed = JSON.parse(raw) as WeightHistoryEntry[];
      if (Array.isArray(parsed)) {
        setWeightHistory(parsed.slice(0, 10));
      }
    } catch {
      // Ignore malformed storage and continue.
    } finally {
      setHistoryLoaded(true);
    }
  }, [historyStorageKey, isWeightConverter]);

  useEffect(() => {
    if (!isWeightConverter || !historyLoaded) return;
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(weightHistory.slice(0, 10)));
    } catch {
      // Ignore storage failures.
    }
  }, [historyLoaded, historyStorageKey, isWeightConverter, weightHistory]);

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
  const [input, setInput] = useState("");
  const result = useMemo(() => convertNumber(mode, input), [input, mode]);

  return (
    <section className="tool-surface">
      <h2>Number converter</h2>
      <label className="field">
        <span>Input</span>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Enter value..."
        />
      </label>
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
  const [copyStatus, setCopyStatus] = useState("");
  const words = countWords(text);
  const characters = text.length;
  const charactersNoSpaces = countCharacters(text, false);
  const sentences = text.split(/[.!?]+/).filter((segment) => segment.trim()).length;
  const paragraphs = text.split(/\n\s*\n/).filter((segment) => segment.trim()).length;
  const lines = text.split("\n").filter((line) => line.trim()).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));
  const speakingTime = Math.max(1, Math.ceil(words / 130));
  const avgWordLength = words > 0 ? (charactersNoSpaces / words).toFixed(1) : "0";
  const topTerms = keywordDensity(text, 8, {
    nGram: 1,
    excludeStopWords: true,
    minLength: 3,
  });

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
      <div className="button-row">
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setText("");
            setCopyStatus("");
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
    </section>
  );
}

function CharacterCounterTool() {
  const [text, setText] = useState("");
  const [includeSpaces, setIncludeSpaces] = useState(true);
  const [presetId, setPresetId] = useState<(typeof CHARACTER_LIMIT_PRESETS)[number]["id"]>("seo-title");
  const currentPreset = CHARACTER_LIMIT_PRESETS.find((preset) => preset.id === presetId) ?? CHARACTER_LIMIT_PRESETS[0];
  const count = countCharacters(text, includeSpaces);
  const words = countWords(text);
  const lines = text ? text.split("\n").length : 0;
  const remaining = currentPreset.limit - count;
  const rawProgress = currentPreset.limit > 0 ? (count / currentPreset.limit) * 100 : 0;
  const progress = Math.max(0, Math.min(130, rawProgress));
  const overLimit = remaining < 0;

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
      </div>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={includeSpaces}
          onChange={(event) => setIncludeSpaces(event.target.checked)}
        />
        Include spaces
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
            ? `${Math.abs(remaining)} characters over limit for ${currentPreset.label}.`
            : `${remaining} characters left for ${currentPreset.label}.`}
        </small>
      </div>
      <ResultList
        rows={[
          { label: "Characters", value: count.toString() },
          { label: "Words", value: words.toString() },
          { label: "Lines", value: lines.toString() },
          { label: "Limit", value: currentPreset.limit.toString() },
        ]}
      />
    </section>
  );
}

function KeywordDensityTool() {
  const [text, setText] = useState("");
  const [nGram, setNGram] = useState<1 | 2 | 3>(1);
  const [excludeStopWords, setExcludeStopWords] = useState(true);
  const [topN, setTopN] = useState(12);
  const [targetKeyword, setTargetKeyword] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
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
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
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
  const [maxLength, setMaxLength] = useState(80);
  const [domain, setDomain] = useState("https://utiliora.com");
  const [copyStatus, setCopyStatus] = useState("");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const generated = lines.map((line) =>
    slugify(line, {
      separator,
      lowercase,
      maxLength,
      removeStopWords,
    }),
  );
  const output = generated[0] ?? "";
  const normalizedDomain = domain.replace(/\/+$/, "");
  const fullUrl = output ? `${normalizedDomain}/${output}` : normalizedDomain;

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
      </div>
      <label className="field">
        <span>Source title(s) - one per line for bulk generation</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={6} />
      </label>
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
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
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
  const [copyStatus, setCopyStatus] = useState("");
  const titleLength = title.length;
  const descriptionLength = description.length;
  const robotsValue = `${robotsIndex ? "index" : "noindex"}, ${robotsFollow ? "follow" : "nofollow"}`;
  const canonicalUrl = canonical.trim() || "https://example.com/page";

  const output = [
    `<title>${title || "Page title"}</title>`,
    `<meta name="description" content="${description || "Page description"}" />`,
    `<meta name="robots" content="${robotsValue}" />`,
    author ? `<meta name="author" content="${author}" />` : "",
    `<meta property="og:site_name" content="${siteName}" />`,
    canonical ? `<link rel="canonical" href="${canonical}" />` : "",
  ]
    .filter(Boolean)
    .join("\n");

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
      <div className="serp-preview">
        <small>Google preview</small>
        <h3>{title || "Page title preview"}</h3>
        <p className="serp-url">{canonicalUrl}</p>
        <p>{description || "Meta description preview appears here."}</p>
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
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
    </section>
  );
}

function OpenGraphGeneratorTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");
  const [siteName, setSiteName] = useState("Utiliora");
  const [ogType, setOgType] = useState("website");
  const [twitterCard, setTwitterCard] = useState("summary_large_image");
  const [twitterHandle, setTwitterHandle] = useState("@utiliora");
  const [copyStatus, setCopyStatus] = useState("");
  const previewTitle = title || "Social preview title";
  const previewDescription = description || "Social preview description will appear here.";
  const previewUrl = url || "https://example.com";

  const output = [
    `<meta property="og:title" content="${previewTitle}" />`,
    `<meta property="og:description" content="${previewDescription}" />`,
    `<meta property="og:url" content="${previewUrl}" />`,
    `<meta property="og:type" content="${ogType}" />`,
    `<meta property="og:site_name" content="${siteName}" />`,
    image ? `<meta property="og:image" content="${image}" />` : "",
    `<meta name="twitter:card" content="${twitterCard}" />`,
    `<meta name="twitter:title" content="${previewTitle}" />`,
    `<meta name="twitter:description" content="${previewDescription}" />`,
    `<meta name="twitter:site" content="${twitterHandle}" />`,
    image ? `<meta name="twitter:image" content="${image}" />` : "",
  ]
    .filter(Boolean)
    .join("\n");

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
          <span>Twitter card</span>
          <select value={twitterCard} onChange={(event) => setTwitterCard(event.target.value)}>
            <option value="summary_large_image">summary_large_image</option>
            <option value="summary">summary</option>
          </select>
        </label>
        <label className="field">
          <span>Twitter handle</span>
          <input type="text" value={twitterHandle} onChange={(event) => setTwitterHandle(event.target.value)} />
        </label>
      </div>
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
        {copyStatus ? <span className="supporting-text">{copyStatus}</span> : null}
      </div>
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

function HtmlBeautifierTool() {
  const [input, setInput] = useState(
    "<!doctype html><html><head><title>Utiliora</title></head><body><main><h1>Simple tools. Instant results.</h1><p>Format this HTML for readability.</p></main></body></html>",
  );
  const [indentSize, setIndentSize] = useState(2);
  const [output, setOutput] = useState(() => beautifyHtml(input, 2));
  const [status, setStatus] = useState("");

  const runBeautifier = () => {
    const formatted = beautifyHtml(input, indentSize);
    setOutput(formatted);
    setStatus(formatted ? "Formatted HTML ready." : "Enter HTML to beautify.");
    trackEvent("tool_html_beautifier_run", { indentSize, hasInput: Boolean(input.trim()) });
  };

  const lineCount = output ? output.split("\n").length : 0;

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
      </div>
      <label className="field">
        <span>Input HTML</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={8} />
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
  const [copyStatus, setCopyStatus] = useState("");

  const generation = useMemo(() => {
    const requestedPriority = Number.parseFloat(priority);
    const normalizedPriority = Number.isFinite(requestedPriority)
      ? Math.max(0, Math.min(1, requestedPriority))
      : 0.7;
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

    const xml = generateSitemapXml(entries);
    return {
      xml,
      entries,
      invalidLines,
      priority: normalizedPriority,
    };
  }, [baseUrl, changefreq, includeLastmod, priority, rawPaths]);

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
          onClick={() => {
            downloadTextFile("sitemap.xml", generation.xml, "application/xml;charset=utf-8;");
            trackEvent("tool_xml_sitemap_download", { urls: generation.entries.length });
          }}
        >
          <Download size={15} />
          Download sitemap.xml
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Valid URLs", value: generation.entries.length.toString() },
          { label: "Invalid lines", value: generation.invalidLines.length.toString() },
          { label: "Priority used", value: generation.priority.toFixed(1) },
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
      <label className="field">
        <span>Generated sitemap.xml</span>
        <textarea value={generation.xml} readOnly rows={12} />
      </label>
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
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
  const [status, setStatus] = useState("");

  const output = useMemo(() => {
    const crawlDelayValue = Number.parseInt(crawlDelay, 10);
    return generateRobotsTxt({
      userAgent,
      allowPaths: splitNonEmptyLines(allowPaths),
      disallowPaths: splitNonEmptyLines(disallowPaths),
      crawlDelay: Number.isFinite(crawlDelayValue) ? crawlDelayValue : null,
      host,
      sitemapUrls: splitNonEmptyLines(sitemaps),
    });
  }, [allowPaths, crawlDelay, disallowPaths, host, sitemaps, userAgent]);

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
  const [copyStatus, setCopyStatus] = useState("");
  const analysis = useMemo(() => analyzeStructuredDataInput(input), [input]);

  const mergedPrettyOutput = useMemo(
    () => analysis.blocks.map((block) => block.pretty).join("\n\n"),
    [analysis.blocks],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Braces}
        title="Structured data validator"
        subtitle="Validate JSON-LD schema blocks, detect issues, and export clean markup for SEO pages."
      />
      <label className="field">
        <span>JSON-LD or script tags</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={12} />
      </label>
      <div className="button-row">
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
    </section>
  );
}

interface LinkMapEntry {
  href: string;
  resolvedUrl: string;
  anchorText: string;
  internal: boolean;
}

function extractAnchorLinksFromHtml(html: string): Array<{ href: string; anchorText: string }> {
  const matches = [...html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  return matches.map((match) => ({
    href: (match[1] ?? "").trim(),
    anchorText: (match[2] ?? "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  }));
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
        entries.push({
          href,
          resolvedUrl,
          anchorText: link.anchorText || "(no anchor text)",
          internal,
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

  const format = () =>
    setResult(
      safeJsonFormat(input, {
        sortKeys,
        minify: minifyOutput,
        indent,
      }),
    );

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
      </div>
      <ResultList
        rows={[
          { label: "Original size", value: `${before} chars` },
          { label: "Minified size", value: `${after} chars` },
          { label: "Reduction", value: `${savings}%` },
        ]}
      />
      <label className="field">
        <span>Output</span>
        <textarea value={output} readOnly rows={6} />
      </label>
      {copyStatus ? <p className="supporting-text">{copyStatus}</p> : null}
    </section>
  );
}

function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [urlSafe, setUrlSafe] = useState(false);
  const [status, setStatus] = useState("");
  const [decodedFileUrl, setDecodedFileUrl] = useState("");
  const [decodedFileName, setDecodedFileName] = useState("decoded.bin");
  const decodedFileUrlRef = useRef("");

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

  const encode = () => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(input)));
      setOutput(urlSafe ? toUrlSafe(encoded) : encoded);
      setStatus("Encoded successfully.");
      trackEvent("tool_base64_encode", { urlSafe });
    } catch {
      setOutput("Unable to encode input.");
      setStatus("Encode failed.");
    }
  };

  const decode = () => {
    try {
      const decoded = decodeURIComponent(escape(atob(urlSafe ? fromUrlSafe(input.trim()) : input.trim())));
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
      const payload = dataUrlMatch ? dataUrlMatch[2] : raw;
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

  const encodeFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      setOutput(result);
      setStatus("File converted to Data URL Base64.");
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
      </div>
      <label className="field">
        <span>Encode file to Base64 Data URL</span>
        <input type="file" onChange={(event) => encodeFile(event.target.files?.[0] ?? null)} />
      </label>
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
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [password, setPassword] = useState("");

  const generate = () => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const numbers = "23456789";
    const symbols = "!@#$%^&*()_+-=?.";
    let chars = letters;
    if (includeNumbers) chars += numbers;
    if (includeSymbols) chars += symbols;
    const chosenLength = Math.min(64, Math.max(8, length));
    let result = "";
    const randomValues = new Uint32Array(chosenLength);
    crypto.getRandomValues(randomValues);
    for (let index = 0; index < chosenLength; index += 1) {
      result += chars[randomValues[index] % chars.length];
    }
    setPassword(result);
    trackEvent("tool_generate_password", { length: chosenLength });
  };

  return (
    <section className="tool-surface">
      <h2>Password generator</h2>
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
      </div>
      <button className="action-button" type="button" onClick={generate}>
        Generate password
      </button>
      <label className="field">
        <span>Password</span>
        <input type="text" value={password} readOnly />
      </label>
    </section>
  );
}

function LoremIpsumTool() {
  const [paragraphs, setParagraphs] = useState(3);
  const [output, setOutput] = useState(generateLoremIpsum(3));

  const generate = () => setOutput(generateLoremIpsum(paragraphs));

  return (
    <section className="tool-surface">
      <h2>Lorem Ipsum generator</h2>
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
      <button className="action-button" type="button" onClick={generate}>
        Generate text
      </button>
      <label className="field">
        <span>Output</span>
        <textarea value={output} rows={10} readOnly />
      </label>
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

function DeveloperTool({ id }: { id: DeveloperToolId }) {
  switch (id) {
    case "uuid-generator":
      return <UuidGeneratorTool />;
    case "url-encoder-decoder":
      return <UrlEncoderDecoderTool />;
    case "timestamp-converter":
      return <TimestampConverterTool />;
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

interface PdfJsPage {
  getViewport(params: { scale: number }): PdfJsPageViewport;
  render(params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfJsPageViewport;
  }): { promise: Promise<void> };
}

interface PdfJsDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  destroy?: () => Promise<void> | void;
}

interface PdfJsLoadingTask {
  promise: Promise<PdfJsDocument>;
  destroy?: () => void;
}

interface PdfJsModule {
  getDocument(params: {
    data: ArrayBuffer;
    disableWorker?: boolean;
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
  const pdfJsModule = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;
  if (pdfJsModule.GlobalWorkerOptions) {
    pdfJsModule.GlobalWorkerOptions.workerSrc = "";
  }
  return pdfJsModule;
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
    try {
      setStatus("Inspecting PDF pages...");
      const pdfjs = await loadPdfJsModule();
      const loadingTask = pdfjs.getDocument({
        data: await nextFile.arrayBuffer(),
        disableWorker: true,
      });
      const pdfDocument = await loadingTask.promise;
      const count = pdfDocument.numPages;
      setPageCount(count);
      setStatus(`PDF loaded with ${count} pages.`);
      setRenderedRangeSummary("None");
      if (pdfDocument.destroy) {
        await pdfDocument.destroy();
      }
      if (loadingTask.destroy) {
        loadingTask.destroy();
      }
    } catch {
      setPageCount(0);
      setStatus("Unable to read PDF file.");
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
      loadingTask = pdfjs.getDocument({
        data: await file.arrayBuffer(),
        disableWorker: true,
      });
      pdfDocument = await loadingTask.promise;
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
      if (pdfDocument?.destroy) {
        await pdfDocument.destroy();
      }
      if (loadingTask?.destroy) {
        loadingTask.destroy();
      }
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

  const settingsKey = "utiliora-pomodoro-settings-v3";
  const legacySettingsKey = "utiliora-pomodoro-settings-v2";
  const statsKey = "utiliora-pomodoro-stats-v2";
  const todayKey = new Date().toISOString().slice(0, 10);
  const popupRef = useRef<Window | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
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
    try {
      const rawSettings = localStorage.getItem(settingsKey) ?? localStorage.getItem(legacySettingsKey);
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
        setFocusMinutes(Math.max(10, Math.min(90, Math.round(parsed.focusMinutes ?? 25))));
        setShortBreakMinutes(Math.max(3, Math.min(30, Math.round(parsed.shortBreakMinutes ?? 5))));
        setLongBreakMinutes(Math.max(10, Math.min(45, Math.round(parsed.longBreakMinutes ?? 15))));
        setSessionsBeforeLongBreak(Math.max(2, Math.min(8, Math.round(parsed.sessionsBeforeLongBreak ?? 4))));
        setAutoStartBreaks(Boolean(parsed.autoStartBreaks));
        setAutoStartFocus(Boolean(parsed.autoStartFocus));
        setEnableSystemNotifications(Boolean(parsed.enableSystemNotifications));
        setEnableSoundAlerts(parsed.enableSoundAlerts ?? true);
        setEnableWarnings(parsed.enableWarnings ?? true);
        setWarningSeconds(Math.max(10, Math.min(300, Math.round(parsed.warningSeconds ?? 60))));
        setKeepScreenAwake(Boolean(parsed.keepScreenAwake));
      }
      const rawStats = localStorage.getItem(statsKey);
      if (rawStats) {
        const parsedStats = JSON.parse(rawStats) as Partial<PomodoroStats>;
        if (parsedStats.dateKey === todayKey) {
          setStats({
            dateKey: todayKey,
            completedFocusSessions: Math.max(0, Math.round(parsedStats.completedFocusSessions ?? 0)),
            focusMinutes: Math.max(0, Math.round(parsedStats.focusMinutes ?? 0)),
            completedBreaks: Math.max(0, Math.round(parsedStats.completedBreaks ?? 0)),
            breakMinutes: Math.max(0, Math.round(parsedStats.breakMinutes ?? 0)),
          });
        } else {
          setStats({
            dateKey: todayKey,
            completedFocusSessions: 0,
            focusMinutes: 0,
            completedBreaks: 0,
            breakMinutes: 0,
          });
        }
      }
    } catch {
      // Ignore malformed local data.
    }
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, [legacySettingsKey, statsKey, settingsKey, todayKey]);

  useEffect(() => {
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
    longBreakMinutes,
    sessionsBeforeLongBreak,
    settingsKey,
    shortBreakMinutes,
    enableSystemNotifications,
    enableSoundAlerts,
    enableWarnings,
    warningSeconds,
    keepScreenAwake,
  ]);

  useEffect(() => {
    try {
      localStorage.setItem(statsKey, JSON.stringify(stats));
    } catch {
      // Ignore storage failures.
    }
  }, [stats, statsKey]);

  useEffect(() => {
    if (running) return;
    setSecondsLeft(durationForMode(mode) * 60);
  }, [durationForMode, mode, running]);

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

type TodoPriority = "high" | "medium" | "low";
type TodoFilter = "all" | "active" | "completed" | "overdue" | "today";
const TODO_PRIORITY_WEIGHT: Record<TodoPriority, number> = { high: 3, medium: 2, low: 1 };

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  priority: TodoPriority;
  dueDate: string;
  createdAt: number;
  completedAt?: number;
}

function TodoListTool() {
  const storageKey = "utiliora-todos-v2";
  const importRef = useRef<HTMLInputElement | null>(null);
  const todayKey = new Date().toISOString().slice(0, 10);
  const [value, setValue] = useState("");
  const [priority, setPriority] = useState<TodoPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<TodoItem[]>([]);
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const isOverdue = useCallback((item: TodoItem) => {
    if (!item.dueDate || item.done) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(item.dueDate);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as TodoItem[];
        if (Array.isArray(parsed)) setItems(parsed);
      }
    } catch {
      // Ignore malformed stored tasks.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      // Ignore storage failures.
    }
  }, [items, storageKey]);

  const filteredItems = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();
    return items
      .filter((item) => {
        if (filter === "active" && item.done) return false;
        if (filter === "completed" && !item.done) return false;
        if (filter === "overdue" && !isOverdue(item)) return false;
        if (filter === "today" && item.dueDate !== todayKey) return false;
        if (!searchTerm) return true;
        return item.text.toLowerCase().includes(searchTerm);
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
  }, [filter, isOverdue, items, search, todayKey]);

  const stats = useMemo(() => {
    const completed = items.filter((item) => item.done).length;
    const active = items.length - completed;
    const overdue = items.filter((item) => isOverdue(item)).length;
    const dueToday = items.filter((item) => item.dueDate === todayKey && !item.done).length;
    const completionRate = items.length ? (completed / items.length) * 100 : 0;
    return { completed, active, overdue, total: items.length, dueToday, completionRate };
  }, [isOverdue, items, todayKey]);

  const addTask = () => {
    const text = value.trim();
    if (!text) {
      setStatus("Enter a task before adding.");
      return;
    }
    const nextItem: TodoItem = {
      id: crypto.randomUUID(),
      text,
      done: false,
      priority,
      dueDate,
      createdAt: Date.now(),
    };
    setItems((current) => [nextItem, ...current]);
    setValue("");
    setDueDate("");
    setPriority("medium");
    setStatus("Task added.");
    trackEvent("todo_add", { priority: nextItem.priority, hasDueDate: Boolean(nextItem.dueDate) });
  };

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Tags}
        title="Simple to-do list"
        subtitle="Manage daily work with priority, due dates, filters, and reliable local persistence."
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
      </div>
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
              ["Task", "Priority", "Due Date", "Done", "Created At"],
              items.map((item) => [
                item.text,
                item.priority,
                item.dueDate,
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
            downloadTextFile("todo-backup.json", JSON.stringify(items, null, 2), "application/json;charset=utf-8;")
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
              const parsed = JSON.parse(await file.text()) as Partial<TodoItem>[];
              if (!Array.isArray(parsed)) throw new Error("Invalid");
              const sanitized = parsed
                .filter((item) => item && typeof item === "object")
                .map((item) => ({
                  id: typeof item.id === "string" ? item.id : crypto.randomUUID(),
                  text: typeof item.text === "string" ? item.text : "",
                  done: Boolean(item.done),
                  priority:
                    item.priority === "high" || item.priority === "medium" || item.priority === "low"
                      ? item.priority
                      : "medium",
                  dueDate: typeof item.dueDate === "string" ? item.dueDate : "",
                  createdAt: typeof item.createdAt === "number" ? item.createdAt : Date.now(),
                  completedAt: typeof item.completedAt === "number" ? item.completedAt : undefined,
                }))
                .filter((item) => item.text.trim());
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
          { label: "Total tasks", value: formatNumericValue(stats.total) },
          { label: "Active tasks", value: formatNumericValue(stats.active) },
          { label: "Completed tasks", value: formatNumericValue(stats.completed) },
          { label: "Overdue tasks", value: formatNumericValue(stats.overdue) },
          { label: "Due today", value: formatNumericValue(stats.dueToday) },
          { label: "Completion rate", value: `${stats.completionRate.toFixed(1)}%` },
        ]}
      />
      <ul className="todo-list">
        {filteredItems.map((item) => (
          <li key={item.id}>
            <label>
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
                aria-label={`Delete task ${item.text}`}
                onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
              >
                Delete
              </button>
            </div>
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
  const storageKey = "utiliora-notes-v3";
  const legacyStorageKey = "utiliora-notes-v2";
  const importRef = useRef<HTMLInputElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const defaultNote = useMemo(() => createNote("Untitled note"), []);
  const [notes, setNotes] = useState<NoteItem[]>([defaultNote]);
  const [activeId, setActiveId] = useState<string>(defaultNote.id);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      const source = stored ?? localStorage.getItem(legacyStorageKey);
      if (source) {
        const parsed = JSON.parse(source) as unknown[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const normalized = parsed
            .map((item) => sanitizeStoredNote(item))
            .filter((item): item is NoteItem => Boolean(item));
          if (normalized.length) {
            setNotes(normalized);
            setActiveId(normalized[0].id);
          }
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
          setNotes((current) => [imported, ...current]);
          setActiveId(imported.id);
          setStatus("Imported shared note from URL.");
          params.delete("noteShare");
          const cleanQuery = params.toString();
          const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`;
          window.history.replaceState({}, "", cleanUrl);
        }
      }
    } catch {
      // Ignore malformed notes or share links.
    }
  }, [defaultNote.id, legacyStorageKey, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      // Ignore storage failures.
    }
  }, [notes, storageKey]);

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
      </div>
      <ResultList
        rows={[
          { label: "Total notes", value: formatNumericValue(notes.length) },
          { label: "Pinned notes", value: formatNumericValue(notes.filter((note) => note.pinned).length) },
          { label: "Words in active note", value: formatNumericValue(activeWordCount) },
          { label: "Characters in active note", value: formatNumericValue(activeCharCount) },
          { label: "Estimated reading time", value: `${readingMinutes} min` },
          { label: "Last edited", value: activeNote ? new Date(activeNote.updatedAt).toLocaleString("en-US") : "-" },
        ]}
      />
      <p className="supporting-text">
        Notes stay in your browser only unless you export or share them. Shortcuts: Ctrl/Cmd+B, I, K, S and Ctrl/Cmd+Shift+N.
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

function ProductivityTool({ id }: { id: ProductivityToolId }) {
  switch (id) {
    case "pomodoro-timer":
      return <PomodoroTool />;
    case "simple-todo-list":
      return <TodoListTool />;
    case "notes-pad":
      return <NotesPadTool />;
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

