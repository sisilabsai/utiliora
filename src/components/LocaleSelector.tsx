"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type AppLocale } from "@/lib/i18n";
import { useLocale } from "@/components/LocaleProvider";

interface LocaleSelectorProps {
  className?: string;
  compact?: boolean;
}

export function LocaleSelector({ className, compact = false }: LocaleSelectorProps) {
  const { locale, setLocale, t } = useLocale();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const onChange = (nextValue: string) => {
    const nextLocale = nextValue as AppLocale;
    setLocale(nextLocale);
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <label className={`locale-picker${compact ? " locale-picker-compact" : ""}${className ? ` ${className}` : ""}`}>
      <span>{t("language.select_label", undefined, "Language")}</span>
      <select
        aria-label={t("language.select_label", undefined, "Language")}
        value={locale}
        onChange={(event) => onChange(event.target.value)}
        disabled={isPending}
      >
        {SUPPORTED_LOCALES.map((optionLocale) => (
          <option key={optionLocale} value={optionLocale}>
            {LOCALE_LABELS[optionLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}
