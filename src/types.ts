// The shape of src/episodes/<id>/script.json. tools/narrate.py reads the same
// files, and scripts/check-scripts.mjs validates them in CI.

export type NarrationLine = {
  /** Caption text, exactly as shown on screen. One sentence. */
  text: string;
  /** Optional spoken override when the caption should not be read literally. */
  say?: string;
  /** Extra seconds of silence after this line, on top of the usual gap. */
  pauseAfter?: number;
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

export type DiagramTone = "neutral" | "accent" | "good" | "bad" | "warn";

export type DiagramBox = {
  id: string;
  /**
   * group: dashed outline with its label at the top, drawn behind everything.
   * component: a solid box (the default). pod: a small pill. note: text only.
   */
  kind?: "group" | "component" | "pod" | "note";
  label: string;
  /** Smaller second line, in monospace. */
  sublabel?: string;
  /** Top-left corner and size on the diagram canvas (size in src/timing.json, 1600 by 800). */
  x: number;
  y: number;
  w: number;
  h: number;
  tone?: DiagramTone;
  /** Starts hidden; a step shows it. */
  hidden?: boolean;
};

export type DiagramArrow = {
  id: string;
  from: string;
  to: string;
  label?: string;
  /** Bends the arrow sideways by this many pixels at its middle. */
  curve?: number;
  tone?: DiagramTone;
  hidden?: boolean;
};

export type DiagramStep = {
  /** Index of the narration line (in this scene) that triggers this step. */
  at: number;
  show?: string[];
  hide?: string[];
  /** Changes the color of boxes or arrows. */
  tone?: Record<string, DiagramTone>;
  /** Highlights these and dims everything else. An empty list clears the focus. */
  focus?: string[];
  /** Arrows that carry a moving dot from now on. An empty list stops them. */
  flow?: string[];
};

export type DiagramScene = SceneBase & {
  type: "diagram";
  title?: string;
  boxes: DiagramBox[];
  arrows?: DiagramArrow[];
  steps?: DiagramStep[];
};

export type Scene = TitleScene | TerminalScene | CodeScene | DiagramScene;

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
