#!/usr/bin/env bash
# One-paste setup for the Mizizi speech server on an NVIDIA Brev GPU instance.
#
# In the instance's terminal (Brev console → your instance → Terminal / SSH):
#
#   curl -fsSL https://raw.githubusercontent.com/maobenigel-git/mizizi/main/mms-server/brev-setup.sh \
#     | MMS_SERVER_TOKEN='<the MMS_SERVER_TOKEN value from the app>' bash
#
# It records the GPU, installs dependencies, pulls the server from GitHub,
# loads the models (MMS speech recognition, MMS voices, NLLB-200 translation)
# and serves them on port 8080 — the port exposed at
# https://8080-<instance>.gobrev.dev. Safe to re-run: it restarts the server.
set -euo pipefail

PORT="${PORT:-8080}"
DIR="$HOME/mizizi-mms"
BASE="https://raw.githubusercontent.com/maobenigel-git/mizizi/main/mms-server"
: "${MMS_SERVER_TOKEN:?Set MMS_SERVER_TOKEN to the same value as in the app (.env.local / setup screen)}"

echo "== GPU on this instance"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv || echo "(nvidia-smi not found — no GPU?)"

mkdir -p "$DIR"
cd "$DIR"
nvidia-smi > gpu-at-setup.txt 2>&1 || true

echo "== Fetching the server"
curl -fsSL "$BASE/main.py" -o main.py
curl -fsSL "$BASE/requirements.txt" -o requirements.txt

echo "== System packages (audio decoding)"
sudo -n apt-get install -y -q ffmpeg libsndfile1 python3-venv >/dev/null 2>&1 || echo "(skipped apt: no passwordless sudo; WAV input still works)"

echo "== Python environment"
python3 -m venv .venv
# shellcheck disable=SC1091
. .venv/bin/activate
pip install -q --upgrade pip
# PyPI's Linux torch wheels include CUDA; no special index needed.
pip install -q -r requirements.txt
python -c "import torch; print('torch', torch.__version__, '| CUDA available:', torch.cuda.is_available())"

echo "== Starting the server on port $PORT"
pkill -f "uvicorn main:app" 2>/dev/null || true
export MMS_SERVER_TOKEN
export NLLB_MODEL="${NLLB_MODEL:-facebook/nllb-200-distilled-600M}"
export MMS_TTS_LANGUAGES="${MMS_TTS_LANGUAGES:-swh,kik,som,saq,teo}"
nohup .venv/bin/uvicorn main:app --host 0.0.0.0 --port "$PORT" > server.log 2>&1 &

echo "== Loading models (first run downloads several GB — a few minutes)"
for _ in $(seq 1 240); do
  if curl -fs "localhost:$PORT/health" > /dev/null; then break; fi
  if ! pgrep -f "uvicorn main:app" > /dev/null; then echo "Server stopped — last log lines:"; tail -30 server.log; exit 1; fi
  sleep 5
done

curl -s "localhost:$PORT/health" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print('READY on', d['device'], '|', d.get('gpu'))
print('voices:', d['tts_languages'], '| recognition languages:', len(d['asr_languages']), '| translation:', d['translation'])
"
echo "Logs: $DIR/server.log — the app can now use https://$PORT-<instance>.gobrev.dev"
