"""Generates narration audio and the timing file for one or more episodes.

    .venv/bin/python tools/narrate.py test-clip      # one episode
    .venv/bin/python tools/narrate.py --all          # every episode

Reads src/episodes/<id>/script.json and writes, under public/narration/<id>/:
    narration.wav   the whole episode's narration, placed on the timeline
    timings.json    frame-exact start and length of every scene and line

Each line is synthesized on its own, so a caption always matches exactly one
clip of audio. Clips are cached in .cache/tts by a hash of what was spoken,
the voice, the speed and the model, so only changed lines are re-generated.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from layout import frames, layout  # noqa: E402
from pronounce import Lexicon  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
EPISODES = ROOT / "src" / "episodes"
OUT = ROOT / "public" / "narration"
CACHE = ROOT / ".cache" / "tts"
MODEL = ROOT / ".cache" / "kokoro" / "kokoro-v1.0.onnx"
VOICES = ROOT / ".cache" / "kokoro" / "voices-v1.0.bin"
MODEL_TAG = "kokoro-v1.0"
# Bump when the way text becomes audio changes, so cached clips are rebuilt.
PIPELINE_VERSION = 2
SAMPLE_RATE = 24000


class Synth:
    def __init__(self):
        self._kokoro = None
        self.lexicon = Lexicon()

    @property
    def kokoro(self):
        if self._kokoro is None:
            if not MODEL.exists():
                sys.exit("Kokoro model missing. Run: bash tools/fetch_models.sh")
            from kokoro_onnx import Kokoro

            self._kokoro = Kokoro(str(MODEL), str(VOICES))
        return self._kokoro

    def line(self, text: str, voice: str, speed: float, lang: str) -> tuple[np.ndarray, dict]:
        spoken = self.lexicon.prepare(text)
        key_src = json.dumps([MODEL_TAG, PIPELINE_VERSION, voice, speed, lang, spoken.pieces])
        key = hashlib.sha256(key_src.encode()).hexdigest()[:20]
        path = CACHE / f"{key}.wav"
        if path.exists():
            audio, sr = sf.read(path, dtype="float32")
            assert sr == SAMPLE_RATE
        else:
            if spoken.has_ipa:
                tok = self.kokoro.tokenizer
                phonemes = spoken.phonemes(lambda text: tok.phonemize(text, lang))
                audio, sr = self.kokoro.create(phonemes, voice=voice, speed=speed, lang=lang, is_phonemes=True)
            else:
                audio, sr = self.kokoro.create(spoken.text, voice=voice, speed=speed, lang=lang)
            assert sr == SAMPLE_RATE, sr
            CACHE.mkdir(parents=True, exist_ok=True)
            sf.write(path, audio, sr, subtype="FLOAT")
        return audio.astype(np.float32), {"spoken": spoken.text, "hash": key}


def narrate(episode_id: str, synth: Synth, timing: dict) -> dict:
    script_path = EPISODES / episode_id / "script.json"
    script = json.loads(script_path.read_text())
    fps = timing["fps"]
    voice = script.get("voice", "af_heart")
    speed = float(script.get("speed", timing["defaultSpeed"]))
    lang = script.get("lang", "en-us")
    spf = SAMPLE_RATE // fps  # samples per frame (800 at 24 kHz / 30 fps)
    assert spf * fps == SAMPLE_RATE

    t0 = time.time()
    clips_by_line: list[list[np.ndarray]] = []
    metas: list[list[dict]] = []
    for scene in script["scenes"]:
        clips_by_line.append([])
        metas.append([])
        for line in scene["lines"]:
            audio, meta = synth.line(line.get("say", line["text"]), voice, speed, lang)
            clips_by_line[-1].append(audio)
            metas[-1].append(meta)
    line_frames = [[frames(len(a) / SAMPLE_RATE, fps) for a in scene] for scene in clips_by_line]
    scenes_out = layout(script["scenes"], line_frames, timing)

    clips: list[tuple[int, np.ndarray]] = []
    for s, scene in enumerate(scenes_out):
        for i, line in enumerate(scene["lines"]):
            audio = clips_by_line[s][i]
            clips.append((scene["from"] + line["from"], audio))
            line.update(
                {
                    "spoken": metas[s][i]["spoken"],
                    "hash": metas[s][i]["hash"],
                    "audioSeconds": round(len(audio) / SAMPLE_RATE, 4),
                }
            )
    cursor = scenes_out[-1]["from"] + scenes_out[-1]["durationInFrames"]

    total = cursor
    track = np.zeros(total * spf, dtype=np.float32)
    for start_frame, audio in clips:
        s = start_frame * spf
        track[s : s + len(audio)] += audio
    peak = float(np.max(np.abs(track))) or 1.0
    if peak > 0.98:  # never clip
        track *= 0.98 / peak

    out_dir = OUT / episode_id
    out_dir.mkdir(parents=True, exist_ok=True)
    sf.write(out_dir / "narration.wav", track, SAMPLE_RATE, subtype="PCM_16")
    timings = {
        "episode": episode_id,
        "fps": fps,
        "sampleRate": SAMPLE_RATE,
        "voice": voice,
        "speed": speed,
        "audio": f"narration/{episode_id}/narration.wav",
        "durationInFrames": total,
        "scenes": scenes_out,
    }
    (out_dir / "timings.json").write_text(json.dumps(timings, indent=2) + "\n")
    print(f"{episode_id}: {total / fps:.2f}s, {len(clips)} lines, {time.time() - t0:.1f}s to build")
    return timings


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("episodes", nargs="*")
    ap.add_argument("--all", action="store_true")
    args = ap.parse_args()
    ids = sorted(p.parent.name for p in EPISODES.glob("*/script.json")) if args.all else args.episodes
    if not ids:
        ap.error("name an episode id or pass --all")
    timing = json.loads((ROOT / "src" / "timing.json").read_text())
    synth = Synth()
    for episode_id in ids:
        narrate(episode_id, synth, timing)


if __name__ == "__main__":
    main()
