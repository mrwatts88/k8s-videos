// Quick render check for every episode, used in CI. Bundles the project once,
// then for each composition renders one still from the middle of every scene
// and a one-second MP4, so a broken component or a bad manifest path fails fast.
// Uses generated narration when it exists, otherwise the silent estimate.
//
//   node scripts/smoke.mjs                 # every episode
//   node scripts/smoke.mjs test-clip       # one episode
//   REMOTION_BROWSER=/path/to/chrome node scripts/smoke.mjs
import { bundle } from "@remotion/bundler";
import { getCompositions, renderMedia, renderStill } from "@remotion/renderer";
import { mkdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { webpackOverride } from "../webpack-override.mjs";

const root = resolve(import.meta.dirname, "..");
const outDir = join(root, "out", "smoke");
mkdirSync(outDir, { recursive: true });
const only = process.argv.slice(2);
const browserExecutable = process.env.REMOTION_BROWSER || null;
const chromiumOptions = { gl: "swangle" };

const serveUrl = await bundle({ entryPoint: join(root, "src", "index.ts"), webpackOverride });
const compositions = await getCompositions(serveUrl, { browserExecutable, chromiumOptions });

let checked = 0;
for (const composition of compositions) {
  if (only.length && !only.includes(composition.id)) continue;
  const timing = composition.props.timing;
  const frames = timing.scenes.map((s) => s.from + Math.floor(s.durationInFrames / 2));
  for (const frame of frames) {
    const output = join(outDir, `${composition.id}-${frame}.png`);
    await renderStill({ composition, serveUrl, frame, output, browserExecutable, chromiumOptions });
    if (statSync(output).size < 10_000) throw new Error(`${output} looks empty`);
  }
  const video = join(outDir, `${composition.id}.mp4`);
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: video,
    frameRange: [0, Math.min(composition.durationInFrames, composition.fps) - 1],
    browserExecutable,
    chromiumOptions,
  });
  console.log(
    `ok ${composition.id}: ${composition.durationInFrames} frames (${timing.audio ? "narrated" : "silent estimate"}), ` +
      `${frames.length} stills, 1s video`,
  );
  checked++;
}
if (checked === 0) throw new Error("No compositions rendered");
