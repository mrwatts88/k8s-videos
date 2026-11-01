"""Unit tests for the pronunciation layer. Stdlib only, no models needed.

    python3 tools/test_pronounce.py
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pronounce import Lexicon  # noqa: E402


class PronounceTest(unittest.TestCase):
    lex = Lexicon()

    def say(self, text):
        return self.lex.prepare(text).text

    def test_common_terms(self):
        self.assertEqual(self.say("Run kubectl on k3s."), "Run cube control on K three S.")
        self.assertEqual(self.say("Traefik routes it."), "traffic routes it.")

    def test_longest_match_wins(self):
        self.assertEqual(self.say("PostgreSQL, not Postgres."), "post gress Q L, not post gress.")
        self.assertEqual(self.say("two JWTs and a JWT"), "two J W Ts and a J W T")

    def test_word_boundaries(self):
        # "CA" inside another word must not be replaced.
        self.assertEqual(self.say("CAREFUL with the CA."), "CAREFUL with the C A.")
        # Hostnames are matched whole.
        self.assertIn("go dot corp dot internal", self.say("Open go.corp.internal now."))

    def test_rules(self):
        self.assertEqual(self.say("Type go/standup."), "Type go slash standup.")
        self.assertIn("slash", self.say("Call /readyz."))

    def test_ipa_pieces(self):
        spoken = self.lex.prepare("The API answers.")
        self.assertTrue(spoken.has_ipa)
        self.assertIn(("ipa", "ˈeɪpˌiːˈaɪ"), spoken.pieces)

    def test_phonemes_keep_word_breaks(self):
        def fake(text):  # stands in for espeak
            return text.strip().upper()

        self.assertEqual(self.lex.prepare("both API pods.").phonemes(fake), "BOTH ˈeɪpˌiːˈaɪ PODS.")
        self.assertEqual(self.lex.prepare("The APIs.").phonemes(fake), "THE ˈeɪpˌiːˈaɪz.")

    def test_every_term_has_heard_forms(self):
        for term in self.lex.terms:
            self.assertTrue(term.heard, term.match)


if __name__ == "__main__":
    unittest.main()
