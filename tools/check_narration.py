"""Checks narration without anyone listening to it.

    .venv/bin/python tools/check_narration.py test-clip   # check an episode's narration.wav
    .venv/bin/python tools/check_narration.py --lexicon   # say every lexicon term and check it

Episode mode, for each line in public/narration/<id>/timings.json:
  1. Alignment: the line's window in narration.wav has speech, and the gaps
     between lines are silent, so captions line up with the voice.
  2. Pronunciation: the window is transcribed with Whisper (base.en, CPU) and
     compared with what was meant to be said. Lexicon terms must come back as
     one of their 'heard' forms; other words are compared by word error rate.

Lexicon mode synthesizes each term in a carrier sentence and transcribes it,
which catches a bad respelling before it reaches an episode.

Writes a report to public/narration/<id>/pronunciation-report.json (or
.cache/lexicon-report.json) and exits 1 when anything is flagged.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pronounce import Lexicon, Term  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
WHISPER = ROOT / ".cache" / "whisper" / "sherpa-onnx-whisper-base.en"
WER_LIMIT = 0.2
SILENCE_RMS = 0.004  # gaps between lines must stay below this
SPEECH_RMS = 0.02  # a line window must reach this somewhere

NUMBER_WORDS = {
    "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
    "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine",
}


def norm(text: str) -> str:
    text = text.lower().replace("’", "'").replace("/", " slash ")
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def words(text: str) -> list[str]:
    out = []
    for w in norm(text).split():
        out.extend(NUMBER_WORDS.get(c, c) for c in ([w] if not w.isdigit() else list(w)))
    return out


def wer(ref: list[str], hyp: list[str]) -> float:
    if not ref:
        return 0.0 if not hyp else 1.0
    d = list(range(len(hyp) + 1))
    for i, r in enumerate(ref, 1):
        prev, d[0] = d[0], i
        for j, h in enumerate(hyp, 1):
            cur = min(d[j] + 1, d[j - 1] + 1, prev + (r != h))
            prev, d[j] = d[j], cur
    return d[len(hyp)] / len(ref)


def diff_words(ref: list[str], hyp: list[str]) -> list[str]:
    out = []
    for op, a1, a2, b1, b2 in SequenceMatcher(a=ref, b=hyp, autojunk=False).get_opcodes():
        if op != "equal":
            out.append(f"{' '.join(ref[a1:a2]) or '-'} -> {' '.join(hyp[b1:b2]) or '-'}")
    return out


def squash(text: str) -> str:
    return "".join(words(text))


def term_heard(term: Term, transcript: str) -> bool:
    forms = term.heard or [term.say, term.match]
    t = squash(transcript)
    return any(squash(f) in t for f in forms)


def strip_terms(spoken: str, terms: list[Term]) -> str:
    """Removes each term's spoken form so WER covers only the ordinary words."""
    for term in sorted(terms, key=lambda t: len(t.say), reverse=True):
        spoken = re.sub(re.escape(term.say), " ", spoken, flags=re.I)
    return spoken


def strip_heard(transcript: str, terms: list[Term]) -> str:
    out = " " + " ".join(words(transcript)) + " "
    for term in terms:
        forms = sorted(term.heard or [term.say, term.match], key=len, reverse=True)
        for f in forms:
            fw = " ".join(words(f))
            if fw and f" {fw} " in out:
                out = out.replace(f" {fw} ", " ", 1)
                break
    return out


class Transcriber:
    def __init__(self):
        if not (WHISPER / "base.en-tokens.txt").exists():
            sys.exit("Whisper model missing. Run: bash tools/fetch_models.sh")
        import sherpa_onnx

        self.rec = sherpa_onnx.OfflineRecognizer.from_whisper(
            encoder=str(WHISPER / "base.en-encoder.int8.onnx"),
            decoder=str(WHISPER / "base.en-decoder.int8.onnx"),
            tokens=str(WHISPER / "base.en-tokens.txt"),
            language="en",
            task="transcribe",
            num_threads=4,
        )

    def __call__(self, audio: np.ndarray, sr: int) -> str:
        pad = np.zeros(int(sr * 0.3), dtype=np.float32)  # Whisper does better with a little air
        s = self.rec.create_stream()
        s.accept_waveform(sr, np.concatenate([pad, audio.astype(np.float32), pad]))
        self.rec.decode_stream(s)
        return s.result.text.strip()


