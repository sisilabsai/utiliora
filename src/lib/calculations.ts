import type { CalculatorId } from "@/lib/types";

export interface ResultRow {
  label: string;
  value: string;
  hint?: string;
}

export interface LoanAmortizationRow {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  balance: number;
}

export interface GrowthTimelineRow {
  periodYears: number;
  value: number;
  gain: number;
}

export interface SavingsTimelineRow {
  periodYears: number;
  accountValue: number;
  contributed: number;
  growth: number;
}

export interface BreakEvenScenarioRow {
  unitPrice: number;
  contributionPerUnit: number;
  units: number;
  revenue: number;
}

export interface DtiAffordabilityScenarioRow {
  label: string;
  frontEndLimit: number;
  backEndLimit: number;
  maxHousingPayment: number;
  maxTotalDebt: number;
  headroom: number;
  constraint: "Front-end" | "Back-end" | "Income";
}

export interface CalculatorOutputOptions {
  currency?: string;
}

const DEFAULT_OUTPUT_CURRENCY = "USD";
const moneyFormatterCache = new Map<string, Intl.NumberFormat>();

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function sanitizeCurrencyCode(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_OUTPUT_CURRENCY;
  const code = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : DEFAULT_OUTPUT_CURRENCY;
}

function getMoneyFormatter(currency: string): Intl.NumberFormat | null {
  const code = sanitizeCurrencyCode(currency);
  const cached = moneyFormatterCache.get(code);
  if (cached) return cached;

  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 2,
    });
    moneyFormatterCache.set(code, formatter);
    return formatter;
  } catch {
    return null;
  }
}

function formatMoneyValue(value: number, currency = DEFAULT_OUTPUT_CURRENCY): string {
  const formatter = getMoneyFormatter(currency);
  if (formatter) return formatter.format(value);
  return `${formatNumber(value)} ${sanitizeCurrencyCode(currency)}`;
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
}

function formatDate(value: Date): string {
  return dateFormatter.format(value);
}

function parseDateInput(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!matched) return null;

  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const parsed = new Date(year, month - 1, day, 12);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function toUtcDayNumber(value: Date): number {
  return Math.floor(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()) / MS_PER_DAY);
}

function resolveBirthdayInYear(birthDate: Date, year: number): Date {
  const month = birthDate.getMonth();
  const day = birthDate.getDate();
  const candidate = new Date(year, month, day, 12);
  if (candidate.getMonth() !== month) {
    return new Date(year, month + 1, 0, 12);
  }
  return candidate;
}

function resolveDisplayCurrency(options?: CalculatorOutputOptions): string {
  return sanitizeCurrencyCode(options?.currency);
}

interface LoanMetrics {
  principal: number;
  annualRate: number;
  months: number;
  monthlyRate: number;
  emi: number;
  totalPayment: number;
  totalInterest: number;
}

function loanMetrics(rawValues: Record<string, unknown>): LoanMetrics {
  const principal = Math.max(0, toNumber(rawValues.principal));
  const annualRate = Math.max(0, toNumber(rawValues.annualRate));
  const months = Math.max(1, Math.round(toNumber(rawValues.months, 12)));
  const monthlyRate = annualRate / 12 / 100;

  if (monthlyRate === 0) {
    const emi = principal / months;
    return {
      principal,
      annualRate,
      months,
      monthlyRate,
      emi,
      totalPayment: principal,
      totalInterest: 0,
    };
  }

  const multiplier = Math.pow(1 + monthlyRate, months);
  const emi = (principal * monthlyRate * multiplier) / (multiplier - 1);
  const totalPayment = emi * months;
  const totalInterest = totalPayment - principal;

  return {
    principal,
    annualRate,
    months,
    monthlyRate,
    emi,
    totalPayment,
    totalInterest,
  };
}

interface AutoLoanMetrics {
  vehiclePrice: number;
  downPayment: number;
  tradeInValue: number;
  salesTaxRate: number;
  dealerFees: number;
  annualRate: number;
  months: number;
  taxableAmount: number;
  salesTaxAmount: number;
  outTheDoorPrice: number;
  upfrontCash: number;
  financedAmount: number;
  monthlyRate: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  totalCost: number;
  loanToValue: number;
}

function autoLoanMetrics(rawValues: Record<string, unknown>): AutoLoanMetrics {
  const vehiclePrice = Math.max(0, toNumber(rawValues.vehiclePrice));
  const downPayment = Math.max(0, toNumber(rawValues.downPayment));
  const tradeInValue = Math.max(0, toNumber(rawValues.tradeInValue));
  const salesTaxRate = Math.max(0, toNumber(rawValues.salesTaxRate));
  const dealerFees = Math.max(0, toNumber(rawValues.dealerFees));
  const annualRate = Math.max(0, toNumber(rawValues.annualRate));
  const months = Math.max(1, Math.round(toNumber(rawValues.months, 60)));
  const monthlyRate = annualRate / 12 / 100;

  const taxableAmount = Math.max(0, vehiclePrice - tradeInValue);
  const salesTaxAmount = taxableAmount * (salesTaxRate / 100);
  const outTheDoorPrice = vehiclePrice + salesTaxAmount + dealerFees;
  const upfrontCash = downPayment + tradeInValue;
  const financedAmount = Math.max(0, outTheDoorPrice - upfrontCash);

  let monthlyPayment = financedAmount / months;
  if (financedAmount > 0 && monthlyRate > 0) {
    const multiplier = Math.pow(1 + monthlyRate, months);
    monthlyPayment = (financedAmount * monthlyRate * multiplier) / (multiplier - 1);
  }
  if (financedAmount === 0) {
    monthlyPayment = 0;
  }

  const totalPayment = monthlyPayment * months;
  const totalInterest = Math.max(0, totalPayment - financedAmount);
  const totalCost = upfrontCash + totalPayment;
  const loanToValue = vehiclePrice > 0 ? (financedAmount / vehiclePrice) * 100 : 0;

  return {
    vehiclePrice,
    downPayment,
    tradeInValue,
    salesTaxRate,
    dealerFees,
    annualRate,
    months,
    taxableAmount,
    salesTaxAmount,
    outTheDoorPrice,
    upfrontCash,
    financedAmount,
    monthlyRate,
    monthlyPayment,
    totalPayment,
    totalInterest,
    totalCost,
    loanToValue,
  };
}

interface CompoundMetrics {
  principal: number;
  annualRate: number;
  years: number;
  compoundsPerYear: number;
  amount: number;
  interest: number;
}

function compoundMetrics(rawValues: Record<string, unknown>): CompoundMetrics {
  const principal = Math.max(0, toNumber(rawValues.principal));
  const annualRate = Math.max(0, toNumber(rawValues.annualRate)) / 100;
  const years = Math.max(0, toNumber(rawValues.years));
  const compoundsPerYear = Math.max(1, Math.round(toNumber(rawValues.compoundsPerYear, 12)));
  const amount = principal * Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear * years);
  const interest = amount - principal;

  return {
    principal,
    annualRate,
    years,
    compoundsPerYear,
    amount,
    interest,
  };
}

interface SavingsGoalMetrics {
  targetAmount: number;
  currentSavings: number;
  years: number;
  annualReturn: number;
  monthlyRate: number;
  months: number;
  futureCurrent: number;
  requiredFromContributions: number;
  monthlyContribution: number;
}

function savingsGoalMetrics(rawValues: Record<string, unknown>): SavingsGoalMetrics {
  const targetAmount = Math.max(0, toNumber(rawValues.targetAmount));
  const currentSavings = Math.max(0, toNumber(rawValues.currentSavings));
  const years = Math.max(1 / 12, toNumber(rawValues.years, 1));
  const annualReturn = Math.max(0, toNumber(rawValues.annualReturn)) / 100;
  const monthlyRate = annualReturn / 12;
  const months = Math.max(1, Math.round(years * 12));
  const futureCurrent = currentSavings * Math.pow(1 + monthlyRate, months);
  const requiredFromContributions = Math.max(0, targetAmount - futureCurrent);

  let monthlyContribution = requiredFromContributions / months;
  if (monthlyRate > 0) {
    const growthFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
    monthlyContribution = requiredFromContributions / Math.max(growthFactor, 1);
  }

  return {
    targetAmount,
    currentSavings,
    years,
    annualReturn,
    monthlyRate,
    months,
    futureCurrent,
    requiredFromContributions,
    monthlyContribution,
  };
}

interface MortgageMetrics {
  homePrice: number;
  downPayment: number;
  loanAmount: number;
  annualRate: number;
  years: number;
  months: number;
  principalAndInterest: number;
  monthlyPropertyTax: number;
  monthlyInsurance: number;
  monthlyHoa: number;
  totalMonthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  downPaymentPercent: number;
}

