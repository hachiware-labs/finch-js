# Generate a diagram from a prompt

[日本語](generating_ja.md) · [Tutorial](tutorial.md)

Use Node.js 22 or newer and a signed-in Codex CLI. For first-time setup:

```sh
npm install -g @openai/codex
codex login
```

After a package release containing this change, start the demo with:

```sh
npx @hachiware-labs/finch-js demo
```

Open the printed URL, `http://127.0.0.1:4316`. Choose a preset or enter a diagram request. Codex produces a Finch.js HTML document, and the page displays it in an iframe. Press the pink bird button in the lower-left of the diagram to edit node positions or diagram source. Use “Open in a new tab” (別タブで開く) to view the result on its own. The demo UI is in Japanese; prompts can use your preferred language. Generation requires an internet connection and available Codex usage.

To try the current checkout before release, run `npm ci`, `npm run build`, and `npm run demo`. Previously published versions do not include this command.

Choose another port or output directory:

```sh
npx @hachiware-labs/finch-js demo --port 4320 --output ./my-diagrams
```

HTML files are saved to `.finch-demo/generated/` under the current working directory by default. Restart with the same output directory to reopen previous URLs. Generated HTML references this server's `/assets/` routes; adjust script URLs before opening files directly or hosting them elsewhere. Press `Ctrl+C` to stop. The server listens only on `127.0.0.1`.

If Codex cannot be found, set `CODEX_CLI_JS` to the absolute path of `@openai/codex/bin/codex.js`, or set `CODEX_BIN` to a native executable.
