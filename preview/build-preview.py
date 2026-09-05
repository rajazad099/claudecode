#!/usr/bin/env python3
"""
Regenerate preview/quiz.html from sections/shades-quiz.liquid.

This is a developer convenience, not a build step for the store — the theme
needs no build. It exists so the standalone preview cannot drift away from the
real section markup: the preview is produced FROM the section, by resolving the
Liquid the section would resolve on the storefront.

It also injects the live theme's design tokens (read from the GokwikOnly theme's
settings_data.json) into :root, so the preview inherits exactly what the quiz
inherits on the storefront.

    python3 preview/build-preview.py
"""
import json, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
section = (ROOT / "sections" / "shades-quiz.liquid").read_text()
products = (ROOT / "preview" / "quiz-products.json").read_text()

# Values the theme editor would supply. Mirrors the schema defaults, except
# use_theme_cards: a file:// preview has no storefront to fetch cards from, so
# it exercises the built-in fallback card instead.
SETTINGS = {
    "result_count": "10",
    "hide_sold_out": "true",
    "remember_result": "true",
    "use_theme_cards": "false",
    "card_section": "shades-quiz-card",
    "collect_phone": "true",
    "phone_required": "false",
}

# The live theme's tokens, from config/settings_data.json of GokwikOnly.
THEME_TOKENS = """
    /* ---- Live theme tokens (GokwikOnly), reproduced so the preview inherits
       exactly what the quiz inherits on the storefront. ---- */
    --color-background: #ffffff;
    --color-foreground: #000000;
    --color-foreground-rgb: 0, 0, 0;
    --color-accent-one: #eeeeee;
    --color-accent-two: #666666;
    --color-accent-three: #999999;
    --color-bg-one: #eeeeee;
    --color-bg-two: #888888;
    --color-bg-three: #404040;
    --color-bg-four: #000000;
    --color-button-foreground: 255, 255, 255;
    --color-button-background: 0, 0, 0;
    --color-price-sale: 247 0 0;

    --font-body-family: "Work Sans", sans-serif;
    --font-body-weight: 400;
    --font-heading-family: "Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif;
    --font-heading-weight: 700;
    --font-accent-family: "Montserrat", sans-serif;

    --font-body-base-size-mobile: 14px;
    --font-body-base-size-desktop: 15px;
    --font-ui-size-mobile: 12px;
    --font-ui-size-desktop: 13px;
    --base-line-height: 1.5;

    --font-h1-size-mobile: 26px;
    --font-h1-size-desktop: 34px;
    --font-h2-size-mobile: 20px;
    --font-h2-size-desktop: 22px;
    --font-h3-size-mobile: 18px;
    --font-h3-size-desktop: 18px;
    --font-h2-case: none;
    --font-h3-case: uppercase;

    --page-margin-mobile: 2rem;
    --page-margin-desktop: 4rem;
    --grid-desktop-horizontal-spacing: 20px;
    --grid-desktop-vertical-spacing: 40px;
    --grid-mobile-horizontal-spacing: 20px;
    --grid-mobile-vertical-spacing: 28px;

    --media-radius: 0px;
    --buttons-radius: 0px;
    --buttons-border-width: 1px;
    --buttons-padding: 4px;
    --buttons-horizontal-padding: 20px;
    --buttons-font-size-desktop: 13px;
    --buttons-font-weight: bold;
    --buttons-text-case: uppercase;
    --buttons-letter-spacing: 0em;
    --inputs-radius: 0px;
    --inputs-border-width: 1px;

    --product-card-text-alignment: center;
    --product-card-text-top-padding: 15px;
    --product-card-text-bottom-padding: 20px;
    --product-card-image-radius: 0rem;
    --product-card-media-bg-col: rgba(0,0,0,0);
    --badge-corner-radius: 4px;
    --price-font-weight: normal;
"""


def resolve(markup: str) -> str:
    """Resolve the Liquid the section would resolve on the storefront."""
    markup = re.sub(r"\{%-?\s*comment\s*-?%\}.*?\{%-?\s*endcomment\s*-?%\}", "", markup, flags=re.S)

    # {% if s.KEY != blank %}...{% endif %}
    # Settings with a stand-in value keep their body; settings that are blank by
    # default (an optional webhook, say) drop theirs, exactly as the storefront
    # would render them out of the box.
    KEEP_IF_SET = {"fallback_collection"}

    def blank_guard(m):
        return m.group(2) if m.group(1) in KEEP_IF_SET else ""

    markup = re.sub(r"\{%\s*if s\.(\w+) != blank\s*%\}(.*?)\{%\s*endif\s*%\}",
                    blank_guard, markup, flags=re.S)
    markup = markup.replace("{{ s.fallback_collection.url }}",
                            "https://www.projectshades.com/collections/all")

    # {{ s.key | default: 'value' }}, with any further filters (| escape and the
    # like) applied to the default and then discarded.
    markup = re.sub(r"\{\{\s*s\.\w+\s*\|\s*default:\s*'([^']*)'\s*(?:\|[^}]*?)?\}\}",
                    lambda m: m.group(1), markup)
    markup = re.sub(r"\{\{\s*s\.(\w+)\s*\|\s*default:\s*(\d+)\s*\}\}",
                    lambda m: SETTINGS.get(m.group(1), m.group(2)), markup)
    # bare {{ s.key }}
    markup = re.sub(r"\{\{\s*s\.(\w+)\s*\}\}", lambda m: SETTINGS.get(m.group(1), ""), markup)

    markup = markup.replace("{{ uid }}", "preview")
    markup = markup.replace("{{ products_json }}", products)
    return markup


body = re.search(r"(<section\b.*?</section>)", section, re.S).group(1)
body = resolve(body)
assert "{{" not in body and "{%" not in body, "unresolved Liquid remains in preview"

html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Project Shades — The Fitting Room (preview)</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600&family=Archivo:wght@600;700&family=Montserrat:wght@400;700&display=swap">
<link rel="stylesheet" href="../assets/shades-quiz.css">
<style>
  /* The theme sets a 10px rem base; the quiz's spacing is expressed in the
     theme's rem-based tokens, so the preview must match it. */
  html {{ font-size: 62.5%; box-sizing: border-box; }}
  body {{ margin: 0; background: #fff; }}
  :root {{{THEME_TOKENS}  }}
</style>
</head>
<body>

<!--
  STATIC PREVIEW — no Shopify required. Open this file in a browser.

  Generated from sections/shades-quiz.liquid by preview/build-preview.py, so it
  cannot drift from the real section. The product data is a live snapshot of the
  Project Shades catalogue, so the recommendations shown here are the ones the
  live section will make.

  Two differences from the storefront, both unavoidable in a static file:
   - Headings use Archivo. The live theme uses Basic Commercial, which is
     Shopify-hosted and cannot be loaded here. Both are grotesques of the same
     weight and width, so the layout reads the same.
   - Results use the built-in fallback card. On the storefront the theme's own
     card-product markup is fetched instead, so results match your collection
     pages exactly.
-->

{body}

<script src="../assets/shades-quiz.js" defer></script>
</body>
</html>
"""
(ROOT / "preview" / "quiz.html").write_text(html)
print(f"preview/quiz.html regenerated ({len(html)//1024} KB)")
