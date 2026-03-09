export type AccessibilityIssueSeverity = "critical" | "important" | "improvement";
export type AccessibilityIssueEffort = "S" | "M" | "L";

export interface AccessibilityAuditIssue {
  id: string;
  title: string;
  category: string;
  severity: AccessibilityIssueSeverity;
  effort: AccessibilityIssueEffort;
  summary: string;
  whyItMatters: string;
  evidence: string[];
  impacts: string[];
  fixSnippet: string;
}

export interface AccessibilityAuditMetrics {
  headings: number;
  images: number;
  missingAltImages: number;
  unlabeledFormControls: number;
  unlabeledButtons: number;
  genericLinks: number;
  duplicateIdGroups: number;
  iframesWithoutTitle: number;
  tablesWithoutHeaders: number;
  mediaWithoutCaptions: number;
  landmarks: number;
}

export interface AccessibilityAuditResult {
  pageTitle: string;
  pageLang: string;
  score: number;
  grade: string;
  issues: AccessibilityAuditIssue[];
  passedChecks: string[];
  metrics: AccessibilityAuditMetrics;
}

const GENERIC_LINK_TEXT = new Set([
  "click here",
  "here",
  "read more",
  "learn more",
  "more",
  "details",
  "this link",
  "go",
]);

function severityWeight(severity: AccessibilityIssueSeverity): number {
  if (severity === "critical") return 12;
  if (severity === "important") return 7;
  return 3;
}

function severityRank(severity: AccessibilityIssueSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "important") return 1;
  return 2;
}

function gradeForScore(score: number): string {
  if (score >= 90) return "A";
  if (score >= 78) return "B";
  if (score >= 64) return "C";
  return "D";
}

function trimText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function getAccessibleName(element: Element): string {
  const ariaLabel = trimText(element.getAttribute("aria-label"));
  if (ariaLabel) return ariaLabel;
  const labelledBy = trimText(element.getAttribute("aria-labelledby"));
  if (labelledBy) return labelledBy;
  const title = trimText(element.getAttribute("title"));
  if (title) return title;
  if (element instanceof HTMLInputElement) {
    const value = trimText(element.value);
    if (value) return value;
    const placeholder = trimText(element.placeholder);
    if (placeholder) return placeholder;
  }
  return trimText(element.textContent);
}

function buildIssue(issue: AccessibilityAuditIssue): AccessibilityAuditIssue {
  return issue;
}

