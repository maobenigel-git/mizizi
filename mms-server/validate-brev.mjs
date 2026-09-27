// Validates the speech server on the Brev GPU and records the evidence.
//
//   node --env-file=.env.local mms-server/validate-brev.mjs
//
// For each language the GPU speaks a real phrase (MMS voice), then listens to
// its own audio (MMS recognition) and we compare; it also translates English
// sentences (NLLB-200). Everything written to docs/brev-validation/ is a
// measurement from this run — audio clips, timings, and the server's own
// GPU usage tally. Nothing is filled in by hand.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const url = process.env.MMS_SERVER_URL?.replace(/\/+$/, "");
const token = process.env.MMS_SERVER_TOKEN;
if (!url || !token) {
  console.error("Set MMS_SERVER_URL and MMS_SERVER_TOKEN (run with --env-file=.env.local).");
  process.exit(1);
}
const auth = { Authorization: `Bearer ${token}` };
const out = new URL("../docs/brev-validation/", import.meta.url);
mkdirSync(new URL("audio/", out), { recursive: true });

// Test phrases: the app's own seeded words (Kiswahili seed entries; Gikuyu
// entries cited to Wiktionary) — nothing invented for the test.
const seed = readFileSync(new URL("../data/seed/word-of-day.ts", import.meta.url), "utf8");
const seeded = (languageId) =>
  [...seed.matchAll(/languageId: "([^"]+)",\s*term: "([^"]+)",[\s\S]*?meaning: "([^"]+)"/g)]
    .filter((m) => m[1] === languageId)
    .map((m) => ({ text: m[2], meaning: m[3] }));

const normalise = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
function similarity(a, b) {
  const [x, y] = [normalise(a), normalise(b)];
  if (!x.length && !y.length) return 100;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  for (let i = 1; i <= x.length; i++) {
    const row = [i];
    for (let j = 1; j <= y.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = row;
  }
  return Math.round((1 - prev[y.length] / Math.max(x.length, y.length)) * 100);
}

async function timed(fn) {
  const t = performance.now();
  const value = await fn();
  return { value, ms: Math.round(performance.now() - t) };
}

async function health() {
  const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`/health answered ${res.status} — is the server running on the exposed port?`);
  return res.json();
}

async function translate(text, tgt) {
  const res = await fetch(`${url}/translate`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: text, parameters: { src_lang: "eng_Latn", tgt_lang: tgt } }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) return `(error ${res.status})`;
  return (await res.json())[0]?.translation_text ?? "(empty)";
}

async function speakAndHear(iso, text) {
  const synth = await timed(async () => {
    const res = await fetch(`${url}/synthesize`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: iso }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`synthesize ${res.status}: ${await res.text()}`);
    return Buffer.from(await res.arrayBuffer());
  });
  const file = `audio/${iso}-${normalise(text).replace(/\s+/g, "-").slice(0, 40) || "clip"}.wav`;
  writeFileSync(new URL(file, out), synth.value);

  const hear = await timed(async () => {
    const form = new FormData();
    form.set("audio", new Blob([synth.value], { type: "audio/wav" }), "clip.wav");
    form.set("language", iso);
    const res = await fetch(`${url}/transcribe`, { method: "POST", headers: auth, body: form, signal: AbortSignal.timeout(60_000) });
    if (!res.ok) throw new Error(`transcribe ${res.status}: ${await res.text()}`);
    return res.json();
  });
  const heard = hear.value.transcript ?? "";
  return { text, file, bytes: synth.value.length, synthMs: synth.ms, heard, hearMs: hear.ms, match: similarity(heard, text) };
}

const started = new Date();
console.log(`Validating ${new URL(url).host} …`);
const before = await health();
console.log(`GPU: ${before.gpu?.name ?? before.device} · voices ${before.tts_languages.join(", ")} · translation ${before.translation}`);

const voices = new Set(before.tts_languages);
const cases = [
  { iso: "swh", name: "Kiswahili", phrases: seeded("kiswahili").slice(0, 4), source: "Mizizi seed words (unverified)" },
  { iso: "kik", name: "Gikuyu", phrases: seeded("gikuyu").slice(0, 4), source: "Mizizi seed words, cited to English Wiktionary" },
];
if (before.translation && voices.has("som")) {
  const text = await translate("Good morning, my friend", "som_Latn");
  cases.push({ iso: "som", name: "Somali", phrases: [{ text, meaning: "Good morning, my friend" }], source: "NLLB-200 machine translation of the English (unverified)" });
}

const speech = [];
for (const c of cases.filter((c) => voices.has(c.iso))) {
  for (const p of c.phrases) {
    try {
      const r = await speakAndHear(c.iso, p.text);
      speech.push({ ...c, ...r, meaning: p.meaning });
      console.log(`  ${c.name.padEnd(9)} “${p.text}” → spoke ${r.synthMs} ms · heard “${r.heard}” (${r.match}%) ${r.hearMs} ms`);
    } catch (error) {
      speech.push({ ...c, text: p.text, meaning: p.meaning, error: error.message });
      console.log(`  ${c.name} “${p.text}” failed: ${error.message}`);
    }
  }
}

