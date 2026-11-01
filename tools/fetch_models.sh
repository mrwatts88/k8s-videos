#!/usr/bin/env bash
# Downloads the Kokoro TTS weights and the Whisper (sherpa-onnx) model used by the
# pronunciation check into .cache/. Both come from GitHub releases, so nothing here
# needs Hugging Face access. Safe to re-run: files that already match are skipped.
set -euo pipefail
cd "$(dirname "$0")/.."

KOKORO_DIR=.cache/kokoro
WHISPER_DIR=.cache/whisper
KOKORO_BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
WHISPER_URL=https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-base.en.tar.bz2

mkdir -p "$KOKORO_DIR" "$WHISPER_DIR"

fetch() { # url dest sha256
  local url=$1 dest=$2 sum=$3
  if [[ -f $dest ]] && echo "$sum  $dest" | sha256sum -c --status; then
    echo "ok      $dest"
    return
  fi
  echo "fetch   $dest"
  curl -fsSL -o "$dest.part" "$url"
  echo "$sum  $dest.part" | sha256sum -c --status || { echo "checksum mismatch for $dest" >&2; exit 1; }
  mv "$dest.part" "$dest"
}

fetch "$KOKORO_BASE/kokoro-v1.0.onnx" "$KOKORO_DIR/kokoro-v1.0.onnx" \
  7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5
fetch "$KOKORO_BASE/voices-v1.0.bin" "$KOKORO_DIR/voices-v1.0.bin" \
  bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d

if [[ ${SKIP_WHISPER:-0} != 1 ]]; then
  if [[ -f $WHISPER_DIR/sherpa-onnx-whisper-base.en/base.en-tokens.txt ]]; then
    echo "ok      $WHISPER_DIR/sherpa-onnx-whisper-base.en"
  else
    echo "fetch   $WHISPER_DIR/sherpa-onnx-whisper-base.en"
    curl -fsSL "$WHISPER_URL" | tar xj -C "$WHISPER_DIR"
  fi
fi
