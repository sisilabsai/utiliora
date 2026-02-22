"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
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
  countCharacters,
  countWords,
  generateLoremIpsum,
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

const calculatorCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const calculatorNumberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function formatCurrencyValue(value: number): string {
  return calculatorCurrencyFormatter.format(value);
}

function formatNumericValue(value: number): string {
  return calculatorNumberFormatter.format(value);
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

function CalculatorTool({ id }: { id: CalculatorId }) {
  const fields = calculatorFields[id];
  const defaultValues = useMemo(() => Object.fromEntries(fields.map((field) => [field.name, field.defaultValue])), [fields]);
  const storageKey = `utiliora-calculator-values-${id}`;
  const autoModeKey = `utiliora-calculator-auto-${id}`;
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [resultRows, setResultRows] = useState<ResultRow[]>(runCalculator(id, defaultValues));
  const [autoCalculate, setAutoCalculate] = useState(true);
  const [copyStatus, setCopyStatus] = useState("");
  const [showFullTable, setShowFullTable] = useState(false);
  const presets = calculatorPresets[id] ?? [];

  useEffect(() => {
    setValues(defaultValues);
    setResultRows(runCalculator(id, defaultValues));
    setShowFullTable(false);
  }, [defaultValues, id]);

  useEffect(() => {
    try {
      const savedValues = localStorage.getItem(storageKey);
      const savedAutoMode = localStorage.getItem(autoModeKey);
      if (savedValues) {
        const parsed = JSON.parse(savedValues) as Record<string, string>;
        setValues((current) => ({ ...current, ...parsed }));
      }
      if (savedAutoMode !== null) {
        setAutoCalculate(savedAutoMode === "true");
      }
    } catch {
      // Ignore malformed storage values and continue with defaults.
    }
  }, [autoModeKey, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(values));
      localStorage.setItem(autoModeKey, autoCalculate ? "true" : "false");
    } catch {
      // Ignore storage failures.
    }
  }, [autoCalculate, autoModeKey, storageKey, values]);

  const calculate = useCallback(
    (
      trigger: "manual" | "auto" | "preset" | "reset" = "manual",
      nextValues: Record<string, string> = values,
    ) => {
      const rows = runCalculator(id, nextValues);
      setResultRows(rows);
      trackEvent("tool_calculate", { tool: id, trigger });
    },
    [id, values],
  );

  useEffect(() => {
    if (!autoCalculate) return;
    calculate("auto");
  }, [autoCalculate, calculate]);

  const insights = useMemo(() => getCalculatorInsights(id, values), [id, values]);
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

      <div className="field-grid">
        {fields.map((field) => (
          <label key={field.name} className="field">
            <span>{field.label}</span>
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
                    <td>{formatCurrencyValue(row.payment)}</td>
                    <td>{formatCurrencyValue(row.principal)}</td>
                    <td>{formatCurrencyValue(row.interest)}</td>
                    <td>{formatCurrencyValue(row.balance)}</td>
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
                    <td>{formatCurrencyValue(row.value)}</td>
                    <td>{formatCurrencyValue(row.gain)}</td>
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
                    <td>{formatCurrencyValue(row.accountValue)}</td>
                    <td>{formatCurrencyValue(row.contributed)}</td>
                    <td>{formatCurrencyValue(row.growth)}</td>
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
                      <td>{formatCurrencyValue(row.unitPrice)}</td>
                      <td>{formatCurrencyValue(row.contributionPerUnit)}</td>
                      <td>{Number.isFinite(row.units) ? formatNumericValue(row.units) : "Not reachable"}</td>
                      <td>{Number.isFinite(row.revenue) ? formatCurrencyValue(row.revenue) : "Not reachable"}</td>
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
                value: formatCurrencyValue((safeNumberValue(values.targetMonthlyIncome) + safeNumberValue(values.monthlyExpenses)) / Math.max(1, safeNumberValue(values.billableHoursPerMonth)) * (1 + safeNumberValue(values.desiredProfitPercent) / 100) * 8),
              },
              {
                label: "Estimated week rate (40h)",
                value: formatCurrencyValue((safeNumberValue(values.targetMonthlyIncome) + safeNumberValue(values.monthlyExpenses)) / Math.max(1, safeNumberValue(values.billableHoursPerMonth)) * (1 + safeNumberValue(values.desiredProfitPercent) / 100) * 40),
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
    case "json-formatter":
      return <JsonFormatterTool />;
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

function ImageTransformTool({ mode }: { mode: ImageMode }) {
  const config = IMAGE_MODE_CONFIG[mode];
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

  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    };
  }, []);

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
        <a className="action-link" href={resultDetails.url} download={resultDetails.downloadName}>
          Download {labelForMimeType(resultDetails.mimeType)}
        </a>
      ) : null}
    </section>
  );
}

