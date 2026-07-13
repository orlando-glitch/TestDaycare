---
name: website-qa
description: |
  End-to-end website quality assurance testing using Playwright MCP browser tools.
  Covers the full QA checklist: responsiveness across 7 breakpoints (320–2500px),
  console error checks, browser compatibility notes, functionality testing (nav, buttons,
  links, forms), broken link validation, redirect verification, favicon and social
  thumbnail validation, HTML validation, Google PageSpeed scoring (performance,
  accessibility, best practices, SEO for every page on mobile & desktop), content
  verification (proofreading, contact info accuracy), and a final site walkthrough.

  Use this skill any time the request involves: "QA this website", "test responsiveness",
  "check for broken links", "run PageSpeed", "validate HTML", "check console errors",
  "proofread the site", "test the navigation", "do a full site audit", "check all
  breakpoints", "is this site ready for demo", "pre-launch checklist", "website quality
  check", or any variation of pre-deployment website review. Also use when someone
  asks to test a specific aspect covered here (just responsiveness, just PageSpeed, etc.)
  — run the relevant subset.

  Do NOT use this skill for: building or designing websites (use frontend-design), backend
  API testing, database work, or unit/integration test authoring. This skill is for
  manual/automated QA of a rendered website in a browser.
---

# Website QA Testing

Full-spectrum website quality assurance driven by Playwright MCP browser tools. Covers every step of the pre-deployment QA checklist — from responsiveness sweeps to PageSpeed audits — against any target URL.

**Read `references/checklist-detail.md` before starting any QA run.** It has the exact procedures, selectors, common errors, and pass/fail criteria for each check. This file (SKILL.md) covers setup, workflow, and reporting.

## 1. Setup

### Target URL

The user provides a URL (production, staging, or localhost). Confirm it's reachable before proceeding:

```
Navigate to the target URL → verify HTTP 200 or rendered content.
```

If localhost, probe first (`curl -s -o /dev/null -w "%{http_code}" <url>`). If down, ask the user to start the dev server.

### Sitemap discovery

Before testing, build a page inventory. Try these in order:

1. **User-provided list** — if the user gives specific pages, use those.
2. **Sitemap XML** — fetch `<base_url>/sitemap.xml`. Parse all `<loc>` entries.
3. **Crawl from homepage** — navigate to the homepage, extract all internal `<a href>` links, deduplicate. Follow one level deep if the site is small (<30 pages).
4. **Ask the user** — if none of the above yields a useful list, ask.

Store the page list — it's used by responsiveness, PageSpeed, broken links, HTML validation, and content checks.

### Scope negotiation

A full QA pass on a 50-page site takes significant time. Before starting, confirm scope:

- **Full QA** — all 12 checks, all pages. Default for sites ≤10 pages.
- **Homepage + key pages** — all 12 checks, but only homepage + pages the user specifies. Default for sites >10 pages.
- **Targeted** — user asks for specific checks only (e.g. "just run PageSpeed"). Run only those.

## 2. The 12-step checklist

Each step maps to the team's QA SOP. Detailed procedures are in `references/checklist-detail.md` — read it before running any step. Summary:

| # | Check | Scope | Tool / Method |
|---|-------|-------|---------------|
| 1 | **Responsiveness** | Every section, 7 breakpoints | Playwright viewport resize + screenshots |
| 2 | **Console errors** | Every page | `browser_console_messages` |
| 3 | **Browser compatibility** | Homepage + key pages | Notes for manual mobile check |
| 4 | **Functionality testing** | Nav, buttons, links, forms | Playwright click/navigate |
| 5 | **Broken link validation** | All pages | Playwright link crawl or external tool |
| 6 | **Redirect testing** | `_redirects` file / old sitemap | Playwright navigate + check final URL |
| 7 | **Favicon validation** | Site-wide | `browser_evaluate` to check `<link rel="icon">` |
| 8 | **Social thumbnail** | Every page | `browser_evaluate` to check OG/Twitter meta tags |
| 9 | **HTML validation** | Every page | W3C validator API or `npm run validate` |
| 10 | **Google PageSpeed** | Every page, mobile & desktop | PageSpeed Insights API |
| 11 | **Content verification** | Homepage (required) + all pages (optional) | AI-assisted proofreading |
| 12 | **Site walkthrough** | Full site | Final manual-style pass |

### Execution order

Run in the numbered order. Early steps (responsiveness, console errors) often surface issues that make later steps redundant or more targeted. If step 1 reveals a section is completely broken at 320px, note it and keep going — don't block the whole run.

