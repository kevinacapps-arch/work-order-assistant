import { readFileSync } from "node:fs";

let cachedHtml;

export function appPageHtml() {
  if (!cachedHtml) {
    const shell = readFileSync(new URL("./toodles_24.html", import.meta.url), "utf8")
      .replace('onclick="unlock()">Unlock</button>', 'id="unlockBtn" onclick="unlock()">Unlock</button>');
    const clientScript = readFileSync(new URL("./toodlesClient.js", import.meta.url), "utf8");
    cachedHtml = shell.replace(/<script>[\s\S]*?<\/script>\s*<\/body>/, `<script>\n${clientScript}\n</script>\n</body>`);
  }

  return cachedHtml;
}