export function analyzeAccessibilityMarkup(markup: string): AccessibilityAuditResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, "text/html");
  const issues: AccessibilityAuditIssue[] = [];
  const passedChecks: string[] = [];

  const title = trimText(doc.title);
  const lang = trimText(doc.documentElement.getAttribute("lang"));
  const landmarks = Array.from(
    doc.querySelectorAll("main, nav, header, footer, aside, [role='main'], [role='navigation'], [role='banner'], [role='contentinfo'], [role='complementary']"),
  );
  const headings = Array.from(doc.querySelectorAll("h1, h2, h3, h4, h5, h6"));
  const images = Array.from(doc.querySelectorAll("img"));
  const formControls = Array.from(doc.querySelectorAll("input:not([type='hidden']), select, textarea"));
  const buttons = Array.from(doc.querySelectorAll("button, [role='button'], input[type='button'], input[type='submit'], input[type='reset']"));
  const links = Array.from(doc.querySelectorAll("a[href]"));
  const iframes = Array.from(doc.querySelectorAll("iframe"));
  const tables = Array.from(doc.querySelectorAll("table"));
  const mediaNodes = Array.from(doc.querySelectorAll("video, audio"));
  const dialogs = Array.from(doc.querySelectorAll("dialog, [role='dialog']"));

  if (!lang || !/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/i.test(lang)) {
    issues.push(
      buildIssue({
        id: "document-language",
        title: "Document language is missing or invalid",
        category: "Document",
        severity: "critical",
        effort: "S",
        summary: "Screen readers depend on a valid `lang` attribute to choose pronunciation rules correctly.",
        whyItMatters: "Without a document language, speech output and translation aids are less reliable.",
        evidence: [lang ? `Current lang value: ${lang}` : "No `lang` attribute found on `<html>`."],
        impacts: ["Screen reader users", "Translation tools", "Voice browsing users"],
        fixSnippet: `<html lang="en">\n  ...\n</html>`,
      }),
    );
  } else {
    passedChecks.push("Valid document language found.");
  }

  if (!title || title.length < 12) {
    issues.push(
      buildIssue({
        id: "page-title",
        title: "Page title is missing or too short",
        category: "Document",
        severity: "important",
        effort: "S",
        summary: "Each page should have a specific title that tells users where they are.",
        whyItMatters: "Titles help screen reader users, browser history, and tab switching workflows.",
        evidence: [title ? `Current title: ${title}` : "No `<title>` element content found."],
        impacts: ["Screen reader users", "Keyboard users", "Users managing many tabs"],
        fixSnippet: `<head>\n  <title>Accessibility Auditor & Fix Planner | Utiliora</title>\n</head>`,
      }),
    );
  } else {
    passedChecks.push("Page title looks descriptive.");
  }

  const skipLink = links.find((link) => {
    const href = trimText(link.getAttribute("href"));
    const text = trimText(link.textContent).toLowerCase();
    return href.startsWith("#") && text.includes("skip");
  });

  if (!skipLink) {
    issues.push(
      buildIssue({
        id: "skip-link",
        title: "Skip link is missing",
        category: "Navigation",
        severity: "important",
        effort: "S",
        summary: "Pages should offer a skip link so keyboard users can bypass repeated navigation quickly.",
        whyItMatters: "This reduces fatigue and repetitive tabbing for keyboard and assistive technology users.",
        evidence: ["No skip-to-content style anchor was detected."],
        impacts: ["Keyboard-only users", "Screen reader users", "Users with motor impairments"],
        fixSnippet:
          `<a class="skip-link" href="#main-content">Skip to main content</a>\n<main id="main-content">\n  ...\n</main>`,
      }),
    );
  } else {
    passedChecks.push("Skip link detected.");
  }

  const mainLandmarks = doc.querySelectorAll("main, [role='main']");
  if (mainLandmarks.length !== 1) {
    issues.push(
      buildIssue({
        id: "main-landmark",
        title: "Main landmark is missing or duplicated",
        category: "Navigation",
        severity: "critical",
        effort: "S",
        summary: "A page should expose exactly one main landmark.",
        whyItMatters: "Landmark navigation is one of the fastest ways assistive technology users move around a page.",
        evidence: [`Detected ${mainLandmarks.length} main landmarks.`],
        impacts: ["Screen reader users", "Keyboard users"],
        fixSnippet: `<main id="main-content">\n  ...\n</main>`,
      }),
    );
  } else {
    passedChecks.push("Single main landmark found.");
  }

  if (landmarks.length < 3) {
    issues.push(
      buildIssue({
        id: "landmark-coverage",
        title: "Landmark structure is thin",
        category: "Navigation",
        severity: "improvement",
        effort: "M",
        summary: "The page has very few landmarks, which makes section jumping harder.",
        whyItMatters: "Landmarks make large pages easier to understand and navigate.",
        evidence: [`Detected ${landmarks.length} landmark region(s).`],
        impacts: ["Screen reader users", "Keyboard users", "Users with cognitive fatigue"],
        fixSnippet:
          `<header>...</header>\n<nav aria-label="Primary">...</nav>\n<main id="main-content">...</main>\n<footer>...</footer>`,
      }),
    );
  } else {
    passedChecks.push("Landmark coverage is healthy.");
  }

  const h1Count = doc.querySelectorAll("h1").length;
  if (h1Count !== 1) {
    issues.push(
      buildIssue({
        id: "h1-count",
        title: "Heading hierarchy starts poorly",
        category: "Headings",
        severity: "important",
        effort: "S",
        summary: "Pages should generally expose one clear H1 heading.",
        whyItMatters: "A stable heading outline helps users understand page purpose immediately.",
        evidence: [`Detected ${h1Count} H1 headings.`],
        impacts: ["Screen reader users", "Users with cognitive load sensitivity"],
        fixSnippet: `<h1>Accessibility Auditor & Fix Planner</h1>`,
      }),
    );
  } else {
    passedChecks.push("Single H1 heading found.");
  }

  const emptyHeadings = headings
    .map((heading) => trimText(heading.textContent))
    .filter((value) => !value);
  if (emptyHeadings.length > 0) {
    issues.push(
      buildIssue({
        id: "empty-headings",
        title: "Some headings are empty",
        category: "Headings",
        severity: "important",
        effort: "S",
        summary: "Empty headings create noise for assistive technologies.",
        whyItMatters: "Users hear a heading announcement but get no useful context.",
        evidence: [`Empty heading count: ${emptyHeadings.length}.`],
        impacts: ["Screen reader users", "Keyboard users"],
        fixSnippet: `<h2>Audit summary</h2>`,
      }),
    );
  }

  let previousLevel = 0;
  const skippedHeadings: string[] = [];
  headings.forEach((heading) => {
    const currentLevel = Number.parseInt(heading.tagName.replace("H", ""), 10);
    if (previousLevel > 0 && currentLevel > previousLevel + 1) {
      skippedHeadings.push(`${heading.tagName.toLowerCase()} "${trimText(heading.textContent) || "(empty)"}"`);
    }
    previousLevel = currentLevel;
  });
  if (skippedHeadings.length > 0) {
    issues.push(
      buildIssue({
        id: "skipped-headings",
        title: "Heading levels are skipped",
        category: "Headings",
        severity: "improvement",
        effort: "S",
        summary: "Heading levels should move in order so the document outline stays predictable.",
        whyItMatters: "Skipping from H2 to H4 can make a page feel structurally broken.",
        evidence: skippedHeadings.slice(0, 6),
        impacts: ["Screen reader users", "Users with cognitive load sensitivity"],
        fixSnippet: `<h2>Section heading</h2>\n<h3>Subsection heading</h3>`,
      }),
    );
  } else if (headings.length > 0) {
    passedChecks.push("Heading levels are sequential.");
  }

  const missingAltImages = images.filter((image) => !image.hasAttribute("alt"));
  if (missingAltImages.length > 0) {
    issues.push(
      buildIssue({
        id: "missing-image-alt",
        title: "Some images are missing alt text",
        category: "Images",
        severity: "critical",
        effort: "S",
        summary: "Every informative image needs an `alt` attribute. Decorative images should use `alt=\"\"`.",
        whyItMatters: "Without alt text, non-visual users lose image meaning or hear noisy file names.",
        evidence: missingAltImages.slice(0, 8).map((image) => trimText(image.getAttribute("src")) || "Image with no src value"),
        impacts: ["Blind users", "Screen reader users", "Low-bandwidth users with blocked images"],
        fixSnippet:
          `<img src="/charts/signup-growth.png" alt="Monthly signup growth chart showing a 28% increase" />\n<img src="/decorative-wave.svg" alt="" />`,
      }),
    );
  } else if (images.length > 0) {
    passedChecks.push("All images expose an alt attribute.");
  }

  const suspiciousAltImages = images.filter((image) => {
    const alt = trimText(image.getAttribute("alt"));
    return Boolean(alt) && (/^image\b/i.test(alt) || /\.(png|jpe?g|gif|webp|svg)$/i.test(alt));
  });
  if (suspiciousAltImages.length > 0) {
    issues.push(
      buildIssue({
        id: "weak-image-alt",
        title: "Some alt text looks auto-generated or weak",
        category: "Images",
        severity: "improvement",
        effort: "S",
        summary: "Alt text should describe the image purpose, not repeat a filename.",
        whyItMatters: "Low-quality alt text still slows users down and does not convey the real message.",
        evidence: suspiciousAltImages.slice(0, 8).map((image) => trimText(image.getAttribute("alt"))),
        impacts: ["Screen reader users", "Users relying on text alternatives"],
        fixSnippet: `<img src="/team-photo.jpg" alt="Utiliora product team reviewing accessibility audit results" />`,
      }),
    );
  }

  const unlabeledControls = formControls.filter((control) => {
    const ariaLabel = trimText(control.getAttribute("aria-label"));
    const ariaLabelledBy = trimText(control.getAttribute("aria-labelledby"));
    if (ariaLabel || ariaLabelledBy) return false;
    const id = trimText(control.getAttribute("id"));
    if (id && doc.querySelector(`label[for="${CSS.escape(id)}"]`)) return false;
    return control.closest("label") === null;
  });
  if (unlabeledControls.length > 0) {
    issues.push(
      buildIssue({
        id: "form-labels",
        title: "Some form fields do not have accessible labels",
        category: "Forms",
        severity: "critical",
        effort: "S",
        summary: "Interactive form controls need a programmatic label.",
        whyItMatters: "Without labels, assistive tech users cannot understand what to enter.",
        evidence: unlabeledControls
          .slice(0, 8)
          .map((control) => `${control.tagName.toLowerCase()}${control.getAttribute("name") ? ` [name=${control.getAttribute("name")}]` : ""}`),
        impacts: ["Screen reader users", "Voice control users", "Keyboard-only users"],
        fixSnippet:
          `<label for="email">Email address</label>\n<input id="email" name="email" type="email" />\n\n<input aria-label="Search tools" type="search" />`,
      }),
    );
  } else if (formControls.length > 0) {
    passedChecks.push("Form controls look labeled.");
  }

  const unlabeledButtons = buttons.filter((button) => !getAccessibleName(button));
  if (unlabeledButtons.length > 0) {
    issues.push(
      buildIssue({
        id: "button-labels",
        title: "Some buttons do not expose a usable name",
        category: "Buttons",
        severity: "important",
        effort: "S",
        summary: "Buttons need visible text or an `aria-label` so users know what they do.",
        whyItMatters: "Icon-only controls without a name are effectively hidden from many users.",
        evidence: unlabeledButtons
          .slice(0, 8)
          .map((button) => `${button.tagName.toLowerCase()}${button.getAttribute("class") ? `.${button.getAttribute("class")}` : ""}`),
        impacts: ["Screen reader users", "Voice control users", "Keyboard-only users"],
        fixSnippet: `<button type="button" aria-label="Close dialog">\n  <svg aria-hidden="true">...</svg>\n</button>`,
      }),
    );
  } else if (buttons.length > 0) {
    passedChecks.push("Buttons appear to have accessible names.");
  }

  const genericLinks = links.filter((link) => {
    const text = trimText(link.textContent).toLowerCase();
    return !text || GENERIC_LINK_TEXT.has(text);
  });
  if (genericLinks.length > 0) {
    issues.push(
      buildIssue({
        id: "link-purpose",
        title: "Some links have weak or generic text",
        category: "Links",
        severity: "important",
        effort: "S",
        summary: "Links should make sense out of context.",
        whyItMatters: "Assistive technologies often surface links as a flat list, so generic link labels become confusing.",
        evidence: genericLinks.slice(0, 8).map((link) => trimText(link.textContent) || "(empty link text)"),
        impacts: ["Screen reader users", "Keyboard users", "Users scanning quickly"],
        fixSnippet: `<a href="/pricing">View pricing plans</a>\n<a href="/guides/accessibility-checklist">Read the accessibility checklist</a>`,
      }),
    );
  } else if (links.length > 0) {
    passedChecks.push("Link text looks descriptive.");
  }

  const ids = new Map<string, number>();
  Array.from(doc.querySelectorAll("[id]")).forEach((element) => {
    const id = trimText(element.getAttribute("id"));
    if (!id) return;
    ids.set(id, (ids.get(id) ?? 0) + 1);
  });
  const duplicateIds = Array.from(ids.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => `${id} (${count} uses)`);
  if (duplicateIds.length > 0) {
    issues.push(
      buildIssue({
        id: "duplicate-ids",
        title: "Duplicate IDs were found",
        category: "Structure",
        severity: "important",
        effort: "S",
        summary: "IDs must be unique within a document.",
        whyItMatters: "Duplicate IDs can break label associations, skip links, scripts, and assistive navigation.",
        evidence: duplicateIds.slice(0, 8),
        impacts: ["Screen reader users", "Keyboard users", "Developers debugging the page"],
        fixSnippet: `<section id="feature-summary">...</section>\n<section id="pricing-summary">...</section>`,
      }),
    );
  } else {
    passedChecks.push("No duplicate IDs detected.");
  }

  const iframesWithoutTitle = iframes.filter((iframe) => !trimText(iframe.getAttribute("title")));
  if (iframesWithoutTitle.length > 0) {
    issues.push(
      buildIssue({
        id: "iframe-titles",
        title: "Embedded frames are missing titles",
        category: "Embeds",
        severity: "important",
        effort: "S",
        summary: "Iframes need a title that explains the embedded content.",
        whyItMatters: "Without titles, screen reader users encounter anonymous embedded regions.",
        evidence: iframesWithoutTitle.slice(0, 6).map((iframe) => trimText(iframe.getAttribute("src")) || "iframe"),
        impacts: ["Screen reader users", "Keyboard users"],
        fixSnippet: `<iframe title="Utiliora pricing plan comparison" src="https://example.com/embed"></iframe>`,
      }),
    );
  } else if (iframes.length > 0) {
    passedChecks.push("Embedded frames are titled.");
  }

  const tablesWithoutHeaders = tables.filter((table) => {
    const hasHeaders = table.querySelector("th") !== null;
    const hasCaption = table.querySelector("caption") !== null;
    return !hasHeaders || !hasCaption;
  });
  if (tablesWithoutHeaders.length > 0) {
    issues.push(
      buildIssue({
        id: "table-structure",
        title: "Some tables are missing headers or captions",
        category: "Tables",
        severity: "improvement",
        effort: "M",
        summary: "Data tables should expose headers and a caption to explain context.",
        whyItMatters: "Structured table semantics make complex information navigable by cell and header.",
        evidence: [`Detected ${tablesWithoutHeaders.length} table(s) with incomplete semantics.`],
        impacts: ["Screen reader users", "Users scanning dense data"],
        fixSnippet:
          `<table>\n  <caption>Quarterly revenue by region</caption>\n  <thead>\n    <tr><th scope="col">Region</th><th scope="col">Revenue</th></tr>\n  </thead>\n</table>`,
      }),
    );
  } else if (tables.length > 0) {
    passedChecks.push("Tables appear to include headers and captions.");
  }

  const unlabeledDialogs = dialogs.filter(
    (dialog) => !trimText(dialog.getAttribute("aria-label")) && !trimText(dialog.getAttribute("aria-labelledby")),
  );
  if (unlabeledDialogs.length > 0) {
    issues.push(
      buildIssue({
        id: "dialog-labels",
        title: "Dialog labels are missing",
        category: "Dialogs",
        severity: "important",
        effort: "S",
        summary: "Dialogs should announce a label or heading when opened.",
        whyItMatters: "Unlabeled modal regions create disorientation when focus moves into them.",
        evidence: [`Detected ${unlabeledDialogs.length} unlabeled dialog region(s).`],
        impacts: ["Screen reader users", "Keyboard users"],
        fixSnippet:
          `<dialog aria-labelledby="dialog-title">\n  <h2 id="dialog-title">Delete project</h2>\n</dialog>`,
      }),
    );
  } else if (dialogs.length > 0) {
    passedChecks.push("Dialogs appear labeled.");
  }

  const mediaWithoutCaptions = mediaNodes.filter((node) => {
    if (node.tagName.toLowerCase() !== "video") return false;
    return node.querySelector("track[kind='captions'], track[kind='subtitles']") === null;
  });
  if (mediaWithoutCaptions.length > 0) {
    issues.push(
      buildIssue({
        id: "media-captions",
        title: "Video content is missing captions or subtitles",
        category: "Media",
        severity: "important",
        effort: "M",
        summary: "Video content should offer caption tracks for spoken content.",
        whyItMatters: "Captions help users with hearing loss, language barriers, and noisy environments.",
        evidence: [`Detected ${mediaWithoutCaptions.length} video element(s) without caption tracks.`],
        impacts: ["Users with hearing loss", "Non-native speakers", "Users in sound-sensitive settings"],
        fixSnippet:
          `<video controls>\n  <source src="/launch.mp4" type="video/mp4" />\n  <track kind="captions" src="/launch.en.vtt" srcLang="en" label="English captions" default />\n</video>`,
      }),
    );
  } else if (mediaNodes.length > 0) {
    passedChecks.push("Video media includes caption support.");
  }

  const sortedIssues = issues.sort((left, right) => {
    const severityDifference = severityRank(left.severity) - severityRank(right.severity);
    if (severityDifference !== 0) return severityDifference;
    return left.title.localeCompare(right.title);
  });

  const score = Math.max(
    0,
    100 - sortedIssues.reduce((total, issue) => total + severityWeight(issue.severity), 0),
  );

  return {
    pageTitle: title || "Untitled page",
    pageLang: lang || "Not set",
    score,
    grade: gradeForScore(score),
    issues: sortedIssues,
    passedChecks,
    metrics: {
      headings: headings.length,
      images: images.length,
      missingAltImages: missingAltImages.length,
      unlabeledFormControls: unlabeledControls.length,
      unlabeledButtons: unlabeledButtons.length,
      genericLinks: genericLinks.length,
      duplicateIdGroups: duplicateIds.length,
      iframesWithoutTitle: iframesWithoutTitle.length,
      tablesWithoutHeaders: tablesWithoutHeaders.length,
      mediaWithoutCaptions: mediaWithoutCaptions.length,
      landmarks: landmarks.length,
    },
  };
}