function ImageTool({ id }: { id: ImageToolId }) {
  switch (id) {
    case "qr-code-generator":
      return <QrCodeGeneratorTool />;
    case "color-picker":
      return <ColorPickerTool />;
    case "hex-rgb-converter":
      return <HexRgbConverterTool />;
    case "image-resizer":
      return <ImageTransformTool mode="resize" />;
    case "image-compressor":
      return <ImageTransformTool mode="compress" />;
    case "jpg-to-png":
      return <ImageTransformTool mode="jpg-to-png" />;
    case "png-to-webp":
      return <ImageTransformTool mode="png-to-webp" />;
    default:
      return <p>Image tool unavailable.</p>;
  }
}

function PomodoroTool() {
  type PomodoroMode = "focus" | "short-break" | "long-break";
  type PomodoroStats = { dateKey: string; completedFocusSessions: number; focusMinutes: number };

  const settingsKey = "utiliora-pomodoro-settings-v2";
  const statsKey = "utiliora-pomodoro-stats-v2";
  const todayKey = new Date().toISOString().slice(0, 10);

  const [focusMinutes, setFocusMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(4);
  const [autoStartBreaks, setAutoStartBreaks] = useState(false);
  const [autoStartFocus, setAutoStartFocus] = useState(false);
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

  useEffect(() => {
    try {
      const rawSettings = localStorage.getItem(settingsKey);
      if (rawSettings) {
        const parsed = JSON.parse(rawSettings) as {
          focusMinutes?: number;
          shortBreakMinutes?: number;
          longBreakMinutes?: number;
          sessionsBeforeLongBreak?: number;
          autoStartBreaks?: boolean;
          autoStartFocus?: boolean;
        };
        setFocusMinutes(Math.max(10, Math.min(90, Math.round(parsed.focusMinutes ?? 25))));
        setShortBreakMinutes(Math.max(3, Math.min(30, Math.round(parsed.shortBreakMinutes ?? 5))));
        setLongBreakMinutes(Math.max(10, Math.min(45, Math.round(parsed.longBreakMinutes ?? 15))));
        setSessionsBeforeLongBreak(Math.max(2, Math.min(8, Math.round(parsed.sessionsBeforeLongBreak ?? 4))));
        setAutoStartBreaks(Boolean(parsed.autoStartBreaks));
        setAutoStartFocus(Boolean(parsed.autoStartFocus));
      }
      const rawStats = localStorage.getItem(statsKey);
      if (rawStats) {
        const parsedStats = JSON.parse(rawStats) as PomodoroStats;
        setStats(
          parsedStats.dateKey === todayKey
            ? parsedStats
            : { dateKey: todayKey, completedFocusSessions: 0, focusMinutes: 0 },
        );
      }
    } catch {
      // Ignore malformed local data.
    }
  }, [statsKey, settingsKey, todayKey]);

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

  const completePhase = useCallback(() => {
    setRunning(false);
    if (mode === "focus") {
      const nextCount = completedFocusInCycle + 1;
      const nextMode: PomodoroMode = nextCount % sessionsBeforeLongBreak === 0 ? "long-break" : "short-break";
      const focusMinutesCompleted = durationForMode("focus");
      setCompletedFocusInCycle(nextCount);
      setMode(nextMode);
      setSecondsLeft(durationForMode(nextMode) * 60);
      setRunning(autoStartBreaks);
      setStatus(
        nextMode === "long-break"
          ? "Focus complete. Long break started."
          : "Focus complete. Short break started.",
      );
      setStats((current) => {
        const safeCurrent =
          current.dateKey === todayKey
            ? current
            : { dateKey: todayKey, completedFocusSessions: 0, focusMinutes: 0 };
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
      setStatus("Break complete. Back to focus.");
    }
  }, [
    autoStartBreaks,
    autoStartFocus,
    completedFocusInCycle,
    durationForMode,
    mode,
    sessionsBeforeLongBreak,
    todayKey,
  ]);

  useEffect(() => {
    if (running && secondsLeft === 0) {
      completePhase();
      trackEvent("pomodoro_phase_complete", { mode });
    }
  }, [completePhase, mode, running, secondsLeft]);

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
        subtitle="Cycle focus and break sessions with auto transitions, daily stats, and preset workflows."
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
          { label: "Completed focus sessions today", value: formatNumericValue(stats.completedFocusSessions) },
          { label: "Focused minutes today", value: formatNumericValue(stats.focusMinutes) },
        ]}
      />
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => setRunning(true)}>
          Start
        </button>
        <button className="action-button secondary" type="button" onClick={() => setRunning(false)}>
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
          Skip phase
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => {
            setRunning(false);
            setMode("focus");
            setSecondsLeft(durationForMode("focus") * 60);
            setStatus("Timer reset to focus phase.");
          }}
        >
          Reset
        </button>
      </div>
      <p className="supporting-text">{status}</p>
    </section>
  );
}

type TodoPriority = "high" | "medium" | "low";
type TodoFilter = "all" | "active" | "completed" | "overdue";
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
  }, [filter, isOverdue, items, search]);

  const stats = useMemo(() => {
    const completed = items.filter((item) => item.done).length;
    const active = items.length - completed;
    const overdue = items.filter((item) => isOverdue(item)).length;
    return { completed, active, overdue, total: items.length };
  }, [isOverdue, items]);

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
      </div>
      <div className="field-grid">
        <label className="field">
          <span>Filter</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value as TodoFilter)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
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
}

