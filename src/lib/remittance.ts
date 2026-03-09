export type RemittancePayoutType = "bank" | "mobile-wallet" | "cash-pickup" | "card";

export interface RemittanceCorridorPreset {
  id: string;
  label: string;
  sendCountry: string;
  receiveCountry: string;
  fromCurrency: string;
  toCurrency: string;
  suggestedAmount: number;
}

export interface RemittanceProviderInput {
  id: string;
  name: string;
  fixedFee: number;
  percentFee: number;
  fxSpreadPercent: number;
  deliveryHours: number;
  payoutType: RemittancePayoutType;
  note: string;
}

export interface RemittanceComparisonInput {
  sendAmount: number;
  marketRate: number;
  providers: RemittanceProviderInput[];
}

export interface RemittanceComparisonRow {
  id: string;
  name: string;
  payoutType: RemittancePayoutType;
  deliveryHours: number;
  fixedFee: number;
  percentFee: number;
  feeAmount: number;
  fxSpreadPercent: number;
  appliedRate: number;
  recipientAmount: number;
  spreadCostInSendCurrency: number;
  totalCostInSendCurrency: number;
  effectiveRate: number;
  note: string;
  overallScore: number;
}

export interface RemittanceComparisonSummary {
  rows: RemittanceComparisonRow[];
  bestRoute: RemittanceComparisonRow | null;
  lowestCostRoute: RemittanceComparisonRow | null;
  fastestRoute: RemittanceComparisonRow | null;
}

export const REMITTANCE_CORRIDOR_PRESETS: RemittanceCorridorPreset[] = [
  {
    id: "usa-nigeria",
    label: "USA to Nigeria",
    sendCountry: "United States",
    receiveCountry: "Nigeria",
    fromCurrency: "USD",
    toCurrency: "NGN",
    suggestedAmount: 300,
  },
  {
    id: "uk-kenya",
    label: "UK to Kenya",
    sendCountry: "United Kingdom",
    receiveCountry: "Kenya",
    fromCurrency: "GBP",
    toCurrency: "KES",
    suggestedAmount: 250,
  },
  {
    id: "uae-india",
    label: "UAE to India",
    sendCountry: "United Arab Emirates",
    receiveCountry: "India",
    fromCurrency: "AED",
    toCurrency: "INR",
    suggestedAmount: 1000,
  },
  {
    id: "usa-mexico",
    label: "USA to Mexico",
    sendCountry: "United States",
    receiveCountry: "Mexico",
    fromCurrency: "USD",
    toCurrency: "MXN",
    suggestedAmount: 350,
  },
  {
    id: "eu-ghana",
    label: "Eurozone to Ghana",
    sendCountry: "Eurozone",
    receiveCountry: "Ghana",
    fromCurrency: "EUR",
    toCurrency: "GHS",
    suggestedAmount: 200,
  },
];

const PAYOUT_SCORE: Record<RemittancePayoutType, number> = {
  bank: 82,
  "mobile-wallet": 90,
  "cash-pickup": 74,
  card: 78,
};

