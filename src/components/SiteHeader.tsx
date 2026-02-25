"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Code2, Grid2x2, History, Home, Sparkles, SquareKanban } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCategories } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";

interface RecentDockEntry {
  href: string;
  label: string;
  kind: "category" | "tool";
  savedAt: number;
}

const RECENT_DOCK_STORAGE_KEY = "utiliora-mobile-recent-dock-v1";

function toCompactLabel(value: string, maxLength = 11): string {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) return "Recent";
  return compact.length > maxLength ? `${compact.slice(0, maxLength - 1)}...` : compact;
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildRecentDockEntry(pathname: string, categories: ReturnType<typeof getCategories>): RecentDockEntry | null {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  const segments = normalized.split("/").filter(Boolean);
  if (!segments.length) return null;

  const [categorySlug, toolSlug] = segments;
  const category = categories.find((entry) => entry.slug === categorySlug);
  if (!category) return null;

  if (!toolSlug) {
    const categoryLabel = category.shortTitle.replace(/\s*tools?$/i, "").trim() || category.shortTitle;
    return {
      href: `/${category.slug}`,
      label: toCompactLabel(categoryLabel),
      kind: "category",
      savedAt: Date.now(),
    };
  }

  const toolLabel = toTitleCase(toolSlug.replace(/-/g, " "));
  return {
    href: `/${category.slug}/${toolSlug}`,
    label: toCompactLabel(toolLabel),
    kind: "tool",
    savedAt: Date.now(),
  };
}

