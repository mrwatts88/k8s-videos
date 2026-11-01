// Fallback browser for Remotion in sandboxes that cannot reach Remotion's own
// browser download (remotion.media / Google storage). Unpacks the Chromium
// build that ships inside the @sparticuz/chromium npm package into
// .cache/chromium/ and prints the executable path. Normal machines and CI do
// not need this: Remotion downloads its headless browser on first render.
//
//   node scripts/fetch-chromium.mjs
//   REMOTION_BROWSER=$(node scripts/fetch-chromium.mjs --path) npm run render -- test-clip
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { brotliDecompressSync } from "node:zlib";

const VERSION = "153.0.0";
const root = resolve(import.meta.dirname, "..");
const dir = join(root, ".cache", "chromium");
const exe = join(dir, "chromium");
const quiet = process.argv.includes("--path");

if (!existsSync(exe)) {
  mkdirSync(dir, { recursive: true });
  const tgz = execFileSync("npm", ["pack", `@sparticuz/chromium@${VERSION}`, "--silent"], { cwd: dir })
    .toString()
    .trim();
  execFileSync("tar", ["xzf", tgz], { cwd: dir });
  const bin = join(dir, "package", "bin");
  writeFileSync(exe, brotliDecompressSync(readFileSync(join(bin, "chromium.br"))));
  chmodSync(exe, 0o755);
  for (const archive of ["swiftshader", "fonts"]) {
    const tar = join(dir, `${archive}.tar`);
    writeFileSync(tar, brotliDecompressSync(readFileSync(join(bin, `${archive}.tar.br`))));
    execFileSync("tar", ["xf", tar], { cwd: dir });
  }
  if (!quiet) console.error(`Unpacked Chromium ${VERSION} into ${dir}`);
}
console.log(exe);
