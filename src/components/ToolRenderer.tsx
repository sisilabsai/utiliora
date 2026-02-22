"use client";

import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { runCalculator, type ResultRow } from "@/lib/calculations";
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
  type?: "number" | "text" | "select";
  min?: number;
  step?: number;
  defaultValue: string;
  options?: Array<{ label: string; value: string }>;
}

const calculatorFields: Record<CalculatorId, CalculatorField[]> = {
  "loan-emi-calculator": [
    { name: "principal", label: "Loan amount (USD)", defaultValue: "100000", min: 0, step: 100, type: "number" },
    { name: "annualRate", label: "Annual interest rate (%)", defaultValue: "8.5", min: 0, step: 0.1, type: "number" },
    { name: "months", label: "Loan tenure (months)", defaultValue: "60", min: 1, step: 1, type: "number" },
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
  "roi-calculator": [
    { name: "investment", label: "Initial investment (USD)", defaultValue: "2000", min: 0, step: 10, type: "number" },
    { name: "returns", label: "Final returns (USD)", defaultValue: "2600", min: 0, step: 10, type: "number" },
  ],
  "profit-margin-calculator": [
    { name: "revenue", label: "Revenue (USD)", defaultValue: "1000", min: 0, step: 1, type: "number" },
    { name: "cost", label: "Cost (USD)", defaultValue: "650", min: 0, step: 1, type: "number" },
  ],
  "vat-calculator": [
    { name: "amount", label: "Base amount (USD)", defaultValue: "100", min: 0, step: 0.01, type: "number" },
    { name: "vatRate", label: "VAT rate (%)", defaultValue: "20", min: 0, step: 0.1, type: "number" },
  ],
  "bmi-calculator": [
    { name: "weightKg", label: "Weight (kg)", defaultValue: "70", min: 1, step: 0.1, type: "number" },
    { name: "heightCm", label: "Height (cm)", defaultValue: "175", min: 30, step: 0.1, type: "number" },
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

function CalculatorTool({ id }: { id: CalculatorId }) {
  const fields = calculatorFields[id];
  const initialValues = Object.fromEntries(fields.map((field) => [field.name, field.defaultValue]));
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [resultRows, setResultRows] = useState<ResultRow[]>(runCalculator(id, initialValues));

  const calculate = () => {
    const rows = runCalculator(id, values);
    setResultRows(rows);
    trackEvent("tool_calculate", { tool: id });
  };

  return (
    <section className="tool-surface">
      <h2>Calculator</h2>
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
                type="number"
                min={field.min}
                step={field.step}
                value={values[field.name] ?? field.defaultValue}
                onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))}
              />
            )}
          </label>
        ))}
      </div>
      <button className="action-button" onClick={calculate} type="button">
        Calculate
      </button>
      <ResultList rows={resultRows} />
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

function WordCounterTool() {
  const [text, setText] = useState("");
  const words = countWords(text);
  const characters = text.length;
  const sentences = text.split(/[.!?]+/).filter((segment) => segment.trim()).length;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  return (
    <section className="tool-surface">
      <h2>Word analysis</h2>
      <label className="field">
        <span>Paste your text</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} />
      </label>
      <ResultList
        rows={[
          { label: "Words", value: words.toString() },
          { label: "Characters", value: characters.toString() },
          { label: "Sentences", value: sentences.toString() },
          { label: "Estimated reading time", value: `${readingTime} min` },
        ]}
      />
    </section>
  );
}

function CharacterCounterTool() {
  const [text, setText] = useState("");
  const [includeSpaces, setIncludeSpaces] = useState(true);
  return (
    <section className="tool-surface">
      <h2>Character count</h2>
      <label className="field">
        <span>Text</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={8} />
      </label>
      <label className="checkbox">
        <input
          type="checkbox"
          checked={includeSpaces}
          onChange={(event) => setIncludeSpaces(event.target.checked)}
        />
        Include spaces
      </label>
      <div className="result-row">
        <span>Characters</span>
        <strong>{countCharacters(text, includeSpaces)}</strong>
      </div>
    </section>
  );
}

function KeywordDensityTool() {
  const [text, setText] = useState("");
  const rows = keywordDensity(text);
  return (
    <section className="tool-surface">
      <h2>Keyword density</h2>
      <label className="field">
        <span>Content input</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} rows={10} />
      </label>
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
  const output = slugify(text);

  return (
    <section className="tool-surface">
      <h2>Slug generation</h2>
      <label className="field">
        <span>Source title</span>
        <input type="text" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <div className="result-row">
        <span>Slug</span>
        <strong>{output || "Add title text to generate slug"}</strong>
      </div>
    </section>
  );
}

function MetaTagGeneratorTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [canonical, setCanonical] = useState("");

  const output = `<title>${title || "Page title"}</title>
<meta name="description" content="${description || "Page description"}" />
${canonical ? `<link rel="canonical" href="${canonical}" />` : ""}`;

  return (
    <section className="tool-surface">
      <h2>Meta tag generator</h2>
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
          <span>Canonical URL</span>
          <input type="url" value={canonical} onChange={(event) => setCanonical(event.target.value)} />
        </label>
      </div>
      <label className="field">
        <span>Generated tags</span>
        <textarea value={output} readOnly rows={6} />
      </label>
    </section>
  );
}

