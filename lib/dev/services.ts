/*
 * Every external service the app can use, with where its credentials go.
 *
 * Drives the local setup screen (/setup) and matches docs/api-setup.md. No
 * secrets here — only names, instructions and links — so this module is safe
 * to import from client components.
 */

export type FieldKind = "secret" | "url" | "text" | "json" | "select";

export type ServiceField = {
  key: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  options?: string[];
  /** The screen can fill this in itself (a random secret). */
  generate?: boolean;
};

export type Service = {
  id: string;
  title: string;
  required: boolean;
  /** What it switches on — and what happens without it. */
  purpose: string;
  without: string;
  cost: string;
  steps: { text: string; link?: string }[];
  fields: ServiceField[];
};

export const services: Service[] = [
  {
    id: "session",
    title: "Session secret",
    required: true,
    purpose: "Signs the login cookie so streaks, XP and user ids can't be forged.",
    without: "Development uses a built-in fallback; a production server refuses to start.",
    cost: "Free — it's just a random string.",
    steps: [
      { text: "Press Generate. That's it — no account needed." },
      { text: "Use a different value in production, set in your host's environment settings." },
    ],
    fields: [{ key: "SESSION_SECRET", label: "Session secret", kind: "secret", generate: true, hint: "At least 32 random characters." }],
  },
  {
    id: "database",
    title: "Database (Supabase Postgres)",
    required: true,
    purpose: "Stores accounts, level progress, notes, the community directory and contributions.",
    without: "Everything is kept in memory and lost whenever the server restarts.",
    cost: "Supabase free tier is enough to start.",
    steps: [
      { text: "Sign up and create a new project. Save the database password it shows you.", link: "https://supabase.com/dashboard/new" },
      { text: "In the project, click Connect and copy the Transaction pooler connection string." },
      { text: "Replace [YOUR-PASSWORD] in it with your password, paste it below, Save, then Check." },
      { text: "Create the tables: run npm run db:migrate in a terminal in the project folder." },
    ],
    fields: [
      {
        key: "DATABASE_URL",
        label: "Connection string",
        kind: "secret",
        placeholder: "postgresql://postgres.xxxx:password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres",
        hint: "If your password contains \" or \\, URL-encode it (e.g. %22, %5C).",
      },
    ],
  },
  {
    id: "gemini",
    title: "Tutor — Google Gemini (free)",
    required: false,
    purpose: "Turns the tutor from lookup-only into a conversation.",
    without: "The tutor still answers, from checked data only.",
    cost: "Free tier, no card needed.",
    steps: [
      { text: "Sign in with a Google account and create an API key.", link: "https://aistudio.google.com/apikey" },
      { text: "Paste it below, Save, then Check." },
    ],
    fields: [{ key: "GEMINI_API_KEY", label: "Gemini API key", kind: "secret", placeholder: "AIza…" }],
  },
  {
    id: "openrouter",
    title: "Tutor — OpenRouter (free models)",
    required: false,
    purpose: "An alternative free tutor model, used if no Gemini key is set.",
    without: "Not needed if you set Gemini or Anthropic.",
    cost: "Free models; no card needed.",
    steps: [
      { text: "Create an account and a key.", link: "https://openrouter.ai/keys" },
      { text: "Paste it below, Save, then Check." },
    ],
    fields: [{ key: "OPENROUTER_API_KEY", label: "OpenRouter key", kind: "secret", placeholder: "sk-or-…" }],
  },
  {
    id: "anthropic",
    title: "Tutor — Anthropic Claude (paid, best)",
    required: false,
    purpose: "The highest-quality tutor. Used first when set.",
    without: "The tutor uses Gemini / OpenRouter, or checked data only.",
    cost: "Pay as you go; add credit in the console.",
    steps: [
      { text: "Create an account, add billing, and create an API key.", link: "https://console.anthropic.com/settings/keys" },
      { text: "Paste it below, Save, then Check." },
    ],
    fields: [{ key: "ANTHROPIC_API_KEY", label: "Anthropic API key", kind: "secret", placeholder: "sk-ant-…" }],
  },
  {
    id: "google-speech",
    title: "Speaking checks — Google Speech-to-Text",
    required: false,
    purpose: "Scores pronunciation word by word in Kiswahili, Dholuo and Kamba.",
    without: "Kiswahili uses the browser's recogniser; other languages use MMS if set, else read-aloud.",
    cost: "About $0.0008 per spoken attempt; new Google Cloud accounts get $300 credit.",
    steps: [
      { text: "Create a Google Cloud project (a billing account is required).", link: "https://console.cloud.google.com/projectcreate" },
      { text: "Enable the Cloud Speech-to-Text API for it.", link: "https://console.cloud.google.com/apis/library/speech.googleapis.com" },
      {
        text: "Create a service account, give it a role that can run speech recognition, then Keys → Add key → JSON.",
        link: "https://console.cloud.google.com/iam-admin/serviceaccounts",
      },
      { text: "Open the downloaded .json file, copy everything in it, paste below. It's stored base64-encoded." },
    ],
    fields: [
      { key: "GOOGLE_SERVICE_ACCOUNT_KEY", label: "Service-account key (JSON)", kind: "json", placeholder: '{ "type": "service_account", … }' },
      { key: "GOOGLE_CLOUD_PROJECT", label: "Project id", kind: "text", optional: true, hint: "Leave empty to use the one in the key." },
      { key: "GOOGLE_SPEECH_REGION", label: "Region", kind: "select", options: ["us-central1", "europe-west4"], optional: true },
    ],
  },
  {
    id: "mms",
    title: "Speech server — Meta MMS on your GPU (Brev)",
    required: false,
    purpose: "Scored speaking and a voice for Gikuyu and more, from your own GPU server (mms-server/).",
    without: "Gikuyu speaking is read-aloud practice with no voice.",
    cost: "Whatever your GPU instance costs while it runs. Models are non-commercial (CC BY-NC).",
    steps: [
      { text: "Start mms-server on the GPU instance — see mms-server/README.md in this project." },
      { text: "Expose port 8000 over HTTPS and copy the instance URL." },
      { text: "Paste the URL and the MMS_SERVER_TOKEN you set on the server, Save, then Check." },
    ],
    fields: [
      { key: "MMS_SERVER_URL", label: "Server URL", kind: "url", placeholder: "https://your-instance.example.com" },
      { key: "MMS_SERVER_TOKEN", label: "Server token", kind: "secret", hint: "The same value as MMS_SERVER_TOKEN on the server." },
    ],
  },
  {
    id: "nllb",
    title: "Translation — NLLB-200",
    required: false,
    purpose: "Whole-sentence machine translation into Gikuyu and Kamba.",
    without: "Translation covers words (Wiktionary) and Google's four languages only.",
    cost: "Free on your Brev server; a Hugging Face Inference Endpoint is billed hourly. Non-commercial model.",
    steps: [
      {
        text: "Easiest: set NLLB_MODEL on your MMS server, then use https://<your-instance>/translate as the endpoint and your MMS token.",
      },
      {
        text: "Or deploy facebook/nllb-200-distilled-600M as a Hugging Face Inference Endpoint (the free serverless API doesn't host it).",
        link: "https://endpoints.huggingface.co",
      },
      { text: "For a Hugging Face endpoint, create an access token.", link: "https://huggingface.co/settings/tokens" },
      { text: "Paste below, Save, then Check." },
    ],
    fields: [
      { key: "NLLB_ENDPOINT_URL", label: "Endpoint URL", kind: "url", placeholder: "https://your-instance.example.com/translate" },
      { key: "HUGGINGFACE_API_TOKEN", label: "Hugging Face token", kind: "secret", optional: true, placeholder: "hf_…" },
      { key: "NLLB_ENDPOINT_TOKEN", label: "Endpoint token (if not the HF token)", kind: "secret", optional: true },
    ],
  },
];

export const serviceKeys = new Set(services.flatMap((s) => s.fields.map((f) => f.key)));
