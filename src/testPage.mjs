export function testPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Work Order Assistant Test</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #19221d;
      --muted: #5d6861;
      --line: #cfd8d1;
      --paper: #f7f4ed;
      --panel: #ffffff;
      --accent: #0d6b57;
      --accent-dark: #084637;
      --warn: #9b3d18;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      color: var(--ink);
      background:
        linear-gradient(135deg, rgba(13, 107, 87, 0.08), transparent 38%),
        repeating-linear-gradient(0deg, rgba(25, 34, 29, 0.035), rgba(25, 34, 29, 0.035) 1px, transparent 1px, transparent 24px),
        var(--paper);
    }

    main {
      width: min(980px, calc(100% - 32px));
      margin: 32px auto;
    }

    h1 {
      margin: 0 0 8px;
      font-size: 34px;
      line-height: 1.05;
      letter-spacing: 0;
    }

    p {
      margin: 0 0 22px;
      color: var(--muted);
      font-size: 17px;
      line-height: 1.45;
    }

    section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      align-items: start;
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      box-shadow: 0 14px 35px rgba(25, 34, 29, 0.08);
    }

    label {
      display: block;
      margin: 0 0 6px;
      font: 700 13px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
      color: #2b3931;
      text-transform: uppercase;
    }

    input,
    textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 11px 12px;
      color: var(--ink);
      background: #fbfaf6;
      font: 15px/1.35 ui-monospace, SFMono-Regular, Consolas, monospace;
    }

    textarea {
      min-height: 92px;
      resize: vertical;
    }

    .field {
      margin-bottom: 14px;
    }

    button {
      width: 100%;
      min-height: 46px;
      border: 0;
      border-radius: 6px;
      color: #fff;
      background: var(--accent);
      font: 700 15px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
      cursor: pointer;
    }

    button:hover {
      background: var(--accent-dark);
    }

    button:disabled {
      cursor: wait;
      opacity: 0.72;
    }

    pre {
      min-height: 360px;
      white-space: pre-wrap;
      word-wrap: break-word;
      margin: 0;
      color: var(--ink);
      font: 16px/1.45 ui-monospace, SFMono-Regular, Consolas, monospace;
    }

    .status {
      min-height: 22px;
      margin: 12px 0 0;
      color: var(--muted);
      font: 14px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace;
    }

    .status.error {
      color: var(--warn);
    }

    @media (max-width: 760px) {
      main {
        width: min(100% - 20px, 980px);
        margin: 18px auto;
      }

      section {
        grid-template-columns: 1fr;
      }

      h1 {
        font-size: 28px;
      }
    }
  </style>
</head>
<body>
  <main>
    <h1>Work Order Assistant Test</h1>
    <p>Send one sample packet to this deployed backend and check the draft before wiring Apple Shortcuts.</p>

    <section>
      <form class="panel" id="test-form">
        <div class="field">
          <label for="secret">App Shared Secret</label>
          <input id="secret" name="secret" type="password" autocomplete="off" placeholder="Paste APP_SHARED_SECRET">
        </div>

        <div class="field">
          <label for="label">Label</label>
          <input id="label" name="label" value="204 kitchen sink">
        </div>

        <div class="field">
          <label for="sourceText">Work Order Text</label>
          <textarea id="sourceText" name="sourceText">Tenant reports kitchen sink backing up and disposal humming.</textarea>
        </div>

        <div class="field">
          <label for="fieldNotes">Field Notes</label>
          <textarea id="fieldNotes" name="fieldNotes">Disposal was jammed. Cabinet access was tight. Cleared trap and freed disposal. Sink draining now.</textarea>
        </div>

        <div class="field">
          <label for="laborNotes">Labor Context</label>
          <textarea id="laborNotes" name="laborNotes">Extra time due to tight cabinet access.</textarea>
        </div>

        <div class="field">
          <label for="followUp">Follow-Up</label>
          <textarea id="followUp" name="followUp"></textarea>
        </div>

        <button type="submit" id="send">Send Test</button>
        <div class="status" id="status"></div>
      </form>

      <div class="panel">
        <pre id="output">Draft note will show here.</pre>
      </div>
    </section>
  </main>

  <script>
    const form = document.querySelector("#test-form");
    const button = document.querySelector("#send");
    const status = document.querySelector("#status");
    const output = document.querySelector("#output");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      status.className = "status";
      status.textContent = "Sending...";
      output.textContent = "";
      button.disabled = true;

      const formData = new FormData(form);
      const secret = String(formData.get("secret") || "").trim();
      const packet = {
        label: formData.get("label"),
        sourceText: formData.get("sourceText"),
        fieldNotes: formData.get("fieldNotes"),
        laborNotes: formData.get("laborNotes"),
        followUp: formData.get("followUp"),
        ocrText: ""
      };

      try {
        const response = await fetch("/api/draft", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + secret,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(packet)
        });

        const json = await response.json();
        if (!response.ok) {
          throw new Error(json.error || "Request failed.");
        }

        output.textContent = json.draftNote || JSON.stringify(json, null, 2);
        status.textContent = "OK";
      } catch (error) {
        status.className = "status error";
        status.textContent = error.message;
        output.textContent = "Request failed.";
      } finally {
        button.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}
