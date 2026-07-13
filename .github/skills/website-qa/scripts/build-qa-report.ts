#!/usr/bin/env npx tsx
/**
 * build-qa-report.ts
 *
 * Reads qa-findings.json → writes a self-contained qa-report.html
 * with severity-colored cards, inlined screenshots (base64), and
 * PageSpeed score grids.
 *
 * Usage:
 *   npx tsx scripts/build-qa-report.ts [input.json] [output.html]
 *
 * Defaults: qa-findings.json → qa-report.html (both in cwd)
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, extname } from "path";

const inputPath = resolve(process.argv[2] || "qa-findings.json");
const outputPath = resolve(process.argv[3] || "qa-report.html");

if (!existsSync(inputPath)) {
  console.error(`❌ Input not found: ${inputPath}`);
  process.exit(1);
}

interface Finding {
  id: string;
  check?: number;
  check_name?: string;
  severity: "critical" | "major" | "minor" | "info";
  title: string;
  page?: string;
  where?: string;
  breakpoint?: string;
  description: string;
  repro?: string;
  suggested_fix?: string;
  effort?: string;
  screenshot?: string;
  screenshot_na?: string;
}

interface PageSpeedEntry {
  page: string;
  mobile?: { performance: number; accessibility: number; best_practices: number; seo: number };
  desktop?: { performance: number; accessibility: number; best_practices: number; seo: number };
}

interface QAReport {
  title: string;
  url?: string;
  date?: string;
  scope?: string;
  checks_run?: number[];
  summary?: {
    pages_tested?: number;
    breakpoints_tested?: number;
    total_findings?: number;
    by_severity?: Record<string, number>;
  };
  pagespeed?: PageSpeedEntry[];
  findings: Finding[];
}

const report: QAReport = JSON.parse(readFileSync(inputPath, "utf-8"));

function inlineScreenshot(screenshotPath: string | undefined): string | null {
  if (!screenshotPath) return null;
  const abs = resolve(screenshotPath);
  if (!existsSync(abs)) return null;
  const ext = extname(abs).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  const b64 = readFileSync(abs).toString("base64");
  return `data:${mime};base64,${b64}`;
}

function severityColor(s: string): string {
  switch (s) {
    case "critical": return "#dc2626";
    case "major": return "#ea580c";
    case "minor": return "#ca8a04";
    case "info": return "#2563eb";
    default: return "#6b7280";
  }
}

function severityBg(s: string): string {
  switch (s) {
    case "critical": return "#fef2f2";
    case "major": return "#fff7ed";
    case "minor": return "#fefce8";
    case "info": return "#eff6ff";
    default: return "#f9fafb";
  }
}

function scoreColor(score: number): string {
  if (score >= 90) return "#16a34a";
  if (score >= 50) return "#ca8a04";
  return "#dc2626";
}

function scoreBg(score: number): string {
  if (score >= 90) return "#f0fdf4";
  if (score >= 50) return "#fefce8";
  return "#fef2f2";
}

// Build summary counts
const bySeverity: Record<string, number> = { critical: 0, major: 0, minor: 0, info: 0 };
for (const f of report.findings) {
  bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
}
const missingScreenshots = report.findings.filter(f => !f.screenshot && !f.screenshot_na).length;

// Group findings by check
const checkNames: Record<number, string> = {
  1: "Responsiveness", 2: "Console Errors", 3: "Browser Compatibility",
  4: "Functionality", 5: "Broken Links", 6: "Redirects",
  7: "Favicon", 8: "Social Thumbnail", 9: "HTML Validation",
  10: "PageSpeed", 11: "Content", 12: "Site Walkthrough"
};

// Generate PageSpeed section
function renderPageSpeed(): string {
  if (!report.pagespeed || report.pagespeed.length === 0) return "";
  const categories = ["performance", "accessibility", "best_practices", "seo"];
  const catLabels: Record<string, string> = {
    performance: "Perf", accessibility: "A11y", best_practices: "BP", seo: "SEO"
  };

  let rows = "";
  for (const entry of report.pagespeed) {
    rows += `<tr><td style="font-weight:600;padding:8px 12px;border-bottom:1px solid #e5e7eb;">${entry.page}</td>`;
    for (const cat of categories) {
      const mScore = (entry.mobile as any)?.[cat] ?? "—";
      const dScore = (entry.desktop as any)?.[cat] ?? "—";
      const mColor = typeof mScore === "number" ? scoreColor(mScore) : "#6b7280";
      const dColor = typeof dScore === "number" ? scoreColor(dScore) : "#6b7280";
      rows += `<td style="text-align:center;padding:8px;border-bottom:1px solid #e5e7eb;">
        <span style="color:${mColor};font-weight:700;">${mScore}</span>
        <span style="color:#9ca3af;margin:0 2px;">/</span>
        <span style="color:${dColor};font-weight:700;">${dScore}</span>
      </td>`;
    }
    rows += `</tr>`;
  }

  return `
    <div style="margin:24px 0;">
      <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">PageSpeed Scores <span style="font-weight:400;font-size:14px;color:#6b7280;">(mobile / desktop)</span></h2>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="text-align:left;padding:10px 12px;border-bottom:2px solid #e5e7eb;">Page</th>
              ${categories.map(c => `<th style="text-align:center;padding:10px 8px;border-bottom:2px solid #e5e7eb;">${catLabels[c]}</th>`).join("")}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p style="font-size:12px;color:#9ca3af;margin-top:6px;">
        Green ≥90 · Yellow 50–89 · Red &lt;50 · Target: 100 all categories, especially homepage
      </p>
    </div>`;
}

// Generate findings HTML
function renderFindings(): string {
  if (report.findings.length === 0) {
    return `<div style="text-align:center;padding:48px;color:#6b7280;">
      <p style="font-size:18px;">✅ No findings — site looks great!</p>
    </div>`;
  }

  let html = "";
  // Group by check number (or "uncategorized")
  const groups = new Map<string, Finding[]>();
  for (const f of report.findings) {
    const key = f.check ? `${f.check}. ${f.check_name || checkNames[f.check] || "Other"}` : "Other";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }

  for (const [groupName, findings] of groups) {
    html += `<h3 style="font-size:16px;font-weight:600;margin:24px 0 12px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;">${groupName}</h3>`;
    for (const f of findings) {
      const img = inlineScreenshot(f.screenshot);
      const location = f.page || f.where || "";
      const bp = f.breakpoint ? ` @ ${f.breakpoint}` : "";

      html += `
        <div style="border:1px solid #e5e7eb;border-left:4px solid ${severityColor(f.severity)};
                    border-radius:6px;padding:16px;margin-bottom:12px;background:${severityBg(f.severity)};">
          <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px;">
            <div>
              <span style="font-size:12px;font-weight:700;color:${severityColor(f.severity)};
                           text-transform:uppercase;letter-spacing:0.05em;">${f.severity}</span>
              <span style="font-size:12px;color:#6b7280;margin-left:8px;">${f.id}</span>
            </div>
            ${location ? `<span style="font-size:12px;color:#6b7280;">${location}${bp}</span>` : ""}
          </div>
          <h4 style="font-size:15px;font-weight:600;margin:0 0 8px;">${f.title}</h4>
          <p style="font-size:14px;color:#374151;margin:0 0 8px;line-height:1.5;">${f.description}</p>
          ${f.repro ? `<details style="margin-bottom:8px;"><summary style="font-size:13px;cursor:pointer;color:#6b7280;">Repro steps</summary><pre style="font-size:12px;background:#f9fafb;padding:8px;border-radius:4px;margin-top:4px;white-space:pre-wrap;">${f.repro}</pre></details>` : ""}
          ${f.suggested_fix ? `<p style="font-size:13px;color:#059669;margin:0 0 8px;">💡 ${f.suggested_fix}${f.effort ? ` <span style="color:#6b7280;">(effort: ${f.effort})</span>` : ""}</p>` : ""}
          ${img ? `<img src="${img}" style="max-width:100%;border-radius:4px;border:1px solid #d1d5db;margin-top:8px;" loading="lazy" />` : ""}
          ${!img && f.screenshot_na ? `<p style="font-size:12px;color:#9ca3af;font-style:italic;margin-top:8px;">No screenshot: ${f.screenshot_na}</p>` : ""}
          ${!img && !f.screenshot_na ? `<p style="font-size:12px;color:#ca8a04;margin-top:8px;">⚠ Missing screenshot</p>` : ""}
        </div>`;
    }
  }
  return html;
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${report.title || "QA Report"}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           line-height: 1.6; color: #1f2937; background: #f3f4f6; padding: 24px; }
    .container { max-width: 960px; margin: 0 auto; }
    .header { background: white; border-radius: 12px; padding: 24px 32px; margin-bottom: 24px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .content { background: white; border-radius: 12px; padding: 24px 32px; margin-bottom: 24px;
               box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
                    gap: 12px; margin-top: 16px; }
    .summary-card { text-align: center; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb; }
    .summary-card .count { font-size: 28px; font-weight: 800; }
    .summary-card .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="font-size:24px;font-weight:800;">${report.title || "QA Report"}</h1>
      ${report.url ? `<p style="color:#6b7280;font-size:14px;margin-top:4px;">${report.url}</p>` : ""}
      ${report.date ? `<p style="color:#9ca3af;font-size:13px;">${report.date}</p>` : ""}
      ${report.scope ? `<p style="color:#9ca3af;font-size:13px;">Scope: ${report.scope}</p>` : ""}
      <div class="summary-grid">
        <div class="summary-card" style="background:${severityBg("critical")}">
          <div class="count" style="color:${severityColor("critical")}">${bySeverity.critical}</div>
          <div class="label">Critical</div>
        </div>
        <div class="summary-card" style="background:${severityBg("major")}">
          <div class="count" style="color:${severityColor("major")}">${bySeverity.major}</div>
          <div class="label">Major</div>
        </div>
        <div class="summary-card" style="background:${severityBg("minor")}">
          <div class="count" style="color:${severityColor("minor")}">${bySeverity.minor}</div>
          <div class="label">Minor</div>
        </div>
        <div class="summary-card" style="background:${severityBg("info")}">
          <div class="count" style="color:${severityColor("info")}">${bySeverity.info}</div>
          <div class="label">Info</div>
        </div>
        <div class="summary-card">
          <div class="count" style="color:#1f2937;">${report.findings.length}</div>
          <div class="label">Total</div>
        </div>
        ${missingScreenshots > 0 ? `<div class="summary-card" style="background:#fefce8;">
          <div class="count" style="color:#ca8a04;">${missingScreenshots}</div>
          <div class="label">Missing Screenshots</div>
        </div>` : ""}
      </div>
    </div>

    ${report.pagespeed ? `<div class="content">${renderPageSpeed()}</div>` : ""}

    <div class="content">
      <h2 style="font-size:20px;font-weight:700;margin-bottom:16px;">Findings</h2>
      ${renderFindings()}
    </div>

    <p style="text-align:center;color:#9ca3af;font-size:12px;padding:16px;">
      Generated by website-qa skill · ${new Date().toISOString().split("T")[0]}
    </p>
  </div>
</body>
</html>`;

writeFileSync(outputPath, html, "utf-8");
console.log(`✅ Report written to ${outputPath}`);
console.log(`   ${report.findings.length} findings (${bySeverity.critical} critical, ${bySeverity.major} major, ${bySeverity.minor} minor, ${bySeverity.info} info)`);
if (missingScreenshots > 0) {
  console.log(`   ⚠ ${missingScreenshots} findings missing screenshots`);
}