function mortgageMetrics(rawValues: Record<string, unknown>): MortgageMetrics {
  const homePrice = Math.max(0, toNumber(rawValues.homePrice));
  const downPayment = Math.min(homePrice, Math.max(0, toNumber(rawValues.downPayment)));
  const loanAmount = Math.max(0, homePrice - downPayment);
  const annualRate = Math.max(0, toNumber(rawValues.annualRate));
  const years = Math.max(1, toNumber(rawValues.years, 30));
  const months = Math.max(1, Math.round(years * 12));
  const monthlyRate = annualRate / 12 / 100;
  const annualPropertyTaxRate = Math.max(0, toNumber(rawValues.annualPropertyTaxRate)) / 100;
  const annualHomeInsurance = Math.max(0, toNumber(rawValues.annualHomeInsurance));
  const monthlyHoa = Math.max(0, toNumber(rawValues.monthlyHoa));
  const monthlyPropertyTax = (homePrice * annualPropertyTaxRate) / 12;
  const monthlyInsurance = annualHomeInsurance / 12;

  let principalAndInterest = loanAmount / months;
  if (loanAmount > 0 && monthlyRate > 0) {
    const multiplier = Math.pow(1 + monthlyRate, months);
    principalAndInterest = (loanAmount * monthlyRate * multiplier) / (multiplier - 1);
  }
  if (loanAmount === 0) {
    principalAndInterest = 0;
  }

  const totalPayment = principalAndInterest * months;
  const totalInterest = Math.max(0, totalPayment - loanAmount);
  const totalMonthlyPayment = principalAndInterest + monthlyPropertyTax + monthlyInsurance + monthlyHoa;
  const downPaymentPercent = homePrice > 0 ? (downPayment / homePrice) * 100 : 0;

  return {
    homePrice,
    downPayment,
    loanAmount,
    annualRate,
    years,
    months,
    principalAndInterest,
    monthlyPropertyTax,
    monthlyInsurance,
    monthlyHoa,
    totalMonthlyPayment,
    totalPayment,
    totalInterest,
    downPaymentPercent,
  };
}

