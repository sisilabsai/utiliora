"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Binary,
  Calculator,
  Braces,
  Code2,
  Copy,
  Download,
  Hash,
  Link2,
  RefreshCw,
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

function UnitConverterTool({ quantity }: { quantity: UnitQuantity }) {
  const units = getUnitsForQuantity(quantity);
  const [inputValue, setInputValue] = useState("1");
  const [from, setFrom] = useState(units[0]?.value ?? "");
  const [to, setTo] = useState(units[1]?.value ?? units[0]?.value ?? "");

  const output = useMemo(() => {
    const value = Number(inputValue);
    if (!Number.isFinite(value)) return "Enter a valid number.";
    const converted = convertUnitValue(quantity, value, from, to);
    if (!Number.isFinite(converted)) return "Unable to convert with selected units.";
    return converted.toLocaleString("en-US", { maximumFractionDigits: 8 });
  }, [from, inputValue, quantity, to]);

  return (
    <section className="tool-surface">
      <h2>Unit converter</h2>
      <div className="field-grid">
        <label className="field">
          <span>Value</span>
          <input type="number" value={inputValue} onChange={(event) => setInputValue(event.target.value)} />
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
      </div>
      <div className="result-row">
        <span>Converted value</span>
        <strong>{output}</strong>
      </div>
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
  const [uuids, setUuids] = useState<string[]>([]);
  const generate = () => {
    const next = crypto.randomUUID();
    setUuids((current) => [next, ...current].slice(0, 10));
    trackEvent("tool_generate_uuid");
  };

  return (
    <section className="tool-surface">
      <h2>UUID generator</h2>
      <button className="action-button" type="button" onClick={generate}>
        Generate UUID v4
      </button>
      <ul className="mono-list">
        {uuids.map((uuid) => (
          <li key={uuid}>{uuid}</li>
        ))}
      </ul>
    </section>
  );
}

function UrlEncoderDecoderTool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  return (
    <section className="tool-surface">
      <h2>URL encode/decode</h2>
      <label className="field">
        <span>Input</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={5} />
      </label>
      <div className="button-row">
        <button className="action-button" type="button" onClick={() => setOutput(encodeURIComponent(input))}>
          Encode
        </button>
        <button
          className="action-button secondary"
          type="button"
          onClick={() => setOutput(decodeURIComponent(input))}
        >
          Decode
        </button>
      </div>
      <label className="field">
        <span>Output</span>
        <textarea value={output} readOnly rows={5} />
      </label>
    </section>
  );
}

function TimestampConverterTool() {
  const [unixInput, setUnixInput] = useState(Math.floor(Date.now() / 1000).toString());
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 16));

  const parsedUnix = Number(unixInput);
  const unixDate = Number.isFinite(parsedUnix) ? new Date(parsedUnix * 1000) : null;
  const parsedDate = new Date(dateInput);
  const dateToUnix = Number.isNaN(parsedDate.getTime()) ? null : Math.floor(parsedDate.getTime() / 1000);

  return (
    <section className="tool-surface">
      <h2>Timestamp converter</h2>
      <div className="field-grid">
        <label className="field">
          <span>Unix timestamp (seconds)</span>
          <input type="text" value={unixInput} onChange={(event) => setUnixInput(event.target.value)} />
        </label>
        <label className="field">
          <span>Date and time</span>
          <input type="datetime-local" value={dateInput} onChange={(event) => setDateInput(event.target.value)} />
        </label>
      </div>
      <ResultList
        rows={[
          {
            label: "Unix -> UTC",
            value: unixDate && !Number.isNaN(unixDate.getTime()) ? unixDate.toUTCString() : "Invalid timestamp",
          },
          { label: "Date -> Unix", value: dateToUnix ? dateToUnix.toString() : "Invalid date" },
        ]}
      />
    </section>
  );
}

function MarkdownToHtmlTool() {
  const [markdown, setMarkdown] = useState("# Heading\n\nWrite **bold** text, *italic* text, and - list items.");
  const html = useMemo(() => markdownToHtml(markdown), [markdown]);
  return (
    <section className="tool-surface">
      <h2>Markdown to HTML</h2>
      <div className="split-panel">
        <label className="field">
          <span>Markdown input</span>
          <textarea value={markdown} onChange={(event) => setMarkdown(event.target.value)} rows={12} />
        </label>
        <div className="preview">
          <h3>HTML preview</h3>
          <div className="preview-box" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </section>
  );
}

function UserAgentCheckerTool() {
  const [agent, setAgent] = useState<string>("Loading...");
  useEffect(() => {
    setAgent(navigator.userAgent);
  }, []);

  return (
    <section className="tool-surface">
      <h2>User agent details</h2>
      <ResultList
        rows={[
          { label: "User Agent", value: agent },
          { label: "Platform", value: typeof navigator !== "undefined" ? navigator.platform : "Unknown" },
          { label: "Language", value: typeof navigator !== "undefined" ? navigator.language : "Unknown" },
        ]}
      />
    </section>
  );
}

