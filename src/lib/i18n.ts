export const LOCALE_STORAGE_KEY = "utiliora-locale-v1";
export const LOCALE_COOKIE_KEY = "utiliora-locale";

export const SUPPORTED_LOCALES = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "sw",
  "ar",
  "hi",
  "ru",
  "zh",
  "nl",
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export type LocaleDirection = "ltr" | "rtl";

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  es: "Espanol",
  fr: "Francais",
  de: "Deutsch",
  pt: "Portugues",
  it: "Italiano",
  sw: "Kiswahili",
  ar: "Al-Arabiyya",
  hi: "Hindi",
  ru: "Russkiy",
  zh: "Zhongwen",
  nl: "Nederlands",
};

type MessageMap = Record<string, string>;

const EN_MESSAGES: MessageMap = {
  "brand.name": "Utiliora",
  "brand.tagline": "Simple tools. Instant results.",

  "language.select_label": "Language",

  "nav.all_tools": "All Tools",
  "nav.about": "About",
  "nav.contact": "Contact",
  "nav.home": "Home",
  "nav.tools": "Tools",
  "nav.quick": "Quick",
  "nav.quick_access": "Quick access",
  "nav.quick_access_desc": "Jump directly into a tool category.",
  "nav.browse_all_tools": "Browse all tools",
  "nav.dev": "Dev",
  "nav.focus": "Focus",
  "nav.recent": "Recent",

  "footer.tools": "Tools",
  "footer.about": "About",
  "footer.contact": "Contact",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.copyright": "Copyright {year} utiliora.cloud",

  "category.calculators.title": "Calculators",
  "category.calculators.short": "Calculator",
  "category.calculators.description": "Finance, business, and health calculators with instant browser-based results.",

  "category.converters.title": "Converters",
  "category.converters.short": "Converter",
  "category.converters.description": "Unit and number converters for quick, accurate transformations.",

  "category.seo-tools.title": "SEO & Text Tools",
  "category.seo-tools.short": "SEO Tool",
  "category.seo-tools.description": "Writing, optimization, formatting, and text productivity utilities.",

  "category.image-tools.title": "Image Tools",
  "category.image-tools.short": "Image Tool",
  "category.image-tools.description": "Client-side image and color tools with privacy-friendly workflows.",

  "category.developer-tools.title": "Developer Tools",
  "category.developer-tools.short": "Developer Tool",
  "category.developer-tools.description": "Practical tools for debugging, formatting, encoding, and diagnostics.",

  "category.productivity-tools.title": "Productivity Tools",
  "category.productivity-tools.short": "Productivity Tool",
  "category.productivity-tools.description": "Lightweight utilities for focus, note taking, and daily execution.",

  "tool_card.tool": "Tool",
  "tool_card.open_tool": "Open tool",

  "tool_search.label": "Search tools",
  "tool_search.placeholder": "Try: EMI, JSON, QR code, BMI...",
  "tool_search.results_found": "{count} result(s) found.",
  "tool_search.popular_tools": "Popular tools:",

  "home.eyebrow": "Global utility platform",
  "home.title": "Simple tools. Instant results.",
  "home.description": "Utiliora delivers fast browser-based calculators, converters, SEO tools, image utilities, and developer workflows without login friction.",
  "home.cta_explore": "Explore all tools",
  "home.tools_live_suffix": "tools live and growing weekly.",
  "home.categories_aria": "Tool categories",
  "home.tools_available": "{count} tools available",
  "home.popular": "Popular right now",
  "home.view_full_directory": "View full directory",
  "home.company_support_title": "Company and support",
  "home.company_support_desc": "Learn how Utiliora works, contact our team, and review platform policies.",

  "all_tools.eyebrow": "Tool directory",
  "all_tools.title": "All Utiliora tools",
  "all_tools.desc": "Use search to jump directly to the utility you need.",

  "about.eyebrow": "About Utiliora",
  "about.title": "Simple tools, fast workflows, clear outcomes.",
  "about.desc": "Utiliora is built for people who need practical online tools without friction. We focus on speed, reliability, and a clean experience across desktop and mobile.",
  "about.mission_title": "Our mission",
  "about.mission_desc": "Make everyday digital tasks easier for everyone by offering high-quality utility tools that work instantly in the browser.",
  "about.values_title": "What we value",
  "about.values_desc": "Practical design, trustworthy outputs, and transparent behavior. We build features that save time and keep complexity low.",
  "about.privacy_title": "Privacy-first by design",
  "about.privacy_desc": "Most tools run client-side whenever possible. You stay in control of your data while working across the platform.",
  "about.why_title": "Why people use Utiliora",
  "about.why_1": "Fast tools for calculators, file workflows, SEO, developer tasks, and productivity.",
  "about.why_2": "No forced account flow for core usage.",
  "about.why_3": "Mobile-ready interface that keeps sessions efficient on any device.",
  "about.why_4": "Continuous updates based on real workflow demand.",
  "about.share_text": "I use Utiliora for fast online tools without login friction.",

  "contact.eyebrow": "Contact",
  "contact.title": "Reach the Utiliora team",
  "contact.desc": "For support requests, feedback, or partnership discussions, use email or social channels below. We review messages regularly and prioritize product-impact conversations.",
  "contact.email_title": "Email",
  "contact.email_desc": "Best for product feedback, support requests, and collaboration inquiries.",
  "contact.social_title": "Social channels",
  "contact.links_title": "Useful links",
  "contact.links_tools": "Browse all tools",
  "contact.links_about": "About Utiliora",
  "contact.links_privacy": "Privacy policy",
  "contact.links_terms": "Terms of use",
  "contact.share_text": "Utiliora has fast, practical tools. Sharing in case it helps your workflow.",

  "privacy.eyebrow": "Privacy",
  "privacy.title": "Privacy Policy",
  "privacy.updated": "This policy explains how Utiliora handles information across our tools and pages. Last updated: {date}.",
  "privacy.section_1_title": "1. Data processing approach",
  "privacy.section_1_desc": "We design tools to process user inputs client-side whenever possible. Some features require server requests to complete network or API-based checks.",
  "privacy.section_2_title": "2. Information we may receive",
  "privacy.section_2_item_1": "Tool inputs you submit for processing.",
  "privacy.section_2_item_2": "Technical telemetry like browser metadata and performance data.",
  "privacy.section_2_item_3": "Analytics and usage events used to improve product quality.",
  "privacy.section_3_title": "3. Cookies and analytics",
  "privacy.section_3_desc": "We may use analytics and measurement technologies to understand feature usage and platform health. This helps us improve content quality and user experience.",
  "privacy.section_4_title": "4. Advertising services",
  "privacy.section_4_desc": "We may display ads through third-party networks such as Google AdSense. These partners may use cookies and similar technologies to deliver and measure relevant advertising according to their policies.",
  "privacy.section_5_title": "5. Data sharing",
  "privacy.section_5_desc": "We do not sell personal data. We may share limited operational data with trusted processors that support platform infrastructure, analytics, and security.",
  "privacy.section_6_title": "6. Security",
  "privacy.section_6_desc": "We use reasonable technical and operational safeguards. No system is perfectly secure, so please avoid submitting sensitive personal information into tools unless necessary.",
  "privacy.section_7_title": "7. Contact",
  "privacy.section_7_desc": "For privacy questions, contact",

  "terms.eyebrow": "Terms",
  "terms.title": "Terms of Use",
  "terms.updated": "These terms govern access to and use of Utiliora. By using the platform, you agree to these terms. Last updated: {date}.",
  "terms.section_1_title": "1. Use of the platform",
  "terms.section_1_desc": "Utiliora provides utility tools for informational and workflow support purposes. You agree to use the platform lawfully and responsibly.",
  "terms.section_2_title": "2. User responsibilities",
  "terms.section_2_item_1": "Do not misuse services or attempt unauthorized access.",
  "terms.section_2_item_2": "Do not submit unlawful or harmful content.",
  "terms.section_2_item_3": "Verify outputs before using them for high-stakes decisions.",
  "terms.section_3_title": "3. Tool output and warranties",
  "terms.section_3_desc": "Tools are provided on an 'as is' basis without guarantees of fitness for a specific purpose. You are responsible for reviewing and validating generated output.",
  "terms.section_4_title": "4. Third-party services",
  "terms.section_4_desc": "Certain features may rely on third-party services for processing, analytics, or advertising. Their terms and policies may apply independently.",
  "terms.section_5_title": "5. Intellectual property",
  "terms.section_5_desc": "Platform branding, interface components, and original content are protected. Do not reproduce or redistribute proprietary assets without permission.",
  "terms.section_6_title": "6. Limitation of liability",
  "terms.section_6_desc": "To the maximum extent permitted by law, Utiliora is not liable for indirect or consequential damages arising from use of the platform.",
  "terms.section_7_title": "7. Contact",
  "terms.section_7_desc": "For terms-related inquiries, contact",

  "spread.aria": "Spread the word",
  "spread.title": "Help Us Spread the Word",
  "spread.description": "If Utiliora saves you time, share it with a friend, team, or community.",
  "spread.copy_link": "Copy link",
  "spread.share_x": "Share on X",
  "spread.linkedin": "LinkedIn",
  "spread.whatsapp": "WhatsApp",
  "spread.email": "Email",
  "spread.link_copied": "Link copied.",
  "spread.copy_failed": "Could not copy link.",

  "share_prompt.thanks_title": "Thanks for sharing Utiliora.",
  "share_prompt.useful_title": "Was this useful?",
  "share_prompt.thanks_desc": "You helped more people discover these tools.",
  "share_prompt.useful_desc": "If this helped, share it with your friends and team.",
  "share_prompt.share": "Share",
  "share_prompt.not_now": "Not now",
  "share_prompt.copy_message": "Copy message",
  "share_prompt.copy_success": "Share text copied.",
  "share_prompt.copy_failed": "Could not copy. Use the share links below.",

  "ad.label": "Advertisement",
  "ad.sponsored_placement": "Sponsored placement",

  "affiliate.kicker": "Sponsored recommendation",
  "affiliate.headline_default": "Recommended upgrade",
  "affiliate.cta_prefix": "Try",

  "related_tools.title": "Related tools",

  "category.collection_suffix": "{shortTitle} collection",

  "tool.breadcrumb_home": "Home",
  "tool.category_fallback": "Utility Tool",
  "tool.how_help_title": "How this tool helps",
  "tool.how_help_desc": "Utiliora tools are designed to work directly in modern browsers with clear input labels, mobile-friendly controls, and accessible result panels. Use related utilities below to continue your workflow without switching apps.",
  "tool.how_help_ai_1": "This humanizer workspace is built for responsible editing: compare multiple rewrite variants, verify meaning-retention signals, and correct sentence-level drift before publishing.",
  "tool.how_help_ai_2": "For SEO and professional writing, use keyword locks, readability deltas, and critical-token retention to keep factual details stable while improving natural flow.",
  "tool.faq_title": "FAQ",
};

