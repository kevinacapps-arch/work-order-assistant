/* Toodles live client. Keeps the downloaded mockup's face, swaps in the real backend. */
const storageKey = "wo-ui-jobs-v1";
const secretKey = "wo-ui-session-secret-v1";

const MOODS = [
  "she has been inside more walls than she'll say.",
  "not a licensed contractor. just right about everything.",
  "the zip ties stay between us.",
  "it was like that when you got there. noted.",
  "'upon further investigation' is just 'i dunno' in a suit.",
  "management doesn't need to know all of it.",
  "quick jobs are a myth she respects but does not believe in.",
  "she remembers every job. every. single. one.",
  "not mad. just keeping records.",
  "that smell was pre-existing. she'll say so.",
  "your chaos. her grammar.",
  "six hours. she said nothing. she wrote it up clean."
];

const LOAD_LINES = [
  "choosing words...",
  "pretending she was there...",
  "making you look like you planned this...",
  "deciding what management needs to know...",
  "translating field brain into office proof...",
  "polishing...",
  "crafting a narrative..."
];

let jobs = loadJobs();
let currentJob = jobs[0] ? jobs[0].id : null;
let unlocked = false;
let busy = false;
let noteCount = Number(sessionStorage.getItem("toodles-note-count") || "0");
let faulted = false;
let matrixRain = null;

if (!jobs.length) {
  const job = createJob("New job");
  jobs.push(job);
  currentJob = job.id;
  saveJobs();
}

document.addEventListener("focusin", (event) => {
  if (event.target.matches("input,textarea")) document.body.classList.add("typing");
});

document.addEventListener("focusout", (event) => {
  if (event.target.matches("input,textarea")) document.body.classList.remove("typing");
});

document.addEventListener("DOMContentLoaded", init);

function init() {
  setAccessState(false);
  text("topDate", new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).toUpperCase());
  text("yr", new Date().getFullYear());
  text("yr2", new Date().getFullYear());

  ["jobLabel", "complaint", "onsite", "labor", "followup"].forEach((id) => {
    byId(id).addEventListener("input", saveActiveFromFields);
  });
  byId("codeInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") unlock();
  });
  byId("codeInput").addEventListener("input", () => setAccessStatus("locked · code changed · unlock again", false));
  byId("revInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") revise();
  });

  const savedSecret = sessionStorage.getItem(secretKey) || "";
  if (savedSecret) {
    byId("codeInput").value = savedSecret;
    setAccessStatus("code remembered for this tab · press unlock", false);
  } else {
    setAccessStatus("locked · toodles is waiting · she is patient · she has seen things", false);
  }

  setInterval(() => {
    const mood = byId("sbMood");
    mood.style.opacity = "0";
    window.setTimeout(() => {
      mood.textContent = MOODS[Math.floor(Math.random() * MOODS.length)];
      mood.style.opacity = "1";
    }, 400);
  }, 7000);

  render();
}

function render() {
  renderJobs();
  renderFields();
  renderOutput();
  updateButtons();
}

function renderJobs() {
  const list = byId("jobList");
  list.innerHTML = "";

  jobs.forEach((job) => {
    const item = document.createElement("div");
    item.className = "job-item" + (job.id === currentJob ? " active" : "");
    item.dataset.id = job.id;

    const name = document.createElement("div");
    name.className = "job-name";
    name.textContent = job.name || "Untitled job";

    const wo = document.createElement("div");
    wo.className = "job-wo";
    wo.textContent = job.wo || formatDate(job.createdAt);

    const quip = document.createElement("div");
    quip.className = "job-quip";
    quip.textContent = job.quip || "";

    const badge = document.createElement("span");
    badge.className = "job-badge " + (job.status === "final" ? "badge-final" : "badge-draft");
    badge.textContent = job.status || "draft";

    item.append(name, wo, quip, badge);
    item.addEventListener("click", () => selJob(job.id));
    list.appendChild(item);
  });

  text("jobCount", jobs.length);
  text("noteCount", noteCount);
}

