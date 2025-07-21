/**
  * Create a new random nonogram game.
  */
class Nonogram {
  #bits;
  #rows;
  #clues;

  constructor(width = 5, height = 5) {
    const bitLength = parseInt(width, 10) * parseInt(height, 10);
    const min = 0;
    // max int that can fin in the given bit length
    const max = (1 << (bitLength - 1)) - 1;
    const rand = Math.round(Math.random() * (max - min) + max);

    const bits = rand.toString(2);
    const rows = bits
      .match(new RegExp(`\\d{${width}}`, "g"))
      .map((r) => r.split(""));
    const cols = rows[0].map((_, i) => rows.map((row) => row[i]));

    const clues = {};
    Object.entries({ rows, cols }).forEach(([key, value]) => {
      clues[key] = value.map((row) =>
        row
          .join("")
          .split("0")
          .map((i) => i.length)
          .filter((v, idx, arr) => v > 0 || (v === 0 && idx === 0 && arr.every((i) => i === 0)))
      )
    });

    this.#bits = bits;
    this.#rows = rows;
    this.#clues = clues;
  }

  get bits() {
    return this.#bits;
  }

  get rows() {
    return this.#rows;
  }

  get clues() {
    return this.#clues;
  }
}

/**
  * Web Components base class.
  */
class BaseElement extends HTMLElement {
  static define(tagName, options = {}) {
    if (!customElements.get(tagName)) {
      customElements.define(tagName, this, options);
    }
  }

  #shadowRoot = this.attachShadow({ mode: "open" });
  #abortController;

  constructor() {
    super();
  }

  connectedCallback() {
    if (!this.render) {
      throw new Error(
        "Web components extending BaseElement must implement a `render` method.",
      );
    }

    // HTML
    this.#abortController = new AbortController();
    const template = bind(this.render(), this, this.#abortController);

    // CSS
    if (this.constructor.styles) {
      if (this.#shadowRoot.adoptedStyleSheets) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(this.constructor.styles);
        this.#shadowRoot.adoptedStyleSheets = [sheet];
      } else {
        const style = document.createElement("style");
        style.textContent = this.constructor.styles;
        template.prepend(style);
      }
    }

    this.#shadowRoot.append(template);
  }

  disconnectedCallback() {
    this.#abortController.abort();
  }
}

/**
  * Binds events and attributes to elements in a template.
  */
function bind(content, target, abortController = {}) {
  const fragment = _createFragment(content);
  const iterator = _createHTMLElementIterator(fragment);

  let node;
  while ((node = iterator.nextNode())) {
    if (!node) {
      return;
    }

    const element = node;
    for (const attribute of [...element.attributes]) {
      // Event binding
      if (attribute.name.startsWith("@")) {
        _bindEvent(target, element, attribute, abortController);
      }

      // Attribute binding
      else if (attribute.name.startsWith(":")) {
        _bindAttribute(target, element, attribute, abortController);
      }
    }
  }

  return fragment;
}

function _createFragment(template) {
  if (!template.content) {
    const content = template;
    template = document.createElement("template");
    template.innerHTML = content;
  }

  return template.content.cloneNode(true);
}

function _createHTMLElementIterator(fragment) {
  return document.createNodeIterator(fragment, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (!(node instanceof HTMLElement)) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });
}

function _bindEvent(target, element, attribute, abortController = {}) {
  const event = attribute.name.slice(1);
  const property = attribute.value;

  // Default listener: set the target property value directly
  let listener = (e) => (target[property] = e.target.value);

  // Target property is a function: call the function directly
  if (typeof target[property] === "function") {
    listener = target[property].bind(target);
  }

  // Target property is a signal: set the signal value
  else if (
    typeof target[property] === "object" &&
    typeof target[property].value !== "undefined"
  ) {
    listener = (e) => (target[property].value = e.target.value);
  }

  // Attach the event listener
  // Pass in the signal from the provided abort controller, if present
  const { signal } = abortController;
  element.addEventListener(event, listener, { signal });

  // Remove the non-standard event binding attribute from the element
  element.removeAttributeNode(attribute);
}

function _bindAttribute(target, element, attribute, abortController) {
  const name = attribute.name.slice(1);
  const property = _getPropertyForAttribute(target, name);

  // Set the property of the element if it exists, fall back to setting an attribute
  const setter = property
    ? () => (element[property] = target[attribute.value])
    : () => element.setAttribute(name, target[attribute.value]);

  // Set the initial value immediately
  setter();

  // Target property is a signal: call the `effect` function with the setter
  if (target[attribute.value]?.effect) {
    target[attribute.value].effect(setter);
  }

  // Target property is NOT a signal: listen to the target's change event
  // The target is responsible for dispatching a change event when the value changes.
  // Pass in the signal from the provided abort controller, if present
  else if (target.addEventListener) {
    const { signal } = abortController;
    target.addEventListener("change", setter, { signal });
  }

  // Remove the non-standard attribute binding attribute from the element
  element.removeAttributeNode(attribute);
}

// Map attribute names (case insensitive) to property names (case sensitive)
// Add short-hand properties here for common attribute names.
function _getPropertyForAttribute(object, name) {
  switch (name.toLowerCase()) {
    case "text":
    case "textcontent":
      return "textContent";
    case "html":
    case "innerhtml":
      return "innerHTML";
    default:
      for (const prop of Object.getOwnPropertyNames(object)) {
        if (prop.toLowerCase() === name.toLowerCase()) {
          return prop;
        }
      }
  }
}

/**
  * Signal
  */
class Signal extends EventTarget {
  #value;

  constructor(value) {
    super();
    this.#value = value;
  }

  get value() {
    return this.#value;
  }

  set value(value) {
    if (this.#value === value) {
      return;
    }

    this.#value = value;
    this.dispatchEvent(new CustomEvent("change", { detail: value }));
  }

  effect(fn) {
    this.addEventListener("change", fn);

    // Trigger the effect immediately by dispatching a change event with the current value
    this.dispatchEvent(new CustomEvent("change", { detail: this.#value }));
    return () => this.removeEventListener("change", fn);
  }

  valueOf() {
    return this.#value;
  }

  toString() {
    return String(this.#value);
  }
}

function signal(value) {
  return new Signal(value);
}

/**
  * Computed Signal
  */
class Computed extends Signal {
  constructor(fn, deps) {
    super(fn(...deps));

    for (const dep of deps) {
      if (dep instanceof Signal) {
        dep.addEventListener("change", () => {
          this.value = fn(...deps);
        });
      }
    }
  }
}

function computed(fn, deps) {
  return new Computed(fn, deps);
}

/**
  * HTML String Encoding
  */
class Html extends String { }

const EntityMap = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ["'", "&#39;"],
  ['"', "&quot;"],
]);
const EntityMatcher = /[&<>'"]/g;

/**
 * tag a string as html not to be encoded
 * @param {string} str
 * @returns {string}
 */
function htmlRaw(str) {
  return new Html(str);
}

/**
 * entity encode a string as html
 * @param {*} value The value to encode
 * @returns {string}
 */
function htmlEncode(value) {
  // avoid double-encoding the same string
  if (value instanceof Html) {
    return value;
  } else {
    // https://stackoverflow.com/a/57448862/20980
    return htmlRaw(
      String(value).replace(EntityMatcher, (tag) => EntityMap.get(tag))
    );
  }
}

/**
 * html tagged template literal, auto-encodes entities
 */
function html(strings, ...values) {
  return htmlRaw(String.raw({ raw: strings }, ...values.map(htmlEncode)));
}