def judge(lex: Lexicon, caption: str, spoken: str, transcript: str) -> dict:
    terms = lex.find_terms(lex_rules(lex, caption))
    missed = [t.match for t in terms if not term_heard(t, transcript)]
    ref = words(strip_terms(spoken, terms))
    hyp = words(strip_heard(transcript, terms))
    score = wer(ref, hyp)
    return {
        "text": caption,
        "spoken": spoken,
        "heard": transcript,
        "terms": [t.match for t in terms],
        "missedTerms": missed,
        "wer": round(score, 3),
        "diff": diff_words(ref, hyp),
        "flagged": bool(missed) or score > WER_LIMIT,
    }


def lex_rules(lex: Lexicon, text: str) -> str:
    for pattern, repl in lex.rules:
        text = pattern.sub(repl, text)
    return text


def rms(a: np.ndarray) -> float:
    return float(np.sqrt(np.mean(np.square(a)))) if len(a) else 0.0


def check_episode(episode_id: str) -> int:
    base = ROOT / "public" / "narration" / episode_id
    timings = json.loads((base / "timings.json").read_text())
    audio, sr = sf.read(base / "narration.wav", dtype="float32")
    fps = timings["fps"]
    spf = sr // fps
    lex = Lexicon()
    asr = Transcriber()
    problems = []
    lines = []

    expected = timings["durationInFrames"] * spf
    if len(audio) != expected:
        problems.append(f"narration.wav is {len(audio)} samples, timeline expects {expected}")

    # Every frame that should be silent: outside all line windows.
    speech_mask = np.zeros(len(audio), dtype=bool)
    for scene in timings["scenes"]:
        for line in scene["lines"]:
            start = (scene["from"] + line["from"]) * spf
            end = start + int(round(line["audioSeconds"] * sr))
            speech_mask[start:end] = True
            window = audio[start : start + line["durationInFrames"] * spf]
            peak_rms = max((rms(window[i : i + spf]) for i in range(0, len(window), spf)), default=0.0)
            text = asr(audio[start:end], sr)
            result = judge(lex, line["text"], line["spoken"], text)
            result["scene"] = scene["id"]
            result["startSec"] = round(start / sr, 2)
            if peak_rms < SPEECH_RMS:
                result["flagged"] = True
                result["alignment"] = f"no speech in caption window (peak rms {peak_rms:.4f})"
            lines.append(result)

    quiet = audio[~speech_mask]
    for i in range(0, len(quiet), spf):
        if rms(quiet[i : i + spf]) > SILENCE_RMS:
            problems.append(f"sound outside caption windows near {i / sr:.2f}s of silent audio")
            break

    flagged = [r for r in lines if r["flagged"]]
    report = {"episode": episode_id, "problems": problems, "flaggedLines": len(flagged), "lines": lines}
    (base / "pronunciation-report.json").write_text(json.dumps(report, indent=2) + "\n")
    print_report(lines, problems)
    return 1 if (problems or flagged) else 0


def check_lexicon() -> int:
    from narrate import Synth

    synth = Synth()
    asr = Transcriber()
    lex = synth.lexicon
    results = []
    for term in lex.terms:
        caption = f"Next, we look at {term.match} together."
        audio, meta = synth.line(caption, "af_heart", 1.0, "en-us")
        text = asr(audio, 24000)
        r = judge(lex, caption, meta["spoken"], text)
        r["term"] = term.match
        # In lexicon mode only the term matters; the carrier words are fixed.
        r["flagged"] = bool(r["missedTerms"])
        results.append(r)
    out = ROOT / ".cache" / "lexicon-report.json"
    out.write_text(json.dumps(results, indent=2) + "\n")
    print_report(results, [])
    return 1 if any(r["flagged"] for r in results) else 0


def print_report(lines: list[dict], problems: list[str]):
    for p in problems:
        print(f"PROBLEM  {p}")
    for r in lines:
        mark = "FLAG" if r["flagged"] else "ok  "
        print(f"{mark} wer={r['wer']:.2f}  {r['text']}")
        if r["flagged"]:
            print(f"       heard: {r['heard']}")
            if r["missedTerms"]:
                print(f"       terms not heard right: {', '.join(r['missedTerms'])}")
            if r["diff"]:
                print(f"       diff: {'; '.join(r['diff'])}")
            if r.get("alignment"):
                print(f"       {r['alignment']}")
    n = sum(r["flagged"] for r in lines)
    print(f"\n{n} of {len(lines)} lines flagged, {len(problems)} timeline problems")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("episode", nargs="?")
    ap.add_argument("--lexicon", action="store_true")
    args = ap.parse_args()
    if args.lexicon:
        sys.exit(check_lexicon())
    if not args.episode:
        ap.error("name an episode id or pass --lexicon")
    sys.exit(check_episode(args.episode))


if __name__ == "__main__":
    main()
