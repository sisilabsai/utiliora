export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <p>{`Copyright ${year} utiliora.cloud`}</p>
        <div className="footer-links">
          <a href="/tools">Browse all tools</a>
          <a href="mailto:hello@utiliora.cloud">hello@utiliora.cloud</a>
          <a href="https://x.com/utilioracloud" target="_blank" rel="noreferrer">
            X/Twitter
          </a>
          <a href="https://www.threads.com/@utilioracloud" target="_blank" rel="noreferrer">
            Threads
          </a>
          <a href="https://www.youtube.com/@utiliora" target="_blank" rel="noreferrer">
            YouTube
          </a>
        </div>
        <a
          className="footer-badge"
          href="https://www.producthunt.com/products/utiliora?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-utiliora"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Utiliora on Product Hunt"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt="Utiliora - Simple tools. Instant results. NO login. NO privacy worries. | Product Hunt"
            width="250"
            height="54"
            src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1086978&theme=light&t=1772200395562"
          />
        </a>
      </div>
    </footer>
  );
}
