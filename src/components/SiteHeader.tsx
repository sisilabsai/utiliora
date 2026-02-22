import Link from "next/link";
import { Grid2x2 } from "lucide-react";
import { getCategories } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";

export function SiteHeader() {
  const categories = getCategories();

  return (
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
  );
}
