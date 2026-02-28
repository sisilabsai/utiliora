import type { Metadata } from "next";
import { AboutPageContent } from "@/components/pages/AboutPageContent";

export const metadata: Metadata = {
  title: "About Utiliora",
  description:
    "Learn about Utiliora, our mission, privacy-first principles, and how we build fast utility tools for everyone.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Utiliora",
    description:
      "Learn about Utiliora, our mission, privacy-first principles, and how we build fast utility tools for everyone.",
    url: "https://utiliora.cloud/about",
    type: "website",
    siteName: "Utiliora",
  },
};

export default function AboutPage() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Utiliora",
    url: "https://utiliora.cloud",
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
