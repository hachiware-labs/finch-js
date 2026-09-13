# Create diagrams with a coding agent

[日本語](agents_ja.md) · [Tutorial](tutorial.md)

The repository contains a portable Finch skill that creates an HTML page with the source and render call kept together. Ask your coding agent:

```text
Use the Finch skill to create an activity diagram in HTML for this order-review specification.
Keep the IDs stable and leave the exact layout for me to refine.
```

Review the generated facts, open the page, then drag and pin the few positions that need human judgment. When requirements change, update the text instead of recreating the diagram.

Codex discovers the repository-local skill automatically and accepts `$finch` as an explicit invocation. To install the skill elsewhere or for another supported agent:

```bash
npx skills add hachiware-labs/finch-js --skill finch
```

Choose the target agent in the installer, or pass it directly—for example, `--agent claude-code cursor`. Invocation conventions differ by agent, but the skill instructions and generated Finch.js HTML are shared.
