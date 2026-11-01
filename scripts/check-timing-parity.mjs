// The timeline is laid out twice: by tools/layout.py when narration is
// generated, and by src/lib/timeline.ts for silent previews and smoke renders.
// This runs both on every episode script with the same made-up line lengths
// and fails if they disagree.
//
//   node scripts/check-timing-parity.mjs
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const dir = mkdtempSync(join(tmpdir(), "parity-"));
const outfile = join(dir, "timeline.mjs");
await build({
  entryPoints: [join(root, "src", "lib", "timeline.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile,
  logLevel: "warning",
});
const { layoutScenes } = await import(pathToFileURL(outfile).href);
rmSync(dir, { recursive: true, force: true });

const episodes = join(root, "src", "episodes");
let failures = 0;
for (const id of readdirSync(episodes, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)) {
  const script = JSON.parse(readFileSync(join(episodes, id, "script.json"), "utf8"));
  // Varied lengths, including very short lines so terminal holds kick in.
  const lineFrames = script.scenes.map((scene, s) => scene.lines.map((_, i) => 12 + ((s * 37 + i * 53) % 160)));
  const strip = (scenes) =>
    scenes.map((sc) => ({ id: sc.id, from: sc.from, d: sc.durationInFrames, lines: sc.lines.map((l) => [l.from, l.durationInFrames]) }));
  const ts = strip(layoutScenes(script.scenes, lineFrames));
  const py = strip(
    JSON.parse(
      execFileSync("python3", [join(root, "tools", "layout.py")], {
        input: JSON.stringify({ scenes: script.scenes, lineFrames }),
      }).toString(),
    ),
  );
  if (JSON.stringify(ts) === JSON.stringify(py)) {
    console.log(`ok ${id}`);
  } else {
    failures++;
    console.error(`MISMATCH ${id}\n  ts: ${JSON.stringify(ts)}\n  py: ${JSON.stringify(py)}`);
  }
}
process.exit(failures ? 1 : 0);
