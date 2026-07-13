#!/usr/bin/env npx tsx
/**
 * broken-links.ts
 *
 * Crawls all internal pages from a starting URL, checks every <a href>
 * for broken links (4xx/5xx), and reports results.
 *
 * Usage:
 *   npx tsx scripts/broken-links.ts <base_url> [--depth 2] [--timeout 10000]
 *
 * Output: qa-screenshots/broken-links-report.json + console summary
 */

import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const OUTPUT_DIR = resolve("qa-screenshots");
mkdirSync(OUTPUT_DIR, { recursive: true });

const args = process.argv.slice(2);
const baseUrl = args.find((a) => !a.startsWith("--"));
if (!baseUrl) {
  console.error("Usage: npx tsx scripts/broken-links.ts <base_url> [--depth 2] [--timeout 10000]");
  process.exit(1);
}

const maxDepth = parseInt(args[args.indexOf("--depth") + 1] || "2", 10);
const timeout = parseInt(args[args.indexOf("--timeout") + 1] || "10000", 10);

const baseOrigin = new URL(baseUrl).origin;

interface LinkResult {
  url: string;
  foundOn: string;
  linkText: string;
  status: number | "timeout" | "error";
  error?: string;
  isExternal: boolean;
  type: "page" | "anchor" | "mailto" | "tel" | "javascript" | "other";
}

const checked = new Map<string, LinkResult>();
const pagesToCrawl: Array<{ url: string; depth: number }> = [{ url: baseUrl, depth: 0 }];
const crawledPages = new Set<string>();

async function checkLink(
  href: string,
  foundOn: string,
  linkText: string
): Promise<LinkResult> {
  // Classify
  if (href.startsWith("mailto:")) {
    const valid = /^mailto:[^\s@]+@[^\s@]+\.[^\s@]+/.test(href);
    return { url: href, foundOn, linkText, status: valid ? 200 : 0, isExternal: false, type: "mailto", error: valid ? undefined : "Invalid mailto format" };
  }
  if (href.startsWith("tel:")) {
    const valid = /^tel:\+?[\d\s()-]+$/.test(href);
    return { url: href, foundOn, linkText, status: valid ? 200 : 0, isExternal: false, type: "tel", error: valid ? undefined : "Invalid tel format" };
  }
  if (href.startsWith("javascript:")) {
    return { url: href, foundOn, linkText, status: 0, isExternal: false, type: "javascript", error: "javascript: link (accessibility issue)" };
  }
  if (href === "#" || href === "") {
    return { url: href || "(empty)", foundOn, linkText, status: 0, isExternal: false, type: "anchor", error: "Empty href or bare #" };
  }

  const isExternal = !href.startsWith(baseOrigin);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const resp = await fetch(href, {
      method: "HEAD",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "website-qa-bot/1.0" },
    });
    clearTimeout(timer);

    return { url: href, foundOn, linkText, status: resp.status, isExternal, type: "page" };
  } catch (e: any) {
    if (e.name === "AbortError") {
      return { url: href, foundOn, linkText, status: "timeout", isExternal, type: "page", error: `Timeout after ${timeout}ms` };
    }
    // Some servers reject HEAD, try GET
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const resp = await fetch(href, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "website-qa-bot/1.0" },
      });
      clearTimeout(timer);
      return { url: href, foundOn, linkText, status: resp.status, isExternal, type: "page" };
    } catch (e2: any) {
      return { url: href, foundOn, linkText, status: "error", isExternal, type: "page", error: e2.message || String(e2) };
    }
  }
}

