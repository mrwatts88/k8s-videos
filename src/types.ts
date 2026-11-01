// The shape of src/episodes/<id>/script.json. tools/narrate.py reads the same
// files, and scripts/check-scripts.mjs validates them in CI.

export type NarrationLine = {
  /** Caption text, exactly as shown on screen. One sentence. */
  text: string;
  /** Optional spoken override when the caption should not be read literally. */
  say?: string;
};

type SceneBase = {
  id: string;
  lines: NarrationLine[];
};

export type TitleScene = SceneBase & {
  type: "title";
  kicker?: string;
  title: string;
  subtitle?: string;
};

export type TerminalStep = {
  /** Index of the narration line (in this scene) that starts this step. */
  at: number;
  command: string;
  output?: string[];
};

export type TerminalScene = SceneBase & {
  type: "terminal";
  title?: string;
  prompt?: string;
  steps: TerminalStep[];
};

export type CodeHighlight = {
  /** Index of the narration line (in this scene) that moves to this highlight. */
  at: number;
  /** Inclusive 1-based file line numbers. */
  lines: [number, number];
};

export type CodeScene = SceneBase & {
  type: "code";
  /** Path from the repo root, for example manifests/base/golinks-deployment.yaml. */
  file: string;
  /** Inclusive 1-based line range of the file to show. Defaults to the whole file. */
  range?: [number, number];
  highlights?: CodeHighlight[];
};

export type Scene = TitleScene | TerminalScene | CodeScene;

export type EpisodeScript = {
  id: string;
  number: number | null;
  title: string;
  voice?: string;
  speed?: number;
  lang?: string;
  scenes: Scene[];
};

// Timings, in frames. Written by tools/narrate.py, or estimated when narration
// has not been generated yet (CI smoke renders, quick previews).

export type LineTiming = {
  text: string;
  /** Frame offset from the start of the scene. */
  from: number;
  durationInFrames: number;
};

export type SceneTiming = {
  id: string;
  from: number;
  durationInFrames: number;
  lines: LineTiming[];
};

export type EpisodeTiming = {
  durationInFrames: number;
  /** Path under public/ of the narration track, or null for a silent estimate. */
  audio: string | null;
  scenes: SceneTiming[];
};
