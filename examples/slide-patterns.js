const patterns = [...document.querySelectorAll("[data-pattern-source]")];
const diagram = document.querySelector("#diagram");
const sourceView = document.querySelector("#source");
const sourceName = document.querySelector("#source-name");
const errorView = document.querySelector("#error");
let instance;

async function showPattern(button) {
  const sourceFile = button.dataset.patternSource;
  if (!sourceFile) return;
  try {
    errorView.hidden = true;
    const response = await fetch(sourceFile, { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const source = await response.text();
    sourceView.textContent = source;
    sourceName.textContent = sourceFile;
    if (instance) instance.update(source);
    else instance = Tit.render(source, { target: diagram, ariaLabel: `${button.textContent.trim()} slide pattern` });
    patterns.forEach((candidate) => candidate.setAttribute("aria-pressed", String(candidate === button)));
  } catch (error) {
    errorView.hidden = false;
    errorView.textContent = `Could not load ${sourceFile}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

patterns.forEach((button) => button.addEventListener("click", () => void showPattern(button)));
if (patterns[0]) void showPattern(patterns[0]);