const ES_MESSAGES: MessageMap = {
  "language.select_label": "Idioma",
  "nav.all_tools": "Todas las herramientas",
  "nav.about": "Acerca de",
  "nav.contact": "Contacto",
  "nav.home": "Inicio",
  "nav.tools": "Herramientas",
  "nav.quick": "Rapido",
  "nav.quick_access": "Acceso rapido",
  "nav.quick_access_desc": "Ir directo a una categoria.",
  "nav.browse_all_tools": "Ver todas las herramientas",
  "nav.dev": "Dev",
  "nav.focus": "Productividad",
  "nav.recent": "Reciente",
  "footer.tools": "Herramientas",
  "footer.about": "Acerca de",
  "footer.contact": "Contacto",
  "footer.privacy": "Privacidad",
  "footer.terms": "Terminos",
  "home.eyebrow": "Plataforma global de utilidades",
  "home.title": "Herramientas simples. Resultados instantaneos.",
  "home.cta_explore": "Explorar herramientas",
  "home.popular": "Populares ahora",
  "related_tools.title": "Herramientas relacionadas",
};

const FR_MESSAGES: MessageMap = {
  "language.select_label": "Langue",
  "nav.all_tools": "Tous les outils",
  "nav.about": "A propos",
  "nav.contact": "Contact",
  "nav.home": "Accueil",
  "nav.tools": "Outils",
  "nav.quick": "Rapide",
  "nav.quick_access": "Acces rapide",
  "nav.browse_all_tools": "Parcourir les outils",
  "footer.tools": "Outils",
  "footer.about": "A propos",
  "footer.contact": "Contact",
  "footer.privacy": "Confidentialite",
  "footer.terms": "Conditions",
  "home.title": "Outils simples. Resultats instantanes.",
};

