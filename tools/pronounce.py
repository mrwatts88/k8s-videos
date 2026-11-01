"""Turns caption text into the text Kokoro should speak, using narration/lexicon.json.

Run directly to see what a line becomes, and with --phonemes the phonemes
Kokoro will get (needs the .venv):
    .venv/bin/python tools/pronounce.py "Run kubectl get pods on k3s."
    .venv/bin/python tools/pronounce.py --phonemes "Call ready Z."
"""
from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEXICON_PATH = ROOT / "narration" / "lexicon.json"


@dataclass
class Term:
    match: str
    say: str
    heard: list[str]
    ipa: str | None = None
    ignore_case: bool = False


@dataclass
class Spoken:
    """Result of preparing one line for speech."""

    text: str  # what Kokoro reads (respelled)
    terms: list[Term] = field(default_factory=list)  # lexicon terms found in the line
    # Pieces in order: ("text", str) or ("ipa", str). Only matters when a term has ipa.
    pieces: list[tuple[str, str]] = field(default_factory=list)

    @property
    def has_ipa(self) -> bool:
        return any(kind == "ipa" for kind, _ in self.pieces)

    def phonemes(self, phonemize) -> str:
        """Joins phonemized text pieces and ipa overrides, keeping word breaks."""
        out = ""
        space_before = False
        for kind, value in self.pieces:
            if kind == "ipa":
                part = value
                lead, trail = False, False
            else:
                if not value:
                    continue
                part = phonemize(value).strip() if value.strip() else ""
                lead, trail = value[0].isspace(), value[-1].isspace()
            if part:
                if out and (space_before or lead):
                    out += " "
                out += part
                space_before = trail
            elif lead or trail:
                space_before = True
        return out


class Lexicon:
    def __init__(self, path: Path = LEXICON_PATH):
        data = json.loads(path.read_text())
        self.terms = [
            Term(
                match=t["match"],
                say=t["say"],
                heard=t.get("heard", []),
                ipa=t.get("ipa"),
                ignore_case=t.get("ignoreCase", False),
            )
            for t in data["terms"]
        ]
        self.rules = [
            (re.compile(r["pattern"]), re.sub(r"\$(\d)", r"\\\1", r["replace"]))
            for r in data.get("rules", [])
        ]
        # Longest match first so "PostgreSQL" wins over "Postgres", "JWTs" over "JWT".
        ordered = sorted(self.terms, key=lambda t: len(t.match), reverse=True)
        parts = []
        for i, t in enumerate(ordered):
            body = re.escape(t.match)
            if t.ignore_case:
                body = f"(?i:{body})"
            parts.append(f"(?P<t{i}>{body})")
        self._ordered = ordered
        self._pattern = re.compile(r"(?<![\w.-])(?:" + "|".join(parts) + r")(?![\w-])")

    def find_terms(self, text: str) -> list[Term]:
        found = []
        for m in self._pattern.finditer(text):
            found.append(self._ordered[int(m.lastgroup[1:])])
        return found

    def prepare(self, text: str) -> Spoken:
        for pattern, repl in self.rules:
            text = pattern.sub(repl, text)
        text = re.sub(r"\s+", " ", text).strip()
        pieces: list[tuple[str, str]] = []
        terms: list[Term] = []
        out = []
        pos = 0
        for m in self._pattern.finditer(text):
            term = self._ordered[int(m.lastgroup[1:])]
            terms.append(term)
            before = text[pos : m.start()]
            out.append(before + term.say)
            if term.ipa:
                pieces.append(("text", before))
                pieces.append(("ipa", term.ipa))
            else:
                pieces.append(("text", before + term.say))
            pos = m.end()
        out.append(text[pos:])
        pieces.append(("text", text[pos:]))
        return Spoken(text="".join(out), terms=terms, pieces=pieces)


if __name__ == "__main__":
    args = sys.argv[1:]
    show_phonemes = "--phonemes" in args
    args = [a for a in args if a != "--phonemes"]
    lex = Lexicon()
    tokenizer = None
    if show_phonemes:
        from kokoro_onnx.tokenizer import Tokenizer

        tokenizer = Tokenizer()
    for arg in args:
        s = lex.prepare(arg)
        print(s.text)
        if s.terms:
            print("  terms:", ", ".join(t.match for t in s.terms))
        if tokenizer:
            print("  phonemes:", s.phonemes(tokenizer.phonemize))
