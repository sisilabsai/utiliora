export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-container footer-inner">
        <div className="footer-brand">
          <strong>Utiliora</strong>
          <p>Simple tools. Instant results.</p>
          <small>{`Copyright ${year} utiliora.cloud`}</small>
        </div>

        <nav className="footer-links" aria-label="Footer links">
          <a href="/tools">Tools</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>

        <div className="footer-socials" aria-label="Social links">
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
      </div>
    </footer>
  );
}