function NotesPadTool() {
  const storageKey = "utiliora-notes-v2";
  const defaultNote: NoteItem = {
    id: crypto.randomUUID(),
    title: "Untitled note",
    content: "",
    updatedAt: Date.now(),
  };

  const [notes, setNotes] = useState<NoteItem[]>([defaultNote]);
  const [activeId, setActiveId] = useState(defaultNote.id);
  const [search, setSearch] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as NoteItem[];
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      setNotes(parsed);
      setActiveId(parsed[0].id);
    } catch {
      // Ignore malformed notes.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      // Ignore storage failures.
    }
  }, [notes, storageKey]);

  const activeNote = useMemo(
    () => notes.find((note) => note.id === activeId) ?? notes[0] ?? null,
    [activeId, notes],
  );

  const filteredNotes = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter(
      (note) =>
        note.title.toLowerCase().includes(needle) || note.content.toLowerCase().includes(needle),
    );
  }, [notes, search]);

  const updateActiveNote = (patch: Partial<NoteItem>) => {
    if (!activeNote) return;
    setNotes((current) =>
      current.map((note) =>
        note.id === activeNote.id ? { ...note, ...patch, updatedAt: Date.now() } : note,
      ),
    );
  };

  const activeWordCount = countWords(activeNote?.content ?? "");
  const activeCharCount = activeNote?.content.length ?? 0;
  const renderedPreview = useMemo(
    () => markdownToHtml(activeNote?.content ?? ""),
    [activeNote?.content],
  );

  return (
    <section className="tool-surface">
      <ToolHeading
        icon={Type}
        title="Notes pad"
        subtitle="Organize multiple notes with autosave, search, markdown preview, and quick export."
      />
      <div className="button-row">
        <button
          className="action-button"
          type="button"
          onClick={() => {
            const created: NoteItem = {
              id: crypto.randomUUID(),
              title: `New note ${notes.length + 1}`,
              content: "",
              updatedAt: Date.now(),
            };
            setNotes((current) => [created, ...current]);
            setActiveId(created.id);
            setStatus("Created a new note.");
          }}
        >
          New note
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
          onClick={() => {
            if (!activeNote) return;
            setNotes((current) => {
              const next = current.filter((note) => note.id !== activeNote.id);
              if (next.length === 0) {
                const replacement: NoteItem = {
                  id: crypto.randomUUID(),
                  title: "Untitled note",
                  content: "",
                  updatedAt: Date.now(),
                };
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
      <div className="split-panel">
        <div className="mini-panel">
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
                <p className="supporting-text">{new Date(note.updatedAt).toLocaleString("en-US")}</p>
              </li>
            ))}
          </ul>
        </div>
        <div>
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
                <span>Your note (autosaved locally)</span>
                <textarea
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
          onClick={() =>
            downloadTextFile(
              `${(activeNote?.title || "note").replace(/[^\w.-]+/g, "-").toLowerCase()}.md`,
              activeNote?.content ?? "",
            )
          }
          disabled={!activeNote}
        >
          <Download size={15} />
          Export .md
        </button>
      </div>
      <ResultList
        rows={[
          { label: "Total notes", value: formatNumericValue(notes.length) },
          { label: "Words in active note", value: formatNumericValue(activeWordCount) },
          { label: "Characters in active note", value: formatNumericValue(activeCharCount) },
        ]}
      />
      <p className="supporting-text">Notes stay in your browser only unless you export them.</p>
    </section>
  );
}

type ResumeTemplate = "modern" | "minimal" | "compact";

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

function sanitizeResumeData(raw: unknown): ResumeData | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<ResumeData>;
  const defaults = createDefaultResumeData();
  const template: ResumeTemplate =
    candidate.template === "minimal" || candidate.template === "compact" || candidate.template === "modern"
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
  items: InvoiceLineItem[];
}

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
    items: items.length ? items : defaults.items,
  };
}

function InvoiceGeneratorTool() {
  const storageKey = "utiliora-invoice-generator-v1";
  const [invoice, setInvoice] = useState<InvoiceData>(() => createDefaultInvoiceData());
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) return;
      const sanitized = sanitizeInvoiceData(JSON.parse(stored));
      if (sanitized) setInvoice(sanitized);
    } catch {
      // Ignore malformed invoice data.
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(invoice));
    } catch {
      // Ignore storage failures.
    }
  }, [invoice, storageKey]);

  const updateInvoice = <K extends keyof InvoiceData>(key: K, value: InvoiceData[K]) => {
    setInvoice((current) => ({ ...current, [key]: value }));
  };

  const updateItem = (id: string, patch: Partial<InvoiceLineItem>) => {
    setInvoice((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
  };

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

  const printInvoice = () => {
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
              <select value={invoice.currency} onChange={(event) => updateInvoice("currency", event.target.value)}>
                {["USD", "EUR", "GBP", "CAD", "AUD", "INR"].map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
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

