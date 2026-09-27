# Mizizi speech server

Meta MMS speech recognition and synthesis — and optionally NLLB-200 translation — served over HTTP
from a GPU machine (e.g. an NVIDIA Brev instance). It is **not** part of the Next.js deploy; the app
calls it through `MMS_SERVER_URL` (see `lib/speech/mms-client.ts`).

| Route | Does |
|---|---|
| `POST /transcribe` | multipart `audio` + `language` (ISO 639-3) → `{ transcript, words: [{ word, confidence }] }` |
| `POST /synthesize` | `{ text, language }` → `audio/wav` |
| `POST /translate` | `{ inputs, parameters: { src_lang, tgt_lang } }` → `[{ translation_text }]` (only with `NLLB_MODEL`) |
| `GET /health` | device and the languages each model serves (no auth) |

## Kenyan-language coverage (checked against the model files, Sept 2026)

- **Recognition** (`facebook/mms-1b-all` adapters): Kiswahili `swh`, Gikuyu `kik`, Dholuo `luo`,
  Kamba `kam`, Somali `som`, Samburu `saq`, Teso `teo`.
- **Voices** (`facebook/mms-tts-*`): `swh`, `kik`, `som`, `saq`, `teo`. There is no Dholuo or Kamba voice.

## Run

On the GPU instance (Python 3.10+; ~8 GB of GPU memory covers recognition, five voices and NLLB):

```bash
git clone <this repo> && cd mizizi/mms-server
python -m venv .venv && source .venv/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cu121   # match your CUDA version
pip install -r requirements.txt
sudo apt-get install -y ffmpeg   # only needed for non-WAV audio; the app sends WAV

export MMS_SERVER_TOKEN="$(openssl rand -hex 32)"   # put the same value in the app's env
export NLLB_MODEL=facebook/nllb-200-distilled-600M   # optional: also serve /translate
uvicorn main:app --host 0.0.0.0 --port 8000
```

The first start downloads the models (several GB) and takes a few minutes; later starts use the
Hugging Face cache. Expose port 8000 over HTTPS (on Brev, through the instance's port-exposure
settings) and set, in the Next.js app:

```bash
MMS_SERVER_URL=https://<your-instance-url>
MMS_SERVER_TOKEN=<the token above>
# optional, if NLLB_MODEL is set here:
NLLB_ENDPOINT_URL=https://<your-instance-url>/translate
NLLB_ENDPOINT_TOKEN=<the token above>
```

Check it: `curl https://<your-instance-url>/health`.

## Notes

- **Licence:** MMS and NLLB-200 are CC BY-NC 4.0 — non-commercial use only.
- **Security:** always set `MMS_SERVER_TOKEN`; without it anyone can use the GPU.
- **Stopped instance:** the app checks `/health` and treats an unreachable server as absent —
  Gikuyu speaking falls back to unscored read-aloud practice, nothing breaks.
- Requests are processed one at a time on the GPU (the recognition adapter is swapped per language).
