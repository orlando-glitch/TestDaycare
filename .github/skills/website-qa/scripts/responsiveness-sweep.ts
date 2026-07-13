#!/usr/bin/env npx tsx
/**
 * responsiveness-sweep.ts
 *
 * Screenshot-based viewport sweep from 320→2500px for manual or agent
 * visual review. Captures a full-page screenshot at every step for each
 * page, plus an optional horizontal overflow detection report.
 *
 * No FFmpeg or video generation — just screenshots the user or agent
 * can review for visual issues (clipping, overlap, orphaned words, etc).
 *
 * Prerequisites:
 *   npm install playwright
 *
 * Usage:
 *   npx tsx scripts/responsiveness-sweep.ts <base_url> [page1] [page2] ...
 *
 * Options:
 *   --step <px>         Step size in px (default: 50)
 *   --min <px>          Start width (default: 320)
 *   --max <px>          End width (default: 2500)
 *   --ref-only          Only capture 7 key reference breakpoints
 *
 * Output: qa-screenshots/
 *   - <page>-<width>px.png       — screenshot at each step
 *   - sweep-report.json          — metadata + overflow detection results
 */

import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

// --- CLI parsing ---
const rawArgs = process.argv.slice(2);

function getFlag(name: string, fallback: string): string {
  const idx = rawArgs.indexOf(`--${name}`);
  return idx >= 0 && rawArgs[idx + 1] && !rawArgs[idx + 1].startsWith("--") ? rawArgs[idx + 1] : fallback;
}
function hasFlag(name: string): boolean {
  return rawArgs.includes(`--${name}`);
}

const flagsWithValues = new Set(["step", "min", "max"]);
const positional: string[] = [];
for (let i = 0; i < rawArgs.length; i++) {
  if (rawArgs[i].startsWith("--")) {
    if (flagsWithValues.has(rawArgs[i].replace(/^--/, ""))) i++;
    continue;
  }
  positional.push(rawArgs[i]);
}

const STEP = parseInt(getFlag("step", "50"), 10);
const MIN_W = parseInt(getFlag("min", "320"), 10);
const MAX_W = parseInt(getFlag("max", "2500"), 10);
const REF_ONLY = hasFlag("ref-only");
const HEIGHT = 900;
const SCREENSHOT_DIR = resolve("qa-screenshots");

const REFERENCE_BREAKPOINTS = [320, 400, 750, 1023, 1024, 1400, 2500];

const baseUrl = positional[0];
if (!baseUrl) {
  console.error("Usage: npx tsx scripts/responsiveness-sweep.ts <base_url> [page1] [page2] ...");
  console.error("\nOptions:");
  console.error("  --step 50       Step size in pixels (default: 50)");
  console.error("  --min 320       Start width (default: 320)");
  console.error("  --max 2500      End width (default: 2500)");
  console.error("  --ref-only      Only capture 7 key reference breakpoints");
  process.exit(1);
}

const pages = positional.slice(1);
if (pages.length === 0) pages.push("/");

mkdirSync(SCREENSHOT_DIR, { recursive: true });

// --- Helpers ---
async function dismissBanners(page: Page): Promise<void> {
  for (const sel of [
    'button:has-text("Accept")',
    'button:has-text("Accept All")',
    'button:has-text("Got it")',
    'button:has-text("Close")',
    '[aria-label="Close"]',
  ]) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 300 })) await btn.click();
    } catch {}
  }
}

async function scrollFull(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let total = 0;
      const step = 300;
      const timer = setInterval(() => {
        window.scrollBy(0, step);
        total += step;
        if (total >= document.body.scrollHeight) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          resolve();
        }
      }, 80);
    });
  });
  await page.waitForTimeout(300);
}

async function checkOverflow(page: Page): Promise<{ hasOverflow: boolean; elements: any[] }> {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const hasOverflow = document.documentElement.scrollWidth > vw + 1;
    const elements: any[] = [];
    if (hasOverflow) {
      document.querySelectorAll("*").forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.right > vw + 2) {
          elements.push({
            tag: el.tagName,
            classes: (el as HTMLElement).className?.toString().substring(0, 100) || "",
            id: el.id || "",
            right: Math.round(rect.right),
          });
        }
      });
    }
    return { hasOverflow, elements: elements.slice(0, 5) };
  });
}