async function extractLinks(url: string): Promise<Array<{ href: string; text: string }>> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "website-qa-bot/1.0" },
    });
    clearTimeout(timer);

    const html = await resp.text();
    const links: Array<{ href: string; text: string }> = [];

    // Simple regex extraction (good enough for link checking — not a full parser)
    const regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = regex.exec(html)) !== null) {
      let href = match[1].trim();
      const text = match[2].replace(/<[^>]+>/g, "").trim().substring(0, 80);

      // Resolve relative URLs
      if (href.startsWith("/")) {
        href = baseOrigin + href;
      } else if (!href.startsWith("http") && !href.startsWith("mailto:") && !href.startsWith("tel:") && !href.startsWith("#") && !href.startsWith("javascript:")) {
        href = new URL(href, url).href;
      }

      // Strip fragment for dedup (but keep original for anchor checks)
      links.push({ href, text });
    }

    return links;
  } catch {
    return [];
  }
}

async function main() {
  console.log(`🔗 Broken link check: ${baseUrl}`);
  console.log(`   Max depth: ${maxDepth} | Timeout: ${timeout}ms\n`);

  while (pagesToCrawl.length > 0) {
    const { url, depth } = pagesToCrawl.shift()!;
    if (crawledPages.has(url)) continue;
    crawledPages.add(url);

    console.log(`📄 [depth ${depth}] ${url}`);
    const links = await extractLinks(url);
    console.log(`   Found ${links.length} links`);

    for (const { href, text } of links) {
      // Skip already checked
      if (checked.has(href)) continue;

      const result = await checkLink(href, url, text);
      checked.set(href, result);

      // Status indicator
      const icon =
        result.status === 200 || result.status === 301 || result.status === 302
          ? "✅"
          : result.type === "mailto" || result.type === "tel"
          ? result.error ? "⚠" : "✅"
          : result.type === "javascript" || result.type === "anchor"
          ? "⚠"
          : "❌";

      if (icon !== "✅") {
        console.log(`   ${icon} [${result.status}] ${href.substring(0, 80)} — "${text.substring(0, 40)}"`);
      }

      // Queue internal pages for deeper crawl
      if (
        !result.isExternal &&
        result.type === "page" &&
        (result.status === 200 || result.status === 301 || result.status === 302) &&
        depth < maxDepth &&
        !crawledPages.has(href)
      ) {
        // Only crawl HTML pages
        const cleanUrl = href.split("#")[0].split("?")[0];
        if (!cleanUrl.match(/\.(pdf|png|jpg|jpeg|gif|svg|css|js|zip|mp4|mp3)$/i)) {
          pagesToCrawl.push({ url: cleanUrl, depth: depth + 1 });
        }
      }
    }

    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 200));
  }

  // Report
  const allResults = Array.from(checked.values());
  const broken = allResults.filter(
    (r) =>
      (typeof r.status === "number" && r.status >= 400) ||
      r.status === "timeout" ||
      r.status === "error"
  );
  const warnings = allResults.filter(
    (r) => r.type === "javascript" || (r.type === "anchor" && r.error) || (r.type === "mailto" && r.error) || (r.type === "tel" && r.error)
  );

  const report = {
    baseUrl,
    pagesCrawled: crawledPages.size,
    totalLinks: allResults.length,
    broken: broken.length,
    warnings: warnings.length,
    brokenLinks: broken,
    warningLinks: warnings,
  };

  const outputPath = resolve(OUTPUT_DIR, "broken-links-report.json");
  writeFileSync(outputPath, JSON.stringify(report, null, 2));

  console.log("\n" + "=".repeat(60));
  console.log(`Pages crawled: ${crawledPages.size}`);
  console.log(`Total links checked: ${allResults.length}`);
  console.log(`❌ Broken: ${broken.length}`);
  console.log(`⚠ Warnings: ${warnings.length}`);
  console.log("=".repeat(60));

  if (broken.length > 0) {
    console.log("\nBroken links:");
    for (const b of broken) {
      console.log(`  [${b.status}] ${b.url}`);
      console.log(`         Found on: ${b.foundOn}`);
      console.log(`         Text: "${b.linkText}"`);
      if (b.error) console.log(`         Error: ${b.error}`);
    }
  }

  console.log(`\n📁 Full report: ${outputPath}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
