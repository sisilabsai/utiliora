import type { NumberConverterMode, UnitQuantity } from "@/lib/types";

export interface UnitDefinition {
  value: string;
  label: string;
  factor: number;
}

const unitMap: Record<Exclude<UnitQuantity, "temperature">, UnitDefinition[]> = {
  length: [
    { value: "meter", label: "Meters", factor: 1 },
    { value: "kilometer", label: "Kilometers", factor: 1000 },
    { value: "mile", label: "Miles", factor: 1609.344 },
    { value: "foot", label: "Feet", factor: 0.3048 },
    { value: "inch", label: "Inches", factor: 0.0254 },
  ],
  weight: [
    { value: "kilogram", label: "Kilograms", factor: 1 },
    { value: "gram", label: "Grams", factor: 0.001 },
    { value: "pound", label: "Pounds", factor: 0.45359237 },
    { value: "ounce", label: "Ounces", factor: 0.028349523125 },
  ],
  area: [
    { value: "sqm", label: "Square meters", factor: 1 },
    { value: "sqkm", label: "Square kilometers", factor: 1_000_000 },
    { value: "sqft", label: "Square feet", factor: 0.09290304 },
    { value: "acre", label: "Acres", factor: 4046.8564224 },
    { value: "hectare", label: "Hectares", factor: 10_000 },
  ],
  volume: [
    { value: "liter", label: "Liters", factor: 1 },
    { value: "milliliter", label: "Milliliters", factor: 0.001 },
    { value: "gallon-us", label: "US Gallons", factor: 3.785411784 },
    { value: "cubic-meter", label: "Cubic meters", factor: 1000 },
    { value: "cup-us", label: "US Cups", factor: 0.2365882365 },
  ],
  speed: [
    { value: "mps", label: "Meters/second", factor: 1 },
    { value: "kph", label: "Kilometers/hour", factor: 0.2777777778 },
    { value: "mph", label: "Miles/hour", factor: 0.44704 },
    { value: "knot", label: "Knots", factor: 0.5144444444 },
  ],
  time: [
    { value: "second", label: "Seconds", factor: 1 },
    { value: "minute", label: "Minutes", factor: 60 },
    { value: "hour", label: "Hours", factor: 3600 },
    { value: "day", label: "Days", factor: 86_400 },
    { value: "week", label: "Weeks", factor: 604_800 },
  ],
  "data-storage": [
    { value: "byte", label: "Bytes", factor: 1 },
    { value: "kilobyte", label: "Kilobytes", factor: 1024 },
    { value: "megabyte", label: "Megabytes", factor: 1024 * 1024 },
    { value: "gigabyte", label: "Gigabytes", factor: 1024 * 1024 * 1024 },
    { value: "terabyte", label: "Terabytes", factor: 1024 * 1024 * 1024 * 1024 },
  ],
  pressure: [
    { value: "pascal", label: "Pascal", factor: 1 },
    { value: "kilopascal", label: "Kilopascal", factor: 1000 },
    { value: "bar", label: "Bar", factor: 100_000 },
    { value: "psi", label: "PSI", factor: 6894.757293168 },
    { value: "atm", label: "Atmosphere", factor: 101_325 },
  ],
  energy: [
    { value: "joule", label: "Joule", factor: 1 },
    { value: "kilojoule", label: "Kilojoule", factor: 1000 },
    { value: "calorie", label: "Calorie", factor: 4.184 },
    { value: "kwh", label: "Kilowatt-hour", factor: 3_600_000 },
    { value: "btu", label: "BTU", factor: 1055.05585262 },
  ],
};

function convertTemperature(value: number, from: string, to: string): number {
  const celsius =
    from === "c"
      ? value
      : from === "f"
        ? (value - 32) * (5 / 9)
        : (value - 273.15);

  if (to === "c") return celsius;
  if (to === "f") return celsius * (9 / 5) + 32;
  return celsius + 273.15;
}

export function getUnitsForQuantity(quantity: UnitQuantity): UnitDefinition[] {
  if (quantity === "temperature") {
    return [
      { value: "c", label: "Celsius (C)", factor: 1 },
      { value: "f", label: "Fahrenheit (F)", factor: 1 },
      { value: "k", label: "Kelvin (K)", factor: 1 },
    ];
  }

  return unitMap[quantity];
}

