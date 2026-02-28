"use client";

import NextImage from "next/image";
import { usePathname } from "next/navigation";
import { Code2, Grid2x2, History, Home, Sparkles, SquareKanban } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LocaleSelector } from "@/components/LocaleSelector";
import { useLocale } from "@/components/LocaleProvider";
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
  const { t } = useLocale();
  const [recentDockEntry, setRecentDockEntry] = useState<RecentDockEntry | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [mobileNavHidden, setMobileNavHidden] = useState(false);
  const [mobileNavCompact, setMobileNavCompact] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollTickingRef = useRef(false);

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
    if (typeof window === "undefined") return;
    lastScrollYRef.current = window.scrollY;

    const handleScroll = () => {
      if (scrollTickingRef.current) return;
      scrollTickingRef.current = true;

      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const previousY = lastScrollYRef.current;
        const delta = currentY - previousY;

        setMobileNavCompact(currentY > 24);

        if (quickOpen) {
          setMobileNavHidden(false);
        } else if (currentY <= 40) {
          setMobileNavHidden(false);
        } else if (delta > 7) {
          setMobileNavHidden(true);
        } else if (delta < -7) {
          setMobileNavHidden(false);
        }

        lastScrollYRef.current = currentY;
        scrollTickingRef.current = false;
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [quickOpen]);

  useEffect(() => {
    if (quickOpen) {
      setMobileNavHidden(false);
    }
  }, [quickOpen]);

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
  const recentLabel = recentDockEntry?.label ?? t("nav.recent", undefined, "Recent");
  const recentActive = recentDockEntry ? isActive(recentDockEntry.href) : false;
  const quickPanelId = "mobile-quick-panel";

  const toggleQuickPanel = useCallback(() => {
    setQuickOpen((current) => !current);
  }, []);

  return (
    <>
      <header className="site-header">
        <div className="site-container header-inner">
          <a className="brand" href="/">
            <span className="brand-mark" aria-hidden>
              <NextImage src="/branding/utiliora-mark-96.png" alt="" width={32} height={32} priority />
            </span>
            <span className="brand-text">
              <strong>{t("brand.name", undefined, "Utiliora")}</strong>
              <small>{t("brand.tagline", undefined, "Simple tools. Instant results.")}</small>
            </span>
          </a>

          <div className="desktop-nav">
            <nav aria-label="Primary navigation" className="main-nav">
              <a href="/tools">
                <Grid2x2 size={14} />
                <span>{t("nav.all_tools", undefined, "All Tools")}</span>
              </a>
              {categories.map((category) => (
                <a key={category.slug} href={`/${category.slug}`}>
                  <span>{t(`category.${category.slug}.title`, undefined, category.title)}</span>
                </a>
              ))}
            </nav>
            <nav className="main-nav-meta" aria-label="Company links">
              <a href="/about">{t("nav.about", undefined, "About")}</a>
              <a href="/contact">{t("nav.contact", undefined, "Contact")}</a>
              <LocaleSelector />
            </nav>
          </div>
        </div>
      </header>

      <nav
        aria-label="Mobile quick access"
        className={`mobile-quick-nav ${mobileNavHidden ? "mobile-quick-nav-hidden" : ""} ${mobileNavCompact ? "mobile-quick-nav-compact" : ""}`}
      >
        <a
          href="/"
          className={`mobile-quick-link ${isActive("/") ? "mobile-quick-link-active" : ""}`}
          aria-current={isActive("/") ? "page" : undefined}
        >
          <Home size={17} />
          <span>{t("nav.home", undefined, "Home")}</span>
        </a>

        <a
          href="/tools"
          className={`mobile-quick-link ${isActive("/tools") ? "mobile-quick-link-active" : ""}`}
          aria-current={isActive("/tools") ? "page" : undefined}
        >
          <Grid2x2 size={17} />
          <span>{t("nav.tools", undefined, "Tools")}</span>
        </a>

        <a
          href={recentHref}
          className={`mobile-quick-link mobile-quick-link-recent ${recentActive ? "mobile-quick-link-active" : ""}`}
          aria-current={recentActive ? "page" : undefined}
        >
          <History size={17} />
          <span>{recentLabel}</span>
        </a>

        <div className="mobile-quick-drawer">
          <button
            type="button"
            className={`mobile-quick-link mobile-quick-link-primary ${quickActive ? "mobile-quick-link-active" : ""}`}
            aria-expanded={quickOpen}
            aria-controls={quickPanelId}
            onClick={toggleQuickPanel}
          >
            <Sparkles size={18} />
            <span>{t("nav.quick", undefined, "Quick")}</span>
          </button>
          {quickOpen ? (
            <div className="mobile-quick-panel-wrap" id={quickPanelId}>
              <div className="mobile-quick-panel">
                <div className="mobile-quick-panel-head">
                  <strong>{t("nav.quick_access", undefined, "Quick access")}</strong>
                  <small>{t("nav.quick_access_desc", undefined, "Jump directly into a tool category.")}</small>
                </div>
                <LocaleSelector compact />
                <div className="mobile-quick-grid">
                  {categories.map((category) => (
                    <a
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
                    >
                      <CategoryIcon category={category.slug} size={14} />
                      <span>{t(`category.${category.slug}.title`, undefined, category.title)}</span>
                    </a>
                  ))}
                </div>
                <a
                  className="mobile-quick-all-link"
                  href="/tools"
                >
                  {t("nav.browse_all_tools", undefined, "Browse all tools")}
                </a>
              </div>
            </div>
          ) : null}
        </div>

        <a
          href="/developer-tools"
          className={`mobile-quick-link ${isActive("/developer-tools") ? "mobile-quick-link-active" : ""}`}
          aria-current={isActive("/developer-tools") ? "page" : undefined}
        >
          <Code2 size={17} />
          <span>{t("nav.dev", undefined, "Dev")}</span>
        </a>

        <a
          href="/productivity-tools"
          className={`mobile-quick-link ${isActive("/productivity-tools") ? "mobile-quick-link-active" : ""}`}
          aria-current={isActive("/productivity-tools") ? "page" : undefined}
        >
          <SquareKanban size={17} />
          <span>{t("nav.focus", undefined, "Focus")}</span>
        </a>
      </nav>
    </>
  );
}