const DE_MESSAGES: MessageMap = {
  "language.select_label": "Sprache",
  "nav.all_tools": "Alle Tools",
  "nav.about": "Uber",
  "nav.contact": "Kontakt",
  "nav.home": "Start",
  "nav.tools": "Tools",
  "nav.quick": "Schnell",
  "nav.quick_access": "Schnellzugriff",
  "footer.tools": "Tools",
  "footer.about": "Uber",
  "footer.contact": "Kontakt",
  "footer.privacy": "Datenschutz",
  "footer.terms": "Nutzung",
  "home.title": "Einfache Tools. Sofortige Ergebnisse.",
};

const PT_MESSAGES: MessageMap = {
  "language.select_label": "Idioma",
  "nav.all_tools": "Todas as ferramentas",
  "nav.about": "Sobre",
  "nav.contact": "Contato",
  "nav.home": "Inicio",
  "nav.tools": "Ferramentas",
  "nav.quick": "Rapido",
  "footer.tools": "Ferramentas",
  "footer.about": "Sobre",
  "footer.contact": "Contato",
  "footer.privacy": "Privacidade",
  "footer.terms": "Termos",
  "home.title": "Ferramentas simples. Resultados instantaneos.",
};

const IT_MESSAGES: MessageMap = {
  "language.select_label": "Lingua",
  "nav.all_tools": "Tutti gli strumenti",
  "nav.about": "Chi siamo",
  "nav.contact": "Contatti",
  "nav.home": "Home",
  "nav.tools": "Strumenti",
  "footer.tools": "Strumenti",
  "footer.about": "Chi siamo",
  "footer.contact": "Contatti",
  "footer.privacy": "Privacy",
  "footer.terms": "Termini",
  "home.title": "Strumenti semplici. Risultati immediati.",
};