interface DtiMetrics {
  grossMonthlyIncome: number;
  coBorrowerMonthlyIncome: number;
  otherMonthlyIncome: number;
  totalMonthlyIncome: number;
  monthlyHousingPayment: number;
  monthlyPropertyTax: number;
  monthlyInsuranceHoa: number;
  housingTotal: number;
  monthlyCarPayment: number;
  monthlyStudentLoanPayment: number;
  monthlyCreditCardPayments: number;
  monthlyPersonalLoanPayments: number;
  monthlyChildSupportAlimony: number;
  monthlyOtherDebts: number;
  nonHousingDebtTotal: number;
  monthlyDebtTotal: number;
  frontEndDti: number;
  backEndDti: number;
  targetFrontEndDti: number;
  targetBackEndDti: number;
  maxTotalDebtAtTarget: number;
  maxHousingAtTargets: number;
  debtCapacityAtTarget: number;
  debtReductionNeededAtTarget: number;
  housingHeadroomAtTarget: number;
  remainingPreTaxIncome: number;
  requiredIncomeFor36: number;
  requiredIncomeFor43: number;
  requiredIncomeFor50: number;
  riskTier: string;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function classifyDtiRisk(backEndDti: number): string {
  if (backEndDti <= 20) return "Very healthy";
  if (backEndDti <= 28) return "Healthy";
  if (backEndDti <= 36) return "Lender-friendly";
  if (backEndDti <= 43) return "Manageable";
  if (backEndDti <= 50) return "Stretched";
  return "High risk";
}

function dtiMetrics(rawValues: Record<string, unknown>): DtiMetrics {
  const grossMonthlyIncome = Math.max(0, toNumber(rawValues.grossMonthlyIncome));
  const coBorrowerMonthlyIncome = Math.max(0, toNumber(rawValues.coBorrowerMonthlyIncome));
  const otherMonthlyIncome = Math.max(0, toNumber(rawValues.otherMonthlyIncome));
  const totalMonthlyIncome = grossMonthlyIncome + coBorrowerMonthlyIncome + otherMonthlyIncome;

  const monthlyHousingPayment = Math.max(0, toNumber(rawValues.monthlyHousingPayment));
  const monthlyPropertyTax = Math.max(0, toNumber(rawValues.monthlyPropertyTax));
  const monthlyInsuranceHoa = Math.max(0, toNumber(rawValues.monthlyInsuranceHoa));
  const housingTotal = monthlyHousingPayment + monthlyPropertyTax + monthlyInsuranceHoa;

  const monthlyCarPayment = Math.max(0, toNumber(rawValues.monthlyCarPayment));
  const monthlyStudentLoanPayment = Math.max(0, toNumber(rawValues.monthlyStudentLoanPayment));
  const monthlyCreditCardPayments = Math.max(0, toNumber(rawValues.monthlyCreditCardPayments));
  const monthlyPersonalLoanPayments = Math.max(0, toNumber(rawValues.monthlyPersonalLoanPayments));
  const monthlyChildSupportAlimony = Math.max(0, toNumber(rawValues.monthlyChildSupportAlimony));
  const monthlyOtherDebts = Math.max(0, toNumber(rawValues.monthlyOtherDebts));

  const nonHousingDebtTotal =
    monthlyCarPayment +
    monthlyStudentLoanPayment +
    monthlyCreditCardPayments +
    monthlyPersonalLoanPayments +
    monthlyChildSupportAlimony +
    monthlyOtherDebts;
  const monthlyDebtTotal = housingTotal + nonHousingDebtTotal;

  const frontEndDti = totalMonthlyIncome > 0 ? (housingTotal / totalMonthlyIncome) * 100 : 0;
  const backEndDti = totalMonthlyIncome > 0 ? (monthlyDebtTotal / totalMonthlyIncome) * 100 : 0;

  const targetFrontEndDti = clampNumber(toNumber(rawValues.targetFrontEndDti, 31), 5, 60);
  const targetBackEndDti = clampNumber(toNumber(rawValues.targetBackEndDti, 43), 10, 80);

  const maxTotalDebtAtTarget = totalMonthlyIncome * (targetBackEndDti / 100);
  const maxHousingByFront = totalMonthlyIncome * (targetFrontEndDti / 100);
  const maxHousingByBack = maxTotalDebtAtTarget - nonHousingDebtTotal;
  const maxHousingAtTargets = Math.max(0, Math.min(maxHousingByFront, maxHousingByBack));

  const debtCapacityAtTarget = maxTotalDebtAtTarget - monthlyDebtTotal;
  const debtReductionNeededAtTarget = Math.max(0, -debtCapacityAtTarget);
  const housingHeadroomAtTarget = maxHousingAtTargets - housingTotal;
  const remainingPreTaxIncome = totalMonthlyIncome - monthlyDebtTotal;

  const requiredIncomeFor36 = monthlyDebtTotal > 0 ? (monthlyDebtTotal * 100) / 36 : 0;
  const requiredIncomeFor43 = monthlyDebtTotal > 0 ? (monthlyDebtTotal * 100) / 43 : 0;
  const requiredIncomeFor50 = monthlyDebtTotal > 0 ? (monthlyDebtTotal * 100) / 50 : 0;
  const riskTier = classifyDtiRisk(backEndDti);

  return {
    grossMonthlyIncome,
    coBorrowerMonthlyIncome,
    otherMonthlyIncome,
    totalMonthlyIncome,
    monthlyHousingPayment,
    monthlyPropertyTax,
    monthlyInsuranceHoa,
    housingTotal,
    monthlyCarPayment,
    monthlyStudentLoanPayment,
    monthlyCreditCardPayments,
    monthlyPersonalLoanPayments,
    monthlyChildSupportAlimony,
    monthlyOtherDebts,
    nonHousingDebtTotal,
    monthlyDebtTotal,
    frontEndDti,
    backEndDti,
    targetFrontEndDti,
    targetBackEndDti,
    maxTotalDebtAtTarget,
    maxHousingAtTargets,
    debtCapacityAtTarget,
    debtReductionNeededAtTarget,
    housingHeadroomAtTarget,
    remainingPreTaxIncome,
    requiredIncomeFor36,
    requiredIncomeFor43,
    requiredIncomeFor50,
    riskTier,
  };
}

interface InflationMetrics {
  amount: number;
  annualInflationRate: number;
  years: number;
  inflationMultiplier: number;
  futureCost: number;
  purchasingPower: number;
  purchasingPowerLossPercent: number;
}

function inflationMetrics(rawValues: Record<string, unknown>): InflationMetrics {
  const amount = Math.max(0, toNumber(rawValues.amount));
  const annualInflationRate = Math.max(0, toNumber(rawValues.annualInflationRate)) / 100;
  const years = Math.max(0, toNumber(rawValues.years));
  const inflationMultiplier = Math.pow(1 + annualInflationRate, years);
  const futureCost = amount * inflationMultiplier;
  const purchasingPower = inflationMultiplier > 0 ? amount / inflationMultiplier : amount;
  const purchasingPowerLossPercent = futureCost > 0 ? (1 - amount / futureCost) * 100 : 0;

  return {
    amount,
    annualInflationRate,
    years,
    inflationMultiplier,
    futureCost,
    purchasingPower,
    purchasingPowerLossPercent,
  };
}

interface CurrencyConversionMetrics {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
  exchangeRate: number;
  conversionFeePercent: number;
  grossConverted: number;
  feeAmount: number;
  netConverted: number;
  inverseRate: number;
}

function currencyConversionMetrics(rawValues: Record<string, unknown>): CurrencyConversionMetrics {
  const amount = Math.max(0, toNumber(rawValues.amount));
  const fromCurrency = String(rawValues.fromCurrency ?? "USD");
  const toCurrency = String(rawValues.toCurrency ?? "EUR");
  const exchangeRate = Math.max(0, toNumber(rawValues.exchangeRate, 1));
  const conversionFeePercent = Math.max(0, toNumber(rawValues.conversionFeePercent));
  const feeRate = conversionFeePercent / 100;
  const grossConverted = amount * exchangeRate;
  const feeAmount = grossConverted * feeRate;
  const netConverted = grossConverted - feeAmount;
  const inverseRate = exchangeRate > 0 ? 1 / exchangeRate : 0;

  return {
    amount,
    fromCurrency,
    toCurrency,
    exchangeRate,
    conversionFeePercent,
    grossConverted,
    feeAmount,
    netConverted,
    inverseRate,
  };
}

interface CryptoProfitMetrics {
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  tradingFeePercent: number;
  costBasis: number;
  buyFee: number;
  grossProceeds: number;
  sellFee: number;
  totalCost: number;
  netProceeds: number;
  profit: number;
  roi: number;
  breakEvenSellPrice: number;
}

function cryptoProfitMetrics(rawValues: Record<string, unknown>): CryptoProfitMetrics {
  const buyPrice = Math.max(0, toNumber(rawValues.buyPrice));
  const sellPrice = Math.max(0, toNumber(rawValues.sellPrice));
  const quantity = Math.max(0, toNumber(rawValues.quantity));
  const tradingFeePercent = Math.max(0, toNumber(rawValues.tradingFeePercent));
  const feeRate = tradingFeePercent / 100;
  const costBasis = buyPrice * quantity;
  const buyFee = costBasis * feeRate;
  const grossProceeds = sellPrice * quantity;
  const sellFee = grossProceeds * feeRate;
  const totalCost = costBasis + buyFee;
  const netProceeds = grossProceeds - sellFee;
  const profit = netProceeds - totalCost;
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0;
  const breakEvenSellPrice = feeRate >= 1 ? Number.POSITIVE_INFINITY : buyPrice * ((1 + feeRate) / (1 - feeRate));

  return {
    buyPrice,
    sellPrice,
    quantity,
    tradingFeePercent,
    costBasis,
    buyFee,
    grossProceeds,
    sellFee,
    totalCost,
    netProceeds,
    profit,
    roi,
    breakEvenSellPrice,
  };
}

interface CreditCardPayoffMetrics {
  balance: number;
  apr: number;
  monthlyPayment: number;
  monthlyInterestRate: number;
  minimumToReduceBalance: number;
  monthsToPayoff: number;
  totalPaid: number;
  totalInterest: number;
  isReachable: boolean;
}

function creditCardPayoffMetrics(rawValues: Record<string, unknown>): CreditCardPayoffMetrics {
  const balance = Math.max(0, toNumber(rawValues.balance));
  const apr = Math.max(0, toNumber(rawValues.apr));
  const monthlyPayment = Math.max(0, toNumber(rawValues.monthlyPayment));
  const monthlyInterestRate = apr / 12 / 100;
  const minimumToReduceBalance = balance * monthlyInterestRate;

  if (balance === 0) {
    return {
      balance,
      apr,
      monthlyPayment,
      monthlyInterestRate,
      minimumToReduceBalance,
      monthsToPayoff: 0,
      totalPaid: 0,
      totalInterest: 0,
      isReachable: true,
    };
  }

  if (monthlyPayment <= minimumToReduceBalance) {
    return {
      balance,
      apr,
      monthlyPayment,
      monthlyInterestRate,
      minimumToReduceBalance,
      monthsToPayoff: Number.POSITIVE_INFINITY,
      totalPaid: Number.POSITIVE_INFINITY,
      totalInterest: Number.POSITIVE_INFINITY,
      isReachable: false,
    };
  }

  let currentBalance = balance;
  let monthsToPayoff = 0;
  let totalPaid = 0;
  let totalInterest = 0;
  const maxMonths = 1200;

  while (currentBalance > 0 && monthsToPayoff < maxMonths) {
    const interest = currentBalance * monthlyInterestRate;
    const payment = Math.min(monthlyPayment, currentBalance + interest);
    const principal = payment - interest;
    if (principal <= 0) break;
    currentBalance = Math.max(0, currentBalance + interest - payment);
    totalInterest += interest;
    totalPaid += payment;
    monthsToPayoff += 1;
  }

  const isReachable = currentBalance === 0;
  return {
    balance,
    apr,
    monthlyPayment,
    monthlyInterestRate,
    minimumToReduceBalance,
    monthsToPayoff: isReachable ? monthsToPayoff : Number.POSITIVE_INFINITY,
    totalPaid: isReachable ? totalPaid : Number.POSITIVE_INFINITY,
    totalInterest: isReachable ? totalInterest : Number.POSITIVE_INFINITY,
    isReachable,
  };
}

interface SalaryAfterTaxMetrics {
  annualSalary: number;
  federalTaxRate: number;
  stateTaxRate: number;
  retirementPercent: number;
  monthlyBenefitsCost: number;
  annualTaxes: number;
  annualRetirement: number;
  annualBenefits: number;
  takeHomeAnnual: number;
  takeHomeMonthly: number;
  effectiveDeductionRate: number;
}

function salaryAfterTaxMetrics(rawValues: Record<string, unknown>): SalaryAfterTaxMetrics {
  const annualSalary = Math.max(0, toNumber(rawValues.annualSalary));
  const federalTaxRate = Math.max(0, toNumber(rawValues.federalTaxRate));
  const stateTaxRate = Math.max(0, toNumber(rawValues.stateTaxRate));
  const retirementPercent = Math.max(0, toNumber(rawValues.retirementPercent));
  const monthlyBenefitsCost = Math.max(0, toNumber(rawValues.monthlyBenefitsCost));
  const annualTaxes = annualSalary * ((federalTaxRate + stateTaxRate) / 100);
  const annualRetirement = annualSalary * (retirementPercent / 100);
  const annualBenefits = monthlyBenefitsCost * 12;
  const takeHomeAnnual = annualSalary - annualTaxes - annualRetirement - annualBenefits;
  const takeHomeMonthly = takeHomeAnnual / 12;
  const effectiveDeductionRate =
    annualSalary > 0 ? ((annualTaxes + annualRetirement + annualBenefits) / annualSalary) * 100 : 0;

  return {
    annualSalary,
    federalTaxRate,
    stateTaxRate,
    retirementPercent,
    monthlyBenefitsCost,
    annualTaxes,
    annualRetirement,
    annualBenefits,
    takeHomeAnnual,
    takeHomeMonthly,
    effectiveDeductionRate,
  };
}

interface BodyFatMetrics {
  sex: "male" | "female";
  weightKg: number;
  bodyFatPercent: number;
  fatMassKg: number;
  leanMassKg: number;
  category: string;
}

function bodyFatCategory(sex: "male" | "female", bodyFatPercent: number): string {
  if (sex === "male") {
    if (bodyFatPercent < 6) return "Essential fat";
    if (bodyFatPercent < 14) return "Athlete";
    if (bodyFatPercent < 18) return "Fitness";
    if (bodyFatPercent < 25) return "Average";
    return "High";
  }
  if (bodyFatPercent < 14) return "Essential fat";
  if (bodyFatPercent < 21) return "Athlete";
  if (bodyFatPercent < 25) return "Fitness";
  if (bodyFatPercent < 32) return "Average";
  return "High";
}

function bodyFatMetrics(rawValues: Record<string, unknown>): BodyFatMetrics {
  const sex = String(rawValues.sex ?? "male") === "female" ? "female" : "male";
  const weightKg = Math.max(1, toNumber(rawValues.weightKg));
  const heightCm = Math.max(1, toNumber(rawValues.heightCm));
  const neckCm = Math.max(1, toNumber(rawValues.neckCm));
  const waistCm = Math.max(1, toNumber(rawValues.waistCm));
  const hipCm = Math.max(1, toNumber(rawValues.hipCm));
  const heightIn = heightCm / 2.54;
  const neckIn = neckCm / 2.54;
  const waistIn = waistCm / 2.54;
  const hipIn = hipCm / 2.54;

  let bodyFatPercent = 0;
  if (sex === "male") {
    const value = waistIn - neckIn;
    bodyFatPercent = value > 0 ? 86.01 * Math.log10(value) - 70.041 * Math.log10(heightIn) + 36.76 : 0;
  } else {
    const value = waistIn + hipIn - neckIn;
    bodyFatPercent = value > 0 ? 163.205 * Math.log10(value) - 97.684 * Math.log10(heightIn) - 78.387 : 0;
  }

  bodyFatPercent = Math.max(2, Math.min(75, bodyFatPercent));
  const fatMassKg = weightKg * (bodyFatPercent / 100);
  const leanMassKg = weightKg - fatMassKg;
  const category = bodyFatCategory(sex, bodyFatPercent);

  return { sex, weightKg, bodyFatPercent, fatMassKg, leanMassKg, category };
}

interface PregnancyMetrics {
  isValid: boolean;
  lmpDate: Date | null;
  conceptionDate: Date | null;
  dueDate: Date | null;
  cycleLengthDays: number;
  gestationDays: number;
  weeksPregnant: number;
  daysPregnant: number;
  daysUntilDue: number;
  trimester: string;
}

function pregnancyMetrics(rawValues: Record<string, unknown>): PregnancyMetrics {
  const lmpRaw = String(rawValues.lmpDate ?? "").trim();
  const cycleLengthDays = Math.max(20, Math.min(45, Math.round(toNumber(rawValues.cycleLengthDays, 28))));
  const lmpDate = new Date(`${lmpRaw}T00:00:00`);
  if (!lmpRaw || Number.isNaN(lmpDate.getTime())) {
    return {
      isValid: false,
      lmpDate: null,
      conceptionDate: null,
      dueDate: null,
      cycleLengthDays,
      gestationDays: 0,
      weeksPregnant: 0,
      daysPregnant: 0,
      daysUntilDue: 0,
      trimester: "Not available",
    };
  }

  const cycleAdjustment = cycleLengthDays - 28;
  const conceptionDate = new Date(lmpDate);
  conceptionDate.setDate(conceptionDate.getDate() + 14 + cycleAdjustment);

  const dueDate = new Date(lmpDate);
  dueDate.setDate(dueDate.getDate() + 280 + cycleAdjustment);

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gestationDays = Math.max(0, Math.floor((today.getTime() - lmpDate.getTime()) / MS_PER_DAY));
  const weeksPregnant = Math.floor(gestationDays / 7);
  const daysPregnant = gestationDays % 7;
  const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / MS_PER_DAY);