export function convertUnitValue(
  quantity: UnitQuantity,
  value: number,
  fromUnit: string,
  toUnit: string,
): number {
  if (quantity === "temperature") {
    return convertTemperature(value, fromUnit, toUnit);
  }

  const units = unitMap[quantity];
  const from = units.find((unit) => unit.value === fromUnit);
  const to = units.find((unit) => unit.value === toUnit);
  if (!from || !to) return NaN;
  const baseValue = value * from.factor;
  return baseValue / to.factor;
}

export interface NumberConversionResult {
  primary: string;
  secondary?: string;
}

const romanNumerals: Array<[number, string]> = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function toRoman(value: number): string {
  let remaining = Math.max(1, Math.min(3999, Math.floor(value)));
  let output = "";
  for (const [arabic, roman] of romanNumerals) {
    while (remaining >= arabic) {
      output += roman;
      remaining -= arabic;
    }
  }
  return output;
}

function fromRoman(value: string): number | null {
  const input = value.toUpperCase().trim();
  if (!/^[IVXLCDM]+$/.test(input)) return null;
  let index = 0;
  let total = 0;
  for (const [arabic, roman] of romanNumerals) {
    while (input.slice(index, index + roman.length) === roman) {
      total += arabic;
      index += roman.length;
    }
  }
  return index === input.length ? total : null;
}

function numberToWords(input: number): string {
  const ones = [
    "zero",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
  ];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  const writeUnderThousand = (value: number): string => {
    let result = "";
    if (value >= 100) {
      result += `${ones[Math.floor(value / 100)]} hundred`;
      value %= 100;
      if (value > 0) result += " ";
    }
    if (value >= 20) {
      result += tens[Math.floor(value / 10)];
      value %= 10;
      if (value > 0) result += `-${ones[value]}`;
    } else if (value > 0 || result.length === 0) {
      result += ones[value];
    }
    return result;
  };

  if (input === 0) return "zero";
  const units: Array<[number, string]> = [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1000, "thousand"],
    [1, ""],
  ];
  let remaining = Math.floor(Math.abs(input));
  const chunks: string[] = [];

  for (const [size, label] of units) {
    if (remaining >= size) {
      const chunk = Math.floor(remaining / size);
      remaining %= size;
      const words = writeUnderThousand(chunk);
      chunks.push(label ? `${words} ${label}` : words);
    }
  }

  return `${input < 0 ? "minus " : ""}${chunks.join(" ")}`.trim();
}

export function convertNumber(mode: NumberConverterMode, rawInput: string): NumberConversionResult {
  const input = rawInput.trim();
  if (!input) return { primary: "" };

  switch (mode) {
    case "binary-decimal": {
      if (/^[01]+$/.test(input)) {
        const decimal = Number.parseInt(input, 2);
        return { primary: decimal.toString(10), secondary: `Hex: ${decimal.toString(16).toUpperCase()}` };
      }

      const decimal = Number.parseInt(input, 10);
      if (Number.isNaN(decimal)) {
        return { primary: "Enter a valid binary or decimal number." };
      }
      return { primary: decimal.toString(2), secondary: `Hex: ${decimal.toString(16).toUpperCase()}` };
    }
    case "decimal-hex": {
      if (/^(0x)?[0-9a-fA-F]+$/.test(input)) {
        const sanitized = input.startsWith("0x") ? input.slice(2) : input;
        const decimal = Number.parseInt(sanitized, 16);
        return { primary: decimal.toString(10), secondary: `Binary: ${decimal.toString(2)}` };
      }

      const decimal = Number.parseInt(input, 10);
      if (Number.isNaN(decimal)) {
        return { primary: "Enter a valid decimal or hexadecimal number." };
      }
      return { primary: `0x${decimal.toString(16).toUpperCase()}`, secondary: `Binary: ${decimal.toString(2)}` };
    }
    case "roman": {
      const numberInput = Number.parseInt(input, 10);
      if (Number.isFinite(numberInput)) {
        return { primary: toRoman(numberInput), secondary: "Supported range: 1 to 3999." };
      }
      const numeric = fromRoman(input);
      if (numeric === null) {
        return { primary: "Enter a valid Roman numeral or integer." };
      }
      return { primary: numeric.toString(10), secondary: "Roman input parsed successfully." };
    }
    case "number-to-words": {
      const value = Number.parseInt(input, 10);
      if (!Number.isFinite(value)) {
        return { primary: "Enter a valid whole number." };
      }
      return { primary: numberToWords(value) };
    }
    default:
      return { primary: "Unsupported converter mode." };
  }
}