export function SiteHeader() {
  const categories = getCategories();
  const pathname = usePathname();
  const [recentDockEntry, setRecentDockEntry] = useState<RecentDockEntry | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [tappingItem, setTappingItem] = useState("");
  const tapTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_DOCK_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as RecentDockEntry;
      if (!parsed || typeof parsed !== "object") return;
      if (typeof parsed.href !== "string" || typeof parsed.label !== "string") return;
      if (parsed.kind !== "category" && parsed.kind !== "tool") return;
      setRecentDockEntry(parsed);
    } catch {
      // Ignore malformed recent entry.
    }
  }, []);

  useEffect(() => {
    const entry = buildRecentDockEntry(pathname, categories);
    if (!entry) return;
    setRecentDockEntry(entry);
    try {
      localStorage.setItem(RECENT_DOCK_STORAGE_KEY, JSON.stringify(entry));
    } catch {
      // Ignore storage failures.
    }
  }, [categories, pathname]);

  useEffect(() => {
    setQuickOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!quickOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setQuickOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [quickOpen]);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const triggerTapFeedback = useCallback((key: string) => {
    setTappingItem(key);
    if (tapTimeoutRef.current !== null) {
      window.clearTimeout(tapTimeoutRef.current);
    }
    tapTimeoutRef.current = window.setTimeout(() => setTappingItem(""), 220);

    if ("vibrate" in navigator) {
      try {
        navigator.vibrate(8);
      } catch {
        // Ignore vibration support issues.
      }
    }
  }, []);

  const isActive = useCallback(
    (href: string) => {
      if (href === "/") return pathname === "/";
      return pathname === href || pathname.startsWith(`${href}/`);
    },
    [pathname],
  );

  const quickActive = useMemo(
    () => categories.some((category) => pathname === `/${category.slug}` || pathname.startsWith(`/${category.slug}/`)),
    [categories, pathname],
  );

  const recentHref = recentDockEntry?.href ?? "/tools";
  const recentLabel = recentDockEntry?.label ?? "Recent";
  const recentActive = recentDockEntry ? isActive(recentDockEntry.href) : false;
  const quickPanelId = "mobile-quick-panel";

  const closeQuickPanel = useCallback(() => {
    setQuickOpen(false);
  }, []);

  const toggleQuickPanel = useCallback(() => {
    setQuickOpen((current) => !current);
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="site-container header-inner">
          <Link className="brand" href="/">
            <span className="brand-mark" aria-hidden>
              U
            </span>
            <span className="brand-text">
              <strong>Utiliora</strong>
              <small>Simple tools. Instant results.</small>
            </span>
          </Link>

          <nav aria-label="Primary navigation" className="main-nav">
            <Link href="/tools">
              <Grid2x2 size={14} />
              <span>All Tools</span>
            </Link>
            {categories.map((category) => (
              <Link key={category.slug} href={`/${category.slug}`}>
                <CategoryIcon category={category.slug} size={14} />
                <span>{category.title}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {quickOpen ? (
        <button type="button" className="mobile-quick-backdrop" aria-label="Close quick access" onClick={closeQuickPanel} />
      ) : null}

      <nav aria-label="Mobile quick access" className="mobile-quick-nav">
        <Link
          href="/"
          className={`mobile-quick-link ${isActive("/") ? "mobile-quick-link-active" : ""} ${tappingItem === "home" ? "is-tapping" : ""}`}
          aria-current={isActive("/") ? "page" : undefined}
          onPointerDown={() => triggerTapFeedback("home")}
          onClick={closeQuickPanel}
        >
          <Home size={17} />
          <span>Home</span>
        </Link>

        <Link
          href="/tools"
          className={`mobile-quick-link ${isActive("/tools") ? "mobile-quick-link-active" : ""} ${tappingItem === "tools" ? "is-tapping" : ""}`}
          aria-current={isActive("/tools") ? "page" : undefined}
          onPointerDown={() => triggerTapFeedback("tools")}
          onClick={closeQuickPanel}
        >
          <Grid2x2 size={17} />
          <span>Tools</span>
        </Link>

        <Link
          href={recentHref}
          className={`mobile-quick-link mobile-quick-link-recent ${recentActive ? "mobile-quick-link-active" : ""} ${tappingItem === "recent" ? "is-tapping" : ""}`}
          aria-current={recentActive ? "page" : undefined}
          onPointerDown={() => triggerTapFeedback("recent")}
          onClick={closeQuickPanel}
        >
          <History size={17} />
          <span>{recentLabel}</span>
        </Link>

        <div className="mobile-quick-drawer">
          <button
            type="button"
            className={`mobile-quick-link mobile-quick-link-primary ${quickActive ? "mobile-quick-link-active" : ""} ${tappingItem === "quick" ? "is-tapping" : ""}`}
            aria-expanded={quickOpen}
            aria-controls={quickPanelId}
            onPointerDown={() => triggerTapFeedback("quick")}
            onClick={toggleQuickPanel}
          >
            <Sparkles size={18} />
            <span>Quick</span>
          </button>
          {quickOpen ? (
            <div className="mobile-quick-panel-wrap" id={quickPanelId}>
              <div className="mobile-quick-panel">
                <div className="mobile-quick-panel-head">
                  <strong>Quick access</strong>
                  <small>Jump directly into a tool category.</small>
                </div>
                <div className="mobile-quick-grid">
                  {categories.map((category) => (
                    <Link
                      key={`quick-${category.slug}`}
                      href={`/${category.slug}`}
                      aria-current={
                        pathname === `/${category.slug}` || pathname.startsWith(`/${category.slug}/`) ? "page" : undefined
                      }
                      className={
                        pathname === `/${category.slug}` || pathname.startsWith(`/${category.slug}/`)
                          ? "mobile-quick-category-link mobile-quick-category-link-active"
                          : "mobile-quick-category-link"
                      }
                      onPointerDown={() => triggerTapFeedback(`quick-${category.slug}`)}
                      onClick={closeQuickPanel}
                    >
                      <CategoryIcon category={category.slug} size={14} />
                      <span>{category.title}</span>
                    </Link>
                  ))}
                </div>
                <Link
                  className="mobile-quick-all-link"
                  href="/tools"
                  onPointerDown={() => triggerTapFeedback("quick-all")}
                  onClick={closeQuickPanel}
                >
                  Browse all tools
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <Link
          href="/developer-tools"
          className={`mobile-quick-link ${isActive("/developer-tools") ? "mobile-quick-link-active" : ""} ${tappingItem === "dev" ? "is-tapping" : ""}`}
          aria-current={isActive("/developer-tools") ? "page" : undefined}
          onPointerDown={() => triggerTapFeedback("dev")}
          onClick={closeQuickPanel}
        >
          <Code2 size={17} />
          <span>Dev</span>
        </Link>

        <Link
          href="/productivity-tools"
          className={`mobile-quick-link ${isActive("/productivity-tools") ? "mobile-quick-link-active" : ""} ${tappingItem === "focus" ? "is-tapping" : ""}`}
          aria-current={isActive("/productivity-tools") ? "page" : undefined}
          onPointerDown={() => triggerTapFeedback("focus")}
          onClick={closeQuickPanel}
        >
          <SquareKanban size={17} />
          <span>Focus</span>
        </Link>
      </nav>
    </>
  );
}
