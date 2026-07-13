# Checklist detail reference

Exact procedures, selectors, and pass/fail criteria for each of the 12 QA checks. The main SKILL.md has the overview and workflow — this file has the how-to.

## § 1. Responsiveness

### Approach: visual sweep

The responsiveness check uses a **visual screenshot sweep** — the agent resizes the viewport in 50px steps from 320→2500px, screenshots at each step, and visually reviews every screenshot for layout issues. This catches clipping, overlap, and aesthetic problems that programmatic DOM checks miss.

**Disclaimer**: 50px steps may miss issues in narrow ranges. The user should manually drag-resize the browser on key pages after the agent sweep.

### Reference breakpoints

These widths represent key device categories and are always included in the sweep:

| Width | Height | Represents |
|-------|--------|-----------|
| 320px | 900px | Smallest phones (iPhone SE, Galaxy Fold) |
| 400px | 900px | Standard phones (iPhone 14, Pixel) |
| 750px | 900px | Large phones / phablets / small tablets |
| 1023px | 900px | Just below common tablet breakpoint |
| 1024px | 900px | Tablet (iPad portrait) |
| 1400px | 900px | Standard laptop/desktop |
| 2500px | 900px | Ultra-wide monitors |

### MCP browser sweep procedure

For each page:

```
1. Navigate to page, wait for networkidle
2. Dismiss cookie banners / popups
3. For width = 320 to 2500, step 50:
   a. Set viewport: page.setViewportSize({ width, height: 900 })
   b. Reload page (SPAs may not respond to resize alone)
   c. Scroll full page to trigger lazy loading
   d. Wait 300ms for settle
   e. Screenshot
   f. Visually inspect for issues (see checklist below)
   g. If issue found → note width, description, screenshot path
4. Report all findings
```

On reload/scroll at each step:
```js
// Reload
await page.goto(url, { waitUntil: 'networkidle' });

// Dismiss cookie banners
for (const sel of ['button:has-text("Accept")', 'button:has-text("Got it")', 'button:has-text("Close")', '[aria-label="Close"]']) {
  try {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 300 })) await btn.click();
  } catch {}
}

// Scroll full page to trigger lazy loading
await page.evaluate(() => {
  return new Promise(resolve => {
    let totalHeight = 0;
    const distance = 300;
    const timer = setInterval(() => {
      window.scrollBy(0, distance);
      totalHeight += distance;
      if (totalHeight >= document.body.scrollHeight) {
        clearInterval(timer);
        window.scrollTo(0, 0);
        resolve();
      }
    }, 100);
  });
});
await page.waitForTimeout(300);
```

### Visual checklist (what to look for at each screenshot)

**Solo words**: A single word wraps to its own line, looking orphaned. Common in headings and CTAs. Example: "Host Your" on line 1, "Event" alone on line 2. Fix: adjust text, add `&nbsp;`, or tweak the breakpoint CSS.

**Icon/graphic overlap with text**: Icons positioned absolutely or with negative margins that collide with adjacent text at certain widths. Check:
- Section headers with decorative icons
- Card layouts where icons float near text
- Navigation items with icons

**Images too big or too small**:
- Images overflowing their container (horizontal scroll appears)
- Images shrinking to unreadable sizes on mobile
- Hero images not covering the viewport properly
- Logo too small on mobile or too large on desktop

**Horizontal overflow / white space**: Any content extending past the right edge of the viewport, causing a horizontal scrollbar or visible white space on the right side.

**Button visibility**: CTAs must be fully visible and tappable. Check that no button is clipped by viewport edges or hidden behind other elements.

**Navigation**:
- Mobile (≤1023px): hamburger menu should appear, open/close correctly, all links reachable
- Desktop (≥1024px): full nav visible, no overflow, dropdown menus work

**Button contrast against background**: Buttons should be visually distinct from their section's background color. A green button on a green background is a finding.

**Invisible text (color matches background)**: Text that is the same or nearly the same color as its background renders invisibly. This is easy to miss because the element exists in the DOM and has no overflow — it just can't be seen. Check for:
- White text on white/light card or section backgrounds (`color: #fff` with `background: #fff`)
- Dark/black text on dark section backgrounds (maroon, navy, dark-gray)
- Use this JS snippet to catch all instances programmatically:

