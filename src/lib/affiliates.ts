import type { AffiliateOffer, ToolCategorySlug, ToolDefinition } from "@/lib/types";

const HOSTINGER_AFFILIATE_URL = "https://hostinger.com?REFERRALCODE=KZNCHATIOGIS";

const hostingerOffer: AffiliateOffer = {
  label: "Hostinger",
  headline: "Need reliable hosting for this domain?",
  description: "Launch faster with domain, SSL, managed hosting, and simple setup in one place.",
  ctaLabel: "Start with Hostinger",
  url: HOSTINGER_AFFILIATE_URL,
};

const toolAffiliateOverrides = new Map<string, AffiliateOffer>([
  ["developer-tools/whois-lookup", hostingerOffer],
  ["developer-tools/dns-lookup", hostingerOffer],
  ["developer-tools/dns-propagation-checker", hostingerOffer],
  ["developer-tools/ssl-checker", hostingerOffer],
  ["developer-tools/http-status-checker", hostingerOffer],
]);

const categoryAffiliatePlacements = new Map<ToolCategorySlug, AffiliateOffer>([["developer-tools", hostingerOffer]]);

export function getAffiliateOfferForTool(tool: ToolDefinition): AffiliateOffer | null {
  const override = toolAffiliateOverrides.get(`${tool.category}/${tool.slug}`);
  if (override) return override;
  if (tool.affiliate) return tool.affiliate;
  return null;
}

export function getAffiliateOfferForCategory(category: ToolCategorySlug): AffiliateOffer | null {
  return categoryAffiliatePlacements.get(category) ?? null;
}
