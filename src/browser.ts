import Tit, { createTit, defaultTheme, midnightTheme } from "./index.js";

const browserTit = Object.assign(Tit, { createTit, defaultTheme, midnightTheme });

declare global {
  var Tit: typeof browserTit;
}

globalThis.Tit = browserTit;