  let trimester = "First trimester";
  if (gestationDays >= 27 * 7) trimester = "Third trimester";
  else if (gestationDays >= 13 * 7) trimester = "Second trimester";

  return {
    isValid: true,
    lmpDate,
    conceptionDate,
    dueDate,
    cycleLengthDays,
    gestationDays,
    weeksPregnant,
    daysPregnant,
    daysUntilDue,
    trimester,
  };
}

interface AgeMetrics {
  isValid: boolean;
  isFutureBirthDate: boolean;
  birthDate: Date | null;
  asOfDate: Date;
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  nextBirthday: Date | null;
  daysUntilNextBirthday: number;
}

function ageMetrics(rawValues: Record<string, unknown>): AgeMetrics {
  const birthDate = parseDateInput(rawValues.birthDate);
  const explicitAsOfDate = parseDateInput(rawValues.asOfDate);
  const now = new Date();
  const asOfDate =
    explicitAsOfDate ?? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);

  if (!birthDate) {
    return {
      isValid: false,
      isFutureBirthDate: false,
      birthDate: null,
      asOfDate,
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
      totalWeeks: 0,
      totalMonths: 0,
      nextBirthday: null,
      daysUntilNextBirthday: 0,
    };
  }

  const totalDaysRaw = toUtcDayNumber(asOfDate) - toUtcDayNumber(birthDate);
  if (totalDaysRaw < 0) {
    return {
      isValid: false,
      isFutureBirthDate: true,
      birthDate,
      asOfDate,
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
      totalWeeks: 0,
      totalMonths: 0,
      nextBirthday: null,
      daysUntilNextBirthday: 0,
    };
  }

  let years = asOfDate.getFullYear() - birthDate.getFullYear();
  let months = asOfDate.getMonth() - birthDate.getMonth();
  let days = asOfDate.getDate() - birthDate.getDate();

  if (days < 0) {
    const daysInPreviousMonth = new Date(asOfDate.getFullYear(), asOfDate.getMonth(), 0).getDate();
    days += daysInPreviousMonth;
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const totalDays = Math.max(0, totalDaysRaw);
  const totalWeeks = totalDays / 7;
  const totalMonths = years * 12 + months + days / 30.4375;

  let nextBirthday = resolveBirthdayInYear(birthDate, asOfDate.getFullYear());
  if (toUtcDayNumber(nextBirthday) < toUtcDayNumber(asOfDate)) {
    nextBirthday = resolveBirthdayInYear(birthDate, asOfDate.getFullYear() + 1);
  }

  return {
    isValid: true,
    isFutureBirthDate: false,
    birthDate,
    asOfDate,
    years,
    months,
    days,
    totalDays,
    totalWeeks,
    totalMonths,
    nextBirthday,
    daysUntilNextBirthday: Math.max(0, toUtcDayNumber(nextBirthday) - toUtcDayNumber(asOfDate)),
  };
}

interface DateDifferenceMetrics {
  isValid: boolean;
  startDate: Date | null;
  endDate: Date | null;
  orderedStart: Date | null;
  orderedEnd: Date | null;
  includeEndDate: boolean;
  wasReversed: boolean;
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  businessDays: number;
  weekendDays: number;
}

interface CalendarDifference {
  years: number;
  months: number;
  days: number;
}

function calculateCalendarDifference(startDate: Date, endDate: Date): CalendarDifference {
  let years = endDate.getFullYear() - startDate.getFullYear();
  let months = endDate.getMonth() - startDate.getMonth();
  let days = endDate.getDate() - startDate.getDate();

  if (days < 0) {
    const daysInPreviousMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 0).getDate();
    days += daysInPreviousMonth;
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return {
    years: Math.max(0, years),
    months: Math.max(0, months),
    days: Math.max(0, days),
  };
}

function countBusinessDays(startDate: Date, endDate: Date, includeEndDate: boolean): number {
  const startDayNumber = toUtcDayNumber(startDate);
  const endDayNumber = toUtcDayNumber(endDate);
  const lastDayNumber = includeEndDate ? endDayNumber : endDayNumber - 1;
  if (lastDayNumber < startDayNumber) return 0;

  let businessDays = 0;
  for (let dayNumber = startDayNumber; dayNumber <= lastDayNumber; dayNumber += 1) {
    const weekDay = new Date(dayNumber * MS_PER_DAY).getUTCDay();
    if (weekDay !== 0 && weekDay !== 6) {
      businessDays += 1;
    }
  }

  return businessDays;
}

function dateDifferenceMetrics(rawValues: Record<string, unknown>): DateDifferenceMetrics {
  const startDate = parseDateInput(rawValues.startDate);
  const endDate = parseDateInput(rawValues.endDate);
  const includeEndDate = String(rawValues.includeEndDate ?? "no").trim().toLowerCase() === "yes";

  if (!startDate || !endDate) {
    return {
      isValid: false,
      startDate,
      endDate,
      orderedStart: null,
      orderedEnd: null,
      includeEndDate,
      wasReversed: false,
      years: 0,
      months: 0,
      days: 0,
      totalDays: 0,
      totalWeeks: 0,
      totalMonths: 0,
      businessDays: 0,
      weekendDays: 0,
    };
  }

  const startDayNumber = toUtcDayNumber(startDate);
  const endDayNumber = toUtcDayNumber(endDate);
  const wasReversed = startDayNumber > endDayNumber;
  const orderedStart = wasReversed ? endDate : startDate;
  const orderedEnd = wasReversed ? startDate : endDate;

  const baseDayDifference = toUtcDayNumber(orderedEnd) - toUtcDayNumber(orderedStart);
  const totalDays = Math.max(0, baseDayDifference + (includeEndDate ? 1 : 0));
  const adjustedEndDate = includeEndDate
    ? new Date(orderedEnd.getFullYear(), orderedEnd.getMonth(), orderedEnd.getDate() + 1, 12)
    : orderedEnd;
  const calendarDifference = calculateCalendarDifference(orderedStart, adjustedEndDate);
  const businessDays = countBusinessDays(orderedStart, orderedEnd, includeEndDate);
  const weekendDays = Math.max(0, totalDays - businessDays);

  return {
    isValid: true,
    startDate,
    endDate,
    orderedStart,
    orderedEnd,
    includeEndDate,
    wasReversed,
    years: calendarDifference.years,
    months: calendarDifference.months,
    days: calendarDifference.days,
    totalDays,
    totalWeeks: totalDays / 7,
    totalMonths: calendarDifference.years * 12 + calendarDifference.months + calendarDifference.days / 30.4375,
    businessDays,
    weekendDays,
  };
}

interface StartupCostMetrics {
  oneTimeCosts: number;
  monthlyBurn: number;
  runwayMonths: number;
  contingencyPercent: number;
  runwayCost: number;
  subtotal: number;
  contingencyAmount: number;
  targetCapital: number;
}

