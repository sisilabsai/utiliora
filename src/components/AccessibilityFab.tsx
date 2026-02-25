"use client";

import { Accessibility, Moon, RotateCcw, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ThemeMode = "light" | "dark";

interface AccessibilitySettings {
  theme: ThemeMode;
  fontScale: number;
  lineSpacing: boolean;
  reduceMotion: boolean;
  highContrast: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
}

const STORAGE_KEY = "utiliora-accessibility-v1";
const MIN_FONT_SCALE = 0.9;
const MAX_FONT_SCALE = 1.25;

const DEFAULT_SETTINGS: AccessibilitySettings = {
  theme: "light",
  fontScale: 1,
  lineSpacing: false,
  reduceMotion: false,
  highContrast: false,
  highlightLinks: false,
  readableFont: false,
};

function clampFontScale(value: number): number {
  return Math.max(MIN_FONT_SCALE, Math.min(MAX_FONT_SCALE, value));
}

function applySettings(settings: AccessibilitySettings): void {
  const root = document.documentElement;
  root.dataset.theme = settings.theme;
  root.style.setProperty("--font-scale", settings.fontScale.toFixed(2));
  root.classList.toggle("a11y-line-spacing", settings.lineSpacing);
  root.classList.toggle("a11y-reduce-motion", settings.reduceMotion);
  root.classList.toggle("a11y-high-contrast", settings.highContrast);
  root.classList.toggle("a11y-highlight-links", settings.highlightLinks);
  root.classList.toggle("a11y-readable-font", settings.readableFont);
}

function sanitizeSettings(input: Partial<AccessibilitySettings>, fallbackTheme: ThemeMode): AccessibilitySettings {
  return {
    theme: input.theme === "dark" || input.theme === "light" ? input.theme : fallbackTheme,
    fontScale: clampFontScale(Number(input.fontScale) || 1),
    lineSpacing: Boolean(input.lineSpacing),
    reduceMotion: Boolean(input.reduceMotion),
    highContrast: Boolean(input.highContrast),
    highlightLinks: Boolean(input.highlightLinks),
    readableFont: Boolean(input.readableFont),
  };
}

export function AccessibilityFab() {
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [settings, setSettings] = useState<AccessibilitySettings>(DEFAULT_SETTINGS);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const initialTheme: ThemeMode = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    let nextSettings: AccessibilitySettings = { ...DEFAULT_SETTINGS, theme: initialTheme };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
        nextSettings = sanitizeSettings(parsed, initialTheme);
      }
    } catch {
      // Ignore malformed storage.
    }

    setSettings(nextSettings);
    applySettings(nextSettings);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    applySettings(settings);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage write failures.
    }
  }, [hydrated, settings]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const updateFlag = (key: keyof AccessibilitySettings, value: boolean) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const resetSettings = () => {
    const fallbackTheme: ThemeMode = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    setSettings({ ...DEFAULT_SETTINGS, theme: fallbackTheme });
  };

  return (
    <div className="accessibility-fab-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="accessibility-fab-button"
        aria-label="Open accessibility options"
        aria-expanded={open}
        aria-controls="accessibility-panel"
        onClick={() => setOpen((current) => !current)}
      >
        <Accessibility size={20} />
      </button>

      {open ? (
        <div ref={panelRef} id="accessibility-panel" className="accessibility-panel" role="dialog" aria-label="Accessibility options">
          <div className="accessibility-panel-head">
            <strong>Accessibility & Theme</strong>
            <small>Switch white/black mode and reading controls.</small>
          </div>

          <div className="accessibility-theme-row">
            <button
              type="button"
              className={`accessibility-option-button ${settings.theme === "light" ? "active" : ""}`}
              onClick={() => setSettings((current) => ({ ...current, theme: "light" }))}
            >
              <Sun size={15} /> White
            </button>
            <button
              type="button"
              className={`accessibility-option-button ${settings.theme === "dark" ? "active" : ""}`}
              onClick={() => setSettings((current) => ({ ...current, theme: "dark" }))}
            >
              <Moon size={15} /> Black
            </button>
          </div>

          <label className="accessibility-slider-field">
            <span>
              Text size <strong>{Math.round(settings.fontScale * 100)}%</strong>
            </span>
            <input
              type="range"
              min={MIN_FONT_SCALE}
              max={MAX_FONT_SCALE}
              step={0.05}
              value={settings.fontScale}
              onChange={(event) =>
                setSettings((current) => ({ ...current, fontScale: clampFontScale(Number(event.target.value)) }))
              }
            />
          </label>

          <div className="accessibility-toggle-list">
            <label className="accessibility-toggle">
              <input
                type="checkbox"
                checked={settings.lineSpacing}
                onChange={(event) => updateFlag("lineSpacing", event.target.checked)}
              />
              <span>Increase line spacing</span>
            </label>

            <label className="accessibility-toggle">
              <input
                type="checkbox"
                checked={settings.highContrast}
                onChange={(event) => updateFlag("highContrast", event.target.checked)}
              />
              <span>High contrast colors</span>
            </label>

            <label className="accessibility-toggle">
              <input
                type="checkbox"
                checked={settings.highlightLinks}
                onChange={(event) => updateFlag("highlightLinks", event.target.checked)}
              />
              <span>Highlight all links</span>
            </label>

            <label className="accessibility-toggle">
              <input
                type="checkbox"
                checked={settings.readableFont}
                onChange={(event) => updateFlag("readableFont", event.target.checked)}
              />
              <span>Readable system font</span>
            </label>

            <label className="accessibility-toggle">
              <input
                type="checkbox"
                checked={settings.reduceMotion}
                onChange={(event) => updateFlag("reduceMotion", event.target.checked)}
              />
              <span>Reduce motion effects</span>
            </label>
          </div>

          <div className="accessibility-panel-actions">
            <button type="button" className="accessibility-option-button" onClick={resetSettings}>
              <RotateCcw size={15} /> Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
