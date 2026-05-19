import { getRx, getRectSize } from "./calculate.utils.js"

const SVG_NS = "http://www.w3.org/2000/svg"
let idCounter = 0

// ---------------------------------------------------------------------------
// Shared constructable stylesheet (parsed once, adopted by every instance)
// ---------------------------------------------------------------------------

let sharedSheet = null

function getSharedSheet() {
  if (!sharedSheet) {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(`
      :host {
        position: relative;
        display: inline-block;
        width: fit-content;
        isolation: isolate;
      }
      :host([type="line"]) {
        display: inline;
        width: auto;
        isolation: normal;
      }
      .svg-layer {
        pointer-events: none;
      }
      /* box-mode: SVG layer is absolutely positioned over the host */
      :host(:not([type="line"])) .svg-layer {
        position: absolute;
        top: 0;
        left: 0;
        z-index: 0;
      }
      /* line-mode: zero-sized anchor for absolutely-positioned SVGs */
      :host([type="line"]) .svg-layer {
        display: inline-block;
        width: 0;
        height: 0;
        overflow: visible;
        position: relative;
        z-index: 0;
      }
      .text-layer {
        position: relative;
        z-index: 1;
      }
    `)
    sharedSheet = sheet
  }
  return sharedSheet
}

// ---------------------------------------------------------------------------
// BloomHighlight custom element
// ---------------------------------------------------------------------------

export class BloomHighlight extends HTMLElement {
  static get observedAttributes() {
    return [
      "type",
      "tip",
      "scale",
      "background-color",
      "gradient",
      "color",
      "padding-x",
      "padding-y",
    ]
  }

  // Per-instance unique prefix for SVG IDs
  #uid
  #shadow

  // Shadow DOM internal elements
  #svgLayer
  #textLayer
  #slot

  // Cached measurements
  #boxSize = { w: 0, h: 0 }
  #lineRects = []

  // Observers / scheduled work
  #resizeObserver = null
  #rafId = 0

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  constructor() {
    super()
    this.#uid = `bloom-${idCounter++}`
    this.#shadow = this.attachShadow({ mode: "open" })
    this.#buildShadowDOM()
  }

  #buildShadowDOM() {
    this.#shadow.adoptedStyleSheets = [getSharedSheet()]

    // SVG layer – acts as positioning anchor
    this.#svgLayer = document.createElement("span")
    this.#svgLayer.className = "svg-layer"
    this.#svgLayer.setAttribute("aria-hidden", "true")

    // Text layer – holds the <slot>
    this.#textLayer = document.createElement("span")
    this.#textLayer.className = "text-layer"

    this.#slot = document.createElement("slot")
    this.#textLayer.appendChild(this.#slot)