```js
const issues = [];
document.querySelectorAll('h1,h2,h3,p,a,li,span').forEach(el => {
  const color = window.getComputedStyle(el).color;
  let bgColor = null;
  let ancestor = el.parentElement;
  while (ancestor && ancestor !== document.body) {
    const bg = window.getComputedStyle(ancestor).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)') { bgColor = bg; break; }
    ancestor = ancestor.parentElement;
  }
  if (!bgColor) return;
  const parse = s => s.match(/\d+/g)?.map(Number);
  const lum = ([r,g,b]) => 0.299*r + 0.587*g + 0.114*b;
  const c = parse(color), bg = parse(bgColor);
  if (c && bg && Math.abs(lum(c) - lum(bg)) < 20) {
    issues.push({ text: el.textContent.trim().substring(0, 40), color, bgColor });
  }
});
return [...new Map(issues.map(i => [i.color+'|'+i.bgColor, i])).values()];
```

Severity: **critical** if key content (headings, paragraphs, CTAs) is invisible. **Major** if supporting text is invisible.

**Content parity across repeated patterns**: When a page uses a repeating component (program cards, testimonial cards, feature cards), verify that ALL instances render comparable content. If one card shows a heading + paragraph + image and an adjacent identical card shows only a heading, the paragraph text is likely invisible (white-on-white or otherwise hidden). Check: do all cards in a grid have the same visible content depth? Screenshot the card grid at desktop and mobile — missing paragraphs stand out immediately.

**Excessive vertical whitespace (empty section gaps)**: Large unexplained blank areas between sections that look like missing content or broken layout. A ~200px+ white gap between two design sections is a finding. How to spot it in a screenshot:
- White/blank band between two styled sections
- Decorative wave or curve divider floating away from its section
- The gap is symmetrically too large compared to neighbouring section spacing

Programmatic check:
```js
const sections = Array.from(document.querySelectorAll('main > *[class]'));
for (let i = 1; i < sections.length; i++) {
  const prev = sections[i-1].getBoundingClientRect();
  const curr = sections[i].getBoundingClientRect();
  const gap = Math.round((curr.top + scrollY) - (prev.bottom + scrollY));
  if (gap > 100) console.warn(`Gap of ${gap}px between`, sections[i-1].className, '→', sections[i].className);
}
```
Severity: **major** if gap >150px and clearly unintentional.

**Tight/cramped spacing**: The inverse of excessive whitespace. Content that feels squeezed — heading sitting directly against a section divider, accordion items with no visual breathing room, text that runs into a decorative element. Look for:
- Section heading that appears to overlap a wave/curve divider above it
- Text flush against the top of a colored section with no padding
- Adjacent elements touching with 0px visible gap between them

Severity: **minor** to **major** depending on impact on readability.

**Overlapping decorative elements obscuring text**: Decorative SVGs, pseudo-elements, absolutely-positioned blobs, or background shapes that sit on top of text and reduce legibility. This is distinct from invisible text (the text color is fine in isolation) — the problem is a foreground or stacking-context element physically covering part of the text. Hard to detect from a screenshot alone because the text is *partially* visible. Look for:
- A letter or word that appears to be circled, underlined, or partially covered by a decorative shape
- An SVG or `<img>` with `position: absolute` or high `z-index` whose bounding box intersects a heading or paragraph
- `::before` / `::after` pseudo-elements with `content`, `background`, or `border-radius` that overlap their sibling text nodes
- Decorative circles, curves, or highlight strokes drawn over hero headings as a design flourish

Programmatic check — scans ALL absolutely/fixed-positioned non-text elements and checks if their bounding boxes intersect any heading or paragraph. This catches decorative elements regardless of their class name (bubbles, blobs, SVGs, images, custom shapes, etc.):
```js
const overlaps = [];
const textEls = Array.from(document.querySelectorAll('h1,h2,h3,p'));
// Select every absolutely or fixed-positioned element that isn't itself a text container
const decorEls = Array.from(document.querySelectorAll('*')).filter(el => {
  if (el.matches('h1,h2,h3,h4,p,a,span,li,ul,ol,nav,header,footer,main,section,article,div>p')) return false;
  const s = window.getComputedStyle(el);
  return (s.position === 'absolute' || s.position === 'fixed') && s.display !== 'none' && s.visibility !== 'hidden';
});
for (const dEl of decorEls) {
  const dr = dEl.getBoundingClientRect();
  if (dr.width < 5 || dr.height < 5) continue; // skip zero-size elements
  for (const tEl of textEls) {
    const tr = tEl.getBoundingClientRect();
    if (tr.width === 0 || tr.height === 0) continue;
    const xOverlap = dr.left < tr.right && dr.right > tr.left;
    const yOverlap = dr.top < tr.bottom && dr.bottom > tr.top;
    if (xOverlap && yOverlap) {
      overlaps.push({
        decor: dEl.tagName + ' .' + (dEl.className?.toString().substring(0, 40) || ''),
        decorSrc: dEl.getAttribute('src')?.substring(0, 40) || '',
        text: tEl.textContent?.trim().substring(0, 40),
        textTag: tEl.tagName,
        decorZ: window.getComputedStyle(dEl).zIndex,
      });
    }
  }
}
// Deduplicate by decor+text key
const seen = new Set();
return overlaps.filter(o => { const k = o.decor+'|'+o.text; if (seen.has(k)) return false; seen.add(k); return true; });
```