function renderFields() {
  const job = activeJob();
  if (!job) {
    setHeader("NO JOBS", "the pile is empty · toodles is waiting");
    ["jobLabel", "complaint", "onsite", "labor", "followup"].forEach((id) => {
      byId(id).value = "";
      byId(id).disabled = true;
    });
    return;
  }

  byId("jobLabel").disabled = false;
  byId("complaint").disabled = false;
  byId("onsite").disabled = false;
  byId("labor").disabled = false;
  byId("followup").disabled = false;

  byId("jobLabel").value = job.name || "";
  byId("complaint").value = job.sourceText || "";
  byId("onsite").value = job.fieldNotes || "";
  byId("labor").value = job.laborNotes || "";
  byId("followup").value = job.followUp || "";

  document.querySelectorAll(".pill").forEach((pill) => {
    pill.classList.toggle("on", (job.laborTags || []).includes(pill.textContent.trim()));
  });

  setHeader(job.name || "Untitled job", (job.wo || formatDate(job.createdAt)) + " · " + (job.status || "draft") + " · toodles is on it");
}

function renderOutput() {
  const job = activeJob();
  const note = job ? job.finalNote || job.draftNote : "";
  const noteBox = byId("noteBox");
  if (note) {
    noteBox.textContent = note;
    noteBox.classList.add("has");
    byId("outputSub").textContent = (job.status === "final" ? "final" : "ready") + " · copy when ready";
    byId("copyBtn").style.display = "";
    byId("finalBtn").style.display = "";
    byId("finalBtn").textContent = job.status === "final" ? "✓ Final" : "Mark Final";
    byId("finalBtn").disabled = job.status === "final";
  } else {
    noteBox.textContent = "fill in the fields.\nhit Make Note.\nnobody will ask questions.";
    noteBox.classList.remove("has");
    byId("outputSub").textContent = "waiting for your input · not judging · definitely not judging · okay maybe a little";
    byId("copyBtn").style.display = "none";
    byId("finalBtn").style.display = "none";
    byId("finalBtn").disabled = false;
  }
}

function updateButtons() {
  const hasJob = Boolean(activeJob());
  const canMake = unlocked && hasJob && !busy;
  const hasNote = hasJob && Boolean(activeJob().draftNote || activeJob().finalNote);
  byId("makeBtn").disabled = !canMake;
  byId("makeBtn2").disabled = !canMake;
  byId("revBtn").disabled = !unlocked || !hasNote || busy;
  const label = byId("makeBtn2Label");
  if (label) label.textContent = busy ? "SHE'S THINKING..." : "OH TOODLES!";
  const unlockBtn = byId("unlockBtn");
  if (unlockBtn) {
    unlockBtn.disabled = busy;
    unlockBtn.textContent = busy ? "Working..." : "Unlock";
  }
}

function selJob(id) {
  saveActiveFromFields();
  currentJob = id;
  render();
}

function addJob() {
  saveActiveFromFields();
  const job = createJob(nextJobLabel());
  jobs.unshift(job);
  currentJob = job.id;
  saveJobs();
  render();
  byId("jobLabel").focus();
  byId("jobLabel").select();
  toast("JOB STARTED", "g");
}

function nukeAll() {
  if (!window.confirm("Nuke everything? Toodles will forget. She will be okay. She is always okay.")) return;
  jobs = [createJob("New job")];
  currentJob = jobs[0].id;
  noteCount = 0;
  sessionStorage.setItem("toodles-note-count", "0");
  saveJobs();
  render();
  toast("PILE CLEARED", "y");
}

