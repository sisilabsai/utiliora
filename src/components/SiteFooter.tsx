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
      </div>
    </footer>
  );
}
