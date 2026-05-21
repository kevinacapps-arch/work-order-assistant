export function appPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Work Order Notes</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f4f1ea;
      --panel: #fffdf8;
      --panel-2: #eef4ef;
      --ink: #17211c;
      --muted: #627067;
      --line: #cbd5ce;
      --line-strong: #aebcb3;
      --accent: #0f6a55;
      --accent-2: #1d4e89;
      --warn: #9b3d18;
      --shadow: 0 16px 40px rgba(23, 33, 28, 0.1);
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      background:
        linear-gradient(120deg, rgba(15, 106, 85, 0.1), transparent 34%),
        linear-gradient(290deg, rgba(29, 78, 137, 0.11), transparent 32%),
        repeating-linear-gradient(0deg, rgba(23, 33, 28, 0.035), rgba(23, 33, 28, 0.035) 1px, transparent 1px, transparent 28px),
        var(--bg);
      font-family: "Aptos", "Segoe UI", sans-serif;
    }

    header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 18px;
      align-items: center;
      padding: 18px 22px;
      border-bottom: 1px solid var(--line);
      background: rgba(255, 253, 248, 0.86);
      backdrop-filter: blur(12px);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    h1 {
      margin: 0;
      font: 800 22px/1.1 "Aptos Display", "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    .topbar {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      justify-content: end;
    }

    .secret {
      width: min(320px, 42vw);
      height: 38px;
    }

    main {
      display: grid;
      grid-template-columns: 260px minmax(360px, 1fr) minmax(360px, 0.9fr);
      gap: 14px;
      padding: 14px;
      min-height: calc(100vh - 75px);
    }

    aside,
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      box-shadow: var(--shadow);
      min-width: 0;
    }

    aside {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .panel-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 14px;
      border-bottom: 1px solid var(--line);
    }

    h2 {
      margin: 0;
      font: 800 15px/1.2 "Aptos Display", "Segoe UI", sans-serif;
      letter-spacing: 0;
    }

    .job-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 10px;
      overflow: auto;
    }

    .job {
      width: 100%;
      border: 1px solid var(--line);
      background: #fbfaf6;
      color: var(--ink);
      text-align: left;
      border-radius: 6px;
      padding: 10px;
      cursor: pointer;
    }

    .job.active {
      border-color: var(--accent);
      background: var(--panel-2);
    }

    .job strong {
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
    }

    .job span {
      display: block;
      margin-top: 4px;
      color: var(--muted);
      font-size: 12px;
    }

    .content {
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .fields,
    .output-body {
      padding: 14px;
      overflow: auto;
    }

    label {
      display: block;
      margin: 0 0 6px;
      color: #26352d;
      font: 800 12px/1.2 ui-monospace, SFMono-Regular, Consolas, monospace;
      text-transform: uppercase;
    }

    input,
    textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fffefa;
      color: var(--ink);
      padding: 10px 11px;
      font: 15px/1.38 "Aptos", "Segoe UI", sans-serif;
    }

    textarea {
      min-height: 88px;
      resize: vertical;
    }

    .field {
      margin-bottom: 13px;
    }

    .quick-add {
      display: grid;
      grid-template-columns: 150px 1fr auto;
      gap: 8px;
      align-items: end;
      padding: 14px;
      border-top: 1px solid var(--line);
      background: #fbfaf6;
    }

    select {
      height: 40px;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fffefa;
      color: var(--ink);
      padding: 0 10px;
      font: 14px/1.2 "Aptos", "Segoe UI", sans-serif;
    }

    button {
      min-height: 38px;
      border: 1px solid var(--line-strong);
      border-radius: 6px;
      background: #fffefa;
      color: var(--ink);
      padding: 0 12px;
      font: 800 13px/1.1 "Aptos", "Segoe UI", sans-serif;
      cursor: pointer;
      white-space: nowrap;
    }

    button.primary {
      border-color: var(--accent);
      background: var(--accent);
      color: #fff;
    }

    button.secondary {
      border-color: var(--accent-2);
      color: var(--accent-2);
    }

    button.danger {
      color: var(--warn);
    }

    button:disabled {
      cursor: wait;
      opacity: 0.62;
    }

    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .note {
      min-height: 290px;
      white-space: pre-wrap;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: #fffefa;
      padding: 12px;
      font: 16px/1.45 Georgia, "Times New Roman", serif;
    }

    .empty {
      color: var(--muted);
    }

    .status {
      min-height: 20px;
      color: var(--muted);
      font-size: 13px;
    }

    .status.error {
      color: var(--warn);
    }

    .revision {
      margin-top: 14px;
    }

    @media (max-width: 1080px) {
      main {
        grid-template-columns: 220px 1fr;
      }

      .output {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 720px) {
      header {
        grid-template-columns: 1fr;
      }

      .topbar {
        justify-content: stretch;
      }

      .secret {
        width: 100%;
      }

      main {
        grid-template-columns: 1fr;
        padding: 10px;
      }

      .quick-add {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <header>
    <h1>Work Order Notes</h1>
    <div class="topbar">
      <input class="secret" id="secret" type="password" autocomplete="off" placeholder="APP_SHARED_SECRET">
      <button id="save-secret">Save Secret</button>
      <button id="new-job" class="primary">New Job</button>
    </div>
  </header>

  <main>
    <aside>
      <div class="panel-head">
        <h2>Jobs</h2>
        <button id="clear-done" class="danger">Clear</button>
      </div>
      <div class="job-list" id="job-list"></div>
    </aside>

    <section class="content">
      <div class="panel-head">
        <h2>Field Facts</h2>
        <div class="status" id="status"></div>
      </div>

      <div class="fields">
        <div class="field">
          <label for="label">Job Label</label>
          <input id="label" placeholder="204 kitchen sink">
        </div>

        <div class="field">
          <label for="sourceText">Work Order Text</label>
          <textarea id="sourceText" placeholder="Tenant complaint or copied AppFolio text"></textarea>
        </div>

        <div class="field">
          <label for="fieldNotes">Field Notes</label>
          <textarea id="fieldNotes" placeholder="What you walked into, checked, found, and did"></textarea>
        </div>

        <div class="field">
          <label for="ocrText">OCR Text</label>
          <textarea id="ocrText" placeholder="Screenshot/photo text if you have it"></textarea>
        </div>

        <div class="field">
          <label for="laborNotes">Labor Context</label>
          <textarea id="laborNotes" placeholder="Access, troubleshooting, supply run, traffic, vendor delay"></textarea>
        </div>

        <div class="field">
          <label for="followUp">Follow-Up</label>
          <textarea id="followUp" placeholder="Practical follow-up or vendor recommendation"></textarea>
        </div>
      </div>

      <div class="quick-add">
        <select id="update-type">
          <option value="fieldNotes">Field note</option>
          <option value="sourceText">WO text</option>
          <option value="laborNotes">Labor reason</option>
          <option value="followUp">Follow-up</option>
          <option value="ocrText">OCR text</option>
        </select>
        <textarea id="update-text" placeholder="Add a quick update"></textarea>
        <button id="add-update">Add</button>
      </div>
    </section>

    <section class="content output">
      <div class="panel-head">
        <h2>Output</h2>
        <div class="actions">
          <button id="make-note" class="primary">Make Note</button>
          <button id="copy-note">Copy</button>
        </div>
      </div>
      <div class="output-body">
        <div class="note empty" id="note">Generated note will show here.</div>

        <div class="revision">
          <label for="correction">Revision</label>
          <textarea id="correction" placeholder="Too formal. Make it shorter. Do not say performed."></textarea>
          <div class="actions" style="margin-top: 8px;">
            <button id="revise-note" class="secondary">Revise</button>
            <button id="save-final">Mark Final</button>
          </div>
        </div>
      </div>
    </section>
  </main>

  <script>
    const storageKey = "wo-ui-jobs-v1";
    const secretKey = "wo-ui-secret-v1";
    const fields = ["label", "sourceText", "fieldNotes", "ocrText", "laborNotes", "followUp"];
    let jobs = loadJobs();
    let activeId = jobs[0] ? jobs[0].id : null;

    const els = {
      secret: document.getElementById("secret"),
      saveSecret: document.getElementById("save-secret"),
      newJob: document.getElementById("new-job"),
      clearDone: document.getElementById("clear-done"),
      jobList: document.getElementById("job-list"),
      status: document.getElementById("status"),
      updateType: document.getElementById("update-type"),
      updateText: document.getElementById("update-text"),
      addUpdate: document.getElementById("add-update"),
      makeNote: document.getElementById("make-note"),
      copyNote: document.getElementById("copy-note"),
      reviseNote: document.getElementById("revise-note"),
      saveFinal: document.getElementById("save-final"),
      note: document.getElementById("note"),
      correction: document.getElementById("correction")
    };

    for (const id of fields) {
      els[id] = document.getElementById(id);
      els[id].addEventListener("input", () => {
        const job = activeJob();
        if (!job) return;
        job[id] = els[id].value;
        saveJobs();
        renderJobs();
      });
    }

    els.secret.value = localStorage.getItem(secretKey) || "";
    els.saveSecret.addEventListener("click", () => {
      localStorage.setItem(secretKey, els.secret.value.trim());
      setStatus("Secret saved on this device.");
    });

    els.newJob.addEventListener("click", () => {
      const label = window.prompt("Job label", "");
      if (!label) return;
      const now = new Date();
      const id = String(now.getTime());
      jobs.unshift({
        id,
        createdAt: now.toISOString(),
        label: label.trim(),
        sourceText: "",
        fieldNotes: "",
        ocrText: "",
        laborNotes: "",
        followUp: "",
        draftNote: "",
        finalNote: "",
        status: "started"
      });
      activeId = id;
      saveJobs();
      render();
    });

    els.clearDone.addEventListener("click", () => {
      const yes = window.confirm("Clear final jobs from this browser?");
      if (!yes) return;
      jobs = jobs.filter((job) => job.status !== "final");
      activeId = jobs[0] ? jobs[0].id : null;
      saveJobs();
      render();
    });

    els.addUpdate.addEventListener("click", () => {
      const job = requireJob();
      if (!job) return;
      const target = els.updateType.value;
      const text = els.updateText.value.trim();
      if (!text) return;
      const stamp = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      const line = stamp + " - " + text;
      job[target] = appendText(job[target], line);
      els.updateText.value = "";
      saveJobs();
      render();
      setStatus("Update added.");
    });

    els.makeNote.addEventListener("click", async () => {
      const job = requireJob();
      if (!job) return;
      await withBusy(els.makeNote, async () => {
        const json = await postJson("/api/draft", packetFromJob(job));
        job.draftNote = json.draftNote || "";
        job.status = "draft";
        saveJobs();
        render();
        await copyText(job.draftNote);
        setStatus("Draft made and copied.");
      });
    });

    els.reviseNote.addEventListener("click", async () => {
      const job = requireJob();
      if (!job) return;
      if (!job.draftNote && !job.finalNote) {
        setStatus("Make a draft first.", true);
        return;
      }
      const correction = els.correction.value.trim();
      if (!correction) {
        setStatus("Add revision notes first.", true);
        return;
      }
      await withBusy(els.reviseNote, async () => {
        const json = await postJson("/api/refine", {
          packet: packetFromJob(job),
          currentNote: job.finalNote || job.draftNote,
          correction
        });
        job.finalNote = json.revisedNote || "";
        job.status = "revised";
        els.correction.value = "";
        saveJobs();
        render();
        await copyText(job.finalNote);
        setStatus("Revision made and copied.");
      });
    });

    els.copyNote.addEventListener("click", async () => {
      const job = requireJob();
      if (!job) return;
      const text = job.finalNote || job.draftNote;
      if (!text) {
        setStatus("No note to copy yet.", true);
        return;
      }
      await copyText(text);
      setStatus("Copied.");
    });

    els.saveFinal.addEventListener("click", async () => {
      const job = requireJob();
      if (!job) return;
      if (!job.finalNote && job.draftNote) job.finalNote = job.draftNote;
      if (!job.finalNote) {
        setStatus("No note to mark final.", true);
        return;
      }
      job.status = "final";
      saveJobs();
      render();
      await copyText(job.finalNote);
      setStatus("Marked final and copied.");
    });

    function render() {
      if (!activeId && jobs[0]) activeId = jobs[0].id;
      renderJobs();
      renderFields();
      renderOutput();
    }

    function renderJobs() {
      els.jobList.innerHTML = "";
      if (!jobs.length) {
        const empty = document.createElement("div");
        empty.className = "status";
        empty.style.padding = "6px";
        empty.textContent = "No jobs yet.";
        els.jobList.appendChild(empty);
        return;
      }

      for (const job of jobs) {
        const button = document.createElement("button");
        button.className = "job" + (job.id === activeId ? " active" : "");
        button.innerHTML = "<strong></strong><span></span>";
        button.querySelector("strong").textContent = job.label || "Untitled job";
        button.querySelector("span").textContent = job.status + " | " + formatDate(job.createdAt);
        button.addEventListener("click", () => {
          activeId = job.id;
          render();
        });
        els.jobList.appendChild(button);
      }
    }

    function renderFields() {
      const job = activeJob();
      for (const id of fields) {
        els[id].value = job ? job[id] || "" : "";
        els[id].disabled = !job;
      }
      els.addUpdate.disabled = !job;
      els.makeNote.disabled = !job;
      els.reviseNote.disabled = !job;
      els.copyNote.disabled = !job;
      els.saveFinal.disabled = !job;
    }

    function renderOutput() {
      const job = activeJob();
      const text = job ? job.finalNote || job.draftNote : "";
      els.note.className = "note" + (text ? "" : " empty");
      els.note.textContent = text || "Generated note will show here.";
    }

    function activeJob() {
      return jobs.find((job) => job.id === activeId) || null;
    }

    function requireJob() {
      const job = activeJob();
      if (!job) setStatus("Start a job first.", true);
      return job;
    }

    function packetFromJob(job) {
      return {
        packetId: job.id,
        label: job.label,
        sourceText: job.sourceText,
        fieldNotes: job.fieldNotes,
        ocrText: job.ocrText,
        laborNotes: job.laborNotes,
        followUp: job.followUp
      };
    }

    async function postJson(url, body) {
      const secret = els.secret.value.trim() || localStorage.getItem(secretKey) || "";
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-Secret": secret
        },
        body: JSON.stringify(body)
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json.error || "Request failed.");
      }
      return json;
    }

    async function withBusy(button, fn) {
      button.disabled = true;
      setStatus("Working...");
      try {
        await fn();
      } catch (error) {
        setStatus(error.message, true);
      } finally {
        button.disabled = false;
        renderFields();
      }
    }

    async function copyText(text) {
      if (!text) return;
      await navigator.clipboard.writeText(text);
    }

    function appendText(existing, update) {
      return [existing, update].filter(Boolean).join("\\n");
    }

    function saveJobs() {
      localStorage.setItem(storageKey, JSON.stringify(jobs));
    }

    function loadJobs() {
      try {
        const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }

    function setStatus(message, isError) {
      els.status.textContent = message || "";
      els.status.className = "status" + (isError ? " error" : "");
    }

    function formatDate(value) {
      if (!value) return "";
      return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
    }

    render();
  </script>
</body>
</html>`;
}