function startupCostMetrics(rawValues: Record<string, unknown>): StartupCostMetrics {
  const oneTimeCosts = Math.max(0, toNumber(rawValues.oneTimeCosts));
  const monthlyBurn = Math.max(0, toNumber(rawValues.monthlyBurn));
  const runwayMonths = Math.max(1, Math.round(toNumber(rawValues.runwayMonths, 12)));
  const contingencyPercent = Math.max(0, toNumber(rawValues.contingencyPercent));
  const runwayCost = monthlyBurn * runwayMonths;
  const subtotal = oneTimeCosts + runwayCost;
  const contingencyAmount = subtotal * (contingencyPercent / 100);
  const targetCapital = subtotal + contingencyAmount;

  return {
    oneTimeCosts,
    monthlyBurn,
    runwayMonths,
    contingencyPercent,
    runwayCost,
    subtotal,
    contingencyAmount,
    targetCapital,
  };
}

export function getLoanAmortizationSchedule(rawValues: Record<string, unknown>): LoanAmortizationRow[] {
  const metrics = loanMetrics(rawValues);
  const rows: LoanAmortizationRow[] = [];
  let balance = metrics.principal;

  for (let period = 1; period <= metrics.months; period += 1) {
    const interest = metrics.monthlyRate === 0 ? 0 : balance * metrics.monthlyRate;
    let principal = metrics.emi - interest;
    if (period === metrics.months || principal > balance) {
      principal = balance;
    }
    const payment = principal + interest;
    balance = Math.max(0, balance - principal);

    rows.push({
      period,
      payment,
      principal,
      interest,
      balance,
    });
  }

  return rows;
}

export function getCompoundGrowthTimeline(rawValues: Record<string, unknown>): GrowthTimelineRow[] {
  const metrics = compoundMetrics(rawValues);
  const months = Math.max(1, Math.round(metrics.years * 12));
  const rows: GrowthTimelineRow[] = [];

  for (let month = 0; month <= months; month += 1) {
    if (month !== 0 && month !== months && month % 12 !== 0) continue;
    const periodYears = month / 12;
    const value =
      metrics.principal *
      Math.pow(1 + metrics.annualRate / metrics.compoundsPerYear, metrics.compoundsPerYear * periodYears);
    rows.push({
      periodYears,
      value,
      gain: value - metrics.principal,
    });
  }

  return rows;
}

export function getSavingsGoalTimeline(rawValues: Record<string, unknown>): SavingsTimelineRow[] {
  const metrics = savingsGoalMetrics(rawValues);
  const rows: SavingsTimelineRow[] = [];
  let balance = metrics.currentSavings;
  let contributed = metrics.currentSavings;

  rows.push({
    periodYears: 0,
    accountValue: balance,
    contributed,
    growth: balance - contributed,
  });

  for (let month = 1; month <= metrics.months; month += 1) {
    balance *= 1 + metrics.monthlyRate;
    balance += metrics.monthlyContribution;
    contributed += metrics.monthlyContribution;

    if (month === metrics.months || month % 12 === 0) {
      rows.push({
        periodYears: month / 12,
        accountValue: balance,
        contributed,
        growth: balance - contributed,
      });
    }
  }

  return rows;
}

export function getBreakEvenScenarios(rawValues: Record<string, unknown>): BreakEvenScenarioRow[] {
  const fixedCosts = Math.max(0, toNumber(rawValues.fixedCosts));
  const variableCost = Math.max(0, toNumber(rawValues.variableCostPerUnit));
  const unitPrice = Math.max(0, toNumber(rawValues.unitPrice));
  const multipliers = [0.9, 1, 1.1, 1.2];

  return multipliers.map((multiplier) => {
    const price = unitPrice * multiplier;
    const contributionPerUnit = price - variableCost;
    const units = contributionPerUnit <= 0 ? Number.POSITIVE_INFINITY : fixedCosts / contributionPerUnit;
    return {
      unitPrice: price,
      contributionPerUnit,
      units,
      revenue: Number.isFinite(units) ? units * price : Number.POSITIVE_INFINITY,
    };
  });
}

export function getDtiAffordabilityScenarios(rawValues: Record<string, unknown>): DtiAffordabilityScenarioRow[] {
  const metrics = dtiMetrics(rawValues);
  const targets: Array<{ label: string; frontEndLimit: number; backEndLimit: number }> = [
    { label: "Conservative", frontEndLimit: 25, backEndLimit: 35 },
    { label: "Standard", frontEndLimit: 28, backEndLimit: 36 },
    { label: "Flexible", frontEndLimit: 31, backEndLimit: 43 },
    { label: "Aggressive", frontEndLimit: 33, backEndLimit: 50 },
  ];

  if (metrics.totalMonthlyIncome <= 0) {
    return targets.map((target) => ({
      ...target,
      maxHousingPayment: 0,
      maxTotalDebt: 0,
      headroom: -metrics.housingTotal,
      constraint: "Income",
    }));
  }

  return targets.map((target) => {
    const maxTotalDebt = metrics.totalMonthlyIncome * (target.backEndLimit / 100);
    const maxHousingByFront = metrics.totalMonthlyIncome * (target.frontEndLimit / 100);
    const maxHousingByBack = maxTotalDebt - metrics.nonHousingDebtTotal;
    const maxHousingPayment = Math.max(0, Math.min(maxHousingByFront, maxHousingByBack));
    const constraint = maxHousingByFront <= maxHousingByBack ? "Front-end" : "Back-end";
    return {
      ...target,
      maxHousingPayment,
      maxTotalDebt,
      headroom: maxHousingPayment - metrics.housingTotal,
      constraint,
    };
  });
}

