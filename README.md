# bloom-highlight

A vanilla Web Component that adds hand-drawn, squiggly highlight effects to any text. Inspired by [yeunoia/bloom](https://github.com/yeunoia/bloom).

Zero dependencies. No build step. Just a `<script>` tag and a custom element.

Demo: [https://pdelboca.me/bloom-highlight/](https://pdelboca.me/bloom-highlight/)

Disclaimer: Migrated to Web Components using AI.

## Install

Use directly via a `<script>` tag:

```html
<script type="module" src="src/index.js"></script>
```

## Usage

```html
<bloom-highlight>highlighted text</bloom-highlight>
```

That's it. The text gets a wobbly yellow marker highlight by default.

## Attributes

| Attribute | Default | Description |
|---|---|---|
| `type` | `"line"` | `"box"` wraps the whole element, `"line"` highlights per text line |
| `tip` | `"square"` | `"round"` or `"square"` edge caps |
| `background-color` | `#fdfd77` | Fill color |
| `color` | `inherit` | Text color |
| `scale` | `4` | Wobble intensity |
| `padding-x` | `4` | Horizontal padding |
| `padding-y` | `2` | Vertical padding |
| `gradient` | — | Comma-separated color stops for a gradient fill |

## Examples

```html
<!-- Default highlight -->
<bloom-highlight>some text</bloom-highlight>

<!-- Box mode with custom color -->
<bloom-highlight type="box" background-color="#bb66cc66" padding-x="14" padding-y="10">
  A whole block of highlighted text.
</bloom-highlight>

<!-- Strong wobble, square tip -->
<bloom-highlight scale="8" tip="square">wobbly</bloom-highlight>

<!-- Gradient fill -->
<bloom-highlight gradient="#ff6b6b, #ffd93d, #6bcb77">rainbow</bloom-highlight>
```

## How it works

Renders an SVG layer behind your text inside a Shadow DOM. Uses `feTurbulence` → `feGaussianBlur` → `feDisplacementMap` SVG filters to create the organic, marker-like wobble.

