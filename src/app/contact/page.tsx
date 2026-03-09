import type { Metadata } from "next";
import { ContactPageContent } from "@/components/pages/ContactPageContent";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact Utiliora",
  description:
    "Contact Utiliora through email or social channels. Reach us for support, product feedback, and partnership conversations.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: `Contact ${SITE_NAME}`,
    description:
      "Contact Utiliora through email or social channels. Reach us for support, product feedback, and partnership conversations.",
    url: absoluteUrl("/contact"),
    type: "website",
    siteName: SITE_NAME,
  },
};

export default function ContactPage() {
  const contactSchema = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: `${SITE_NAME} Contact`,
    url: absoluteUrl("/contact"),
    mainEntity: {
      "@type": "Organization",
      name: SITE_NAME,
      email: "hello@utiliora.cloud",
    },
  };

  return (
    <>
      <ContactPageContent />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(contactSchema) }}
      />
    </>
  );
}
