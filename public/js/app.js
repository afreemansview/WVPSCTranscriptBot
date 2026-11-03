import { Index, locateQuote } from "./search.js";

const $ = (s) => document.querySelector(s);
const form = $("#ask-form"), qInput = $("#q"), daySel = $("#day"), spInput = $("#speaker");
const statusEl = $("#status"), answerEl = $("#answer"), resultsEl = $("#results");
const askBtn = $("#ask-btn"), searchBtn = $("#search-btn");

let index = null, videos = {}, days = {};

const fmt = (sec) => {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
};
const dateLabel = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k === "text") e.textContent = v; else e.setAttribute(k, v);
  }
  for (const k of kids) if (k) e.append(k);
  return e;
}

function timeLink(turn, sec) {
  const url = videos[String(turn.day)];
  const label = fmt(sec);
  if (!url) return el("span", { class: "time", text: label });
  const sep = url.includes("?") ? "&" : "?";
  return el("a", { class: "time", href: `${url}${sep}t=${sec}s`, target: "_blank", rel: "noopener", title: "Open the video at this moment" }, label);
}

function card(turn, quote) {
  const found = quote ? locateQuote(turn, quote) : null;
  const sec = found ? found.sec : turn.sec;
  const meta = el("div", { class: "meta" },
    el("span", { class: "day", text: `Day ${turn.day}, ${dateLabel(turn.date)}` }), " ", timeLink(turn, sec));
  const who = el("div", { class: "who" }, el("strong", { text: turn.sp }), turn.role ? el("span", { class: "role", text: turn.role }) : null);
  const body = el("blockquote", { text: found ? found.text : turn.text });
  const c = el("article", { class: "card" }, meta, who, body);
  if (found && found.text.length < turn.text.length) {
    const more = el("details", {}, el("summary", { text: "Show the whole turn" }), el("p", { text: turn.text }));
    c.append(more);
  }
  if (quote && !found) c.append(el("p", { class: "note", text: "The AI's excerpt did not match the transcript word for word, so the whole turn is shown." }));
  return c;
}

function setBusy(on, msg = "") {
  askBtn.disabled = searchBtn.disabled = on;
  statusEl.textContent = msg;
}

function doSearch() {
  const q = qInput.value.trim();
  if (!q || !index) return;
  answerEl.replaceChildren();
  const hits = index.search(q, { day: daySel.value || null, speaker: spInput.value, limit: 30 });
  statusEl.textContent = hits.length ? `${hits.length} matching passages, best first.` : "No matching passages. Try other words.";
  resultsEl.replaceChildren(...hits.map((t) => card(t)));
}

async function doAsk() {
  const question = qInput.value.trim();
  if (!question || !index) return;
  const filters = [daySel.value ? `Day ${daySel.value} only.` : "", spInput.value.trim() ? `Speaker: ${spInput.value.trim()}.` : ""].filter(Boolean).join(" ");
  const messages = [{ role: "user", content: filters ? `${question}\n\n(${filters})` : question }];
  answerEl.replaceChildren();
  resultsEl.replaceChildren();
  setBusy(true, "Reading the transcripts...");
  try {
    for (let round = 0; round < 8; round++) {
      const res = await fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages }) });
      const data = await res.json().catch(() => ({ error: `Server error (${res.status}).` }));
      if (!res.ok || data.error) throw new Error(data.error || `Server error (${res.status}).`);
      if (data.stop_reason === "refusal") throw new Error("The AI declined to answer this question.");
      messages.push({ role: "assistant", content: data.content });
      const calls = data.content.filter((b) => b.type === "tool_use");
      const final = calls.find((b) => b.name === "give_answer");
      if (final) return showAnswer(final.input);
      if (!calls.length) {
        const text = data.content.filter((b) => b.type === "text").map((b) => b.text).join("\n");
        return showAnswer({ summary: text || "No answer was returned.", quotes: [] });
      }
      const results = calls.map((c) => {
        const { query = "", day = null, speaker = "" } = c.input || {};
        statusEl.textContent = `Searching: "${query}"${day ? ` (Day ${day})` : ""}${speaker ? ` (${speaker})` : ""}`;
        const hits = index.search(query, { day, speaker, limit: 12 }).map((t) => ({
          turn_id: t.id, day: t.day, date: t.date, time: t.t, speaker: t.sp, role: t.role,
          text: t.text.length > 1500 ? t.text.slice(0, 1500) + " [...]" : t.text,
        }));
        return { type: "tool_result", tool_use_id: c.id, content: JSON.stringify(hits.length ? hits : "No matches. Try other words.") };
      });
      messages.push({ role: "user", content: results });
    }
    throw new Error("The search took too many rounds. Try a narrower question.");
  } catch (e) {
    statusEl.textContent = e.message;
  } finally {
    askBtn.disabled = searchBtn.disabled = false;
  }
}

function showAnswer({ summary = "", quotes = [] }) {
  statusEl.textContent = "";
  answerEl.replaceChildren(el("h2", { text: "Answer" }), el("p", { text: summary }),
    el("p", { class: "note", text: "Written by AI from the transcript passages below. Check the quotes and the video before relying on it." }));
  const cards = [];
  for (const q of quotes || []) {
    const t = index.byId.get(q.turn_id);
    if (t) cards.push(card(t, q.quote));
  }
  resultsEl.replaceChildren(...cards);
}

form.addEventListener("submit", (e) => { e.preventDefault(); doAsk(); });
searchBtn.addEventListener("click", doSearch);

(async () => {
  setBusy(true, "Loading the transcripts...");
  try {
    const [t, v] = await Promise.all([fetch("data/turns.json").then((r) => r.json()), fetch("data/videos.json").then((r) => r.json()).catch(() => ({}))]);
    videos = v;
    index = new Index(t.turns);
    for (const turn of t.turns) days[turn.day] = turn.date;
    for (const [d, iso] of Object.entries(days)) daySel.append(el("option", { value: d, text: `Day ${d}, ${dateLabel(iso)}` }));
    const dl = $("#speakers");
    for (const name of Object.keys(t.speakers).sort()) dl.append(el("option", { value: name }));
    setBusy(false, "");
  } catch {
    statusEl.textContent = "Could not load the transcripts.";
  }
})();