async function unlock(fromSession) {
  const code = byId("codeInput").value.trim();
  if (!code) {
    setAccessStatus("code required · toodles cannot open the bag without it", true);
    toast("CODE REQUIRED", "y");
    return;
  }

  setBusy(true, "checking code...");
  setAccessStatus("checking code...", false);
  const slowNotice = window.setTimeout(() => {
    setAccessStatus("still checking · server may be waking up", false);
  }, 8000);

  try {
    await postJson("/api/auth-check", {}, code);
    sessionStorage.setItem(secretKey, code);
    unlocked = true;
    setAccessState(true);
    setAccessStatus("unlocked · " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + " · she is with you", false, true);
    if (!fromSession) toast("TOODLES IS READY", "p");
  } catch (error) {
    unlocked = false;
    setAccessState(false);
    sessionStorage.removeItem(secretKey);
    setAccessStatus(error.message || "code did not work", true);
    toast("CODE DID NOT WORK", "y");
  } finally {
    window.clearTimeout(slowNotice);
    setBusy(false);
  }
}

function syncLabel() {
  saveActiveFromFields();
  const job = activeJob();
  if (!job) return;
  setHeader(job.name || "Untitled job", (job.wo || formatDate(job.createdAt)) + " · toodles is watching");
  renderJobs();
}

function tp(element) {
  element.classList.toggle("on");
  saveActiveFromFields();
}

function pills() {
  return Array.from(document.querySelectorAll(".pill.on")).map((pill) => pill.textContent.trim()).join(", ");
}

function clearFields() {
  const job = activeJob();
  if (!job) return;
  job.name = "New job";
  job.sourceText = "";
  job.fieldNotes = "";
  job.laborNotes = "";
  job.followUp = "";
  job.laborTags = [];
  job.draftNote = "";
  job.finalNote = "";
  job.status = "draft";
  job.quip = "cleared · toodles is ready";
  byId("revInput").value = "";
  saveJobs();
  render();
  toast("CLEARED", "y");
}

async function makeNote() {
  if (!requireUnlocked()) return;
  const job = activeJob();
  if (!job) return;
  saveActiveFromFields();

  if (!job.sourceText && !job.fieldNotes) {
    toast("FILL SOMETHING IN", "y");
    byId("outputSub").textContent = "toodles needs at least a complaint or onsite notes";
    return;
  }

  setBusy(true, LOAD_LINES[Math.floor(Math.random() * LOAD_LINES.length)]);
  try {
    const json = await postJson("/api/draft", packetFromJob(job));
    job.draftNote = json.draftNote || "";
    job.finalNote = "";
    job.status = "draft";
    job.quip = "draft ready · copied if the browser allowed it";
    noteCount += 1;
    sessionStorage.setItem("toodles-note-count", String(noteCount));
    saveJobs();
    render();
    await copyText(job.draftNote);
    toast("NOTE READY", "g");
  } catch (error) {
    triggerFault(error.message);
  } finally {
    setBusy(false);
  }
}

async function revise() {
  if (!requireUnlocked()) return;
  const job = activeJob();
  if (!job || (!job.draftNote && !job.finalNote)) return;
  const correction = byId("revInput").value.trim();
  if (!correction) {
    toast("REVISION NEEDED", "y");
    return;
  }

  saveActiveFromFields();
  setBusy(true, "reworking note...");
  try {
    const json = await postJson("/api/refine", {
      packet: packetFromJob(job),
      currentNote: job.finalNote || job.draftNote,
      correction
    });
    job.finalNote = json.revisedNote || "";
    job.status = "revised";
    job.quip = "revised · she took notes on your notes";
    byId("revInput").value = "";
    saveJobs();
    render();
    await copyText(job.finalNote);
    toast("REVISED", "g");
  } catch (error) {
    triggerFault(error.message);
  } finally {
    setBusy(false);
  }
}

async function copyNote() {
  const job = activeJob();
  const note = job ? job.finalNote || job.draftNote : "";
  if (!note) return;
  await copyText(note);
  toast("COPIED.", "y");
}

