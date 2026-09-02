const title = document.body.dataset.title ?? "Diagram";
const sourceFile = document.body.dataset.source;
const diagram = document.querySelector("#diagram");
const sourceView = document.querySelector("#source");
const errorView = document.querySelector("#error");
let instance;

const controls = document.createElement("div");
controls.className = "example-toolbar viewport-controls";
controls.innerHTML = `
  <button type="button" data-zoom="out" aria-label="Zoom out">−</button>
  <button type="button" data-zoom="reset" class="zoom-readout" aria-label="Reset zoom to 100%">100%</button>
  <button type="button" data-zoom="in" aria-label="Zoom in">＋</button>
  <button type="button" data-zoom="fit">Fit diagram</button>
  <button type="button" data-zoom="width">Fit width</button>
`;
diagram.before(controls);

function updateZoomReadout() {
  const readout = controls.querySelector(".zoom-readout");
  if (readout && instance) readout.textContent = `${Math.round(instance.zoom * 100)}%`;
}

controls.addEventListener("click", (event) => {
  const action = event.target.closest("[data-zoom]")?.dataset.zoom;
  if (!instance || !action) return;
  if (action === "out") instance.zoomOut();
  if (action === "in") instance.zoomIn();
  if (action === "reset") instance.resetZoom();
  if (action === "fit") instance.fit("diagram");
  if (action === "width") instance.fit("width");
  updateZoomReadout();
});

diagram.addEventListener("tit:zoomchange", updateZoomReadout);

async function renderExample() {
  try {
    if (!sourceFile) throw new Error("Missing data-source on the example page.");
    const response = await fetch(sourceFile, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const source = await response.text();
    sourceView.textContent = source;
    instance = Tit.render(source, { target: diagram, ariaLabel: `${title} advanced example` });
    updateZoomReadout();
  } catch (error) {
    errorView.hidden = false;
    errorView.textContent = `Could not load ${sourceFile}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

void renderExample();
