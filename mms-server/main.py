"""
Mizizi speech server — Meta MMS speech recognition and synthesis (and,
optionally, NLLB-200 translation) on a GPU instance, e.g. NVIDIA Brev.

Runs separately from the Next.js app, which calls it over HTTP
(lib/speech/mms-client.ts, lib/translation/nllb.ts).

    POST /transcribe   multipart: audio (file), language (ISO 639-3, e.g. "kik")
                       -> { transcript, words: [{ word, confidence }], language }
    POST /synthesize   JSON: { text, language }  -> audio/wav
    POST /translate    JSON: { inputs, parameters: { src_lang, tgt_lang } }
                       -> [{ translation_text }]   (Hugging Face's translation schema;
                       only when NLLB_MODEL is set)
    GET  /health       -> device, and the languages each model can serve

Models are loaded once, at startup. Every model here is CC BY-NC 4.0:
non-commercial use only.

Configuration (environment variables):
    MMS_SERVER_TOKEN    shared secret; when set, every route but /health needs
                        "Authorization: Bearer <token>". Set it: this server is
                        on the internet and a GPU is not free.
    MMS_ASR_MODEL       default facebook/mms-1b-all
    MMS_TTS_LANGUAGES   comma-separated ISO 639-3 codes to load voices for,
                        default "swh,kik,som,saq,teo" (the Kenyan languages
                        facebook/mms-tts-* has models for)
    NLLB_MODEL          e.g. facebook/nllb-200-distilled-600M; empty = no /translate
"""

from __future__ import annotations

import io
import logging
import os
import secrets
import threading
import time
from collections import Counter, defaultdict
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone

import librosa
import numpy as np
import soundfile as sf
import torch
from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field
from transformers import (
    AutoModelForSeq2SeqLM,
    AutoProcessor,
    AutoTokenizer,
    VitsModel,
    Wav2Vec2ForCTC,
    set_seed,
)

log = logging.getLogger("mms-server")
logging.basicConfig(level=logging.INFO)

ASR_MODEL = os.getenv("MMS_ASR_MODEL", "facebook/mms-1b-all")
TTS_LANGUAGES = [code.strip() for code in os.getenv("MMS_TTS_LANGUAGES", "swh,kik,som,saq,teo").split(",") if code.strip()]
NLLB_MODEL = os.getenv("NLLB_MODEL", "").strip()
TOKEN = os.getenv("MMS_SERVER_TOKEN", "")

SAMPLE_RATE = 16_000  # what MMS was trained on
MAX_AUDIO_BYTES = 5_000_000
MAX_AUDIO_SECONDS = 30
MAX_TTS_CHARS = 400
MAX_TRANSLATE_CHARS = 1_000

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


@dataclass
class Models:
    asr_processor: object = None
    asr_model: object = None
    asr_languages: set[str] = field(default_factory=set)
    asr_language: str | None = None  # the adapter currently loaded
    tts: dict[str, tuple[object, object]] = field(default_factory=dict)
    nllb: tuple[object, object] | None = None


models = Models()

# What this GPU has actually done since start-up, reported by /health: the
# record of how the compute is being used (e.g. for NVIDIA Brev credit reports).
usage = {
    "started_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    "requests": Counter(),  # route -> count
    "gpu_seconds": defaultdict(float),  # route -> seconds of model inference
    "languages": Counter(),  # "route:lang" -> count
}


def record(route: str, language: str, started: float) -> None:
    usage["requests"][route] += 1
    usage["gpu_seconds"][route] += time.perf_counter() - started
    usage["languages"][f"{route}:{language}"] += 1


def gpu_info() -> dict | None:
    if not torch.cuda.is_available():
        return None
    props = torch.cuda.get_device_properties(0)
    return {
        "name": torch.cuda.get_device_name(0),
        "memory_total_gb": round(props.total_memory / 1e9, 1),
        "memory_allocated_gb": round(torch.cuda.memory_allocated(0) / 1e9, 2),
        "cuda": torch.version.cuda,
    }
