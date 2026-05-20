# bloom-highlight

A vanilla Web Component that adds hand-drawn, squiggly highlight effects to any text. Inspired by [yeunoia/bloom](https://github.com/yeunoia/bloom).

Zero dependencies. No build step. Just a `<script>` tag and a custom element.

Demo: [https://pdelboca.me/bloom-highlight/](https://pdelboca.me/bloom-highlight/)

## Install

Use directly via a `<script>` tag:

```html
<script type="module" src="src/index.js"></script>
```

## Usage

```html
This is <bloom-highlight>highlighted</bloom-highlight> text.
```

That's it. The text gets a wobbly yellow marker highlight by default.

## Custom variants

All visual styling is driven by CSS custom properties. Define variants by overriding them on the host element:

```css
bloom-highlight.primary {
  --bloom-bg: #bb66cc66;
  --bloom-scale: 3;
  --bloom-tip: round;
}
```

Then apply the class in HTML:

```html
<bloom-highlight class="primary">important text</bloom-highlight>
```

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `type` | `"line"` | `"box"` wraps the whole element, `"line"` highlights per text line |

## CSS custom properties

| Property | Default | Description |
|---|---|---|
| `--bloom-bg` | `#fdfd77` | Fill color |
| `--bloom-color` | `inherit` | Text color |
| `--bloom-scale` | `4` | Wobble intensity |
| `--bloom-padding-x` | `4` | Horizontal padding |
| `--bloom-padding-y` | `2` | Vertical padding |
| `--bloom-tip` | `square` | `"round"` or `"square"` edge caps |
| `--bloom-gradient` | — | Pipe-separated color stops for a gradient fill |

## Examples

```html
<!-- Default highlight -->
<bloom-highlight>some text</bloom-highlight>

<!-- Strong wobble -->
<bloom-highlight class="marker">wobbly</bloom-highlight>

<!-- Box mode -->
<bloom-highlight type="box" class="primary">
  A whole block of highlighted text.
</bloom-highlight>

```

```css
bloom-highlight.primary {
  --bloom-bg: #bb66cc66;
  --bloom-padding-x: 14;
  --bloom-padding-y: 10;
  --bloom-scale: 4;
}

bloom-highlight.marker {
  --bloom-bg: #ff6b6b88;
  --bloom-padding-x: 8;
  --bloom-padding-y: 4;
  --bloom-scale: 6;
}
```

## How it works

Renders an SVG layer behind your text inside a Shadow DOM. Uses `feTurbulence` → `feGaussianBlur` → `feDisplacementMap` SVG filters to create the organic, marker-like wobble.

## AI Disclaimer

The development of this Web Component has been assisted with AI tools.
