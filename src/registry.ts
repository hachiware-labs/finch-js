import type { DiagramPlugin, LayoutPlugin, ShapePlugin, ThemePlugin } from "./types.js";

export class Registry {
  readonly diagrams = new Map<string, DiagramPlugin>();
  readonly shapes = new Map<string, ShapePlugin>();
  readonly layouts = new Map<string, LayoutPlugin>();
  readonly themes = new Map<string, ThemePlugin>();

  registerDiagram(name: string, plugin: DiagramPlugin): void {
    this.diagrams.set(normalize(name), { ...plugin, name: normalize(name) });
  }

  registerShape(name: string, plugin: ShapePlugin): void {
    this.shapes.set(normalize(name), { ...plugin, name: normalize(name) });
  }

  registerLayout(name: string, plugin: LayoutPlugin): void {
    this.layouts.set(normalize(name), { ...plugin, name: normalize(name) });
  }

  registerTheme(name: string, theme: ThemePlugin): void {
    this.themes.set(normalize(name), { ...theme, name: normalize(name) });
  }

  diagram(name: string): DiagramPlugin {
    const plugin = this.diagrams.get(normalize(name));
    if (!plugin) throw new Error(`Unknown diagram "${name}". Register it with Tit.registerDiagram().`);
    return plugin;
  }

  shape(name: string): ShapePlugin {
    return this.shapes.get(normalize(name)) ?? this.shapes.get("rectangle") ?? missing("shape", name);
  }

  layout(name: string): LayoutPlugin {
    const plugin = this.layouts.get(normalize(name));
    if (!plugin) throw new Error(`Unknown layout "${name}". Register it with Tit.registerLayout().`);
    return plugin;
  }

  theme(name: string): ThemePlugin {
    const theme = this.themes.get(normalize(name));
    if (!theme) throw new Error(`Unknown theme "${name}". Register it with Tit.registerTheme().`);
    return theme;
  }
}

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

function missing(kind: string, name: string): never {
  throw new Error(`Unknown ${kind} "${name}".`);
}
