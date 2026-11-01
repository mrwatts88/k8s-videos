"""Turns caption text into the text Kokoro should speak, using narration/lexicon.json.

Run directly to see what a line becomes, and with --phonemes the phonemes
Kokoro will get (needs the .venv):
    .venv/bin/python tools/pronounce.py "Run kubectl get pods on k3s."
    .venv/bin/python tools/pronounce.py --phonemes "Call ready Z."
    .venv/bin/python tools/pronounce.py --phonemes --sense lives=verb "Each pod lives on a node."
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


@dataclass
class Heteronym:
    """A word spelled the same in two senses that sound different, like "lives"."""

    word: str
    senses: dict[str, str]  # sense name -> ipa


class MissingSense(ValueError):
    pass


BOUNDARY_BEFORE = r"(?<![\w.-])"
BOUNDARY_AFTER = r"(?![\w-])"


def _compile(terms: list[Term]):
    # Longest match first so "PostgreSQL" wins over "Postgres", "JWTs" over "JWT".
    ordered = sorted(terms, key=lambda t: len(t.match), reverse=True)
    parts = []
    for i, t in enumerate(ordered):
        body = re.escape(t.match)
        if t.ignore_case:
            body = f"(?i:{body})"
        parts.append(f"(?P<t{i}>{body})")
    return ordered, re.compile(BOUNDARY_BEFORE + "(?:" + "|".join(parts) + ")" + BOUNDARY_AFTER)


class Lexicon:
    def __init__(self, path: Path = LEXICON_PATH):
        data = json.loads(path.read_text())
        self.heteronyms = {
            h["word"].lower(): Heteronym(word=h["word"].lower(), senses={k: v["ipa"] for k, v in h["senses"].items()})
            for h in data.get("heteronyms", [])
        }
        self._het_pattern = re.compile(
            BOUNDARY_BEFORE + "(?i:" + "|".join(re.escape(w) for w in self.heteronyms) + ")" + BOUNDARY_AFTER
        ) if self.heteronyms else None
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
        self._ordered, self._pattern = _compile(self.terms)

    def find_terms(self, text: str) -> list[Term]:
        found = []
        for m in self._pattern.finditer(text):
            found.append(self._ordered[int(m.lastgroup[1:])])
        return found

    def heteronyms_in(self, text: str) -> list[str]:
        if not self._het_pattern:
            return []
        return [m.group(0).lower() for m in self._het_pattern.finditer(text)]

    def prepare(self, text: str, senses: dict[str, str] | None = None) -> Spoken:
        """senses names the meaning of each heteronym in the line, for example {"lives": "verb"}."""
        senses = {k.lower(): v for k, v in (senses or {}).items()}
        for pattern, repl in self.rules:
            text = pattern.sub(repl, text)
        text = re.sub(r"\s+", " ", text).strip()
        ordered, pattern = self._ordered, self._pattern
        found = self.heteronyms_in(text)
        if found:
            extra = []
            for word in dict.fromkeys(found):
                het = self.heteronyms[word]
                sense = senses.get(word)
                if sense not in het.senses:
                    raise MissingSense(
                        f'"{word}" can be said {len(het.senses)} ways; add "senses": {{"{word}": one of '
                        f"{sorted(het.senses)}}} to the line: {text}"
                    )
                extra.append(Term(match=word, say=word, heard=[word], ipa=het.senses[sense], ignore_case=True))
            ordered, pattern = _compile(self.terms + extra)
        pieces: list[tuple[str, str]] = []
        terms: list[Term] = []
        out = []
        pos = 0
        for m in pattern.finditer(text):
            term = ordered[int(m.lastgroup[1:])]
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
    # --sense lives=verb picks the sense of a heteronym.
    senses = {}
    while "--sense" in args:
        i = args.index("--sense")
        word, _, sense = args[i + 1].partition("=")
        senses[word] = sense
        del args[i : i + 2]
    lex = Lexicon()
    tokenizer = None
    if show_phonemes:
        from kokoro_onnx.tokenizer import Tokenizer

        tokenizer = Tokenizer()
    for arg in args:
        try:
            s = lex.prepare(arg, senses)
        except MissingSense as e:
            sys.exit(str(e))
        print(s.text)
        if s.terms:
            print("  terms:", ", ".join(t.match for t in s.terms))
        if tokenizer:
            print("  phonemes:", s.phonemes(tokenizer.phonemize))
