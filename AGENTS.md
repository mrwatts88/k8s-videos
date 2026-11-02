# AGENTS.md

How to work in this repo. Read `PLAN.md` for what the series is and `STATUS.md`
for where each episode stands.

## Layout

```
PLAN.md                     series plan, episode outlines, the go links design, video format
STATUS.md                   per-episode status tracker (update it in every episode PR)
manifests/base/             real Kubernetes manifests for the go links service (Kustomize base)
narration/lexicon.json      how technical terms are spoken (see Pronunciation)
src/
  index.ts, Root.tsx        Remotion entry; one composition per episode script
  Episode.tsx               renders an episode: scenes, narration audio, captions
  episodes/<id>/script.json the episode: scenes, narration lines, what appears when
  episodes/registry.ts      list of episode scripts
  components/               TitleCard, TerminalCard, CodeCard, DiagramCard, Captions, Card
  lib/timeline.ts           timing helpers and the silent estimate
  lib/files.ts              loads manifests/ as text for code cards
  timing.json               fps, size, speed, lead-in, gaps, tail, terminal typing and beats (shared with Python)
tools/                      Python: narration (Kokoro), the timeline layout mirror (layout.py) and the pronunciation check (Whisper)
scripts/                    Node and shell: checks, smoke render, render, tool installs
public/narration/<id>/      generated narration.wav and timings.json (gitignored)
```

## Setup

```bash
npm ci
npm run setup:python          # .venv with kokoro-onnx and sherpa-onnx, then model downloads
bash scripts/install-k8s-tools.sh   # kubeconform + kubectl into .cache/bin
```

Models come from GitHub releases (Kokoro v1.0 ONNX from `thewh1teagle/kokoro-onnx`,
Whisper base.en from `k2-fsa/sherpa-onnx`), checked by SHA-256 in
`tools/fetch_models.sh`. Everything runs on CPU.

Remotion downloads its own headless browser on first render. In a sandbox that
cannot reach Remotion's download host, `node scripts/fetch-chromium.mjs` unpacks a
Chromium from npm and prints its path; pass it as `REMOTION_BROWSER`.

## Making an episode

1. Create `src/episodes/<id>/script.json` (ids look like `ep00-what-is-kubernetes`)
   and add it to `src/episodes/registry.ts`. Copy `test-clip` as a starting point.
2. Write narration as `lines` inside each scene. One line is one sentence, under
   200 characters. Captions show the line text exactly; use `say` on a line only
   when the spoken words should differ from the caption.
3. Visuals follow narration by line index within the scene:
   - `terminal` scenes: each step has `at` (the line that starts it), `command`,
     and `output` lines. Write realistic output; nothing runs on a cluster.
   - `code` scenes: `file` is a path under `manifests/`, `range` limits the lines
     shown, and each highlight has `at` and inclusive `lines`. Line numbers are
     the file's own, so re-check highlights when a manifest changes.
   - `title` scenes: `kicker`, `title`, `subtitle`.
   - `diagram` scenes: `boxes` and `arrows` laid out on a 1600 by 800 canvas
     (size in `src/timing.json`), then `steps`, each with `at` and any of
     `show`, `hide`, `tone` (neutral, accent, good, bad, warn), `focus` (dims
     everything else; `[]` clears it) and `flow` (a dot travels the arrows;
     `[]` stops it). Box kinds: `component` (default), `group` (dashed, drawn
     behind), `pod` (pill) and `note` (text only). Mark boxes and arrows that
     appear later with `hidden: true`. Episode 0 has examples of each. Render
     a few stills to check the layout before a full render; see
     `scripts/smoke.mjs` for how.
4. Add or change manifests in `manifests/base/` and list them in its
   `kustomization.yaml`.
5. `npm run narrate -- <id>` writes `public/narration/<id>/` (only changed lines
   are re-synthesized).
6. `npm run check:narration -- <id>` and fix anything flagged (see below).
7. `npm run studio` to preview, `npm run render -- <id>` for `out/<id>.mp4`.
8. Update `STATUS.md`.

## Pacing

All pacing lives in `src/timing.json`: the default speech speed, the lead-in,
the gap between lines and the tail of each scene, and how terminal cards type
(characters per second, the beat with the cursor on the command line before
output, the time the output stays on screen before the next line starts).
Slow a single moment down with `"pauseAfter": <seconds>` on a narration line.

The layout is computed twice, in `src/lib/timeline.ts` for the video and in
`tools/layout.py` for the narration track. Change both together;
`npm run check:timing` fails if they disagree.

Without narration, compositions fall back to a silent estimate of the timing,
which is what the CI smoke render uses.

## Pronunciation

Kokoro reads text through espeak, which gets many technical terms wrong.
`narration/lexicon.json` rewrites terms before synthesis; captions are not
affected. Each term has:

- `match`: the text as written (case-sensitive unless `ignoreCase`; longest match wins)
- `say`: a plain respelling
- `ipa` (optional): phonemes, for when a respelling cannot get there
- `heard`: what Whisper may write when the term was said correctly

