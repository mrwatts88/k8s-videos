import timingConfig from "../timing.json";
import type { EpisodeScript, EpisodeTiming, Scene, SceneTiming } from "../types";

export const FPS = timingConfig.fps;

/** Seconds to whole frames, rounding up. tools/narrate.py uses the same rule. */
export const toFrames = (seconds: number) => Math.ceil(seconds * FPS - 1e-9);

const term = timingConfig.terminal;
export const terminalFrames = {
  typeDelay: toFrames(term.typeDelaySec),
  beat: toFrames(term.outputBeatSec),
  stagger: toFrames(term.outputStaggerSec),
  read: toFrames(term.outputReadSec),
};

/** Frames it takes to type a command on a terminal card. */
export const typingFrames = (command: string) =>
  Math.min(toFrames(term.maxTypeSec), Math.ceil((command.length * FPS) / term.typeCharsPerSec - 1e-9));

/**
 * Scene-relative frame by which line i's terminal output has been on screen
 * long enough to read, or 0 when no command starts on that line.
 */
export const terminalHoldUntil = (scene: Scene, lineIndex: number, lineFrom: number): number => {
  if (scene.type !== "terminal") return 0;
  let until = 0;
  for (const step of scene.steps) {
    if (step.at !== lineIndex) continue;
    const outputs = step.output?.length ?? 0;
    const lastOutput =
      lineFrom +
      terminalFrames.typeDelay +
      typingFrames(step.command) +
      terminalFrames.beat +
      Math.max(0, outputs - 1) * terminalFrames.stagger;
    until = Math.max(until, lastOutput + terminalFrames.read);
  }
  return until;
};

/**
 * Lays out lines on the timeline from their lengths in frames. tools/narrate.py
 * mirrors this exactly; keep the two in step.
 */
export const layoutScenes = (scenes: Scene[], lineFrames: number[][]): SceneTiming[] => {
  const lead = toFrames(timingConfig.sceneLeadInSec);
  const gap = toFrames(timingConfig.lineGapSec);
  const tail = toFrames(timingConfig.sceneTailSec);
  let cursor = 0;
  return scenes.map((scene, s) => {
    const start = cursor;
    let at = lead; // scene-relative
    let holdUntil = 0;
    const lines = scene.lines.map((line, i) => {
      const from = Math.max(at, holdUntil);
      const durationInFrames = lineFrames[s][i];
      holdUntil = terminalHoldUntil(scene, i, from);
      at = from + durationInFrames + gap + toFrames(line.pauseAfter ?? 0);
      return { text: line.text, from, durationInFrames };
    });
    const last = lines[lines.length - 1];
    const lastPause = toFrames(scene.lines[scene.lines.length - 1]?.pauseAfter ?? 0);
    const end = Math.max(last ? last.from + last.durationInFrames + lastPause + tail : lead + tail, holdUntil);
    cursor = start + end;
    return { id: scene.id, from: start, durationInFrames: end, lines };
  });
};

/**
 * A silent stand-in for tools/narrate.py's timings, built from word counts,
 * so layouts can be previewed and smoke-rendered without generating audio.
 */
export const estimateTiming = (script: EpisodeScript): EpisodeTiming => {
  const lineFrames = script.scenes.map((scene) =>
    scene.lines.map((line) => {
      const words = (line.say ?? line.text).split(/\s+/).filter(Boolean).length;
      return toFrames(Math.max(1, words / timingConfig.estimateWordsPerSec));
    }),
  );
  const scenes = layoutScenes(script.scenes, lineFrames);
  const last = scenes[scenes.length - 1];
  return { durationInFrames: last.from + last.durationInFrames, audio: null, scenes };
};

/** True when a generated timings.json still matches the script it came from. */
export const timingMatchesScript = (timing: EpisodeTiming, script: EpisodeScript): boolean =>
  timing.scenes.length === script.scenes.length &&
  timing.scenes.every((scene, i) => {
    const source = script.scenes[i];
    return (
      scene.id === source.id &&
      scene.lines.length === source.lines.length &&
      scene.lines.every((line, j) => line.text === source.lines[j].text)
    );
  });

/** Index of the narration line playing at a scene-relative frame, or -1 before the first. */
export const activeLineIndex = (scene: SceneTiming, frame: number): number => {
  let index = -1;
  scene.lines.forEach((line, i) => {
    if (frame >= line.from) index = i;
  });
  return index;
};

/** Scene-relative frame at which a line starts. Indexes past the end clamp to the last line. */
export const lineStart = (scene: SceneTiming, index: number): number => {
  if (scene.lines.length === 0) return 0;
  const line = scene.lines[Math.min(Math.max(index, 0), scene.lines.length - 1)];
  return line.from;
};
