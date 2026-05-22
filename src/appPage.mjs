import { readFileSync } from "node:fs";

let cachedHtml;

export function appPageHtml() {
  if (!cachedHtml) {
    const shell = readFileSync(new URL("./toodles_24.html", import.meta.url), "utf8")
      .replace('placeholder="sk-ant-... you know the one"', 'placeholder="enter access code"')
      .replace('onclick="unlock()">Unlock</button>', 'id="unlockBtn" onclick="unlock()">Unlock</button>')
      .replaceAll("POWERED BY ANTHROPIC", "POWERED BY TOODLES");
    const clientScript = readFileSync(new URL("./toodlesClient.js", import.meta.url), "utf8");
    cachedHtml = shell.replace(/<script>[\s\S]*?<\/script>\s*<\/body>/, `<script>\n${clientScript}\n</script>\n</body>`);
  }

  return cachedHtml;
}
