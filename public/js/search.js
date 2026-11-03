// Keyword search (BM25) over the hearing turns, run in the browser.

const STOP = new Set(("a an and are as at be been but by did do does for from had has have he her his i if in into is it its " +
  "me my not of on or our she so that the their them then there they this to uh um us was we were what when where which who " +
  "will with would you your yeah okay just like know think going get got").split(" "));

function stem(w) {
  if (w.length > 5 && w.endsWith("ing")) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (w.length > 4 && w.endsWith("ed")) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function tokens(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOP.has(w)).map(stem);
}

export class Index {
  constructor(turns) {
    this.turns = turns;
    this.byId = new Map(turns.map((t) => [t.id, t]));
    this.post = new Map(); // term -> [[doc, tf], ...]
    this.len = new Array(turns.length);
    let total = 0;
    turns.forEach((t, i) => {
      const tf = new Map();
      const toks = tokens(t.text);
      for (const w of toks) tf.set(w, (tf.get(w) || 0) + 1);
      for (const [w, n] of tf) {
        if (!this.post.has(w)) this.post.set(w, []);
        this.post.get(w).push([i, n]);
      }
      this.len[i] = toks.length;
      total += toks.length;
    });
    this.avg = total / turns.length || 1;
  }

  search(query, { day = null, speaker = "", limit = 12 } = {}) {
    const q = [...new Set(tokens(query))];
    const sp = speaker.trim().toLowerCase();
    const N = this.turns.length, k1 = 1.4, b = 0.75;
    const score = new Map();
    for (const w of q) {
      const list = this.post.get(w);
      if (!list) continue;
      const idf = Math.log(1 + (N - list.length + 0.5) / (list.length + 0.5));
      for (const [i, n] of list) {
        const s = idf * (n * (k1 + 1)) / (n + k1 * (1 - b + b * this.len[i] / this.avg));
        score.set(i, (score.get(i) || 0) + s);
      }
    }
    const out = [];
    for (const [i, s] of score) {
      const t = this.turns[i];
      if (day && t.day !== Number(day)) continue;
      if (sp && !t.sp.toLowerCase().includes(sp)) continue;
      // Very short turns ("Yes.", "Thank you.") rarely answer anything.
      out.push([s * Math.min(1, this.len[i] / 6), t]);
    }
    out.sort((a, b2) => b2[0] - a[0]);
    return out.slice(0, limit).map((x) => x[1]);
  }
}

// Find a quote inside a turn, ignoring case, spacing and punctuation differences.
// Returns {text, sec} with the turn's own wording and the time of the caption line it starts in, or null.
export function locateQuote(turn, quote) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const nq = norm(quote);
  if (!nq) return null;
  // Map each normalised character back to its position in the original text.
  const src = turn.text;
  let nt = "", map = [], prevSpace = true;
  for (let i = 0; i < src.length; i++) {
    const c = src[i].toLowerCase();
    if (/[a-z0-9]/.test(c)) { nt += c; map.push(i); prevSpace = false; }
    else if (!prevSpace) { nt += " "; map.push(i); prevSpace = true; }
  }
  const at = nt.indexOf(nq);
  if (at < 0) return null;
  const start = map[at];
  let end = map[at + nq.length - 1] + 1;
  while (end < src.length && /[.,!?;:'")\]]/.test(src[end])) end++;
  // Caption line the quote starts in, for the video link.
  let pos = 0, sec = turn.sec;
  for (const [s, text] of turn.ln) {
    if (start < pos + text.length + 1) { sec = s; break; }
    pos += text.length + 1;
  }
  return { text: src.slice(start, end), sec };
}
