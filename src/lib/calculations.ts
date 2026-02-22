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

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatMoney(value: number): string {
  return moneyFormatter.format(value);
}

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercent(value: number): string {
  return `${formatNumber(value)}%`;
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

export function getCalculatorInsights(id: CalculatorId, rawValues: Record<string, unknown>): string[] {
  switch (id) {
    case "loan-emi-calculator": {
      const metrics = loanMetrics(rawValues);
      const interestShare = metrics.totalPayment === 0 ? 0 : (metrics.totalInterest / metrics.totalPayment) * 100;
      return [
        `Interest share of total payment: ${formatPercent(interestShare)}.`,
        `Every 1% rate increase can significantly raise lifetime cost on long tenures.`,
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
    case "roi-calculator": {
      const investment = Math.max(0, toNumber(rawValues.investment));
      const returns = Math.max(0, toNumber(rawValues.returns));
      const multiple = investment > 0 ? returns / investment : 0;
      return [`Capital multiple: ${formatNumber(multiple)}x.`, "Track ROI alongside payback time, not in isolation."];
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

export function runCalculator(id: CalculatorId, rawValues: Record<string, unknown>): ResultRow[] {
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