    this.#shadow.appendChild(this.#svgLayer)
    this.#shadow.appendChild(this.#textLayer)
  }

  // -----------------------------------------------------------------------
  // Attribute accessors (with defaults matching the React version)
  // -----------------------------------------------------------------------

  get #type() {
    return this.getAttribute("type") ?? "line"
  }

  get #tip() {
    return this.getAttribute("tip") ?? "square"
  }

  get #scale() {
    const v = this.getAttribute("scale")
    return v !== null ? Number(v) : 4
  }

  get #backgroundColor() {
    return this.getAttribute("background-color") ?? "#fdfd77"
  }

  get #gradient() {
    const raw = this.getAttribute("gradient")
    if (!raw) return null
    return raw.split(",").map((s) => s.trim())
  }

  get #color() {
    return this.getAttribute("color") ?? "inherit"
  }

  get #paddingX() {
    const v = this.getAttribute("padding-x")
    return v !== null ? Number(v) : 4
  }

  get #paddingY() {
    const v = this.getAttribute("padding-y")
    return v !== null ? Number(v) : 2
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  connectedCallback() {
    this.#textLayer.style.color = this.#color
    this.#slot.addEventListener("slotchange", this.#onSlotChange)
    this.#setupObservers()
  }

  disconnectedCallback() {
    this.#teardownObservers()
    this.#slot.removeEventListener("slotchange", this.#onSlotChange)
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return

    if (name === "type") {
      // Observers depend on the mode – tear down & rebuild
      this.#teardownObservers()
      this.#setupObservers()
    }

    if (name === "color") {
      this.#textLayer.style.color = this.#color
    }

    this.#render()
  }

  // -----------------------------------------------------------------------
  // Observer setup / teardown
  // -----------------------------------------------------------------------

  #setupObservers() {
    if (this.#type === "box") {
      this.#resizeObserver = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect
        if (width === 0 || height === 0) return
        this.#boxSize = { w: width, h: height }
        this.#render()
      })
      this.#resizeObserver.observe(this.#textLayer)

      // Trigger initial render after first layout
      requestAnimationFrame(() => {
        const { width, height } = this.#textLayer.getBoundingClientRect()
        if (width > 0 && height > 0) {
          this.#boxSize = { w: width, h: height }
          this.#render()
        }
      })
    } else {
      // Line mode – observe resizes & window resize to recalculate line rects
      this.#resizeObserver = new ResizeObserver(() => {
        this.#scheduleLineCalculation()
      })
      this.#resizeObserver.observe(this.#textLayer)

      window.addEventListener("resize", this.#onWindowResize)

      // Initial calculation (deferred so the DOM is laid out)
      this.#scheduleLineCalculation()
    }
  }

  #teardownObservers() {
    if (this.#resizeObserver) {
      this.#resizeObserver.disconnect()
      this.#resizeObserver = null
    }
    window.removeEventListener("resize", this.#onWindowResize)
    cancelAnimationFrame(this.#rafId)
  }

  // -----------------------------------------------------------------------
  // Line measurement (mirrors React useTypeLine)
  // -----------------------------------------------------------------------

  #onWindowResize = () => {
    this.#scheduleLineCalculation()
  }

  #onSlotChange = () => {
    if (this.#type === "line") {
      this.#scheduleLineCalculation()
    }
  }

  #scheduleLineCalculation() {
    cancelAnimationFrame(this.#rafId)
    this.#rafId = requestAnimationFrame(() => this.#calculateLines())
  }

  #calculateLines() {
    const nodes = this.#slot.assignedNodes({ flatten: true })
    if (nodes.length === 0) return

    const range = document.createRange()
    try {
      range.setStartBefore(nodes[0])
      range.setEndAfter(nodes[nodes.length - 1])
    } catch {
      return
    }

    const anchorRect = this.#svgLayer.getBoundingClientRect()
    this.#lineRects = Array.from(range.getClientRects()).map((rect) => ({
      top: rect.top - anchorRect.top,
      left: rect.left - anchorRect.left,
      width: rect.width,
      height: rect.height,
    }))

    this.#render()
  }

  // -----------------------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------------------

  #render() {
    this.#svgLayer.innerHTML = ""

    if (this.#type === "line") {
      this.#renderLineMode()
    } else {
      this.#renderBoxMode()
    }
  }

  /** Box mode – single SVG that wraps the entire element */
  #renderBoxMode() {
    const { w, h } = this.#boxSize
    if (w <= 0 || h <= 0) return

    const paddingX = this.#paddingX
    const paddingY = this.#paddingY
    const filterId = `${this.#uid}-box`
    const gradientId = `${this.#uid}-box-gradient`

    const svg = this.#svgEl("svg")
    svg.setAttribute("width", String(w))
    svg.setAttribute("height", String(h))
    svg.style.cssText = "position:absolute;pointer-events:none;overflow:visible"

    this.#appendDefs(svg, filterId, gradientId)

    const rect = this.#svgEl("rect")
    const size = getRectSize(w, h, paddingX, paddingY)
    rect.setAttribute("x", String(-paddingX))
    rect.setAttribute("y", String(-paddingY))
    rect.setAttribute("width", String(size.width))
    rect.setAttribute("height", String(size.height))
    rect.setAttribute("rx", String(getRx(h, this.#tip, paddingY)))
    rect.setAttribute(
      "fill",
      this.#gradient ? `url(#${gradientId})` : this.#backgroundColor,
    )
    rect.setAttribute("filter", `url(#${filterId})`)

    svg.appendChild(rect)
    this.#svgLayer.appendChild(svg)
  }

  /** Line mode – one SVG per text line */
  #renderLineMode() {
    const paddingX = this.#paddingX
    const paddingY = this.#paddingY
    const gradient = this.#gradient

    this.#lineRects.forEach((lineRect, i) => {
      const filterId = `${this.#uid}-line-${i}`
      const gradientId = `${this.#uid}-line-gradient-${i}`

      const svg = this.#svgEl("svg")
      svg.setAttribute("width", String(lineRect.width))
      svg.setAttribute("height", String(lineRect.height))
      svg.style.cssText =
        "position:absolute;pointer-events:none;overflow:visible"
      svg.style.top = `${lineRect.top}px`
      svg.style.left = `${lineRect.left}px`

      this.#appendDefs(svg, filterId, gradientId)

      const rect = this.#svgEl("rect")
      const size = getRectSize(lineRect.width, lineRect.height, paddingX, paddingY)
      rect.setAttribute("x", String(-paddingX))
      rect.setAttribute("y", String(-paddingY))
      rect.setAttribute("width", String(size.width))
      rect.setAttribute("height", String(size.height))
      rect.setAttribute("rx", String(getRx(lineRect.height, this.#tip, paddingY)))
      rect.setAttribute(
        "fill",
        gradient ? `url(#${gradientId})` : this.#backgroundColor,
      )
      rect.setAttribute("filter", `url(#${filterId})`)

      svg.appendChild(rect)
      this.#svgLayer.appendChild(svg)
    })
  }

  // -----------------------------------------------------------------------
  // SVG helpers
  // -----------------------------------------------------------------------

  /** Create an SVG filter + optional linearGradient inside <defs> */
  #appendDefs(svg, filterId, gradientId) {
    const defs = this.#svgEl("defs")

    // Gradient (optional)
    const gradient = this.#gradient
    if (gradient && gradient.length > 1) {
      const lg = this.#svgEl("linearGradient")
      lg.id = gradientId
      lg.setAttribute("x1", "0%")
      lg.setAttribute("y1", "0%")
      lg.setAttribute("x2", "100%")
      lg.setAttribute("y2", "0%")

      gradient.forEach((color, i) => {
        const stop = this.#svgEl("stop")
        stop.setAttribute("offset", `${(i / (gradient.length - 1)) * 100}%`)
        stop.setAttribute("stop-color", color)
        lg.appendChild(stop)
      })

      defs.appendChild(lg)
    }

    // Filter – feTurbulence + feDisplacementMap (the wobble effect)
    const filter = this.#svgEl("filter")
    filter.id = filterId

    const turbulence = this.#svgEl("feTurbulence")
    turbulence.setAttribute("baseFrequency", "0.015")
    turbulence.setAttribute("numOctaves", "5")
    turbulence.setAttribute("seed", "0")

    const displacement = this.#svgEl("feDisplacementMap")
    displacement.setAttribute("in", "SourceGraphic")
    displacement.setAttribute("scale", String(this.#scale))
    displacement.setAttribute("xChannelSelector", "R")
    displacement.setAttribute("yChannelSelector", "G")

    filter.appendChild(turbulence)
    filter.appendChild(displacement)
    defs.appendChild(filter)

    svg.appendChild(defs)
  }

  /** Namespace-aware SVG element factory */
  #svgEl(tag) {
    return document.createElementNS(SVG_NS, tag)
  }
}
