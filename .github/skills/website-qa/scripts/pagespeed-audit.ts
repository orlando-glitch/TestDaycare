#!/usr/bin/env npx tsx
/**
 * pagespeed-audit.ts
 *
 * Runs Google PageSpeed Insights API against all provided pages for both
 * mobile and desktop strategies. Outputs a summary table + detailed JSON.
 *
 * Usage:
 *   npx tsx scripts/pagespeed-audit.ts <base_url> [page1] [page2] ...
 *
 * Examples:
 *   npx tsx scripts/pagespeed-audit.ts https://example.com / /about /contact
 *
 * Output: qa-screenshots/pagespeed-results.json + console summary table
 *
 * Note: Only works with publicly reachable URLs (not localhost).
 *       Rate limit: ~1 req/sec unkeyed. Script spaces requests automatically.
 */

import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";

const API = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"];
const STRATEGIES = ["mobile", "desktop"] as const;
const OUTPUT_DIR = resolve("qa-screenshots");

const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error("Usage: npx tsx scripts/pagespeed-audit.ts <base_url> [page1] [page2] ...");
  process.exit(1);
}

if (baseUrl.includes("localhost") || baseUrl.includes("127.0.0.1")) {
  console.error("❌ PageSpeed Insights requires a publicly reachable URL. Deploy to staging first.");
  process.exit(1);
}

const pages = process.argv.slice(3);
if (pages.length === 0) pages.push("/");

mkdirSync(OUTPUT_DIR, { recursive: true });

interface ScoreSet {
  performance: number;
  accessibility: number;
  best_practices: number;
  seo: number;
}

interface PageResult {
  page: string;
  url: string;
  mobile?: ScoreSet;
  desktop?: ScoreSet;
  mobile_audits?: Record<string, any>;
  desktop_audits?: Record<string, any>;
  errors?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function runPageSpeed(
  url: string,
  strategy: "mobile" | "desktop"
): Promise<{ scores: ScoreSet; failingAudits: Record<string, any> } | { error: string }> {
  const params = new URLSearchParams({ url, strategy });
  CATEGORIES.forEach((c) => params.append("category", c));

  try {
    const resp = await fetch(`${API}?${params}`);
    if (resp.status === 429) {
      return { error: "Rate limited (429). Wait and retry." };
    }
    if (!resp.ok) {
      return { error: `HTTP ${resp.status}: ${resp.statusText}` };
    }

    const data = await resp.json();
    const cats = data.lighthouseResult?.categories;
    if (!cats) return { error: "No categories in response" };

    const scores: ScoreSet = {
      performance: Math.round((cats.performance?.score ?? 0) * 100),
      accessibility: Math.round((cats.accessibility?.score ?? 0) * 100),
      best_practices: Math.round((cats["best-practices"]?.score ?? 0) * 100),
      seo: Math.round((cats.seo?.score ?? 0) * 100),
    };

    // Collect failing audits (score < 1)
    const audits = data.lighthouseResult?.audits || {};
    const failingAudits: Record<string, any> = {};
    for (const [key, audit] of Object.entries(audits) as any) {
      if (audit.score !== null && audit.score < 1 && audit.score !== undefined) {
        failingAudits[key] = {
          title: audit.title,
          score: audit.score,
          description: audit.description?.substring(0, 200),
        };
      }
    }

    return { scores, failingAudits };
  } catch (e: any) {
    return { error: e.message || String(e) };
  }
}

function scoreIcon(score: number): string {
  if (score >= 90) return "🟢";
  if (score >= 50) return "🟡";
  return "🔴";
}

async function main() {
  const results: PageResult[] = [];

  for (const pagePath of pages) {
    const url = `${baseUrl.replace(/\/$/, "")}${pagePath}`;
    console.log(`\n📄 ${url}`);

    const result: PageResult = { page: pagePath, url, errors: [] };

    for (const strategy of STRATEGIES) {
      console.log(`  ⏳ ${strategy}...`);
      const res = await runPageSpeed(url, strategy);

      if ("error" in res) {
        console.log(`  ❌ ${strategy}: ${res.error}`);
        result.errors!.push(`${strategy}: ${res.error}`);

        // If rate limited, wait and retry once
        if (res.error.includes("429")) {
          console.log("  ⏳ Waiting 60s for rate limit...");
          await sleep(60000);
          const retry = await runPageSpeed(url, strategy);
          if ("error" in retry) {
            console.log(`  ❌ ${strategy} retry failed: ${retry.error}`);
          } else {
            result[strategy] = retry.scores;
            (result as any)[`${strategy}_audits`] = retry.failingAudits;
          }
        }
      } else {
        result[strategy] = res.scores;
        (result as any)[`${strategy}_audits`] = res.failingAudits;

        const s = res.scores;
        console.log(
          `  ${strategy}: ${scoreIcon(s.performance)} Perf ${s.performance} | ` +
            `${scoreIcon(s.accessibility)} A11y ${s.accessibility} | ` +
            `${scoreIcon(s.best_practices)} BP ${s.best_practices} | ` +
            `${scoreIcon(s.seo)} SEO ${s.seo}`
        );
      }

      // Rate limit spacing
      await sleep(2000);
    }

    results.push(result);
  }

  // Write detailed results
  const outputPath = resolve(OUTPUT_DIR, "pagespeed-results.json");
  writeFileSync(outputPath, JSON.stringify(results, null, 2));

  // Print summary table
  console.log("\n" + "=".repeat(80));
  console.log("PageSpeed Summary");
  console.log("=".repeat(80));
  console.log(
    "Page".padEnd(30) +
      "  Perf(M/D)  A11y(M/D)  BP(M/D)    SEO(M/D)"
  );
  console.log("-".repeat(80));

  let anyBelow90 = false;
  for (const r of results) {
    const m = r.mobile;
    const d = r.desktop;
    const fmt = (mob: number | undefined, desk: number | undefined) => {
      const ms = mob !== undefined ? String(mob).padStart(3) : "  —";
      const ds = desk !== undefined ? String(desk).padStart(3) : "  —";
      if ((mob !== undefined && mob < 90) || (desk !== undefined && desk < 90)) anyBelow90 = true;
      return `${ms}/${ds}`;
    };
    console.log(
      r.page.padEnd(30) +
        `  ${fmt(m?.performance, d?.performance)}    ${fmt(m?.accessibility, d?.accessibility)}    ` +
        `${fmt(m?.best_practices, d?.best_practices)}    ${fmt(m?.seo, d?.seo)}`
    );
  }
  console.log("=".repeat(80));

  if (anyBelow90) {
    console.log("⚠ Some scores are below 90 — see pagespeed-results.json for failing audits.");
  } else {
    console.log("✅ All scores ≥90. Check pagespeed-results.json for details.");
  }

  console.log(`\n📁 Full results: ${outputPath}`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