function OpenGraphGeneratorTool() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [image, setImage] = useState("");

  const output = [
    `<meta property="og:title" content="${title || "OG Title"}" />`,
    `<meta property="og:description" content="${description || "OG Description"}" />`,
    `<meta property="og:url" content="${url || "https://example.com"}" />`,
    `<meta property="og:type" content="website" />`,
    image ? `<meta property="og:image" content="${image}" />` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="tool-surface">
      <h2>Open Graph tags</h2>
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
      </div>
      <label className="field">
        <span>Generated OG tags</span>
        <textarea value={output} readOnly rows={8} />
      </label>
    </section>
  );
}

function JsonFormatterTool() {
  const [input, setInput] = useState('{"name":"Utiliora","tools":10}');
  const [output, setOutput] = useState(() => safeJsonFormat('{"name":"Utiliora","tools":10}'));

  const format = () => setOutput(safeJsonFormat(input));

  return (
    <section className="tool-surface">
      <h2>JSON formatter</h2>
      <label className="field">
        <span>Input JSON</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={8} />
      </label>
      <button className="action-button" type="button" onClick={format}>
        Format JSON
      </button>
      <label className="field">
        <span>{output.ok ? "Formatted JSON" : "Error"}</span>
        <textarea value={output.output} readOnly rows={10} />
      </label>
    </section>
  );
}

function MinifierTool({ mode }: { mode: "css" | "js" }) {
  const [input, setInput] = useState(
    mode === "css" ? "body { color: #111; }" : "function hello() { console.log('hi'); }",
  );
  const [output, setOutput] = useState("");

  const minify = () => {
    const result = mode === "css" ? minifyCss(input) : minifyJs(input);
    setOutput(result);
  };

  return (
    <section className="tool-surface">
      <h2>{mode.toUpperCase()} minifier</h2>
      <label className="field">
        <span>Input {mode.toUpperCase()}</span>
        <textarea value={input} onChange={(event) => setInput(event.target.value)} rows={8} />
      </label>
      <button className="action-button" type="button" onClick={minify}>
        Minify
      </button>
      <label className="field">
        <span>Output</span>
        <textarea value={output} readOnly rows={6} />
      </label>
    </section>
  );
}

function Base64Tool() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");

  const encode = () => {
    try {
      setOutput(btoa(unescape(encodeURIComponent(input))));
    } catch {
      setOutput("Unable to encode input.");
    }
  };

  const decode = () => {
    try {
      setOutput(decodeURIComponent(escape(atob(input))));
    } catch {
      setOutput("Invalid Base64 string.");
    }
  };

  return (
    <section className="tool-surface">
      <h2>Base64 encode/decode</h2>
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
      </div>
      <label className="field">
        <span>Output</span>
        <textarea value={output} readOnly rows={6} />
      </label>
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

function ImageTransformTool({ mode }: { mode: ImageMode }) {
  const [file, setFile] = useState<File | null>(null);
  const [targetWidth, setTargetWidth] = useState(1200);
  const [quality, setQuality] = useState(0.8);
  const [resultUrl, setResultUrl] = useState<string>("");
  const [status, setStatus] = useState("Upload an image to begin.");
  const previousUrlRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (previousUrlRef.current) {
        URL.revokeObjectURL(previousUrlRef.current);
      }
    };
  }, []);

  const processImage = async () => {
    if (!file) {
      setStatus("Select an image file first.");
      return;
    }

    try {
      setStatus("Processing image...");
      const sourceUrl = URL.createObjectURL(file);
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Could not load image."));
        element.src = sourceUrl;
      });

      const canvas = document.createElement("canvas");
      const ratio = image.height / image.width;
      const width = mode === "resize" ? Math.max(16, targetWidth) : image.width;
      const height = mode === "resize" ? Math.round(width * ratio) : image.height;
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        setStatus("Canvas context unavailable.");
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(sourceUrl);

      const outputType =
        mode === "jpg-to-png"
          ? "image/png"
          : mode === "png-to-webp"
            ? "image/webp"
            : mode === "compress"
              ? "image/jpeg"
              : file.type || "image/png";

      const outputBlob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, outputType, mode === "compress" ? quality : 0.92),
      );

      if (!outputBlob) {
        setStatus("Image conversion failed.");
        return;
      }

      const outputUrl = URL.createObjectURL(outputBlob);
      if (previousUrlRef.current) URL.revokeObjectURL(previousUrlRef.current);
      previousUrlRef.current = outputUrl;
      setResultUrl(outputUrl);
      setStatus(`Done. Output size: ${(outputBlob.size / 1024).toFixed(1)} KB`);
      trackEvent("tool_image_process", { mode });
    } catch {
      setStatus("Image processing failed.");
    }
  };

  return (
    <section className="tool-surface">
      <h2>Image processor</h2>
      <label className="field">
        <span>Choose image</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </label>
      {mode === "resize" ? (
        <label className="field">
          <span>Target width (px)</span>
          <input
            type="number"
            min={16}
            max={5000}
            value={targetWidth}
            onChange={(event) => setTargetWidth(Number(event.target.value))}
          />
        </label>
      ) : null}
      {mode === "compress" ? (
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
      ) : null}
      <button className="action-button" type="button" onClick={processImage}>
        Process image
      </button>
      <p className="supporting-text">{status}</p>
      {resultUrl ? (
        <div className="image-preview">
          <NextImage
            src={resultUrl}
            alt="Processed output preview"
            width={1200}
            height={900}
            style={{ width: "100%", height: "auto", maxWidth: "620px" }}
            unoptimized
          />
          <a className="action-link" href={resultUrl} download={`utiliora-${mode}.png`}>
            Download result
          </a>
        </div>
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