async function markFinal() {
  const job = activeJob();
  if (!job) return;
  if (!job.finalNote && job.draftNote) job.finalNote = job.draftNote;
  if (!job.finalNote) return;
  job.status = "final";
  job.quip = "final · management can read this one";
  saveJobs();
  render();
  await copyText(job.finalNote);
  toast("MARKED FINAL", "g");
}

function saveActiveFromFields() {
  const job = activeJob();
  if (!job) return;
  job.name = byId("jobLabel").value.trim() || "Untitled job";
  job.sourceText = byId("complaint").value.trim();
  job.fieldNotes = byId("onsite").value.trim();
  job.laborNotes = byId("labor").value.trim();
  job.followUp = byId("followup").value.trim();
  job.laborTags = Array.from(document.querySelectorAll(".pill.on")).map((pill) => pill.textContent.trim());
  job.quip = job.fieldNotes ? "field notes in · toodles is watching" : "freshly opened · toodles is watching";
  saveJobs();
}

function packetFromJob(job) {
  return {
    packetId: job.id,
    label: job.name,
    sourceText: job.sourceText,
    fieldNotes: job.fieldNotes,
    ocrText: "",
    laborNotes: [job.laborTags.join(", "), job.laborNotes].filter(Boolean).join(". "),
    followUp: job.followUp
  };
}

async function postJson(url, body, overrideSecret) {
  const secret = overrideSecret || byId("codeInput").value.trim() || sessionStorage.getItem(secretKey) || "";
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
    if (response.status === 401) {
      unlocked = false;
      setAccessState(false);
      sessionStorage.removeItem(secretKey);
      updateButtons();
      throw new Error("code did not match · check the access code");
    }
    throw new Error(json.error || "request failed");
  }
  return json;
}

function setBusy(value, message) {
  busy = value;
  byId("dots").classList.toggle("on", value);
  if (message) byId("outputSub").textContent = message;
  updateButtons();
}

function requireUnlocked() {
  if (unlocked) return true;
  setAccessStatus("unlock first · toodles is behind the little door", true);
  toast("UNLOCK FIRST", "y");
  byId("codeInput").focus();
  return false;
}

function setAccessStatus(message, isError, isOn) {
  const status = byId("accessStatus");
  status.textContent = message;
  status.classList.toggle("on", Boolean(isOn) || (!isError && unlocked));
}

function setAccessState(isUnlocked) {
  document.body.classList.toggle("locked", !isUnlocked);
  document.body.classList.toggle("unlocked", isUnlocked);
}

async function copyText(value) {
  if (!value || !navigator.clipboard) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Browser can block clipboard unless it follows a user gesture. The note still stays visible.
  }
}

function createJob(name) {
  const now = new Date();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(now.getTime()),
    createdAt: now.toISOString(),
    name,
    wo: "WO #" + String(2200 + Math.floor(Math.random() * 800)),
    status: "draft",
    quip: "freshly opened · toodles is watching",
    sourceText: "",
    fieldNotes: "",
    laborNotes: "",
    followUp: "",
    laborTags: [],
    draftNote: "",
    finalNote: ""
  };
}

function nextJobLabel() {
  const base = "New job";
  const used = new Set(jobs.map((job) => job.name));
  if (!used.has(base)) return base;
  let index = 2;
  while (used.has(base + " " + index)) index += 1;
  return base + " " + index;
}

function activeJob() {
  return jobs.find((job) => job.id === currentJob) || null;
}

function loadJobs() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return Array.isArray(parsed) ? parsed.map(normalizeJob) : [];
  } catch {
    return [];
  }
}

function normalizeJob(raw, index) {
  const createdAt = raw.createdAt || new Date().toISOString();
  const name = raw.name || raw.label || "New job";
  return {
    id: String(raw.id || raw.packetId || Date.now() + "-" + index),
    createdAt,
    name,
    wo: raw.wo || formatDate(createdAt),
    status: raw.status || "draft",
    quip: raw.quip || "stored locally · toodles remembers this browser",
    sourceText: raw.sourceText || raw.complaint || "",
    fieldNotes: raw.fieldNotes || raw.onsite || "",
    laborNotes: raw.laborNotes || raw.labor || "",
    followUp: raw.followUp || raw.followup || "",
    laborTags: Array.isArray(raw.laborTags) ? raw.laborTags : [],
    draftNote: raw.draftNote || "",
    finalNote: raw.finalNote || ""
  };
}