### Parallel opportunities

These can run independently and don't require sequential browser state:
- Steps 7 + 8 (favicon + social thumbnail) — quick meta-tag checks
- Step 9 (HTML validation) — can run via API/CLI in parallel with browser checks
- Step 10 (PageSpeed) — API-based, doesn't need the Playwright browser

## 3. Responsiveness testing (Step 1 — detailed)

This is the highest-effort step. Full procedure in `references/checklist-detail.md § 1`.

### Approach: visual sweep via MCP browser

The agent **resizes the viewport in 50px steps from 320→2500px, screenshots at each step, and visually reviews every screenshot** for layout issues. This catches clipping, overlap, solo words, and aesthetic breaks that programmatic DOM checks miss — the same issues a human sees when dragging the browser edge to resize.

**Why visual, not programmatic**: DOM-based checks (`scrollWidth > clientWidth`, bounding rect math) miss real-world clipping — elements hidden behind siblings via z-index, text obscured by overlapping icons where neither technically overflows its container, `overflow: hidden` masking cut-off content. These are pixel-level visual problems that only show up in a screenshot.

**Disclaimer**: the 50px step size means the sweep may miss issues that only appear in a narrow 10–20px range between steps. After the agent sweep, the user should manually drag-resize the browser on any page that looks borderline, especially around the key breakpoints.

### Key reference breakpoints

| Width | Represents |
|-------|-----------|
| 320px | Smallest phones (iPhone SE) |
| 400px | Standard phones |
| 750px | Large phones / small tablets |
| 1023px | Just below common tablet breakpoint |
| 1024px | Tablet / iPad |
| 1400px | Standard desktop |
| 2500px | Ultra-wide monitors |

### What to look for at each screenshot

- **Solo words**: a single word orphaned on its own line in headings or buttons
- **Icon/graphic overlap with text**: icons positioned over text at certain widths
- **Image sizing**: images too large (overflowing) or too small (unreadable)
- **Horizontal overflow**: white space on sides, content extending past viewport
- **Button clipping**: CTAs cut off or unreachable
- **Button contrast**: buttons that blend into their section's background color
- **Navigation**: hamburger present and correct on mobile, full nav clean on desktop
- **Invisible text**: text the same color as its background — white text on white card, dark text on dark section. Looks like missing content but the element is there. Run the contrast JS snippet in `checklist-detail.md § 1` at every breakpoint.
- **Content parity in card grids**: all cards in a repeating grid should show the same depth of content. If one card shows a heading + image + paragraph and the next shows only a heading + image, the paragraph text is likely invisible (not missing). Compare cards side by side in the screenshot.
- **Excessive vertical whitespace**: a blank white band ≥150px between two styled sections. Usually a wave/curve divider that has floated away from its section, or a section with runaway bottom padding. Use the gap-checker JS snippet in `checklist-detail.md § 1`.
- **Tight/cramped spacing**: section heading overlapping a wave divider above it, text flush against a section edge with no padding, elements touching with 0px gap.
- **Overlapping decorative elements**: an SVG, image, circle, blob, or styled pseudo-element that physically covers part of a heading or paragraph letter. The text color is fine — it's the overlapping shape on top that reduces legibility. Run the overlap-detection JS snippet in `checklist-detail.md § 1`, then screenshot the hero at desktop to visually confirm no decorative shape is cutting through a letter.

### MCP browser procedure

For each page in scope:

1. Navigate to the page, wait for `networkidle`, dismiss cookie banners.
2. Loop from 320 to 2500 in 50px steps:
   - Set viewport width via `browser_run_code`: `await page.setViewportSize({ width: W, height: 900 })`
   - Reload on first width and every ~200px (SPAs may not respond to resize alone)
   - Screenshot and visually inspect
   - If an issue is spotted, note the width, the issue, and screenshot path
3. Report all findings with severity, width, and screenshot evidence.

### Standalone script (for user review)

The script captures screenshots at each step for the user to review manually:
```bash
npx tsx scripts/responsiveness-sweep.ts <base_url> / /about /contact
```
Output: `qa-screenshots/<page>-<width>px.png` at every step + `sweep-report.json`.

### Efficiency for large sites

- Homepage: full 320→2500 sweep at 50px steps (mandatory)
- Other pages: full sweep if ≤10 pages; key 7 breakpoints only if >10
- If an issue is spotted at a step, do a focused sweep at 10px steps around that range

## 4. PageSpeed testing (Step 10 — detailed)

