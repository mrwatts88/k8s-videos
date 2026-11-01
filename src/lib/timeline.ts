import timingConfig from "../timing.json";
import type { EpisodeScript, EpisodeTiming, SceneTiming } from "../types";

export const FPS = timingConfig.fps;

const frames = (seconds: number) => Math.ceil(seconds * FPS - 1e-9);

/**
 * A silent stand-in for tools/narrate.py's timings, built from word counts and
 * the same lead-in, gap and tail rules, so layouts can be previewed and
 * smoke-rendered without generating audio.
 */
export const estimateTiming = (script: EpisodeScript): EpisodeTiming => {
  const lead = frames(timingConfig.sceneLeadInSec);
  const gap = frames(timingConfig.lineGapSec);
  const tail = frames(timingConfig.sceneTailSec);
  let cursor = 0;
  const scenes: SceneTiming[] = script.scenes.map((scene) => {
    const start = cursor;
    cursor += lead;
    const lines = scene.lines.map((line, i) => {
      if (i > 0) cursor += gap;
      const words = (line.say ?? line.text).split(/\s+/).filter(Boolean).length;
      const durationInFrames = frames(Math.max(1, words / timingConfig.estimateWordsPerSec));
      const timing = { text: line.text, from: cursor - start, durationInFrames };
      cursor += durationInFrames;
      return timing;
    });
    cursor += tail;
    return { id: scene.id, from: start, durationInFrames: cursor - start, lines };
  });
  return { durationInFrames: cursor, audio: null, scenes };
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