After running the script, also check for `::before`/`::after` decorators on hero sections manually via screenshot — pseudo-elements are not in the DOM and cannot be queried. Screenshot the hero at 1400px and inspect for any shape, stroke, or circle visually touching a letter.

Severity: **major** if a decorative element covers a letter in a key heading (H1/H2). **Minor** if it touches supporting text.

### Standalone script (for user review)

```bash
# Full sweep — screenshots at every 50px step for user to review
npx tsx scripts/responsiveness-sweep.ts https://example.com / /about /contact

# Finer granularity
npx tsx scripts/responsiveness-sweep.ts https://example.com / --step 25

# Only 7 key breakpoints
npx tsx scripts/responsiveness-sweep.ts https://example.com / --ref-only
```

**Output**:
- `qa-screenshots/<page>-<width>px.png` — screenshot at each step
- `qa-screenshots/sweep-report.json` — metadata

## § 2. Console errors

### Procedure

```js
// Navigate to each page
await page.goto(url, { waitUntil: 'networkidle' });

// Collect console messages
// Use mcp_playwright_browser_console_messages
```

### Severity mapping

| Console level | QA severity |
|--------------|-------------|
| `error` (uncaught exceptions, failed resources) | Major |
| `warning` (deprecations, missing resources) | Minor |
| `info` / `log` | Ignore unless clearly a bug message |

### Common acceptable messages (do not flag)

- Framework dev-mode warnings (React dev tools, Next.js hot reload, Vite HMR)
- Third-party script notices (analytics, chat widgets)
- `Failed to load resource: net::ERR_BLOCKED_BY_CLIENT` (ad blockers)
- Service worker lifecycle messages
- Deprecation notices for third-party libraries

### Always flag

- `Uncaught TypeError`, `Uncaught ReferenceError`, `Uncaught SyntaxError`
- `Failed to load resource` for first-party assets (CSS, JS, images, fonts)
- React key warnings, hook dependency warnings
- CORS errors on first-party API calls
- `404` responses for any first-party URL
- `Mixed Content` warnings (HTTP resources on HTTPS page)

## § 3. Browser compatibility

This step is partially manual. The Playwright MCP browser is Chromium-based.

**What the agent can do**:
- Note that testing was done in Chromium
- Flag any CSS that uses features without broad support (check caniuse mentally):
  - `container queries` — limited Safari support in older versions
  - `@layer` — older browser gaps
  - `has()` selector — recent addition
  - `backdrop-filter` — partial support historically
- Remind the user to check on:
  - Mobile Safari (iPhone) — the most common source of rendering differences
  - Firefox desktop (if audience uses it)
  - Edge (usually matches Chrome, but worth a glance)

**Report template**:
```
Browser compatibility: Tested in Chromium (Playwright).
Manual check recommended: Safari on iPhone, Firefox desktop.
CSS features in use that may have compat issues: [list or "none detected"]
```

## § 4. Functionality testing

### Navigation

**Desktop nav**:
1. Click every top-level nav link → verify correct page loads
2. If dropdowns exist, hover/click to open → verify sub-links work
3. Check that active page is visually indicated (highlight, underline, etc.)

**Mobile nav** (set viewport to 400px first):
1. Verify hamburger icon is present
2. Click hamburger → menu opens
3. Click each menu item → correct page loads
4. Click hamburger again or outside → menu closes
5. Check that menu doesn't persist across page navigations

### Buttons