const SW_MESSAGES: MessageMap = {
  "language.select_label": "Lugha",
  "nav.all_tools": "Zana zote",
  "nav.about": "Kuhusu",
  "nav.contact": "Mawasiliano",
  "nav.home": "Nyumbani",
  "nav.tools": "Zana",
  "footer.tools": "Zana",
  "footer.about": "Kuhusu",
  "footer.contact": "Mawasiliano",
  "footer.privacy": "Faragha",
  "footer.terms": "Masharti",
  "home.title": "Zana rahisi. Matokeo ya papo hapo.",
};

const AR_MESSAGES: MessageMap = {
  "language.select_label": "Al-lugha",
  "nav.all_tools": "Kull al-adawat",
  "nav.about": "Hawl",
  "nav.contact": "Ittasil",
  "nav.home": "Al-raisiya",
  "nav.tools": "Al-adawat",
  "footer.tools": "Al-adawat",
  "footer.about": "Hawl",
  "footer.contact": "Ittasil",
  "footer.privacy": "Al-khususiya",
  "footer.terms": "Al-shurut",
  "home.title": "Adawat basita. Nataij fawriya.",
};

const HI_MESSAGES: MessageMap = {
  "language.select_label": "Bhasha",
  "nav.all_tools": "Sabhi tools",
  "nav.about": "About",
  "nav.contact": "Sampark",
  "nav.home": "Home",
  "nav.tools": "Tools",
  "footer.tools": "Tools",
  "footer.about": "About",
  "footer.contact": "Sampark",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "home.title": "Simple tools. Instant results.",
};

