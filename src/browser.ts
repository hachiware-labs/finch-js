import Finch, { createFinch, defaultTheme, midnightTheme, prismTheme, lucideIcons, parseState, validateState } from "./index.js";

const browserFinch = Object.assign(Finch, { createFinch, defaultTheme, midnightTheme, prismTheme, lucideIcons, parseState, validateState });

declare global {
  var Finch: typeof browserFinch;
}

globalThis.Finch = browserFinch;