const translations = [];
if (before.translation) {
  const targets = [["Kiswahili", "swh_Latn"], ["Gikuyu", "kik_Latn"], ["Dholuo", "luo_Latn"], ["Kamba", "kam_Latn"], ["Somali", "som_Latn"]];
  for (const sentence of ["Good morning", "Thank you very much", "Where is the market?"]) {
    for (const [name, code] of targets) {
      const { value, ms } = await timed(() => translate(sentence, code));
      translations.push({ sentence, name, code, value, ms });
      console.log(`  ${sentence} → ${name}: ${value} (${ms} ms)`);
    }
  }
}

const after = await health();
const gpu = after.gpu;
const row = (cells) => `| ${cells.join(" | ")} |`;
const report = [
  "# NVIDIA Brev GPU — validation run",
  "",
  `Generated by \`mms-server/validate-brev.mjs\` on ${started.toISOString()}. Every value below was measured in this run.`,
  "",
  "## The machine",
  "",
  row(["", ""]),
  row(["---", "---"]),
  row(["Instance", `\`${new URL(url).host}\``]),
  row(["GPU", gpu ? `${gpu.name} · ${gpu.memory_total_gb} GB · CUDA ${gpu.cuda}` : `none reported (device: ${after.device})`]),
  row(["GPU memory in use by models", gpu ? `${gpu.memory_allocated_gb} GB` : "—"]),
  row(["PyTorch", after.torch ?? "—"]),
  row(["Server up since", after.usage?.started_at ?? "—"]),
  "",
  "## Models loaded on the GPU",
  "",
  `- **Speech recognition:** \`${after.asr_model}\` — ${after.asr_languages.length} languages, including Kenyan ${["swh", "kik", "luo", "kam", "som", "saq", "teo"].filter((l) => after.asr_languages.includes(l)).join(", ")}`,
  `- **Voices (speech synthesis):** ${after.tts_languages.map((l) => `\`facebook/mms-tts-${l}\``).join(", ")}`,
  `- **Translation:** ${after.translation ? `\`${after.translation_model}\`` : "not enabled"}`,
  "",
  "## Speaking and listening, per language",
  "",
  "The GPU speaks each phrase, then transcribes its own audio. *Match* compares what it heard with the text.",
  "",
  row(["Language", "Phrase", "Meaning", "Spoke (ms)", "Heard back", "Match", "Heard (ms)", "Audio"]),
  row(["---", "---", "---", "---", "---", "---", "---", "---"]),
  ...speech.map((s) =>
    s.error
      ? row([s.name, s.text, s.meaning, "—", `error: ${s.error}`, "—", "—", "—"])
      : row([s.name, s.text, s.meaning, s.synthMs, s.heard || "(nothing)", `${s.match}%`, s.hearMs, `[wav](${s.file})`]),
  ),
  "",
  `Phrase sources: ${[...new Set(speech.map((s) => `${s.name} — ${s.source}`))].join("; ")}.`,
  "",
  ...(translations.length
    ? [
        "## Translation (NLLB-200 on the GPU)",
        "",
        "Machine translation — unverified by speakers, shown as produced.",
        "",
        row(["English", "Into", "Output", "ms"]),
        row(["---", "---", "---", "---"]),
        ...translations.map((t) => row([t.sentence, t.name, t.value, t.ms])),
        "",
      ]
    : []),
  "## GPU work recorded by the server",
  "",
  "From the server's own counters (`/health` → `usage`) at the end of this run, since it started:",
  "",
  row(["Task", "Requests", "GPU inference seconds"]),
  row(["---", "---", "---"]),
  ...Object.entries(after.usage?.requests ?? {}).map(([k, v]) => row([k, v, after.usage.gpu_seconds?.[k] ?? "—"])),
  "",
  "By language: " + Object.entries(after.usage?.languages ?? {}).map(([k, v]) => `\`${k}\` ×${v}`).join(", "),
  "",
  "## What this does and doesn't show",
  "",
  "- It shows the models running on this NVIDIA GPU, speaking and recognising each listed language, and translating.",
  "- *Match* is the recogniser agreeing with the synthesiser — both machine models. It is not a native-speaker quality rating.",
  "- MMS and NLLB-200 are CC BY-NC 4.0 (non-commercial).",
  "",
];
writeFileSync(new URL("README.md", out), report.join("\n"));
writeFileSync(new URL("run.json", out), JSON.stringify({ started, before, after, speech, translations }, null, 2));
console.log(`\nReport: docs/brev-validation/README.md (${speech.length} speech tests, ${translations.length} translations)`);