export function buildAccessibilityAuditMarkdown(
  result: AccessibilityAuditResult,
  meta: {
    sourceLabel: string;
    auditedAt: string;
    finalUrl?: string;
    httpStatus?: number;
  },
): string {
  const lines: string[] = [];
  lines.push(`# Accessibility Audit Report`);
  lines.push("");
  lines.push(`- Source: ${meta.sourceLabel}`);
  lines.push(`- Audited at: ${meta.auditedAt}`);
  if (meta.finalUrl) lines.push(`- Final URL: ${meta.finalUrl}`);
  if (typeof meta.httpStatus === "number") lines.push(`- HTTP status: ${meta.httpStatus}`);
  lines.push(`- Page title: ${result.pageTitle}`);
  lines.push(`- Document language: ${result.pageLang}`);
  lines.push(`- Score: ${result.score}/100 (${result.grade})`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push("");
  lines.push(`- Issues found: ${result.issues.length}`);
  lines.push(`- Critical issues: ${result.issues.filter((issue) => issue.severity === "critical").length}`);
  lines.push(`- Important issues: ${result.issues.filter((issue) => issue.severity === "important").length}`);
  lines.push(`- Improvement issues: ${result.issues.filter((issue) => issue.severity === "improvement").length}`);
  lines.push(`- Images missing alt: ${result.metrics.missingAltImages}`);
  lines.push(`- Unlabeled form controls: ${result.metrics.unlabeledFormControls}`);
  lines.push(`- Unlabeled buttons: ${result.metrics.unlabeledButtons}`);
  lines.push("");

  if (result.passedChecks.length > 0) {
    lines.push(`## Passed checks`);
    lines.push("");
    result.passedChecks.forEach((check) => lines.push(`- ${check}`));
    lines.push("");
  }

  lines.push(`## Issues`);
  lines.push("");
  if (result.issues.length === 0) {
    lines.push(`No major structural accessibility issues were detected in this audit.`);
    lines.push("");
  } else {
    result.issues.forEach((issue, index) => {
      lines.push(`### ${index + 1}. ${issue.title}`);
      lines.push("");
      lines.push(`- Severity: ${issue.severity}`);
      lines.push(`- Category: ${issue.category}`);
      lines.push(`- Effort: ${issue.effort}`);
      lines.push(`- Summary: ${issue.summary}`);
      lines.push(`- Why it matters: ${issue.whyItMatters}`);
      lines.push(`- Affected users: ${issue.impacts.join(", ")}`);
      if (issue.evidence.length > 0) {
        lines.push(`- Evidence:`);
        issue.evidence.forEach((item) => lines.push(`  - ${item}`));
      }
      lines.push("");
      lines.push("```html");
      lines.push(issue.fixSnippet);
      lines.push("```");
      lines.push("");
    });
  }

  return lines.join("\n");
}