For every button on the page:
1. Is it visually distinguishable from the background? (contrast check)
2. Does it have a hover/focus state?
3. Does clicking it do what's expected? (navigate, open modal, submit form, etc.)
4. Is the click target large enough on mobile? (≥44×44px recommended)

### Links

**Homepage (required)**: click every link, including footer links. Verify each goes to the correct destination.

**Other pages (recommended)**: at minimum, verify nav + footer links work. Spot-check 3–5 content links per page.

### Forms

If the site has forms (contact, newsletter, etc.):
1. Submit empty → verify validation messages appear
2. Fill with invalid data (bad email, short phone) → verify validation
3. Fill correctly → verify submission works (or that the form at least doesn't error — don't actually submit to production if it'll email the client)

## § 5. Broken link validation

### Automated crawl

```js
// Collect all links on a page
const links = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a[href]')).map(a => ({
    href: a.href,
    text: a.textContent.trim().substring(0, 50),
    isExternal: !a.href.startsWith(window.location.origin)
  }));
});
```

For each link:
- **Internal**: navigate with Playwright, check for 200 status (not 404 page, not error page)
- **External**: use `fetch` or `curl` with HEAD method. Accept 200, 301, 302. Flag 4xx, 5xx, timeout.
- **Anchor** (`#id`): verify `document.getElementById('id')` exists on the target page
- **mailto/tel**: regex validate format (`mailto:x@y.z`, `tel:+1234567890`)
- **javascript:void(0)** or empty `href="#"`: flag as minor (accessibility issue)

### Deduplication

Don't check the same URL twice. Build a `Set<string>` of checked URLs across all pages.

### If external tool exists

If the user says "we have a broken link checker," ask them to run it and provide results. Still do a quick 10-link spot-check with Playwright to cross-validate.

## § 6. Redirect testing

### When applicable

Only if the site has:
- A `_redirects` file (Netlify-style)
- An `.htaccess` with redirects (Apache)
- A `next.config.js` with redirects (Next.js)
- A list of old URLs from a previous sitemap

### Procedure

For each redirect rule `old_path → new_path`:
1. Navigate to `<base_url>/old_path`
2. Wait for navigation to settle
3. Check `page.url()` — does it match the expected `new_path`?
4. Check HTTP status (should be 301 or 302, not 200 serving the old page, not 404)

Flag: redirect loops, wrong destination, 404s, chains >2 hops.

## § 7. Favicon validation

```js
const faviconData = await page.evaluate(() => {
  const links = document.querySelectorAll('link[rel*="icon"]');
  const results = [];
  links.forEach(link => {
    results.push({
      rel: link.getAttribute('rel'),
      href: link.getAttribute('href'),
      sizes: link.getAttribute('sizes'),
      type: link.getAttribute('type')
    });
  });
  // Also check for /favicon.ico default
  return {
    linkTags: results,
    title: document.title
  };
});
```

### Pass criteria

- At least one `<link rel="icon">` or `<link rel="shortcut icon">` exists
- The referenced file is loadable (HEAD request returns 200)
- Bonus: `apple-touch-icon` present for iOS

### Fail

- No favicon link tag AND `/favicon.ico` returns 404
- Link tag exists but referenced file is 404

## § 8. Social thumbnail (Open Graph / Twitter meta)

```js
const socialMeta = await page.evaluate(() => {
  const getMeta = (prop) => {
    const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
    return el ? el.getAttribute('content') : null;
  };
  return {
    ogTitle: getMeta('og:title'),
    ogDescription: getMeta('og:description'),
    ogImage: getMeta('og:image'),
    ogUrl: getMeta('og:url'),
    ogType: getMeta('og:type'),
    twitterCard: getMeta('twitter:card'),
    twitterTitle: getMeta('twitter:title'),
    twitterDescription: getMeta('twitter:description'),
    twitterImage: getMeta('twitter:image')
  };
});
```

### Pass criteria (per page)

- `og:title` present and non-empty
- `og:description` present and non-empty
- `og:image` present and the URL returns 200 (HEAD check)
- `og:image` dimensions ≥ 1200×630 (ideal for most platforms)
- `twitter:card` present (typically `summary_large_image`)

### Common issues

- OG image URL is relative (should be absolute)
- OG image is missing or returns 404
- Same OG title/description on every page (should be page-specific)
- OG description is truncated or contains HTML entities

## § 9. HTML validation

### Option A: W3C Validator API

```bash
curl -s "https://validator.w3.org/nu/?doc=<encoded_url>&out=json" \
  -H "User-Agent: Mozilla/5.0"
```

Parse the JSON response. Group messages by type:
- `error` → Major finding
- `warning` / `info` → Minor or ignore

### Option B: npm run validate

If the project has a validation script (`npm run validate`), run it. Parse output for error counts and locations.

### Common acceptable HTML issues (don't flag)

- Trailing slashes on void elements in JSX/React output
- Minor attribute order differences
- Third-party embed markup (YouTube, Google Maps iframes)

### Always flag

- Unclosed tags
- Duplicate IDs
- Missing `alt` attributes on `<img>` (accessibility)
- Missing `<label>` for form inputs
- Invalid nesting (`<p>` inside `<p>`, `<div>` inside `<span>`)
- Missing `lang` attribute on `<html>`
- Missing `<meta charset>`
- Missing `<title>`

## § 10. Google PageSpeed

See SKILL.md § 4 for the full procedure. Additional notes here:

### API call

```bash
# Mobile
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<URL>&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo"

# Desktop
curl -s "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<URL>&strategy=desktop&category=performance&category=accessibility&category=best-practices&category=seo"
```

### Parsing scores

```js
// From the API response:
const categories = response.lighthouseResult.categories;
const scores = {
  performance: Math.round(categories.performance.score * 100),
  accessibility: Math.round(categories.accessibility.score * 100),
  bestPractices: Math.round(categories['best-practices'].score * 100),
  seo: Math.round(categories.seo.score * 100)
};
```

### SEO: descriptive link text

When PageSpeed flags "Links do not have descriptive text":
1. Find the flagged links in the audit details (`response.lighthouseResult.audits['link-text']`)
2. For each: note the current text and the destination page
3. Suggest a more descriptive replacement
4. **Flag that the replacement text may break responsiveness** — longer text needs re-checking at mobile breakpoints

### Rate limiting

PageSpeed API has rate limits (unkeyed: ~1 req/sec). Space requests. For sites with 20+ pages, run in batches of 5 with 2s pauses between batches. If rate-limited (429), wait 60s and retry.

### Localhost limitation

PageSpeed Insights requires a publicly reachable URL. If testing localhost:
- Note that PageSpeed cannot be run
- Suggest deploying to a staging URL for PageSpeed testing
- Or: run Lighthouse CLI locally (`npx lighthouse <url> --output json --chrome-flags="--headless"`) if available

## § 11. Content verification

### Contact information (required)

Find and verify these on the site:
- **Phone number**: format is valid, area code matches the business location
- **Email address**: format is valid, domain matches the business
- **Physical address**: present and looks complete (street, city, state, zip)
- **Hours of operation**: present and formatted consistently

Cross-check: does the footer match the contact page? Do all instances of the phone number match?

### Proofreading (homepage required, all pages recommended)

For each page, extract all visible text and check for:
- Typos and misspellings
- Grammar errors
- Inconsistent capitalization (e.g. "About us" vs "About Us" in different places)
- Lorem ipsum or placeholder text left in
- Broken or garbled characters (encoding issues)
- Dates that are in the past (copyright year, event dates)
- Dummy content ("John Doe", "example@email.com", "123 Main St")

### AI-assisted approach

Use `browser_evaluate` to extract all text content from the page, then analyze it for the above issues. For large pages, process section by section.

```js
const pageText = await page.evaluate(() => {
  // Get text from main content area, skip nav/footer for separate check
  const main = document.querySelector('main') || document.body;
  return main.innerText;
});
```

## § 12. Site walkthrough

The final pass. Navigate through the entire site as a real user would:

1. Land on the homepage — does the first impression look professional?
2. Use the navigation to visit every major section
3. Scroll through each page completely
4. Interact with any interactive elements (accordions, tabs, sliders, carousels)
5. Check that scrolling feels smooth (no jank, no flicker)
6. Verify that page transitions are clean (no flash of unstyled content)
7. Check footer: all links work, copyright year is current, social media links go to the right profiles

### What to note

- **Aesthetic concerns**: anything that "just looks off" — spacing, alignment, color consistency
- **Performance feel**: pages that take noticeably long to load
- **Missing states**: empty states that show nothing instead of a helpful message
- **Broken interactivity**: accordions that don't close, carousels that don't advance
- **Accessibility basics**: can you tab through the page? Is focus visible? Do images have alt text?

This step is intentionally subjective — it's the "would I be proud to show this to the client?" check.