export function createDefaultRemittanceProviders(): RemittanceProviderInput[] {
  return [
    {
      id: "budget-route",
      name: "Budget route",
      fixedFee: 1.99,
      percentFee: 0.45,
      fxSpreadPercent: 0.9,
      deliveryHours: 30,
      payoutType: "bank",
      note: "Low total cost with slower delivery.",
    },
    {
      id: "balanced-route",
      name: "Balanced route",
      fixedFee: 2.99,
      percentFee: 0.7,
      fxSpreadPercent: 1.2,
      deliveryHours: 8,
      payoutType: "bank",
      note: "Balanced cost and speed for routine transfers.",
    },
    {
      id: "wallet-express",
      name: "Wallet express",
      fixedFee: 3.49,
      percentFee: 0.95,
      fxSpreadPercent: 1.55,
      deliveryHours: 1,
      payoutType: "mobile-wallet",
      note: "Faster mobile-wallet payout with a wider FX spread.",
    },
    {
      id: "cash-pickup-fast",
      name: "Cash pickup fast",
      fixedFee: 4.99,
      percentFee: 1.15,
      fxSpreadPercent: 1.8,
      deliveryHours: 0.5,
      payoutType: "cash-pickup",
      note: "Optimized for urgent cash pickup.",
    },
  ];
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeScore(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return 0;
  if (max <= min) return 100;
  return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
}

export function compareRemittanceRoutes(input: RemittanceComparisonInput): RemittanceComparisonSummary {
  const safeAmount = Math.max(0, input.sendAmount);
  const safeRate = Math.max(0, input.marketRate);

  const baseRows = input.providers.map((provider) => {
    const feeAmount = safeAmount * Math.max(0, provider.percentFee) / 100 + Math.max(0, provider.fixedFee);
    const sendAfterFees = Math.max(0, safeAmount - feeAmount);
    const appliedRate = safeRate * (1 - Math.max(0, provider.fxSpreadPercent) / 100);
    const recipientAmount = sendAfterFees * appliedRate;
    const idealRecipientWithoutSpread = sendAfterFees * safeRate;
    const spreadCostInReceiveCurrency = Math.max(0, idealRecipientWithoutSpread - recipientAmount);
    const spreadCostInSendCurrency = safeRate > 0 ? spreadCostInReceiveCurrency / safeRate : 0;
    const totalCostInSendCurrency = feeAmount + spreadCostInSendCurrency;
    const effectiveRate = safeAmount > 0 ? recipientAmount / safeAmount : 0;

    return {
      id: provider.id,
      name: provider.name,
      payoutType: provider.payoutType,
      deliveryHours: Math.max(0, provider.deliveryHours),
      fixedFee: roundCurrency(Math.max(0, provider.fixedFee)),
      percentFee: roundCurrency(Math.max(0, provider.percentFee)),
      feeAmount: roundCurrency(feeAmount),
      fxSpreadPercent: roundCurrency(Math.max(0, provider.fxSpreadPercent)),
      appliedRate: roundCurrency(appliedRate),
      recipientAmount: roundCurrency(recipientAmount),
      spreadCostInSendCurrency: roundCurrency(spreadCostInSendCurrency),
      totalCostInSendCurrency: roundCurrency(totalCostInSendCurrency),
      effectiveRate: roundCurrency(effectiveRate),
      note: provider.note,
      overallScore: 0,
    } satisfies RemittanceComparisonRow;
  });

  const recipientMin = Math.min(...baseRows.map((row) => row.recipientAmount));
  const recipientMax = Math.max(...baseRows.map((row) => row.recipientAmount));
  const speedMin = Math.min(...baseRows.map((row) => row.deliveryHours));
  const speedMax = Math.max(...baseRows.map((row) => row.deliveryHours));
  const costMin = Math.min(...baseRows.map((row) => row.totalCostInSendCurrency));
  const costMax = Math.max(...baseRows.map((row) => row.totalCostInSendCurrency));

  const rows = baseRows
    .map((row) => {
      const recipientScore = normalizeScore(row.recipientAmount, recipientMin, recipientMax);
      const speedScore = 100 - normalizeScore(row.deliveryHours, speedMin, speedMax);
      const costScore = 100 - normalizeScore(row.totalCostInSendCurrency, costMin, costMax);
      const payoutScore = PAYOUT_SCORE[row.payoutType];
      const overallScore = roundCurrency(recipientScore * 0.5 + costScore * 0.25 + speedScore * 0.15 + payoutScore * 0.1);
      return {
        ...row,
        overallScore,
      };
    })
    .sort((left, right) => {
      if (right.recipientAmount !== left.recipientAmount) return right.recipientAmount - left.recipientAmount;
      if (left.totalCostInSendCurrency !== right.totalCostInSendCurrency) {
        return left.totalCostInSendCurrency - right.totalCostInSendCurrency;
      }
      return left.deliveryHours - right.deliveryHours;
    });

  return {
    rows,
    bestRoute: rows[0] ?? null,
    lowestCostRoute: [...rows].sort((left, right) => left.totalCostInSendCurrency - right.totalCostInSendCurrency)[0] ?? null,
    fastestRoute: [...rows].sort((left, right) => left.deliveryHours - right.deliveryHours)[0] ?? null,
  };
}

export function estimateMonthlySavings(bestRoute: RemittanceComparisonRow | null, baselineRoute: RemittanceComparisonRow | null, transfersPerMonth: number): number {
  if (!bestRoute || !baselineRoute) return 0;
  const safeRepeats = Math.max(0, Math.round(transfersPerMonth));
  const savingsPerTransfer = Math.max(0, bestRoute.recipientAmount - baselineRoute.recipientAmount);
  return roundCurrency(savingsPerTransfer * safeRepeats);
}

export function formatDeliveryLabel(hours: number): string {
  if (hours <= 1) return "Within 1 hour";
  if (hours < 24) return `${roundCurrency(hours)} hours`;
  const days = hours / 24;
  if (days < 7) return `${roundCurrency(days)} days`;
  return `${roundCurrency(days / 7)} weeks`;
}