function saveJobs() {
  localStorage.setItem(storageKey, JSON.stringify(jobs));
}

function setHeader(name, sub) {
  const parts = String(name || "Untitled job").split(/\s*[–—-]\s*/);
  if (parts.length > 1) {
    byId("jobTitle").innerHTML = escapeHtml(parts[0].trim().toUpperCase()) + " — <em>" + escapeHtml(parts.slice(1).join("—").trim().toUpperCase()) + "</em>";
  } else {
    byId("jobTitle").textContent = String(name || "Untitled job").toUpperCase();
  }
  byId("jobSub").textContent = sub || "";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric" });
}

function byId(id) {
  return document.getElementById(id);
}

function text(id, value) {
  const element = byId(id);
  if (element) element.textContent = value;
}

function toast(message, type) {
  const toastBox = byId("toast");
  toastBox.textContent = message;
  toastBox.className = "toast " + (type || "") + " show";
  clearTimeout(toastBox._t);
  toastBox._t = setTimeout(() => toastBox.classList.remove("show"), 2200);
}

function triggerFault(message) {
  faulted = true;
  document.body.classList.add("fault");
  const plate = byId("fpPlate");
  if (plate) {
    plate.classList.remove("normal");
    plate.classList.add("tripped");
  }
  text("gfciStatus", "fault · hit reset");
  byId("noteBox").classList.remove("has");
  byId("noteBox").textContent = [
    "⚠ TOODLES WARNING SYSTEM ⚠",
    "",
    message || "UNKNOWN ERROR",
    "",
    "> CIRCUIT TRIPPED.",
    "> TOODLES IS IN THE BAG.",
    "> PRESS RESET TO REACH HER."
  ].join("\n");
  byId("outputSub").textContent = "fault · toodles is in safe mode · hit RESET on the GFCI";
  startMatrixRain();
  toast("FAULT", "y");
}

function gfciTrip() {
  if (!faulted) {
    triggerFault("GFCI TEST — manual trip");
  } else {
    resetFault();
  }
}

function resetFault() {
  faulted = false;
  document.body.classList.remove("fault");
  const plate = byId("fpPlate");
  if (plate) {
    plate.classList.remove("tripped");
    plate.classList.add("normal");
  }
  text("gfciStatus", "circuit protected");
  stopMatrixRain();
  renderOutput();
  toast("POWER RESTORED", "g");
}

function startMatrixRain() {
  const existing = byId("matrixCanvas");
  if (existing) existing.remove();
  const canvas = document.createElement("canvas");
  canvas.id = "matrixCanvas";
  canvas.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:8998;opacity:0.07;";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  matrixRain = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 180; index += 1) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const w = Math.random() * 3 + 1;
      const h = Math.random() * 2 + 1;
      const a = Math.random() * 0.6 + 0.1;
      ctx.fillStyle = "rgba(90,245,120," + a + ")";
      ctx.fillRect(x, y, w, h);
    }
  }, 80);
}

function stopMatrixRain() {
  if (matrixRain) {
    clearInterval(matrixRain);
    matrixRain = null;
  }
  const canvas = byId("matrixCanvas");
  if (canvas) canvas.remove();
}

window.unlock = unlock;
window.addJob = addJob;
window.nukeAll = nukeAll;
window.clearFields = clearFields;
window.makeNote = makeNote;
window.revise = revise;
window.copyNote = copyNote;
window.markFinal = markFinal;
window.tp = tp;
window.syncLabel = syncLabel;
window.gfciTrip = gfciTrip;
window.selJob = selJob;