function IpAddressCheckerTool() {
  const [ip, setIp] = useState("Not loaded yet");
  const [loading, setLoading] = useState(false);

  const loadIp = async () => {
    setLoading(true);
    try {
      const response = await fetch("https://api64.ipify.org?format=json");
      const payload = (await response.json()) as { ip: string };
      setIp(payload.ip ?? "Unavailable");
      trackEvent("tool_check_ip");
    } catch {
      setIp("Failed to fetch IP. Check network connectivity.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="tool-surface">
      <h2>Public IP checker</h2>
      <button className="action-button" type="button" onClick={loadIp} disabled={loading}>
        {loading ? "Checking..." : "Check IP"}
      </button>
      <div className="result-row">
        <span>Public IP</span>
        <strong>{ip}</strong>
      </div>
    </section>
  );
}

function CronGeneratorTool() {
  const [minute, setMinute] = useState("0");
  const [hour, setHour] = useState("*");
  const [dayOfMonth, setDayOfMonth] = useState("*");
  const [month, setMonth] = useState("*");
  const [dayOfWeek, setDayOfWeek] = useState("*");
  const cron = `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;

  return (
    <section className="tool-surface">
      <h2>Cron expression generator</h2>
      <div className="field-grid">
        <label className="field">
          <span>Minute</span>
          <input value={minute} onChange={(event) => setMinute(event.target.value)} />
        </label>
        <label className="field">
          <span>Hour</span>
          <input value={hour} onChange={(event) => setHour(event.target.value)} />
        </label>
        <label className="field">
          <span>Day of month</span>
          <input value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} />
        </label>
        <label className="field">
          <span>Month</span>
          <input value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label className="field">
          <span>Day of week</span>
          <input value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)} />
        </label>
      </div>
      <div className="result-row">
        <span>Cron expression</span>
        <strong>{cron}</strong>
      </div>
    </section>
  );
}

function HttpStatusCheckerTool() {
  const [url, setUrl] = useState("https://example.com");
  const [status, setStatus] = useState("No result yet");
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    setStatus("Checking...");
    try {
      const response = await fetch(`/api/http-status?url=${encodeURIComponent(url)}`);
      const payload = (await response.json()) as {
        ok: boolean;
        status?: number;
        statusText?: string;
        error?: string;
        timingMs?: number;
      };
      if (!payload.ok) {
        setStatus(payload.error ?? "Unable to fetch URL");
      } else {
        setStatus(`${payload.status} ${payload.statusText ?? ""} (${payload.timingMs} ms)`.trim());
      }
      trackEvent("tool_http_check", { success: payload.ok });
    } catch {
      setStatus("Request failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="tool-surface">
      <h2>HTTP status checker</h2>
      <label className="field">
        <span>URL</span>
        <input type="url" value={url} onChange={(event) => setUrl(event.target.value)} />
      </label>
      <button className="action-button" type="button" onClick={check} disabled={loading}>
        {loading ? "Checking..." : "Check status"}
      </button>
      <div className="result-row">
        <span>Result</span>
        <strong>{status}</strong>
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
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(minutes * 60);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    setSecondsLeft(minutes * 60);
  }, [minutes]);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          setRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const mm = Math.floor(secondsLeft / 60)
    .toString()
    .padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  return (
    <section className="tool-surface">
      <h2>Pomodoro timer</h2>
      <label className="field">
        <span>Focus session length (minutes)</span>
        <input
          type="number"
          min={5}
          max={90}
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
        />
      </label>
      <div className="timer-value" aria-live="polite">
        {mm}:{ss}
      </div>
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
            setRunning(false);
            setSecondsLeft(minutes * 60);
          }}
        >
          Reset
        </button>
      </div>
    </section>
  );
}

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

function TodoListTool() {
  const [value, setValue] = useState("");
  const [items, setItems] = useState<TodoItem[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem("utiliora-todos");
    if (stored) setItems(JSON.parse(stored) as TodoItem[]);
  }, []);

  useEffect(() => {
    localStorage.setItem("utiliora-todos", JSON.stringify(items));
  }, [items]);

  return (
    <section className="tool-surface">
      <h2>Simple to-do list</h2>
      <div className="button-row">
        <input
          type="text"
          value={value}
          placeholder="Add a task..."
          onChange={(event) => setValue(event.target.value)}
        />
        <button
          className="action-button"
          type="button"
          onClick={() => {
            const text = value.trim();
            if (!text) return;
            setItems((current) => [{ id: crypto.randomUUID(), text, done: false }, ...current]);
            setValue("");
          }}
        >
          Add
        </button>
      </div>
      <ul className="todo-list">
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input
                type="checkbox"
                checked={item.done}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((candidate) =>
                      candidate.id === item.id ? { ...candidate, done: event.target.checked } : candidate,
                    ),
                  )
                }
              />
              <span className={item.done ? "done" : ""}>{item.text}</span>
            </label>
            <button
              className="icon-button"
              type="button"
              aria-label={`Delete task ${item.text}`}
              onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NotesPadTool() {
  const [note, setNote] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("utiliora-notes");
    if (stored) setNote(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem("utiliora-notes", note);
  }, [note]);

  return (
    <section className="tool-surface">
      <h2>Notes pad</h2>
      <label className="field">
        <span>Your notes (autosaved locally)</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={16} />
      </label>
      <p className="supporting-text">Notes are stored in your browser only.</p>
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