const RU_MESSAGES: MessageMap = {
  "language.select_label": "Yazyk",
  "nav.all_tools": "Vse instrumenty",
  "nav.about": "O nas",
  "nav.contact": "Kontakty",
  "nav.home": "Glavnaya",
  "nav.tools": "Instrumenty",
  "footer.tools": "Instrumenty",
  "footer.about": "O nas",
  "footer.contact": "Kontakty",
  "footer.privacy": "Privatnost",
  "footer.terms": "Usloviya",
  "home.title": "Prostye instrumenty. Mgnovennyy rezultat.",
};

const ZH_MESSAGES: MessageMap = {
  "language.select_label": "Yuyan",
  "nav.all_tools": "Quanbu gongju",
  "nav.about": "Guanyu",
  "nav.contact": "Lianxi",
  "nav.home": "Shouye",
  "nav.tools": "Gongju",
  "footer.tools": "Gongju",
  "footer.about": "Guanyu",
  "footer.contact": "Lianxi",
  "footer.privacy": "Yinsi",
  "footer.terms": "Tiaokuan",
  "home.title": "Jiandan gongju. Jishi jieguo.",
};

const NL_MESSAGES: MessageMap = {
  "language.select_label": "Taal",
  "nav.all_tools": "Alle tools",
  "nav.about": "Over",
  "nav.contact": "Contact",
  "nav.home": "Home",
  "nav.tools": "Tools",
  "footer.tools": "Tools",
  "footer.about": "Over",
  "footer.contact": "Contact",
  "footer.privacy": "Privacy",
  "footer.terms": "Voorwaarden",
  "home.title": "Eenvoudige tools. Direct resultaat.",
};

const LOCALE_MESSAGES: Record<AppLocale, MessageMap> = {
  en: EN_MESSAGES,
  es: ES_MESSAGES,
  fr: FR_MESSAGES,
  de: DE_MESSAGES,
  pt: PT_MESSAGES,
  it: IT_MESSAGES,
  sw: SW_MESSAGES,
  ar: AR_MESSAGES,
  hi: HI_MESSAGES,
  ru: RU_MESSAGES,
  zh: ZH_MESSAGES,
  nl: NL_MESSAGES,
};

function templateMessage(message: string, params?: Record<string, string | number>): string {
  if (!params) return message;

  return Object.entries(params).reduce((output, [key, value]) => {
    return output.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }, message);
}

export function isSupportedLocale(value: string | null | undefined): value is AppLocale {
  if (!value) return false;
  return SUPPORTED_LOCALES.includes(value as AppLocale);
}

export function resolveLocale(value: string | null | undefined, fallback: AppLocale = DEFAULT_LOCALE): AppLocale {
  return isSupportedLocale(value) ? value : fallback;
}

export function getLocaleDirection(locale: AppLocale): LocaleDirection {
  return locale === "ar" ? "rtl" : "ltr";
}

export function getMessage(
  locale: AppLocale,
  key: string,
  params?: Record<string, string | number>,
  fallback?: string,
): string {
  const localized = LOCALE_MESSAGES[locale]?.[key];
  if (localized) return templateMessage(localized, params);

  const english = EN_MESSAGES[key];
  if (english) return templateMessage(english, params);

  return fallback ?? key;
}

export function detectLocaleFromNavigator(fallback: AppLocale = DEFAULT_LOCALE): AppLocale {
  if (typeof navigator === "undefined") return fallback;

  const candidates = [navigator.language, ...(navigator.languages ?? [])]
    .filter(Boolean)
    .map((entry) => entry.toLowerCase().replace(/_/g, "-"));

  for (const candidate of candidates) {
    if (isSupportedLocale(candidate)) return candidate;

    const base = candidate.split("-")[0];
    if (isSupportedLocale(base)) return base;
  }

  return fallback;
}
