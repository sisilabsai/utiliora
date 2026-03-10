import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_SITE_ORIGIN = "https://www.utiliora.cloud";
const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
const INDEXNOW_KEY_FILENAME = "c215761ac4f94e389f94f1eed83100dd.txt";
const MAX_URLS_PER_REQUEST = 10000;

function printUsage() {
  console.log(`Usage:
  npm run indexnow:submit
  npm run indexnow:submit -- --dry-run
  npm run indexnow:submit -- --url https://www.utiliora.cloud/productivity-tools/pdf-form-filler-signature-pack
  npm run indexnow:submit -- --host https://www.utiliora.cloud --sitemap https://www.utiliora.cloud/sitemap.xml

Options:
  --dry-run         Build the payload and print what would be submitted without calling IndexNow.
  --host <origin>   Override the site origin. Defaults to ${DEFAULT_SITE_ORIGIN}
  --sitemap <url>   Override the sitemap URL. Defaults to <host>/sitemap.xml
  --url <url>       Submit one or more explicit URLs instead of reading the sitemap.
`);
}

function normalizeOrigin(value) {
  return value.replace(/\/+$/, "");
}

function chunk(array, size) {
  const chunks = [];
  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size));
  }
  return chunks;
}

function extractSitemapUrls(xmlText) {
  return Array.from(xmlText.matchAll(/<loc>(.*?)<\/loc>/gsi))
    .map((match) => match[1]?.trim() ?? "")
    .filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "utiliora-indexnow-submit/1.0",
      accept: "application/xml,text/xml,text/plain,*/*",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed for ${url} with status ${response.status}.`);
  }
  return await response.text();
}

async function resolveKey(projectRoot) {
  const keyPath = path.join(projectRoot, "public", INDEXNOW_KEY_FILENAME);
  const key = (await readFile(keyPath, "utf8")).trim();
  if (!key) {
    throw new Error(`IndexNow key file is empty: ${keyPath}`);
  }
  return key;
}

function parseArgs(argv) {
  const result = {
    dryRun: false,
    host: DEFAULT_SITE_ORIGIN,
    sitemap: "",
    urls: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--dry-run") {
      result.dryRun = true;
      continue;
    }
    if (token === "--host") {
      result.host = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--sitemap") {
      result.sitemap = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (token === "--url") {
      const value = argv[index + 1] ?? "";
      if (value) result.urls.push(value);
      index += 1;
      continue;
    }
    if (token === "--help" || token === "-h") {
      printUsage();
      process.exit(0);
    }
    if (token.trim()) {
      result.urls.push(token);
    }
  }

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const host = normalizeOrigin(args.host || DEFAULT_SITE_ORIGIN);
  const sitemapUrl = args.sitemap || `${host}/sitemap.xml`;
  const projectRoot = process.cwd();
  const key = await resolveKey(projectRoot);
  const keyLocation = `${host}/${INDEXNOW_KEY_FILENAME}`;

  let urls = args.urls;
  if (!urls.length) {
    console.log(`Fetching sitemap: ${sitemapUrl}`);
    const sitemapXml = await fetchText(sitemapUrl);
    urls = extractSitemapUrls(sitemapXml);
  }

  const hostName = new URL(host).hostname;
  const cleanedUrls = Array.from(
    new Set(
      urls
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => new URL(url, host).toString())
        .filter((url) => new URL(url).hostname === hostName),
    ),
  );

  if (!cleanedUrls.length) {
    throw new Error("No URLs matched the configured host. Nothing to submit.");
  }

  const batches = chunk(cleanedUrls, MAX_URLS_PER_REQUEST);
  console.log(`Prepared ${cleanedUrls.length} URL(s) for ${hostName} in ${batches.length} batch(es).`);
  console.log(`Key location: ${keyLocation}`);

  if (args.dryRun) {
    console.log("Dry run enabled. Sample URLs:");
    cleanedUrls.slice(0, 10).forEach((url) => console.log(`- ${url}`));
    return;
  }

  for (let index = 0; index < batches.length; index += 1) {
    const urlList = batches[index];
    const payload = {
      host: hostName,
      key,
      keyLocation,
      urlList,
    };

    console.log(`Submitting batch ${index + 1}/${batches.length} with ${urlList.length} URL(s)...`);
    const response = await fetch(INDEXNOW_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        "user-agent": "utiliora-indexnow-submit/1.0",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseText = await response.text();
      throw new Error(`IndexNow rejected batch ${index + 1}: ${response.status} ${response.statusText} ${responseText}`);
    }
  }

  console.log(`IndexNow submission completed for ${cleanedUrls.length} URL(s).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