# One request on the GPU at a time: the ASR adapter is swapped per language,
# which is not safe to do while another request is mid-inference.
gpu = threading.Lock()


def load_models() -> None:
    log.info("loading %s on %s", ASR_MODEL, DEVICE)
    models.asr_processor = AutoProcessor.from_pretrained(ASR_MODEL)
    models.asr_model = Wav2Vec2ForCTC.from_pretrained(ASR_MODEL).to(DEVICE).eval()
    # The multilingual tokenizer's vocab is keyed by language code.
    models.asr_languages = set(models.asr_processor.tokenizer.vocab.keys())

    for code in TTS_LANGUAGES:
        name = f"facebook/mms-tts-{code}"
        try:
            models.tts[code] = (VitsModel.from_pretrained(name).to(DEVICE).eval(), AutoTokenizer.from_pretrained(name))
            log.info("loaded voice %s", name)
        except Exception:  # a missing voice shouldn't stop the server
            log.exception("could not load %s; skipping", name)

    if NLLB_MODEL:
        log.info("loading %s", NLLB_MODEL)
        models.nllb = (
            AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL).to(DEVICE).eval(),
            AutoTokenizer.from_pretrained(NLLB_MODEL),
        )
    log.info("ready: %d ASR languages, voices %s, translation %s", len(models.asr_languages), sorted(models.tts), bool(models.nllb))


@asynccontextmanager
async def lifespan(_: FastAPI):
    if not TOKEN:
        log.warning("MMS_SERVER_TOKEN is not set: anyone who finds this server can use its GPU")
    load_models()
    yield


app = FastAPI(title="Mizizi speech server", lifespan=lifespan)


def authorised(authorization: str | None = Header(default=None)) -> None:
    if not TOKEN:
        return
    expected = f"Bearer {TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=401, detail="missing or wrong bearer token")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "device": DEVICE,
        "gpu": gpu_info(),
        "torch": torch.__version__,
        "asr_model": ASR_MODEL,
        "asr_languages": sorted(models.asr_languages),
        "tts_languages": sorted(models.tts),
        "translation": models.nllb is not None,
        "translation_model": NLLB_MODEL or None,
        "usage": {
            "started_at": usage["started_at"],
            "requests": dict(usage["requests"]),
            "gpu_seconds": {k: round(v, 2) for k, v in usage["gpu_seconds"].items()},
            "languages": dict(usage["languages"]),
        },
    }


# ── speech recognition ──────────────────────────────────────────────────


def word_confidences(ids: torch.Tensor, confidence: torch.Tensor) -> list[dict]:
    """
    Per-word confidence from the CTC frames: the mean of each word's
    per-character peak probabilities. Mirrors the per-word confidence the
    app gets from Google, so both feed the same word-by-word feedback.
    """
    tokenizer = models.asr_processor.tokenizer
    blank = tokenizer.pad_token_id
    delimiter = tokenizer.convert_tokens_to_ids(tokenizer.word_delimiter_token)

    words: list[dict] = []
    chars: list[str] = []
    scores: list[float] = []
    previous = None

    def flush() -> None:
        if chars:
            words.append({"word": "".join(chars), "confidence": round(float(np.mean(scores)), 3)})
        chars.clear()
        scores.clear()

    for token, score in zip(ids.tolist(), confidence.tolist()):
        if token == previous:
            # The same character held over several frames: keep its best score.
            if token not in (blank, delimiter) and scores:
                scores[-1] = max(scores[-1], score)
            continue
        previous = token
        if token == blank:
            continue
        if token == delimiter:
            flush()
            continue
        chars.append(tokenizer.convert_ids_to_tokens(token))
        scores.append(score)
    flush()
    return words