Uses the Google PageSpeed Insights API (free, no key required for basic use):

```
https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<URL>&strategy=<mobile|desktop>&category=performance&category=accessibility&category=best-practices&category=seo
```

### Targets

| Category | Target | Escalation threshold |
|----------|--------|---------------------|
| Performance | 100 | <90 → flag for team review |
| Accessibility | 100 | <90 → flag |
| Best Practices | 100 | <90 → flag |
| SEO | 100 | <90 → flag |

**Homepage scores are the highest priority.** Other pages should aim for the same targets but homepage is non-negotiable.

### Common SEO fix: non-descriptive link text

PageSpeed frequently flags "Links do not have descriptive text" for buttons like "Read More" or "Learn More." The fix:
1. Find the button on the site
2. Check what page it links to
3. Make the text more descriptive ("Read More" → "About Our Services")
4. Note that longer button text may break responsiveness — flag for re-check at step 1

### Reporting PageSpeed

For each page, report a table:

```
Page: /about
         Mobile  Desktop
Perf:      92      98
A11y:      95     100
BP:       100     100
SEO:       89      95   ← flag: <90 mobile SEO
```

List specific failing audits for any category <90.

## 5. Broken link validation (Step 5)

Crawl every `<a href>` on every page in scope. For each link:
- Internal links: navigate and confirm 200 (not 404, not redirect loop)
- External links: HEAD request, check for 200/301/302 (flag 4xx/5xx)
- Anchor links (`#section`): verify the target ID exists on the page
- `mailto:` / `tel:` links: validate format only (don't send)

**If the user already has a broken-link tool**, run it and incorporate results. Still do a quick spot-check of 5–10 links via Playwright to cross-validate.

## 6. Output & reporting

### Quick report (single check or small site)

Inline in conversation:
1. **Summary**: what was tested, pass/fail
2. **Findings**: each issue with severity, page, description, screenshot path
3. **Scores**: PageSpeed table if applicable

### Full QA report (multi-check, multi-page)

Produce a self-contained HTML report. Write findings to `qa-findings.json`, then build:

```json
{
  "title": "Website QA Report — <site name>",
  "url": "<target URL>",
  "date": "<ISO date>",
  "scope": "full | homepage-plus | targeted",
  "checks_run": [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12],
  "summary": {
    "pages_tested": 12,
    "breakpoints_tested": 7,
    "total_findings": 8,
    "by_severity": { "critical": 1, "major": 3, "minor": 4 }
  },
  "pagespeed": [
    {
      "page": "/",
      "mobile": { "performance": 95, "accessibility": 100, "best_practices": 100, "seo": 92 },
      "desktop": { "performance": 99, "accessibility": 100, "best_practices": 100, "seo": 100 }
    }
  ],
  "findings": [
    {
      "id": "F-001",
      "check": 1,
      "check_name": "Responsiveness",
      "severity": "major",
      "title": "Hero text overlaps CTA button at 320px",
      "page": "/",
      "breakpoint": "320px",
      "description": "At 320px viewport width, the hero heading text overflows into the CTA button area. The button text is partially obscured.",
      "screenshot": "qa-screenshots/home-320-hero-overlap.png",
      "suggested_fix": "Add overflow-wrap or reduce font size in the <576px media query."
    }
  ]
}
```

Build the HTML with `scripts/build-qa-report.ts` (included in this skill). The report includes:
- Summary card with pass/fail counts by severity
- PageSpeed score cards per page (color-coded: green ≥90, yellow 50–89, red <50)
- Finding cards with inlined screenshots, grouped by check
- Browser compatibility notes section

### Severity definitions

| Severity | Meaning | Examples |
|----------|---------|---------|
| **Critical** | Site is broken / unusable | Page crashes, nav doesn't work, content invisible |
| **Major** | Significant UX issue | Text covered by icons, horizontal scroll, buttons unreachable, PageSpeed <70 |
| **Minor** | Cosmetic / polish | Solo word wrapping, slight spacing issue, PageSpeed 90–99 |
| **Info** | Observation, no action needed | Suggestion for improvement, note for future |

## 7. Checklist quick-reference

Use this as a running checklist during the QA session. Check off items as you go:

```
[ ] 1.  Responsiveness — 7 breakpoints × all pages in scope
[ ] 2.  Console errors — all pages
[ ] 3.  Browser compatibility — note for user (manual mobile check)
[ ] 4.  Functionality — nav, buttons, links, forms
[ ] 5.  Broken links — all internal + external links
[ ] 6.  Redirects — _redirects file or old sitemap URLs
[ ] 7.  Favicon — present and loading
[ ] 8.  Social thumbnail — OG and Twitter meta tags on all pages
[ ] 9.  HTML validation — all pages
[ ] 10. PageSpeed — all pages, mobile + desktop
[ ] 11. Content verification — proofread, contact info accuracy
[ ] 12. Site walkthrough — final pass as a user would experience it
```

## 8. Agent compatibility

This skill is designed to work with any AI coding agent that has access to a Playwright MCP server. The procedures use generic Playwright API calls, not agent-specific tool names.

### GitHub Copilot (VS Code)

**Setup**: install the `@playwright/mcp` MCP server in your VS Code MCP config (`.vscode/mcp.json` or user settings):

```json
{
  "servers": {
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest", "--viewport-size=1440,900"]
    }
  }
}
```

**Tool mapping**: Copilot's Playwright MCP tools are typically prefixed `mcp_playwright_*`. The skill's procedures reference raw Playwright API (`page.goto()`, `page.setViewportSize()`, `page.evaluate()`, `page.screenshot()`). When using MCP tools:
- Navigation → `mcp_playwright_browser_navigate`
- Screenshots → `mcp_playwright_browser_take_screenshot`
- JS evaluation → `mcp_playwright_browser_evaluate` or `mcp_playwright_browser_run_code`
- Click/type → `mcp_playwright_browser_click` / `mcp_playwright_browser_type`
- Console → `mcp_playwright_browser_console_messages`

**Limitation — visual review**: Copilot can see screenshots via its vision capabilities. The responsiveness sweep relies on the agent visually reviewing screenshots at each viewport step. Verify that your Copilot version supports image/screenshot review. If not, the standalone scripts produce screenshots for the user to review manually.

**Limitation — PageSpeed API**: the standalone `pagespeed-audit.ts` script calls the Google PageSpeed Insights API via `fetch`. This requires network access from the terminal. If running in a restricted environment, use `curl` in the terminal instead, or ask the user to run PageSpeed manually at `https://pagespeed.web.dev`.

### Claude (claude.ai / Claude Code)

Works natively with Claude's MCP browser tools. Claude can visually review screenshots in-context. All 12 checks work as described.

### Other agents

Any agent with Playwright MCP access can run this skill. The key requirement is that the agent can:
1. Control a browser (navigate, resize viewport, click, evaluate JS)
2. Take and view screenshots
3. Run bash commands (for standalone scripts, PageSpeed API calls, HTML validation)

If the agent cannot view screenshots, the responsiveness sweep and site walkthrough should fall back to programmatic checks only, with a disclaimer that visual issues may be missed.

### Standalone scripts (no MCP required)

The scripts in `scripts/` use Playwright directly (not MCP) and run from the terminal:
- `responsiveness-sweep.ts` — viewport sweep with screenshots at each step
- `pagespeed-audit.ts` — PageSpeed Insights API for all pages
- `broken-links.ts` — recursive link crawler
- `build-qa-report.ts` — HTML report generator from `qa-findings.json`

These work in any environment with Node.js, `npx tsx`, and Playwright installed. No AI agent required — useful for CI or manual runs.

## 9. Edge cases & gotchas

- **SPAs** (React, Next, etc.): viewport resize may not retrigger responsive styles. Always reload after resize.
- **Lazy-loaded content**: scroll the full page before screenshotting. Wait for `networkidle` + extra 500ms.
- **Auth-gated pages**: if the site has a login, ask the user for test credentials or a storage state file. Don't skip auth-gated pages silently.
- **Cookie banners / popups**: dismiss them before responsiveness screenshots, or they'll obscure content in every shot.
- **Animations**: wait for them to complete before screenshotting. Use `page.waitForTimeout(1000)` after navigation if the site has entrance animations.
- **Dark mode**: if the site supports it, run responsiveness checks in both modes (or at minimum, note that dark mode wasn't tested).
- **Third-party scripts**: PageSpeed will flag these (analytics, chat widgets, fonts). Note them but don't count them against the dev team — they're usually out of scope to fix.
- **PageSpeed on localhost**: the API requires a publicly reachable URL. For local dev, either deploy to a staging URL first or use Lighthouse CLI (`npx lighthouse <url> --output json --chrome-flags="--headless"`).
- **Responsiveness sweep coverage**: the 50px step size may miss narrow breakpoint issues. Always recommend the user do a manual drag-resize pass on key pages after the agent sweep.