export function getCalculatorInsights(
  id: CalculatorId,
  rawValues: Record<string, unknown>,
  options?: CalculatorOutputOptions,
): string[] {
  const currency = resolveDisplayCurrency(options);
  const formatMoney = (value: number): string => formatMoneyValue(value, currency);

  switch (id) {
    case "loan-emi-calculator": {
      const metrics = loanMetrics(rawValues);
      const interestShare = metrics.totalPayment === 0 ? 0 : (metrics.totalInterest / metrics.totalPayment) * 100;
      return [
        `Interest share of total payment: ${formatPercent(interestShare)}.`,
        `Every 1% rate increase can significantly raise lifetime cost on long tenures.`,
      ];
    }
    case "auto-loan-calculator": {
      const metrics = autoLoanMetrics(rawValues);
      const interestShare = metrics.totalPayment === 0 ? 0 : (metrics.totalInterest / metrics.totalPayment) * 100;
      return [
        `Out-the-door price: ${formatMoney(metrics.outTheDoorPrice)} with financed amount ${formatMoney(metrics.financedAmount)}.`,
        `Interest share of loan payments: ${formatPercent(interestShare)}. Loan-to-value: ${formatPercent(metrics.loanToValue)}.`,
      ];
    }
    case "mortgage-calculator": {
      const metrics = mortgageMetrics(rawValues);
      return [
        `Down payment ratio: ${formatPercent(metrics.downPaymentPercent)} of home price.`,
        `Monthly principal+interest: ${formatMoney(metrics.principalAndInterest)}. Total housing payment: ${formatMoney(metrics.totalMonthlyPayment)}.`,
      ];
    }
    case "debt-to-income-calculator": {
      const metrics = dtiMetrics(rawValues);
      if (metrics.totalMonthlyIncome <= 0) {
        return [
          "Enter gross monthly income to calculate front-end and back-end DTI.",
          "Lenders usually compare housing DTI and total DTI before approving new credit.",
        ];
      }
      const debtCapacityInsight =
        metrics.debtCapacityAtTarget >= 0
          ? `At target ${formatPercent(metrics.targetBackEndDti)} back-end DTI, you have ${formatMoney(metrics.debtCapacityAtTarget)} monthly debt capacity remaining.`
          : `To hit target ${formatPercent(metrics.targetBackEndDti)} back-end DTI, reduce monthly debt by ${formatMoney(metrics.debtReductionNeededAtTarget)}.`;
      const housingHeadroomInsight =
        metrics.housingHeadroomAtTarget >= 0
          ? `Housing payment headroom at ${formatPercent(metrics.targetFrontEndDti)}/${formatPercent(metrics.targetBackEndDti)} targets: ${formatMoney(metrics.housingHeadroomAtTarget)}.`
          : `Current housing costs are ${formatMoney(Math.abs(metrics.housingHeadroomAtTarget))} above target affordability.`;
      return [
        `Front-end DTI: ${formatPercent(metrics.frontEndDti)}. Back-end DTI: ${formatPercent(metrics.backEndDti)} (${metrics.riskTier}).`,
        debtCapacityInsight,
        housingHeadroomInsight,
      ];
    }
    case "compound-interest-calculator": {
      const metrics = compoundMetrics(rawValues);
      const cagr =
        metrics.principal > 0 && metrics.years > 0
          ? (Math.pow(metrics.amount / metrics.principal, 1 / metrics.years) - 1) * 100
          : 0;
      return [
        `Effective annual growth rate (CAGR): ${formatPercent(cagr)}.`,
        "Longer time horizon usually beats trying to time markets for most investors.",
      ];
    }
    case "inflation-calculator": {
      const metrics = inflationMetrics(rawValues);
      return [
        `Inflation multiplier over ${formatNumber(metrics.years)} years: ${formatNumber(metrics.inflationMultiplier)}x.`,
        `Purchasing power erosion: ${formatPercent(metrics.purchasingPowerLossPercent)}.`,
      ];
    }
    case "currency-converter-calculator": {
      const metrics = currencyConversionMetrics(rawValues);
      return [
        `Using rate 1 ${metrics.fromCurrency} = ${formatNumber(metrics.exchangeRate)} ${metrics.toCurrency}.`,
        `Net converted after ${formatPercent(metrics.conversionFeePercent)} fee: ${formatNumber(metrics.netConverted)} ${metrics.toCurrency}.`,
      ];
    }
    case "crypto-profit-calculator": {
      const metrics = cryptoProfitMetrics(rawValues);
      return [
        `Trade ROI after fees: ${formatPercent(metrics.roi)}.`,
        Number.isFinite(metrics.breakEvenSellPrice)
          ? `Break-even sell price: ${formatMoney(metrics.breakEvenSellPrice)}.`
          : "Break-even sell price is not reachable with current fee setup.",
      ];
    }
    case "credit-card-payoff-calculator": {
      const metrics = creditCardPayoffMetrics(rawValues);
      return metrics.isReachable
        ? [
            `Payoff time at current payment: ${formatNumber(metrics.monthsToPayoff)} months.`,
            `Total interest paid: ${formatMoney(metrics.totalInterest)}.`,
          ]
        : [
            "Current payment is too low to reduce principal.",
            `Pay more than ${formatMoney(metrics.minimumToReduceBalance)} per month to start reducing balance.`,
          ];
    }
    case "salary-after-tax-calculator": {
      const metrics = salaryAfterTaxMetrics(rawValues);
      return [
        `Estimated effective deductions: ${formatPercent(metrics.effectiveDeductionRate)}.`,
        `Estimated monthly take-home: ${formatMoney(metrics.takeHomeMonthly)}.`,
      ];
    }
    case "roi-calculator": {
      const investment = Math.max(0, toNumber(rawValues.investment));
      const returns = Math.max(0, toNumber(rawValues.returns));
      const multiple = investment > 0 ? returns / investment : 0;
      return [`Capital multiple: ${formatNumber(multiple)}x.`, "Track ROI alongside payback time, not in isolation."];
    }
    case "age-calculator": {
      const metrics = ageMetrics(rawValues);
      if (!metrics.isValid) {
        return metrics.isFutureBirthDate
          ? ["Birth date cannot be later than the As of date.", "Adjust the date inputs to calculate age."]
          : ["Enter a valid birth date to calculate age.", "You can leave As of date empty to use today."];
      }
      return [
        `Exact age: ${metrics.years} years ${metrics.months} months ${metrics.days} days.`,
        metrics.nextBirthday
          ? `Next birthday: ${formatDate(metrics.nextBirthday)} (${formatNumber(metrics.daysUntilNextBirthday)} days left).`
          : "Next birthday information is not available.",
      ];
    }
    case "date-difference-calculator": {
      const metrics = dateDifferenceMetrics(rawValues);
      if (!metrics.isValid) {
        return [
          "Enter valid start and end dates to calculate the difference.",
          "Use Inclusive mode when you want to count both start and end dates.",
        ];
      }
      return [
        `Exact difference: ${metrics.years} years ${metrics.months} months ${metrics.days} days.`,
        metrics.wasReversed
          ? "Start date is after end date. Results are shown as absolute difference."
          : `Business-day span: ${formatNumber(metrics.businessDays)} days.`,
      ];
    }
    case "bmi-calculator": {
      const heightCm = Math.max(1, toNumber(rawValues.heightCm));
      const heightM = heightCm / 100;
      const minHealthy = 18.5 * heightM * heightM;
      const maxHealthy = 24.9 * heightM * heightM;
      return [
        `Healthy weight range for your height: ${formatNumber(minHealthy)} - ${formatNumber(maxHealthy)} kg.`,
        "BMI is directional; combine it with waist and body-fat context for better decisions.",
      ];
    }
    case "body-fat-calculator": {
      const metrics = bodyFatMetrics(rawValues);
      return [
        `Estimated body fat category: ${metrics.category}.`,
        `Estimated lean mass: ${formatNumber(metrics.leanMassKg)} kg.`,
      ];
    }
    case "savings-goal-calculator": {
      const metrics = savingsGoalMetrics(rawValues);
      const projectedContribution =
        metrics.monthlyRate > 0
          ? metrics.monthlyContribution * ((Math.pow(1 + metrics.monthlyRate, metrics.months) - 1) / metrics.monthlyRate)
          : metrics.monthlyContribution * metrics.months;
      const projected = metrics.futureCurrent + projectedContribution;
      return [
        `Estimated monthly contribution needed: ${formatMoney(metrics.monthlyContribution)}.`,
        `Projected account value with your plan: ${formatMoney(projected)}.`,
      ];
    }
    case "break-even-calculator": {
      const fixedCosts = Math.max(0, toNumber(rawValues.fixedCosts));
      const variableCost = Math.max(0, toNumber(rawValues.variableCostPerUnit));
      const unitPrice = Math.max(0, toNumber(rawValues.unitPrice));
      const contribution = unitPrice - variableCost;
      return [
        `Contribution per unit: ${formatMoney(contribution)}.`,
        fixedCosts > 0 && contribution > 0
          ? `You need ${formatNumber(fixedCosts / contribution)} unit sales to cover fixed costs.`
          : "Increase contribution margin to reach break-even.",
      ];
    }
    case "pregnancy-due-date-calculator": {
      const metrics = pregnancyMetrics(rawValues);
      return metrics.isValid && metrics.dueDate
        ? [
            `Estimated due date: ${formatDate(metrics.dueDate)}.`,
            `Current stage: ${metrics.trimester} (${metrics.weeksPregnant} weeks ${metrics.daysPregnant} days).`,
          ]
        : ["Enter a valid LMP date to calculate due date.", "Cycle length helps tune estimate for non-28 day cycles."];
    }
    case "startup-cost-estimator": {
      const metrics = startupCostMetrics(rawValues);
      return [
        `Runway operating cost: ${formatMoney(metrics.runwayCost)}.`,
        `Recommended capital target with buffer: ${formatMoney(metrics.targetCapital)}.`,
      ];
    }
    case "markup-calculator": {
      const cost = Math.max(0, toNumber(rawValues.cost));
      const markupPercent = Math.max(0, toNumber(rawValues.markupPercent));
      const price = cost * (1 + markupPercent / 100);
      const margin = price === 0 ? 0 : ((price - cost) / price) * 100;
      return [
        `Selling price at target markup: ${formatMoney(price)}.`,
        `Resulting margin: ${formatPercent(margin)}.`,
      ];
    }
    case "freelance-rate-calculator": {
      const targetIncome = Math.max(0, toNumber(rawValues.targetMonthlyIncome));
      const monthlyExpenses = Math.max(0, toNumber(rawValues.monthlyExpenses));
      const billableHours = Math.max(1, toNumber(rawValues.billableHoursPerMonth, 80));
      const desiredProfitPercent = Math.max(0, toNumber(rawValues.desiredProfitPercent, 20)) / 100;
      const requiredRevenue = (targetIncome + monthlyExpenses) * (1 + desiredProfitPercent);
      const hourly = requiredRevenue / billableHours;
      return [
        `Target day rate (8h): ${formatMoney(hourly * 8)}.`,
        "Protect margins by limiting unbilled admin and revision time.",
      ];
    }
    default:
      return ["Adjust inputs to explore scenarios and compare outcomes."];
  }
}

