/** Resolve image references against the page, never against the library script. */
export function imageUrl(source: string, document: Document): string {
  const url = new URL(source, document.baseURI);
  if (!["https:", "http:", "file:", "blob:", "data:"].includes(url.protocol)) throw new Error("Unsupported image URL protocol.");
  if (url.protocol === "data:" && !/^data:image\/(png|jpeg|gif|webp|svg\+xml);/i.test(source)) throw new Error("Unsupported image data URL.");
  return url.href;
}

/** Embed images in an export clone; failure must not produce an incomplete export. */
export async function embedImages(svg: SVGSVGElement): Promise<void> {
  const cache = new Map<string, Promise<string>>();
  await Promise.all([...svg.querySelectorAll("image")].map(async image => {
    const href = image.getAttribute("href");
    if (!href || href.startsWith("data:")) return;
    let pending = cache.get(href);
    if (!pending) {
      pending = (async () => {
        const response = await fetch(href, { credentials: "same-origin" });
        if (!response.ok) throw new Error(`Image export failed (${response.status}): ${href}`);
        const blob = await response.blob();
        if (!/^image\/(png|jpeg|gif|webp|svg\+xml)(;|$)/i.test(blob.type)) throw new Error(`Unsupported image content: ${href}`);
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error(`Could not embed image: ${href}`));
          reader.readAsDataURL(blob);
        });
      })();
      cache.set(href, pending);
    }
    image.setAttribute("href", await pending);
  }));
}
