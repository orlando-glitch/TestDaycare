---
name: design-to-code
description: "Transform a visual design (Figma, image, screenshot, or description) into production-ready HTML/SCSS code for this Eleventy + Nunjucks + SCSS project. Use when: converting a home page design, building a new page section, creating a new page from a design, implementing a layout from a mockup, adding a hero, card grid, side-by-side, FAQ, CTA, or any page block. Follows CodeStitch cs- naming conventions, uses CSS custom properties for all colors and fonts, outputs reusable Nunjucks template blocks."
argument-hint: "Describe the section or page design, or paste a description of the layout."
---

# Design to Code

## When to Use

- User provides a design image, Figma link, screenshot, or written description of a layout
- User asks to build or add a new page section (hero, cards, side-by-side, FAQ, CTA, gallery, testimonials, etc.)
- User asks to create a new page following the same pattern as existing pages
- User wants to convert any visual concept into project-consistent HTML + SCSS

---

## Project Stack Reference

| Layer | Tech |
|-------|------|
| SSG | [Eleventy (11ty)](https://www.11ty.dev/) |
| Templating | Nunjucks (`.html` files with `{% %}` syntax) |
| Styles | SCSS compiled to CSS — one file per page + shared globals |
| Images | `<picture>` with avif/webp/jpeg + `{% getUrl %}` resize filter |
| Components | Nunjucks macros and `_includes/components/` partials |

---

## Step-by-Step Procedure

### 1. Analyse the Design

Before writing any code:
- Identify every **section** on the page (hero, service cards, side-by-side, FAQ, CTA, etc.)
- Note the **layout** of each section (full-width, centered, side-by-side, grid)
- Note all **colors** — map each to an existing CSS variable or propose a new one
- Note all **fonts/weights** — map to existing variables
- Note image placements and approximate aspect ratios

### 2. Plan CSS Variables

All colors and fonts **must** live in `:root` in `src/assets/sass/global.scss`.

**Existing variables (never hardcode these values — always use the variable):**

```scss
:root {
    --primary: #3C3288;             // Main brand color (purple)
    --secondary: #FCE729;           // Accent color (yellow)
    --headingTextColor: #202020;    // Dark headings on light bg
    --headingTextColorWhite: #EBEBEB; // Light headings on dark bg
    --bodyTextColor: #3D424D;       // Body text on light bg
    --bodyTextColorWhite: #EBEBEB;  // Body text on dark bg
    --sectionPadding: clamp(3.75rem, 7.82vw, 6.25rem) clamp(1rem, 1.5vw, 2rem);
    --topperFontSize: clamp(0.8125rem, 1.6vw, 1rem);
    --headerFontSize: clamp(1.9375rem, 3.9vw, 3.0625rem);
    --bodyFontSize: 1rem;
    --headerFont: "Inter", Arial, sans-serif;
    --bodyFont: "Inter", Arial, sans-serif;
}
```

If the design introduces a **new color** (e.g. a section background, an accent), add it to `:root` with a descriptive name:
```scss
--sectionBg: #F5F7FA;
--accentGreen: #2ECC71;
```

### 3. Identify the SCSS File to Edit

| New content lives on… | Edit this SCSS file |
|----------------------|---------------------|
| Home page (`/`) | `src/assets/sass/home.scss` |
| About pages | `src/assets/sass/about.scss` |
| Programs pages | `src/assets/sass/programs.scss` |
| Administration pages | `src/assets/sass/administration.scss` |
| Contact pages | `src/assets/sass/contact.css` |
| Shared components (header, footer, CTA, banner) | `src/assets/sass/components.scss` |
| New page | Create `src/assets/sass/<page-slug>.scss` and link it in the page's `{% block head %}` |

Above-the-fold / hero styles also belong in `src/assets/sass/critical-above-fold.scss` for pages where LCP matters.

### 4. Write the HTML Section

**Every section follows this skeleton:**

```html
<!-- ============================================ -->
<!--            Section Name Here                 -->
<!-- ============================================ -->
<section id="page-sectionname" class="cs-section">
    <div class="cs-container">
        <!-- content here -->
    </div>
</section>
```

Rules:
- `id` = `{page}-{sectionname}` (e.g. `home-hero`, `home-service`, `about-mission`)
- Add `class="cs-section"` to get `var(--sectionPadding)` automatically
- Inner `.cs-container` limits width to `1280px` and centers content
- Use `pt-0` or `pb-0` modifier classes on `.cs-section` when a section visually connects to the one above/below

### 5. Write the SCSS Section

Each section gets its own SCSS block with a comment banner:

```scss
/*-- -------------------------- -->
<---        section-name        -->
<--- -------------------------- -*/
#page-sectionname {
    // section styles here
}
```

---

## CodeStitch Class Naming Reference

All class names use the `cs-` prefix (CodeStitch standard). **Never invent raw semantic names for structural elements** — use these established classes.

### Typography Classes (defined in global.scss)

| Class | Use for |
|-------|---------|
| `.cs-hero-title` | `<h1>` on hero/banner sections |
| `.cs-title` | `<h2>` section headings |
| `.cs-topper` | Small eyebrow text above a title (e.g. "About Us") |
| `.sub-title` | Subtitle text below a heading |
| `.cs-text` | Body paragraph text |
| `.cs-text.last-line` | Last paragraph — removes bottom margin |
| `.cs-text.button-below` | Paragraph followed immediately by a button |
| `.hover-highlight` | Inline link/accent text (underline or color on hover) |

### Layout Classes (defined in global.scss)

| Class | Use for |
|-------|---------|
| `.cs-section` | Outer `<section>` — applies `var(--sectionPadding)` |
| `.cs-container` | Inner content wrapper — `max-width: 1280px; margin: auto` |
| `.sbs-standard` | Side-by-side (flexbox row on desktop, column on mobile) |
| `.sbs-standard.reverse` | Side-by-side with image on the right |
| `.text-content` | Text block inside an sbs layout |
| `.auto-picture` | Image block inside an sbs layout (flex: 1) |
| `.cs-image-background` | Absolute-positioned full-bleed background image wrapper |

### Card / List Classes

| Class | Use for |
|-------|---------|
| `.cs-card-group` | `<ul>` or `<div>` wrapping a row of cards |
| `.cs-item` | Individual card (`<li>` or `<a>`) |
| `.cs-icon` | Icon image inside a card |
| `.cs-h3` | Card heading (`<h3>`) |

### Button Classes (defined in global.scss)

| Class | Result |
|-------|--------|
| `.button-solid` | Filled button, `var(--primary)` bg, hover sweeps black overlay |

---

## HTML Block Templates

Use these as starting points. Customise content, never the structural class names.

### Hero Section (full-bleed background image)

```html
<!-- ============================================ -->
<!--                  hero                        -->
<!-- ============================================ -->
<section id="home-hero">
    <div class="cs-container">
        <div class="text-content">
            <h1 class="cs-hero-title">Heading text here</h1>
            <p class="cs-text">Short supporting sentence.</p>
            <p class="cs-text button-below">Longer supporting paragraph with more context.</p>
            <a href="/schedule-a-tour/" class="button-solid">Schedule a Tour</a>
        </div>
    </div>
    <picture class="cs-image-background">
        <!--Mobile Image-->
        <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 530, height: 550 }) | avif %}" type="image/avif">
        <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 530, height: 550 }) | webp %}" type="image/webp">
        <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 530, height: 550 }) | jpeg %}" type="image/jpeg">
        <!--Desktop Image-->
        <source media="(min-width: 601px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1440, height: 900 }) | avif %}" type="image/avif">
        <source media="(min-width: 601px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1440, height: 900 }) | webp %}" type="image/webp">
        <source media="(min-width: 601px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1440, height: 900 }) | jpeg %}" type="image/jpeg">
        <img src="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1440, height: 900 }) | jpeg %}" alt="Descriptive alt text." width="1440" height="900" decoding="async" aria-hidden="true">
    </picture>
</section>
```

### Card Grid Section (icon + heading + text)

```html
<!-- ============================================ -->
<!--              service cards                   -->
<!-- ============================================ -->
<section id="page-service" class="cs-section">
    <div class="cs-container">
        <h2 class="cs-title">Section Heading</h2>
        <ul class="cs-card-group">
            <li class="cs-item">
                <img class="cs-icon" loading="lazy" decoding="async" src="/assets/images/icon.png" alt="Icon description" width="76" height="76" data-img2picture-ignore>
                <h3 class="cs-h3">Card Heading</h3>
                <p class="cs-text last-line">Card body text.</p>
            </li>
            <!-- repeat .cs-item as needed -->
        </ul>
    </div>
</section>
```

### Side-by-Side Section (image left, text right)

```html
<!-- ============================================ -->
<!--           side-by-side                       -->
<!-- ============================================ -->
<section id="page-sbs" class="cs-section">
    <div class="cs-container sbs-standard">
        <div class="sbs-image">
            <picture>
                <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 530, height: 550 }) | avif %}" type="image/avif">
                <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 530, height: 550 }) | webp %}" type="image/webp">
                <source media="(max-width: 600px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 530, height: 550 }) | jpeg %}" type="image/jpeg">
                <source media="(min-width: 601px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1054, height: 1100 }) | avif %}" type="image/avif">
                <source media="(min-width: 601px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1054, height: 1100 }) | webp %}" type="image/webp">
                <source media="(min-width: 601px)" srcset="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1054, height: 1100 }) | jpeg %}" type="image/jpeg">
                <img src="{% getUrl '/assets/images/IMAGE.jpg' | resize({ width: 1054, height: 1100 }) | jpeg %}" alt="Descriptive alt text." width="1054" height="1100" loading="lazy" decoding="async">
            </picture>
        </div>
        <div class="text-content">
            <span class="cs-topper">Eyebrow label</span>
            <h2 class="cs-title">Section Heading</h2>
            <p class="cs-text">First paragraph of body copy.</p>
            <p class="cs-text button-below">Second paragraph of body copy.</p>
            <a href="/contact-us/" class="button-solid">Button Label</a>
        </div>
    </div>
</section>
```

### FAQ Section (accordion)

```html
<!-- ============================================ -->
<!--                  FAQ                         -->
<!-- ============================================ -->
<script defer src="/assets/js/faq.js"></script>
<section id="faq" class="cs-section">
    <div class="cs-container">
        <h2 class="cs-title">Frequently Asked Questions</h2>
        <ul class="cs-faq-group">
            <li class="cs-faq-item active">
                <button class="cs-button">
                    <span class="cs-cross"></span>
                    <span class="cs-button-text">Question text here?</span>
                </button>
                <p class="cs-item-p">Answer text here.</p>
            </li>
            <!-- repeat .cs-faq-item for each question -->
        </ul>
    </div>
</section>
```

### CTA Section (reusable macro)

```html
{% from "components/cta.html" import cta %}
{{ cta("Heading Text", "Supporting body text.", "Button Label") }}
```

### Page Banner (inner pages)

```html
<section class="page-banner cs-section">
    <div class="cs-container">
        <h1 class="cs-hero-title">Page Title</h1>
        <p class="sub-title">Optional subtitle text</p>
    </div>
    <picture class="cs-image-background">
        <!-- same picture pattern as hero -->
    </picture>
</section>
```

---

## SCSS Block Templates

### Hero SCSS

```scss
/*-- -------------------------- -->
<---          hero               -->
<--- -------------------------- -*/
#page-hero {
    position: relative;
    padding: clamp(4.75rem, 7.82vw, 8rem) clamp(1rem, 1.5vw, 2rem);
    margin-top: 60px; // offset for mobile fixed nav

    &::before {
        content: "";
        position: absolute;
        background: linear-gradient(270deg, rgba(0, 0, 0, 0.00) 0%, rgba(0, 0, 0, 0.78) 100%);
        top: 0; left: 0; width: 100%; height: 100%;
        z-index: 1;
    }

    .cs-image-background {
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        img { width: 100%; height: 100%; object-fit: cover; }
    }

    .cs-container {
        position: relative;
        z-index: 5;
        .cs-text { color: var(--bodyTextColorWhite); }
    }

    @media screen and (min-width: 1024px) {
        margin-top: 0;
        .cs-container { max-width: 60%; }
    }
}
```

### Card Grid SCSS

```scss
/*-- -------------------------- -->
<---        card-grid            -->
<--- -------------------------- -*/
#page-service {
    .cs-container { text-align: center; }

    .cs-card-group {
        width: 100%;
        padding: 0;
        margin: 1.5rem auto 0;
        list-style: none;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .cs-item {
        padding: 2.25rem 1.4375rem;
        border-radius: 18px;
        background: #fff;
        box-shadow: 0px 0px 24px 0px rgba(0, 0, 0, 0.16);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
        transition: box-shadow 0.3s, transform 0.3s;

        .cs-icon { width: 76px; height: 76px; object-fit: cover; border-radius: 14px; }
        .cs-h3 { font-size: clamp(20px, 2.2vw, 24px); font-weight: 700; }
        .cs-text { margin-bottom: 0; }
    }

    @media screen and (min-width: 1024px) {
        .cs-card-group { flex-direction: row; }
        .cs-item:hover {
            box-shadow: 0px 0px 34px 0px rgba(0, 0, 0, 0.20);
            transform: translateY(-1em);
        }
    }
}
```

### Side-by-Side SCSS

```scss
/*-- -------------------------- -->
<---         sbs                 -->
<--- -------------------------- -*/
#page-sbs {
    .cs-topper {
        font-size: clamp(18px, 2.2vw, 24px);
        display: block;
        color: var(--primary);
        font-weight: 700;
        margin-bottom: 0.5rem;
    }

    .sbs-image {
        position: relative;
        width: calc(553 / 16 * 1em);
        height: calc(576 / 16 * 1em);
        font-size: min(2.5vw, 1em); // fluid scaling trick

        &::before {
            content: "";
            position: absolute;
            z-index: -1;
            background: var(--primary);
            width: calc(506 / 16 * 1em);
            height: calc(576 / 16 * 1em);
            border-radius: calc(30 / 16 * 1em);
        }
        &::after {
            content: "";
            position: absolute;
            width: calc(553 / 16 * 1em);
            height: 100%;
            border-radius: calc(30 / 16 * 1em);
            border: 1px solid var(--secondary);
            top: 0; left: 0;
        }

        img {
            position: relative;
            object-fit: cover;
            top: 0.813em; left: 0.75em;
            z-index: 5;
            width: calc(527 / 16 * 1em);
            height: calc(550 / 16 * 1em);
            border-radius: 20px;
            box-shadow: 0px 0px 24px 0px rgba(0, 0, 0, 0.16);
        }
    }

    @media screen and (min-width: 1024px) {
        .sbs-standard { flex-direction: row; gap: 5rem; }
        .sbs-image { font-size: min(1.2vw, 1em); }
    }
}
```

---

## Creating a New Page — Full Checklist

1. **Copy `src/content/pages/_template.txt`** → rename to `src/content/pages/page-slug.html`
2. **Fill frontmatter**: title, description, permalink, `eleventyNavigation` (key + order)
3. **Add `{% block head %}`**: link the page-specific CSS and `components.css` if needed
4. **Add `{% block body %}`**: build sections using the templates above
5. **Create `src/assets/sass/page-slug.scss`**: write section styles
6. **Register the SCSS** in `package.json` or the eleventy config (check how existing pages are compiled)
7. **Import CTA macro** at the top of the body block if needed: `{% from "components/cta.html" import cta %}`

---

## Key Rules

1. **No hardcoded colors or fonts** — every color goes through a CSS variable.
2. **All classes use `cs-` prefix** for structural elements. Page-level layout IDs use `#page-section` pattern.
3. **Mobile-first SCSS** — base styles are mobile, `@media (min-width: 1024px)` for desktop.
4. **Use `clamp()` for all fluid type and spacing** — never `px` only for font sizes.
5. **`calc(X / 16 * 1em)` pattern** for proportional sizing inside components that use the `font-size` scaling trick.
6. **`font-size: min(Xvw, 1em)` on a wrapper** is the preferred fluid-scaling technique for complex decorative components (e.g. SBS image frames).
7. **Images always use `<picture>`** with avif → webp → jpeg sources and mobile/desktop breakpoint variants.
8. **Hero sections** get `margin-top: 60px` on mobile to clear the fixed nav; `margin-top: 0` on desktop.
9. **Sections that share background color with the next section** use `padding-top: 0` (`pt-0` class) on the lower section.
10. **Reusable components** (CTA, header, footer) live in `src/_includes/components/` as Nunjucks macros or partials.

---

## Design Interpretation Rules

When converting a visual design:

| Design element | Code approach |
|---------------|---------------|
| Full-width image behind text | `#section-hero` with `.cs-image-background` + gradient `::before` overlay |
| Row of 2–4 icon cards | `.cs-card-group` + `.cs-item` list |
| Text on left, image on right | `.sbs-standard` + `.text-content` + `.sbs-image` |
| Text on right, image on left | `.sbs-standard.reverse` |
| Expandable Q&A list | `.cs-faq-group` + `.cs-faq-item` + `faq.js` |
| Bottom-of-page promotional strip | CTA macro from `cta.html` |
| Inner page with background image banner | `.page-banner` with `.cs-hero-title` |
| Eyebrow text above a heading | `<span class="cs-topper">` |
| Colored rounded badge/pill | Add a scoped class; color via `var(--secondary)` or `var(--primary)` |
| Background-colored section | Set `background-color: var(--variable)` on the `#id` selector in the page SCSS |

---

## See Also

- [src/assets/sass/global.scss](../../src/assets/sass/global.scss) — all CSS variables and shared utility classes
- [src/assets/sass/components.scss](../../src/assets/sass/components.scss) — CTA, page-banner shared styles
- [src/_includes/components/cta.html](../../src/_includes/components/cta.html) — CTA macro
- [src/content/pages/_template.txt](../../src/content/pages/_template.txt) — new page frontmatter template
- [src/content/index.html](../../src/content/index.html) — home page for reference patterns
- [src/assets/sass/home.scss](../../src/assets/sass/home.scss) — home page SCSS for reference
