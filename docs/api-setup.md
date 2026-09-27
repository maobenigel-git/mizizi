# Setting up the APIs

Mizizi runs with **no keys at all**. Each key switches on one more feature. This guide covers where
keys live, how to create each one, and how to add them locally and in production.

## Where keys live — and why they're never pushed

| Where | File / place | Committed to git? |
|---|---|---|
| Your computer | `.env.local` in the project folder | **No** — `.gitignore` excludes every `.env*` file except `.env.example` |
| Template | `.env.example` — names and explanations, **no real values** | Yes |
| Live site | your host's environment settings (e.g. Vercel) | No — stored by the host |

Keys are only ever read on the server. None of them is sent to the browser.

## The easy way: the setup screen

1. Start the app: `npm run dev`.
2. In that terminal, look for the line

   ```text
   🔑 API setup: http://localhost:3000/setup?token=…
   ```

   and open it **on the same computer**. (The token stops anyone else on your Wi-Fi from changing
   your keys. It changes every time the dev server restarts; `/setup` without it shows nothing.)
3. For each service: follow its numbered steps, paste the key, press **Save**. It's written to
   `.env.local` and checked against the real service straight away — green means it works.
4. Restart `npm run dev` so every part of the app picks the new values up.

The setup screen exists only in development. A deployed site has no `/setup` page.

Prefer editing by hand? Open `.env.local` and add `NAME="value"` lines (copy names from
`.env.example`). Write any `$` as `\$`: the env loader expands `$WORDS` even inside quotes.

## Each service

### 1. Session secret — required in production
Signs the login cookie so streaks and accounts can't be forged.
- **Create:** press **Generate** on the setup screen, or run
  `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`.
- **Name:** `SESSION_SECRET` (32+ characters). Use a different value for production.

### 2. Database — Supabase Postgres, required in production
Stores accounts, level progress, notes and contributions. Without it they're lost on restart.
1. Sign up at <https://supabase.com> → **New project**. Save the database password.
2. **Connect** → copy the **Transaction pooler** string; replace `[YOUR-PASSWORD]`.
   If the password has `"` or `\`, URL-encode them (`%22`, `%5C`).
3. **Name:** `DATABASE_URL`. Save it, then create the tables: `npm run db:migrate`
   (safe to re-run; it skips what's already applied).

### 3. AI tutor — any one of these (optional)
Without one, the tutor still answers from checked data only.

| Service | Create at | Name | Cost |
|---|---|---|---|
| Google Gemini | <https://aistudio.google.com/apikey> | `GEMINI_API_KEY` | Free tier |
| OpenRouter | <https://openrouter.ai/keys> | `OPENROUTER_API_KEY` | Free models |
| Anthropic Claude | <https://console.anthropic.com/settings/keys> | `ANTHROPIC_API_KEY` | Paid, best quality; used first |

### 4. Speaking checks — Google Speech-to-Text (optional)
Scores pronunciation word by word in Kiswahili, Dholuo and Kamba. About $0.0008 per attempt;
new Google Cloud accounts get $300 credit.
1. Create a project (needs a billing account): <https://console.cloud.google.com/projectcreate>
2. Enable **Cloud Speech-to-Text**: <https://console.cloud.google.com/apis/library/speech.googleapis.com>
3. **Service accounts** → create one with a role that can run speech recognition →
   **Keys → Add key → JSON**: <https://console.cloud.google.com/iam-admin/serviceaccounts>
4. Paste the whole `.json` file into the setup screen (it stores it base64-encoded).
- **Names:** `GOOGLE_SERVICE_ACCOUNT_KEY`, optionally `GOOGLE_CLOUD_PROJECT` and
  `GOOGLE_SPEECH_REGION` (`us-central1` or `europe-west4`).

### 5. Speech server — Meta MMS on your GPU (optional)
Adds scored speaking and a voice for **Gikuyu** (and Somali, Samburu, Teso…). Runs on your own GPU
instance, e.g. NVIDIA Brev. Models are non-commercial (CC BY-NC 4.0).
1. Start `mms-server/` on the instance — see [`mms-server/README.md`](../mms-server/README.md).
   Set `MMS_SERVER_TOKEN` there to a long random value.
2. Expose port 8000 over HTTPS; copy the URL.
- **Names:** `MMS_SERVER_URL`, `MMS_SERVER_TOKEN` (the same token as on the server).

### 6. Translation — NLLB-200 (optional)
Adds whole-sentence translation into Gikuyu and Kamba. Non-commercial model.
Hugging Face's free serverless API does **not** host this model, so choose one:
- **Your Brev server (free):** set `NLLB_MODEL=facebook/nllb-200-distilled-600M` on the MMS server,
  then `NLLB_ENDPOINT_URL=https://<instance>/translate` and `NLLB_ENDPOINT_TOKEN=<MMS token>`.
- **A Hugging Face Inference Endpoint (billed hourly):** deploy the model at
  <https://endpoints.huggingface.co>, create a token at <https://huggingface.co/settings/tokens>,
  then `NLLB_ENDPOINT_URL=<endpoint URL>` and `HUGGINGFACE_API_TOKEN=hf_…`.

## Going live (Vercel)

1. Project → **Settings → Environment Variables**.
2. Add each name and value you use locally — at least `SESSION_SECRET` (a new one) and
   `DATABASE_URL`. Choose the **Production** environment.
3. Redeploy. The server refuses to start without `SESSION_SECRET` and says so in the logs.

Other hosts (Render, Fly, a VPS) have an equivalent "environment variables" setting.

## Changing or removing a key

- Setup screen: paste the new value and **Save**, or press **Remove**.
- If a key was ever exposed (pasted in chat, committed by accident): **revoke it at the provider and
  create a new one** — deleting it from the code doesn't un-leak it.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/setup` says "Open the setup link…" | Use the exact link from the terminal; restarting the server issues a new one. |
| Saved, but the app doesn't use it | Restart `npm run dev`. |
| Check says "Rejected" | Copy the key again; make sure the API/billing is enabled at the provider. |
| Database: "Tables not created yet" | Run `npm run db:migrate`. |
| Speech server unreachable | Is the GPU instance running and port 8000 exposed? `curl <url>/health` |