export function runCalculator(
  id: CalculatorId,
  rawValues: Record<string, unknown>,
  options?: CalculatorOutputOptions,
): ResultRow[] {
  const currency = resolveDisplayCurrency(options);
  const formatMoney = (value: number): string => formatMoneyValue(value, currency);

  switch (id) {
    case "loan-emi-calculator": {
      const metrics = loanMetrics(rawValues);
      const interestShare = metrics.totalPayment === 0 ? 0 : (metrics.totalInterest / metrics.totalPayment) * 100;
      return [
        { label: "Monthly EMI", value: formatMoney(metrics.emi) },
        { label: "Total Payment", value: formatMoney(metrics.totalPayment) },
        { label: "Total Interest", value: formatMoney(metrics.totalInterest) },
        { label: "Interest Share", value: formatPercent(interestShare) },
      ];
    }
    case "auto-loan-calculator": {
      const metrics = autoLoanMetrics(rawValues);
      return [
        { label: "Out-the-door Price", value: formatMoney(metrics.outTheDoorPrice) },
        { label: "Financed Amount", value: formatMoney(metrics.financedAmount) },
        { label: "Monthly Auto Payment", value: formatMoney(metrics.monthlyPayment) },
        { label: "Total of Loan Payments", value: formatMoney(metrics.totalPayment) },
        { label: "Total Interest", value: formatMoney(metrics.totalInterest) },
        { label: "Total Vehicle Cost", value: formatMoney(metrics.totalCost) },
        { label: "Loan-to-Value", value: formatPercent(metrics.loanToValue) },
      ];
    }
    case "mortgage-calculator": {
      const metrics = mortgageMetrics(rawValues);
      return [
        { label: "Loan Amount", value: formatMoney(metrics.loanAmount) },
        { label: "Monthly Principal + Interest", value: formatMoney(metrics.principalAndInterest) },
        { label: "Estimated Total Monthly Housing", value: formatMoney(metrics.totalMonthlyPayment) },
        {
          label: "Monthly Taxes + Insurance + HOA",
          value: formatMoney(metrics.monthlyPropertyTax + metrics.monthlyInsurance + metrics.monthlyHoa),
        },
        { label: "Total Interest (Loan Term)", value: formatMoney(metrics.totalInterest) },
      ];
    }
    case "debt-to-income-calculator": {
      const metrics = dtiMetrics(rawValues);
      if (metrics.totalMonthlyIncome <= 0) {
        return [
          { label: "Status", value: "Enter gross monthly income" },
          { label: "Tip", value: "Include all recurring debt payments to get a realistic DTI result." },
        ];
      }

      return [
        { label: "Total Gross Monthly Income", value: formatMoney(metrics.totalMonthlyIncome) },
        { label: "Housing-related Debt", value: formatMoney(metrics.housingTotal) },
        { label: "Non-housing Debt", value: formatMoney(metrics.nonHousingDebtTotal) },
        { label: "Total Monthly Debt Payments", value: formatMoney(metrics.monthlyDebtTotal) },
        { label: "Front-end DTI (Housing)", value: formatPercent(metrics.frontEndDti) },
        { label: "Back-end DTI (Total)", value: formatPercent(metrics.backEndDti) },
        { label: "DTI Risk Tier", value: metrics.riskTier },
        { label: "Remaining Pre-tax Income", value: formatMoney(metrics.remainingPreTaxIncome) },
        {
          label: `Max Total Debt @ ${formatPercent(metrics.targetBackEndDti)}`,
          value: formatMoney(metrics.maxTotalDebtAtTarget),
        },
        {
          label: metrics.debtCapacityAtTarget >= 0 ? "Additional Debt Capacity" : "Debt Reduction Needed",
          value: formatMoney(Math.abs(metrics.debtCapacityAtTarget)),
        },
        {
          label: `Max Housing @ ${formatPercent(metrics.targetFrontEndDti)}/${formatPercent(metrics.targetBackEndDti)}`,
          value: formatMoney(metrics.maxHousingAtTargets),
        },
        { label: "Income Needed for 36% Back-end DTI", value: formatMoney(metrics.requiredIncomeFor36) },
      ];
    }
    case "compound-interest-calculator": {
      const metrics = compoundMetrics(rawValues);
      const growthMultiple = metrics.principal > 0 ? metrics.amount / metrics.principal : 0;
      const cagr =
        metrics.principal > 0 && metrics.years > 0
          ? (Math.pow(metrics.amount / metrics.principal, 1 / metrics.years) - 1) * 100
          : 0;
      return [
        { label: "Final Amount", value: formatMoney(metrics.amount) },
        { label: "Interest Earned", value: formatMoney(metrics.interest) },
        { label: "Growth Multiple", value: `${formatNumber(growthMultiple)}x` },
        { label: "CAGR", value: formatPercent(cagr) },
      ];
    }
    case "simple-interest-calculator": {
      const principal = Math.max(0, toNumber(rawValues.principal));
      const annualRate = Math.max(0, toNumber(rawValues.annualRate));
      const years = Math.max(0, toNumber(rawValues.years));
      const interest = (principal * annualRate * years) / 100;
      const total = principal + interest;

      return [
        { label: "Interest", value: formatMoney(interest) },
        { label: "Total Amount", value: formatMoney(total) },
        { label: "Annual Interest", value: formatMoney(years > 0 ? interest / years : interest) },
      ];
    }
    case "inflation-calculator": {
      const metrics = inflationMetrics(rawValues);
      return [
        { label: "Current Amount", value: formatMoney(metrics.amount) },
        { label: "Inflation-adjusted Future Cost", value: formatMoney(metrics.futureCost) },
        { label: "Future Purchasing Power (in today's money)", value: formatMoney(metrics.purchasingPower) },
        { label: "Purchasing Power Loss", value: formatPercent(metrics.purchasingPowerLossPercent) },
      ];
    }
    case "currency-converter-calculator": {
      const metrics = currencyConversionMetrics(rawValues);
      return [
        { label: "Gross Converted", value: `${formatNumber(metrics.grossConverted)} ${metrics.toCurrency}` },
        { label: "Fee Amount", value: `${formatNumber(metrics.feeAmount)} ${metrics.toCurrency}` },
        { label: "Net Converted", value: `${formatNumber(metrics.netConverted)} ${metrics.toCurrency}` },
        {
          label: "Inverse Rate",
          value: metrics.inverseRate > 0 ? `1 ${metrics.toCurrency} = ${formatNumber(metrics.inverseRate)} ${metrics.fromCurrency}` : "Not available",
        },
      ];
    }
    case "crypto-profit-calculator": {
      const metrics = cryptoProfitMetrics(rawValues);
      return [
        { label: "Total Cost (incl. buy fee)", value: formatMoney(metrics.totalCost) },
        { label: "Net Proceeds (after sell fee)", value: formatMoney(metrics.netProceeds) },
        { label: "Net Profit", value: formatMoney(metrics.profit) },
        { label: "ROI", value: formatPercent(metrics.roi) },
        {
          label: "Break-even Sell Price",
          value: Number.isFinite(metrics.breakEvenSellPrice) ? formatMoney(metrics.breakEvenSellPrice) : "Not reachable",
        },
      ];
    }
    case "credit-card-payoff-calculator": {
      const metrics = creditCardPayoffMetrics(rawValues);
      if (!metrics.isReachable) {
        return [
          { label: "Payoff Status", value: "Payment too low to reduce balance" },
          { label: "Minimum to Start Reducing", value: formatMoney(metrics.minimumToReduceBalance + 1) },
          { label: "Current Monthly Interest", value: formatMoney(metrics.minimumToReduceBalance) },
        ];
      }

      const payoffYears = Math.floor(metrics.monthsToPayoff / 12);
      const payoffMonths = metrics.monthsToPayoff % 12;
      return [
        { label: "Payoff Time", value: `${payoffYears} years ${payoffMonths} months` },
        { label: "Total Interest Paid", value: formatMoney(metrics.totalInterest) },
        { label: "Total Paid", value: formatMoney(metrics.totalPaid) },
        { label: "Average Monthly Interest", value: formatMoney(metrics.monthsToPayoff > 0 ? metrics.totalInterest / metrics.monthsToPayoff : 0) },
      ];
    }
    case "salary-after-tax-calculator": {
      const metrics = salaryAfterTaxMetrics(rawValues);
      return [
        { label: "Net Annual Take-home", value: formatMoney(metrics.takeHomeAnnual) },
        { label: "Net Monthly Take-home", value: formatMoney(metrics.takeHomeMonthly) },
        { label: "Estimated Annual Taxes", value: formatMoney(metrics.annualTaxes) },
        { label: "Effective Deduction Rate", value: formatPercent(metrics.effectiveDeductionRate) },
      ];
    }
    case "roi-calculator": {
      const investment = Math.max(0, toNumber(rawValues.investment));
      const returns = Math.max(0, toNumber(rawValues.returns));
      const profit = returns - investment;
      const roi = investment === 0 ? 0 : (profit / investment) * 100;
      const multiple = investment === 0 ? 0 : returns / investment;

      return [
        { label: "Net Profit", value: formatMoney(profit) },
        { label: "ROI", value: formatPercent(roi) },
        { label: "Capital Multiple", value: `${formatNumber(multiple)}x` },
      ];
    }
    case "profit-margin-calculator": {
      const revenue = Math.max(0, toNumber(rawValues.revenue));
      const cost = Math.max(0, toNumber(rawValues.cost));
      const profit = revenue - cost;
      const margin = revenue === 0 ? 0 : (profit / revenue) * 100;
      const markup = cost === 0 ? 0 : (profit / cost) * 100;

      return [
        { label: "Profit", value: formatMoney(profit) },
        { label: "Profit Margin", value: formatPercent(margin) },
        { label: "Markup", value: formatPercent(markup) },
      ];
    }
    case "markup-calculator": {
      const cost = Math.max(0, toNumber(rawValues.cost));
      const markupPercent = Math.max(0, toNumber(rawValues.markupPercent));
      const sellingPrice = cost * (1 + markupPercent / 100);
      const grossProfit = sellingPrice - cost;
      const margin = sellingPrice === 0 ? 0 : (grossProfit / sellingPrice) * 100;

      return [
        { label: "Selling Price", value: formatMoney(sellingPrice) },
        { label: "Gross Profit", value: formatMoney(grossProfit) },
        { label: "Resulting Margin", value: formatPercent(margin) },
      ];
    }
    case "vat-calculator": {
      const amount = Math.max(0, toNumber(rawValues.amount));
      const vatRate = Math.max(0, toNumber(rawValues.vatRate));
      const vatAmount = amount * (vatRate / 100);
      const totalWithVat = amount + vatAmount;

      return [
        { label: "Base Amount", value: formatMoney(amount) },
        { label: "VAT Amount", value: formatMoney(vatAmount) },
        { label: "Total (Incl. VAT)", value: formatMoney(totalWithVat) },
      ];
    }
    case "age-calculator": {
      const metrics = ageMetrics(rawValues);
      if (!metrics.isValid) {
        return [
          { label: "Status", value: metrics.isFutureBirthDate ? "Birth date cannot be in the future" : "Enter a valid birth date" },
          { label: "Tip", value: "Leave As of date empty to calculate age as of today." },
        ];
      }

      return [
        { label: "Exact Age", value: `${metrics.years} years ${metrics.months} months ${metrics.days} days` },
        { label: "As of Date", value: formatDate(metrics.asOfDate) },
        { label: "Total Months (approx.)", value: formatNumber(metrics.totalMonths) },
        { label: "Total Weeks (approx.)", value: formatNumber(metrics.totalWeeks) },
        { label: "Total Days", value: formatNumber(metrics.totalDays) },
        { label: "Next Birthday", value: metrics.nextBirthday ? formatDate(metrics.nextBirthday) : "Not available" },
        { label: "Days Until Next Birthday", value: formatNumber(metrics.daysUntilNextBirthday) },
      ];
    }
    case "date-difference-calculator": {
      const metrics = dateDifferenceMetrics(rawValues);
      if (!metrics.isValid) {
        return [
          { label: "Status", value: "Enter valid start and end dates" },
          { label: "Tip", value: "Choose Inclusive mode if both boundary dates should be counted." },
        ];
      }

      return [
        { label: "Exact Difference", value: `${metrics.years} years ${metrics.months} months ${metrics.days} days` },
        {
          label: "Date Order",
          value: metrics.wasReversed ? "Start date is after end date (absolute difference shown)" : "Start date is before end date",
        },
        { label: "Count Mode", value: metrics.includeEndDate ? "Inclusive (end date counted)" : "Exclusive (end date not counted)" },
        { label: "Total Days", value: formatNumber(metrics.totalDays) },
        { label: "Total Weeks (approx.)", value: formatNumber(metrics.totalWeeks) },
        { label: "Total Months (approx.)", value: formatNumber(metrics.totalMonths) },
        { label: "Business Days", value: formatNumber(metrics.businessDays) },
        { label: "Weekend Days", value: formatNumber(metrics.weekendDays) },
      ];
    }
    case "bmi-calculator": {
      const weightKg = Math.max(0, toNumber(rawValues.weightKg));
      const heightCm = Math.max(1, toNumber(rawValues.heightCm));
      const heightM = heightCm / 100;
      const bmi = weightKg / (heightM * heightM);
      let category = "Normal";
      if (bmi < 18.5) category = "Underweight";
      else if (bmi >= 25 && bmi < 30) category = "Overweight";
      else if (bmi >= 30) category = "Obesity";
      const minHealthy = 18.5 * heightM * heightM;
      const maxHealthy = 24.9 * heightM * heightM;

      return [
        { label: "BMI", value: formatNumber(bmi) },
        { label: "Category", value: category },
        { label: "Healthy Weight Range", value: `${formatNumber(minHealthy)} - ${formatNumber(maxHealthy)} kg` },
      ];
    }
    case "body-fat-calculator": {
      const metrics = bodyFatMetrics(rawValues);
      return [
        { label: "Body Fat Percentage", value: formatPercent(metrics.bodyFatPercent) },
        { label: "Category", value: metrics.category },
        { label: "Fat Mass", value: `${formatNumber(metrics.fatMassKg)} kg` },
        { label: "Lean Mass", value: `${formatNumber(metrics.leanMassKg)} kg` },
      ];
    }
    case "calorie-needs-calculator": {
      const sex = String(rawValues.sex ?? "female");
      const age = Math.max(1, toNumber(rawValues.age));
      const weightKg = Math.max(1, toNumber(rawValues.weightKg));
      const heightCm = Math.max(1, toNumber(rawValues.heightCm));
      const activityFactor = Math.max(1.2, toNumber(rawValues.activityFactor, 1.375));

      const bmr =
        sex === "male"
          ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
          : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
      const maintenance = bmr * activityFactor;

      return [
        { label: "Basal Metabolic Rate (BMR)", value: `${formatNumber(bmr)} kcal/day` },
        { label: "Maintenance Calories", value: `${formatNumber(maintenance)} kcal/day` },
        { label: "Mild Weight Loss", value: `${formatNumber(maintenance - 300)} kcal/day` },
        { label: "Lean Mass Gain", value: `${formatNumber(maintenance + 250)} kcal/day` },
      ];
    }
    case "water-intake-calculator": {
      const weightKg = Math.max(1, toNumber(rawValues.weightKg));
      const activityMinutes = Math.max(0, toNumber(rawValues.activityMinutes));
      const baseMl = weightKg * 35;
      const activityBonusMl = activityMinutes * 12;
      const totalMl = baseMl + activityBonusMl;

      return [
        { label: "Daily Target (ml)", value: `${formatNumber(totalMl)} ml` },
        { label: "Daily Target (liters)", value: `${formatNumber(totalMl / 1000)} L` },
        { label: "Approx. 250ml glasses", value: formatNumber(totalMl / 250) },
      ];
    }
    case "pregnancy-due-date-calculator": {
      const metrics = pregnancyMetrics(rawValues);
      if (!metrics.isValid || !metrics.lmpDate || !metrics.conceptionDate || !metrics.dueDate) {
        return [
          { label: "Status", value: "Enter a valid LMP date" },
          { label: "Tip", value: "Use YYYY-MM-DD format for best accuracy" },
        ];
      }

      return [
        { label: "Estimated Due Date", value: formatDate(metrics.dueDate) },
        { label: "Estimated Conception Date", value: formatDate(metrics.conceptionDate) },
        { label: "Current Gestational Age", value: `${metrics.weeksPregnant} weeks ${metrics.daysPregnant} days` },
        { label: "Current Trimester", value: metrics.trimester },
        {
          label: "Days Until Due Date",
          value: metrics.daysUntilDue >= 0 ? formatNumber(metrics.daysUntilDue) : `${formatNumber(Math.abs(metrics.daysUntilDue))} past due`,
        },
      ];
    }
    case "savings-goal-calculator": {
      const metrics = savingsGoalMetrics(rawValues);

      return [
        { label: "Required Monthly Savings", value: formatMoney(metrics.monthlyContribution) },
        { label: "Projected Value of Current Savings", value: formatMoney(metrics.futureCurrent) },
        {
          label: "Total Future Contributions",
          value: formatMoney(metrics.monthlyContribution * metrics.months),
        },
      ];
    }
    case "break-even-calculator": {
      const fixedCosts = Math.max(0, toNumber(rawValues.fixedCosts));
      const variableCost = Math.max(0, toNumber(rawValues.variableCostPerUnit));
      const unitPrice = Math.max(0, toNumber(rawValues.unitPrice));
      const contribution = unitPrice - variableCost;
      const breakEvenUnits = contribution <= 0 ? Number.POSITIVE_INFINITY : fixedCosts / contribution;
      const breakEvenRevenue = Number.isFinite(breakEvenUnits) ? breakEvenUnits * unitPrice : Number.POSITIVE_INFINITY;

      return [
        { label: "Contribution per Unit", value: formatMoney(contribution) },
        { label: "Break-even Units", value: Number.isFinite(breakEvenUnits) ? formatNumber(breakEvenUnits) : "Not reachable" },
        { label: "Break-even Revenue", value: Number.isFinite(breakEvenRevenue) ? formatMoney(breakEvenRevenue) : "Not reachable" },
      ];
    }
    case "startup-cost-estimator": {
      const metrics = startupCostMetrics(rawValues);

      return [
        { label: "One-time Setup Costs", value: formatMoney(metrics.oneTimeCosts) },
        { label: "Runway Operating Cost", value: formatMoney(metrics.runwayCost) },
        { label: "Contingency Buffer", value: formatMoney(metrics.contingencyAmount) },
        { label: "Recommended Capital Target", value: formatMoney(metrics.targetCapital) },
      ];
    }
    case "freelance-rate-calculator": {
      const targetIncome = Math.max(0, toNumber(rawValues.targetMonthlyIncome));
      const monthlyExpenses = Math.max(0, toNumber(rawValues.monthlyExpenses));
      const billableHours = Math.max(1, toNumber(rawValues.billableHoursPerMonth, 80));
      const desiredProfitPercent = Math.max(0, toNumber(rawValues.desiredProfitPercent, 20)) / 100;

      const requiredRevenue = (targetIncome + monthlyExpenses) * (1 + desiredProfitPercent);
      const hourlyRate = requiredRevenue / billableHours;

      return [
        { label: "Target Hourly Rate", value: formatMoney(hourlyRate) },
        { label: "Target Day Rate (8h)", value: formatMoney(hourlyRate * 8) },
        { label: "Required Monthly Revenue", value: formatMoney(requiredRevenue) },
      ];
    }
    default:
      return [{ label: "Result", value: "Not available" }];
  }
}
