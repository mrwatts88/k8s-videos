"""Places narration lines on the timeline. Stdlib only.

Mirrors layoutScenes in src/lib/timeline.ts; scripts/check-timing-parity.mjs
runs both on the same input in CI and fails if they disagree.

As a script it reads {"scenes": [...], "lineFrames": [[...]]} on stdin and
prints the layout as JSON (used by the parity check).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_timing() -> dict:
    return json.loads((ROOT / "src" / "timing.json").read_text())


def frames(seconds: float, fps: int) -> int:
    """Seconds to whole frames, rounding up, like toFrames in timeline.ts."""
    return int(math.ceil(seconds * fps - 1e-9))


def typing_frames(command: str, timing: dict) -> int:
    t = timing["terminal"]
    fps = timing["fps"]
    return min(frames(t["maxTypeSec"], fps), int(math.ceil(len(command) * fps / t["typeCharsPerSec"] - 1e-9)))


def terminal_hold_until(scene: dict, line_index: int, line_from: int, timing: dict) -> int:
    """Scene-relative frame by which this line's terminal output has been readable long enough."""
    if scene["type"] != "terminal":
        return 0
    t = timing["terminal"]
    fps = timing["fps"]
    until = 0
    for step in scene["steps"]:
        if step["at"] != line_index:
            continue
        outputs = len(step.get("output", []))
        last_output = (
            line_from
            + frames(t["typeDelaySec"], fps)
            + typing_frames(step["command"], timing)
            + frames(t["outputBeatSec"], fps)
            + max(0, outputs - 1) * frames(t["outputStaggerSec"], fps)
        )
        until = max(until, last_output + frames(t["outputReadSec"], fps))
    return until


def layout(scenes: list[dict], line_frames: list[list[int]], timing: dict) -> list[dict]:
    """Places lines on the timeline from their lengths in frames.

    Mirrors layoutScenes in src/lib/timeline.ts; scripts/check-timing-parity.mjs
    checks that the two agree.
    """
    fps = timing["fps"]
    lead = frames(timing["sceneLeadInSec"], fps)
    gap = frames(timing["lineGapSec"], fps)
    tail = frames(timing["sceneTailSec"], fps)
    out = []
    cursor = 0
    for s, scene in enumerate(scenes):
        at = lead  # scene-relative
        hold_until = 0
        lines = []
        for i, line in enumerate(scene["lines"]):
            start = max(at, hold_until)
            dur = line_frames[s][i]
            lines.append({"text": line["text"], "from": start, "durationInFrames": dur})
            hold_until = terminal_hold_until(scene, i, start, timing)
            at = start + dur + gap + frames(line.get("pauseAfter", 0), fps)
        last = lines[-1]
        last_pause = frames(scene["lines"][-1].get("pauseAfter", 0), fps)
        end = max(last["from"] + last["durationInFrames"] + last_pause + tail, hold_until)
        out.append({"id": scene["id"], "from": cursor, "durationInFrames": end, "lines": lines})
        cursor += end
    return out



if __name__ == "__main__":
    data = json.load(sys.stdin)
    json.dump(layout(data["scenes"], data["lineFrames"], load_timing()), sys.stdout)
