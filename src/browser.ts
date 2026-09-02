import Tit, { createTit, defaultTheme, midnightTheme } from "./index";

Object.assign(Tit, { createTit, defaultTheme, midnightTheme });
(globalThis as typeof globalThis & { Tit: typeof Tit }).Tit = Tit;
