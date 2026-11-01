// Renders one episode to out/<id>.mp4 with the Remotion CLI.
//
//   npm run render -- test-clip
//   REMOTION_BROWSER=$(node scripts/fetch-chromium.mjs --path) npm run render -- test-clip
//
// Run tools/narrate.py <id> first, or the render is a silent estimate.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const [id, ...rest] = process.argv.slice(2);
if (!id) {
  console.error("usage: npm run render -- <episode-id> [extra remotion flags]");
  process.exit(2);
}
if (!existsSync(join(root, "public", "narration", id, "timings.json"))) {
  console.warn(`warning: no narration for ${id}; rendering a silent estimate. Run: npm run narrate -- ${id}`);
}
const args = ["remotion", "render", "src/index.ts", id, `out/${id}.mp4`, ...rest];
if (process.env.REMOTION_BROWSER) args.push(`--browser-executable=${process.env.REMOTION_BROWSER}`);
const result = spawnSync("npx", args, { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);