@app.post("/transcribe", dependencies=[Depends(authorised)])
def transcribe(audio: UploadFile = File(...), language: str = Form(...)) -> dict:
    language = language.strip().lower()
    if language not in models.asr_languages:
        raise HTTPException(status_code=400, detail=f"no speech recognition for '{language}'")

    data = audio.file.read(MAX_AUDIO_BYTES + 1)
    if len(data) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="audio too large")
    try:
        # librosa decodes WAV/FLAC/OGG (and more with ffmpeg) and resamples to 16 kHz mono.
        samples, _ = librosa.load(io.BytesIO(data), sr=SAMPLE_RATE, mono=True, duration=MAX_AUDIO_SECONDS)
    except Exception:
        raise HTTPException(status_code=400, detail="could not decode audio")
    if samples.size < SAMPLE_RATE // 4:
        raise HTTPException(status_code=400, detail="audio too short")

    with gpu:
        started = time.perf_counter()
        if models.asr_language != language:
            models.asr_processor.tokenizer.set_target_lang(language)
            models.asr_model.load_adapter(language)
            models.asr_language = language
        inputs = models.asr_processor(samples, sampling_rate=SAMPLE_RATE, return_tensors="pt").to(DEVICE)
        with torch.inference_mode():
            logits = models.asr_model(**inputs).logits[0]
        probabilities = torch.softmax(logits.float(), dim=-1)
        confidence, ids = probabilities.max(dim=-1)
        transcript = models.asr_processor.decode(ids)
        words = word_confidences(ids.cpu(), confidence.cpu())
        record("transcribe", language, started)

    return {"transcript": transcript, "words": words, "language": language}


# ── speech synthesis ────────────────────────────────────────────────────


class SynthesisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_TTS_CHARS)
    language: str


@app.post("/synthesize", dependencies=[Depends(authorised)])
def synthesize(request: SynthesisRequest) -> Response:
    voice = models.tts.get(request.language.strip().lower())
    if not voice:
        raise HTTPException(status_code=400, detail=f"no voice loaded for '{request.language}'")
    model, tokenizer = voice

    with gpu:
        started = time.perf_counter()
        inputs = tokenizer(request.text, return_tensors="pt").to(DEVICE)
        if inputs["input_ids"].shape[-1] == 0:
            raise HTTPException(status_code=400, detail="nothing speakable in that text")
        # VITS samples its prosody; a fixed seed keeps a phrase sounding the same each time.
        set_seed(555)
        with torch.inference_mode():
            waveform = model(**inputs).waveform[0].cpu().numpy()
        record("synthesize", request.language.strip().lower(), started)

    buffer = io.BytesIO()
    sf.write(buffer, waveform, model.config.sampling_rate, format="WAV", subtype="PCM_16")
    return Response(
        content=buffer.getvalue(),
        media_type="audio/wav",
        headers={"Cache-Control": "public, max-age=86400"},
    )


# ── translation (optional) ──────────────────────────────────────────────


class TranslationParameters(BaseModel):
    src_lang: str
    tgt_lang: str


class TranslationRequest(BaseModel):
    inputs: str = Field(min_length=1, max_length=MAX_TRANSLATE_CHARS)
    parameters: TranslationParameters


@app.post("/translate", dependencies=[Depends(authorised)])
def translate(request: TranslationRequest) -> list[dict]:
    if models.nllb is None:
        raise HTTPException(status_code=404, detail="translation is not enabled (set NLLB_MODEL)")
    model, tokenizer = models.nllb
    target = tokenizer.convert_tokens_to_ids(request.parameters.tgt_lang)
    if target == tokenizer.unk_token_id:
        raise HTTPException(status_code=400, detail=f"unknown target language '{request.parameters.tgt_lang}'")

    with gpu:
        started = time.perf_counter()
        tokenizer.src_lang = request.parameters.src_lang
        inputs = tokenizer(request.inputs, return_tensors="pt", truncation=True, max_length=512).to(DEVICE)
        with torch.inference_mode():
            output = model.generate(**inputs, forced_bos_token_id=target, max_new_tokens=256)
        record("translate", request.parameters.tgt_lang, started)
    return [{"translation_text": tokenizer.batch_decode(output, skip_special_tokens=True)[0]}]
