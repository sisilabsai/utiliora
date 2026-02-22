import type { CalculatorId } from "@/lib/types";

export interface ResultRow {
  label: string;
  value: string;
  hint?: string;
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

export function runCalculator(id: CalculatorId, rawValues: Record<string, unknown>): ResultRow[] {
  switch (id) {
    case "loan-emi-calculator": {
      const principal = toNumber(rawValues.principal);
      const annualRate = toNumber(rawValues.annualRate);
      const months = Math.max(1, toNumber(rawValues.months, 12));
      const monthlyRate = annualRate / 12 / 100;

      if (monthlyRate === 0) {
        const emi = principal / months;
        return [
          { label: "Monthly EMI", value: formatMoney(emi) },
          { label: "Total Payment", value: formatMoney(principal) },
          { label: "Total Interest", value: formatMoney(0) },
        ];
      }

      const multiplier = Math.pow(1 + monthlyRate, months);
      const emi = (principal * monthlyRate * multiplier) / (multiplier - 1);
      const totalPayment = emi * months;
      const totalInterest = totalPayment - principal;

      return [
        { label: "Monthly EMI", value: formatMoney(emi) },
        { label: "Total Payment", value: formatMoney(totalPayment) },
        { label: "Total Interest", value: formatMoney(totalInterest) },
      ];
    }
    case "compound-interest-calculator": {
      const principal = toNumber(rawValues.principal);
      const annualRate = toNumber(rawValues.annualRate) / 100;
      const years = toNumber(rawValues.years);
      const compoundsPerYear = Math.max(1, toNumber(rawValues.compoundsPerYear, 12));

      const amount = principal * Math.pow(1 + annualRate / compoundsPerYear, compoundsPerYear * years);
      const interest = amount - principal;

      return [
        { label: "Final Amount", value: formatMoney(amount) },
        { label: "Interest Earned", value: formatMoney(interest) },
        { label: "Growth Multiple", value: `${formatNumber(amount / Math.max(principal, 1))}x` },
      ];
    }
    case "simple-interest-calculator": {
      const principal = toNumber(rawValues.principal);
      const annualRate = toNumber(rawValues.annualRate);
      const years = toNumber(rawValues.years);
      const interest = (principal * annualRate * years) / 100;
      const total = principal + interest;

      return [
        { label: "Interest", value: formatMoney(interest) },
        { label: "Total Amount", value: formatMoney(total) },
      ];
    }
    case "roi-calculator": {
      const investment = toNumber(rawValues.investment);
      const returns = toNumber(rawValues.returns);
      const profit = returns - investment;
      const roi = investment === 0 ? 0 : (profit / investment) * 100;

      return [
        { label: "Net Profit", value: formatMoney(profit) },
        { label: "ROI", value: `${formatNumber(roi)}%` },
      ];
    }
    case "profit-margin-calculator": {
      const revenue = toNumber(rawValues.revenue);
      const cost = toNumber(rawValues.cost);
      const profit = revenue - cost;
      const margin = revenue === 0 ? 0 : (profit / revenue) * 100;
      const markup = cost === 0 ? 0 : (profit / cost) * 100;

      return [
        { label: "Profit", value: formatMoney(profit) },
        { label: "Profit Margin", value: `${formatNumber(margin)}%` },
        { label: "Markup", value: `${formatNumber(markup)}%` },
      ];
    }
    case "vat-calculator": {
      const amount = toNumber(rawValues.amount);
      const vatRate = toNumber(rawValues.vatRate);
      const vatAmount = amount * (vatRate / 100);
      const totalWithVat = amount + vatAmount;

      return [
        { label: "VAT Amount", value: formatMoney(vatAmount) },
        { label: "Total (Incl. VAT)", value: formatMoney(totalWithVat) },
      ];
    }
    case "bmi-calculator": {
      const weightKg = toNumber(rawValues.weightKg);
      const heightCm = toNumber(rawValues.heightCm);
      const heightM = heightCm / 100;
      const bmi = heightM === 0 ? 0 : weightKg / (heightM * heightM);
      let category = "Normal";
      if (bmi < 18.5) category = "Underweight";
      else if (bmi >= 25 && bmi < 30) category = "Overweight";
      else if (bmi >= 30) category = "Obesity";

      return [
        { label: "BMI", value: formatNumber(bmi) },
        { label: "Category", value: category },
      ];
    }
    case "calorie-needs-calculator": {
      const sex = String(rawValues.sex ?? "female");
      const age = toNumber(rawValues.age);
      const weightKg = toNumber(rawValues.weightKg);
      const heightCm = toNumber(rawValues.heightCm);
      const activityFactor = toNumber(rawValues.activityFactor, 1.375);

      const bmr =
        sex === "male"
          ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
          : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
      const maintenance = bmr * activityFactor;

      return [
        { label: "Basal Metabolic Rate (BMR)", value: `${formatNumber(bmr)} kcal/day` },
        { label: "Maintenance Calories", value: `${formatNumber(maintenance)} kcal/day` },
        { label: "Mild Weight Loss", value: `${formatNumber(maintenance - 300)} kcal/day` },
      ];
    }
    case "water-intake-calculator": {
      const weightKg = toNumber(rawValues.weightKg);
      const activityMinutes = toNumber(rawValues.activityMinutes);
      const baseMl = weightKg * 35;
      const activityBonusMl = activityMinutes * 12;
      const totalMl = baseMl + activityBonusMl;

      return [
        { label: "Daily Intake", value: `${formatNumber(totalMl)} ml` },
        { label: "Daily Intake", value: `${formatNumber(totalMl / 1000)} liters` },
      ];
    }
    case "savings-goal-calculator": {
      const targetAmount = toNumber(rawValues.targetAmount);
      const currentSavings = toNumber(rawValues.currentSavings);
      const years = Math.max(1 / 12, toNumber(rawValues.years, 1));
      const annualReturn = toNumber(rawValues.annualReturn) / 100;
      const monthlyRate = annualReturn / 12;
      const months = Math.round(years * 12);
      const futureCurrent = currentSavings * Math.pow(1 + monthlyRate, months);
      const requiredFromContributions = Math.max(0, targetAmount - futureCurrent);

      let monthlyContribution = requiredFromContributions / Math.max(months, 1);
      if (monthlyRate > 0) {
        const growthFactor = (Math.pow(1 + monthlyRate, months) - 1) / monthlyRate;
        monthlyContribution = requiredFromContributions / Math.max(growthFactor, 1);
      }

      return [
        { label: "Required Monthly Savings", value: formatMoney(monthlyContribution) },
        { label: "Projected Value of Current Savings", value: formatMoney(futureCurrent) },
      ];
    }
    case "break-even-calculator": {
      const fixedCosts = toNumber(rawValues.fixedCosts);
      const variableCost = toNumber(rawValues.variableCostPerUnit);
      const unitPrice = toNumber(rawValues.unitPrice);
      const contribution = unitPrice - variableCost;
      const breakEvenUnits = contribution <= 0 ? 0 : fixedCosts / contribution;
      const breakEvenRevenue = breakEvenUnits * unitPrice;

      return [
        { label: "Break-even Units", value: formatNumber(breakEvenUnits) },
        { label: "Break-even Revenue", value: formatMoney(breakEvenRevenue) },
      ];
    }
    case "freelance-rate-calculator": {
      const targetIncome = toNumber(rawValues.targetMonthlyIncome);
      const monthlyExpenses = toNumber(rawValues.monthlyExpenses);
      const billableHours = Math.max(1, toNumber(rawValues.billableHoursPerMonth, 80));
      const desiredProfitPercent = toNumber(rawValues.desiredProfitPercent, 20) / 100;

      const requiredRevenue = (targetIncome + monthlyExpenses) * (1 + desiredProfitPercent);
      const hourlyRate = requiredRevenue / billableHours;

      return [
        { label: "Target Hourly Rate", value: formatMoney(hourlyRate) },
        { label: "Required Monthly Revenue", value: formatMoney(requiredRevenue) },
      ];
    }
    default:
      return [{ label: "Result", value: "Not available" }];
  }
}
