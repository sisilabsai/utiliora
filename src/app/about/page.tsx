import type { Metadata } from "next";
import { AboutPageContent } from "@/components/pages/AboutPageContent";
import { absoluteUrl, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

export const metadata: Metadata = {
  title: "About Utiliora",
  description:
    "Learn about Utiliora, our mission, privacy-first principles, and how we build fast utility tools for everyone.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: `About ${SITE_NAME}`,
    description:
      "Learn about Utiliora, our mission, privacy-first principles, and how we build fast utility tools for everyone.",
    url: absoluteUrl("/about"),
    type: "website",
    siteName: SITE_NAME,
  },
};

export default function AboutPage() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_ORIGIN,
    email: "hello@utiliora.cloud",
    sameAs: [
      "https://x.com/utilioracloud",
      "https://www.threads.com/@utilioracloud",
      "https://www.youtube.com/@utiliora",
    ],
  };

  return (
    <>
      <AboutPageContent />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </>
  );
}
