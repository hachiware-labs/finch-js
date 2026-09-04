import Finch, { createFinch, defaultTheme, midnightTheme } from "./index.js";

const browserFinch = Object.assign(Finch, { createFinch, defaultTheme, midnightTheme });

declare global {
  var Finch: typeof browserFinch;
}

globalThis.Finch = browserFinch;