// --- Main ---
async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const reportData: any[] = [];

  for (const pagePath of pages) {
    const safeName = pagePath === "/" ? "home" : pagePath.replace(/^\//, "").replace(/\//g, "-");
    const fullUrl = `${baseUrl.replace(/\/$/, "")}${pagePath}`;

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📄 ${fullUrl}`);
    console.log("=".repeat(60));

    const pageReport: any = {
      page: pagePath,
      url: fullUrl,
      screenshots: [],
      overflowWidths: [],
    };

    // Determine which widths to test
    let widths: number[];
    if (REF_ONLY) {
      widths = REFERENCE_BREAKPOINTS;
      console.log(`📸 Reference breakpoints only: ${widths.join(", ")}px`);
    } else {
      widths = [];
      for (let w = MIN_W; w <= MAX_W; w += STEP) widths.push(w);
      // Ensure reference breakpoints are included
      for (const bp of REFERENCE_BREAKPOINTS) {
        if (!widths.includes(bp) && bp >= MIN_W && bp <= MAX_W) {
          widths.push(bp);
        }
      }
      widths.sort((a, b) => a - b);
      // Deduplicate
      widths = [...new Set(widths)];
      console.log(`📸 Sweep: ${widths.length} widths (${MIN_W}→${MAX_W}px, step ${STEP}px + reference breakpoints)`);
    }

    for (let i = 0; i < widths.length; i++) {
      const w = widths[i];
      await page.setViewportSize({ width: w, height: HEIGHT });

      try {
        await page.goto(fullUrl, { waitUntil: "networkidle", timeout: 15000 });
      } catch {
        try { await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 10000 }); } catch {}
      }

      await dismissBanners(page);
      await scrollFull(page);

      // Check for horizontal overflow
      const overflow = await checkOverflow(page);

      const filename = `${safeName}-${w}px.png`;
      await page.screenshot({ path: resolve(SCREENSHOT_DIR, filename), fullPage: true });

      const marker = overflow.hasOverflow ? "❌ OVERFLOW" : "✅";
      const isRef = REFERENCE_BREAKPOINTS.includes(w) ? " [ref]" : "";
      console.log(`  ${w}px ${marker}${isRef}`);

      pageReport.screenshots.push(filename);
      if (overflow.hasOverflow) {
        pageReport.overflowWidths.push({ width: w, elements: overflow.elements });
      }

      // Progress
      if ((i + 1) % 10 === 0) {
        const pct = Math.round(((i + 1) / widths.length) * 100);
        process.stdout.write(`  Progress: ${pct}%\r`);
      }
    }

    reportData.push(pageReport);
    console.log(`  ✅ ${pageReport.screenshots.length} screenshots captured`);
    if (pageReport.overflowWidths.length > 0) {
      console.log(`  ⚠ Horizontal overflow at: ${pageReport.overflowWidths.map((o: any) => `${o.width}px`).join(", ")}`);
    }
  }

  await browser.close();

  // Write report
  const report = {
    baseUrl,
    config: { step: STEP, min: MIN_W, max: MAX_W, refOnly: REF_ONLY },
    pages: reportData,
    summary: {
      totalPages: reportData.length,
      totalScreenshots: reportData.reduce((s, p) => s + p.screenshots.length, 0),
      pagesWithOverflow: reportData.filter((p) => p.overflowWidths.length > 0).length,
    },
  };

  const reportPath = resolve(SCREENSHOT_DIR, "sweep-report.json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`\n${"=".repeat(60)}`);
  console.log("Sweep complete");
  console.log("=".repeat(60));
  console.log(`Total screenshots: ${report.summary.totalScreenshots}`);
  console.log(`Pages with overflow: ${report.summary.pagesWithOverflow}`);
  console.log(`Output: ${SCREENSHOT_DIR}/`);
  console.log(`Report: ${reportPath}`);
  console.log(`\n⚠ Note: 50px steps may miss narrow-range issues.`);
  console.log(`  Manually drag-resize your browser on key pages to verify.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