`rules` handle patterns: `go/standup` is said "go slash standup", and other
slashes in paths become "slash".

Choices, and why:

| Term | Spoken | Why |
| --- | --- | --- |
| kubectl | cube control | The most common spoken form; "cube cuddle" and "kube C T L" also exist |
| k3s | K three S | No official pronunciation; spelling it out is unambiguous |
| k8s | Kubernetes | Narration should say the full name |
| etcd | et see dee | The etcd project's own guidance |
| YAML | yammel (rhymes with camel) | Common usage |
| kubelet, kube-proxy, kube-system | cube let, cube proxy, cube system | Matches kubectl |
| Traefik | traffic | The project's own pronunciation |
| Keycloak | key cloak | |
| JWT | J W T | RFC 7519 suggests "jot", but most engineers spell it out, and spelling is clearer for newcomers |
| OIDC, CNI, TLS, DNS, PVC, CA, URL, HTTP | spelled out | |
| API | phoneme override | espeak read the "A" in "A P I" as the article "uh" |
| RBAC | are back | Common usage |
| Kustomize | customize | |
| nginx | engine X | The project's own pronunciation |
| Postgres | post gress | |
| Istio | iss-tee-oh | "is tee oh" ran together into "his T O" |
| healthz, readyz | health Z, ready Z | Endpoint names are read as written |
| HTTP status codes | three oh two, four oh four | How engineers say them |
| go.corp.internal | go dot corp dot internal | |

### Words Whisper cannot catch

Whisper writes "lives" whichever way it was said, so two kinds of mistake need
their own guard:

- Heteronyms. espeak picks the sense from context and often gets it wrong: it
  says "pods live on nodes" with the live of "a live demo", and "k3s uses
  SQLite" with the noun "uses". Every word under `heteronyms` in the lexicon
  (live, lives, use, uses, read, close, lead, record, object and others) must
  have its sense named on the line, as `"senses": {"lives": "verb"}`.
  `check:scripts` fails otherwise, and narration speaks that sense's `ipa`.
  Prefer rewording when it reads just as well.
- Words ending in -ies or -ied. espeak clips some of them ("copies" comes out
  "copiz", "copied" comes out "copid"). Every narration word of six or more
  letters ending in -ies or -ied must be a lexicon term or listed in
  `endingsChecked`. Check a new one with `tools/pronounce.py --phonemes`: if it
  ends in `ɪz` or `ɪd`, add a term with `ipa` ending in `iz` or `id`; otherwise
  list it.
- Tool names. Some are said in a way espeak can't guess: containerd is
  "container D", kubeconfig is "cube config", kubectl is "cube control". These
  are lexicon terms; add new tool names the same way.

When the listener reports a word that sounded off, find the phonemes with
`tools/pronounce.py --phonemes` and fix the cause in the lexicon, so later
episodes inherit the fix.

### Checking without listening

`npm run check:narration -- <id>` transcribes every line of the episode's
`narration.wav` with Whisper (base.en, CPU) and compares it with what was meant:

- every lexicon term in the line must come back as one of its `heard` forms
- the rest of the line must have a word error rate of 0.2 or less
- each caption window must contain speech, and the gaps between them must be
  silent, so captions and voice line up

Results go to `public/narration/<id>/pronunciation-report.json`.
`npm run check:lexicon` says every term in a carrier sentence and checks it,
which is the fastest way to try a new respelling.

Whisper is a proxy for a listener, not a perfect one. Some flags are Whisper
mishearing correct speech (it often writes "ready Z" as "red easy"). When a
flag looks like that, check the phonemes with
`.venv/bin/python tools/pronounce.py --phonemes "the line"`, and if they are right, add the transcription to the term's `heard` list. When
the phonemes are wrong, change `say` or add `ipa`.

## Checks

| Command | What it checks | In CI |
| --- | --- | --- |
| `npm run typecheck` | TypeScript | yes |
| `npm run lint` | ESLint (Remotion config) | yes |
| `npm run check:scripts` | every narration line sits in a scene; `at` indexes, code files, line ranges and diagrams are valid; episodes are registered; heteronyms have senses and -ies and -ied words are checked; lexicon is well formed | yes |
| `npm run check:timing` | `src/lib/timeline.ts` and `tools/layout.py` lay out every script identically | yes |
| `python3 tools/test_pronounce.py` | lexicon rewriting rules and heteronym senses | yes |
| `npm run check:manifests` | kubeconform (strict, Kubernetes 1.33) on every manifest, and `kubectl kustomize` on every kustomization | yes |
| `npm run smoke` | renders a still from every scene and a 1 second MP4 of every episode | yes |
| `npm run check:narration -- <id>` | transcription and caption alignment | no (needs models and narration; run locally) |

`npm run check` runs the fast ones together.

## Pull requests

Work on a branch, open a PR, and merge it once CI is green. No human review is
required. If a check fails, fix the cause; never skip or weaken a check to get
green. Keep `STATUS.md` current in the same PR.
