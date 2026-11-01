// Validates every episode script and the pronunciation lexicon. Runs in CI.
//
//   node scripts/check-scripts.mjs
//
// Checks that each narration line belongs to a scene, that terminal steps and
// code highlights point at real narration lines, that code cards point at real
// files and line ranges, and that every episode is registered.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const episodesDir = join(root, "src", "episodes");
const registry = readFileSync(join(episodesDir, "registry.ts"), "utf8");
const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);

const isInt = (n) => Number.isInteger(n);
const MAX_LINE_CHARS = 200;
const TONES = ["neutral", "accent", "good", "bad", "warn"];
const BOX_KINDS = ["group", "component", "pod", "note"];
const { diagram } = JSON.parse(readFileSync(join(root, "src", "timing.json"), "utf8"));

const ids = readdirSync(episodesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

let lineCount = 0;
for (const id of ids) {
  const path = join(episodesDir, id, "script.json");
  const where = `src/episodes/${id}/script.json`;
  if (!existsSync(path)) {
    fail(`src/episodes/${id}`, "missing script.json");
    continue;
  }
  let script;
  try {
    script = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    fail(where, `not valid JSON: ${e.message}`);
    continue;
  }
  if (script.id !== id) fail(where, `id "${script.id}" must match its folder name "${id}"`);
  if (!registry.includes(`./${id}/script.json`)) fail(where, "not imported in src/episodes/registry.ts");
  if (!script.title) fail(where, "missing title");
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) {
    fail(where, "needs at least one scene");
    continue;
  }

  const sceneIds = new Set();
  script.scenes.forEach((scene, s) => {
    const at = `${where} scene ${s} (${scene.id ?? "no id"})`;
    if (!scene.id) fail(at, "missing id");
    if (sceneIds.has(scene.id)) fail(at, "duplicate scene id");
    sceneIds.add(scene.id);
    if (!Array.isArray(scene.lines) || scene.lines.length === 0) {
      fail(at, "every scene needs at least one narration line");
      return;
    }
    scene.lines.forEach((line, i) => {
      lineCount++;
      if (typeof line.text !== "string" || !line.text.trim()) fail(`${at} line ${i}`, "empty text");
      else if (line.text.length > MAX_LINE_CHARS)
        fail(`${at} line ${i}`, `${line.text.length} characters; split it (max ${MAX_LINE_CHARS})`);
      if (line.pauseAfter !== undefined && !(typeof line.pauseAfter === "number" && line.pauseAfter >= 0))
        fail(`${at} line ${i}`, "pauseAfter must be a number of seconds, 0 or more");
      if (line.say !== undefined && (typeof line.say !== "string" || !line.say.trim()))
        fail(`${at} line ${i}`, "say must be non-empty text");
    });
    const validAt = (n) => isInt(n) && n >= 0 && n < scene.lines.length;

    switch (scene.type) {
      case "title":
        if (!scene.title) fail(at, "title scene needs a title");
        break;
      case "terminal": {
        if (!Array.isArray(scene.steps) || scene.steps.length === 0) fail(at, "terminal scene needs steps");
        let last = -1;
        (scene.steps ?? []).forEach((step, i) => {
          if (!validAt(step.at)) fail(`${at} step ${i}`, `at=${step.at} is not a narration line of this scene`);
          if (step.at < last) fail(`${at} step ${i}`, "steps must be in narration order");
          last = step.at;
          if (!step.command) fail(`${at} step ${i}`, "missing command");
          if (step.output !== undefined && !Array.isArray(step.output)) fail(`${at} step ${i}`, "output must be a list");
        });
        break;
      }
      case "code": {
        if (!scene.file?.startsWith("manifests/")) {
          fail(at, "code cards show files under manifests/");
          break;
        }
        const file = join(root, scene.file);
        if (!existsSync(file)) {
          fail(at, `file not found: ${scene.file}`);
          break;
        }
        const total = readFileSync(file, "utf8").replace(/\n$/, "").split("\n").length;
        const [first, lastLine] = scene.range ?? [1, total];
        if (!isInt(first) || !isInt(lastLine) || first < 1 || lastLine > total || first > lastLine)
          fail(at, `range ${JSON.stringify(scene.range)} is outside 1..${total}`);
        let previous = -1;
        (scene.highlights ?? []).forEach((h, i) => {
          if (!validAt(h.at)) fail(`${at} highlight ${i}`, `at=${h.at} is not a narration line of this scene`);
          if (h.at < previous) fail(`${at} highlight ${i}`, "highlights must be in narration order");
          previous = h.at;
          const [a, b] = h.lines ?? [];
          if (!isInt(a) || !isInt(b) || a > b || a < first || b > lastLine)
            fail(`${at} highlight ${i}`, `lines ${JSON.stringify(h.lines)} are outside the shown range ${first}..${lastLine}`);
        });
        break;
      }
      case "diagram": {
        const ids = new Map();
        const boxes = Array.isArray(scene.boxes) ? scene.boxes : [];
        if (boxes.length === 0) fail(at, "diagram scene needs boxes");
        boxes.forEach((b, i) => {
          const where = `${at} box ${i} (${b.id ?? "no id"})`;
          if (!b.id) fail(where, "missing id");
          else if (ids.has(b.id)) fail(where, "duplicate id");
          ids.set(b.id, "box");
          if (!b.label) fail(where, "missing label");
          if (b.kind !== undefined && !BOX_KINDS.includes(b.kind)) fail(where, `kind must be one of ${BOX_KINDS.join(", ")}`);
          if (b.tone !== undefined && !TONES.includes(b.tone)) fail(where, `tone must be one of ${TONES.join(", ")}`);
          if (![b.x, b.y, b.w, b.h].every(isInt) || b.w <= 0 || b.h <= 0) fail(where, "x, y, w and h must be whole numbers, w and h above 0");
          else if (b.x < 0 || b.y < 0 || b.x + b.w > diagram.width || b.y + b.h > diagram.height)
            fail(where, `sits outside the ${diagram.width} by ${diagram.height} canvas`);
        });
        (scene.arrows ?? []).forEach((a, i) => {
          const where = `${at} arrow ${i} (${a.id ?? "no id"})`;
          if (!a.id) fail(where, "missing id");
          else if (ids.has(a.id)) fail(where, "duplicate id");
          ids.set(a.id, "arrow");
          if (ids.get(a.from) !== "box") fail(where, `from "${a.from}" is not a box`);
          if (ids.get(a.to) !== "box") fail(where, `to "${a.to}" is not a box`);
          if (a.from === a.to) fail(where, "an arrow needs two different boxes");
          if (a.tone !== undefined && !TONES.includes(a.tone)) fail(where, `tone must be one of ${TONES.join(", ")}`);
        });
        let previous = -1;
        (scene.steps ?? []).forEach((step, i) => {
          const where = `${at} step ${i}`;
          if (!validAt(step.at)) fail(where, `at=${step.at} is not a narration line of this scene`);
          if (step.at < previous) fail(where, "steps must be in narration order");
          previous = step.at;
          for (const key of ["show", "hide", "focus"]) {
            for (const id of step[key] ?? []) if (!ids.has(id)) fail(where, `${key}: no box or arrow "${id}"`);
          }
          for (const id of step.flow ?? []) if (ids.get(id) !== "arrow") fail(where, `flow: no arrow "${id}"`);
          for (const [id, tone] of Object.entries(step.tone ?? {})) {
            if (!ids.has(id)) fail(where, `tone: no box or arrow "${id}"`);
            if (!TONES.includes(tone)) fail(where, `tone for "${id}" must be one of ${TONES.join(", ")}`);
          }
        });
        break;
      }
      default:
        fail(at, `unknown scene type "${scene.type}"`);
    }
  });

  // Generated timings are not committed, but if one exists locally, say when it is stale.
  const timingsPath = join(root, "public", "narration", id, "timings.json");
  if (existsSync(timingsPath)) {
    const timings = JSON.parse(readFileSync(timingsPath, "utf8"));
    const same =
      timings.scenes.length === script.scenes.length &&
      timings.scenes.every(
        (t, i) =>
          t.id === script.scenes[i].id &&
          t.lines.length === script.scenes[i].lines.length &&
          t.lines.every((l, j) => l.text === script.scenes[i].lines[j].text),
      );
    if (!same) console.warn(`warning: public/narration/${id}/timings.json is stale; re-run tools/narrate.py ${id}`);
  }
}

// Lexicon
const lexiconPath = join(root, "narration", "lexicon.json");
try {
  const lexicon = JSON.parse(readFileSync(lexiconPath, "utf8"));
  const seen = new Set();
  lexicon.terms.forEach((t, i) => {
    const at = `narration/lexicon.json term ${i} (${t.match ?? "?"})`;
    if (!t.match || !t.say) fail(at, "needs match and say");
    if (seen.has(t.match)) fail(at, "duplicate match");
    seen.add(t.match);
    if (!Array.isArray(t.heard) || t.heard.length === 0) fail(at, "needs at least one heard form for the check");
  });
  (lexicon.rules ?? []).forEach((r, i) => {
    try {
      new RegExp(r.pattern);
    } catch (e) {
      fail(`narration/lexicon.json rule ${i}`, `bad pattern: ${e.message}`);
    }
  });
} catch (e) {
  fail("narration/lexicon.json", e.message);
}

if (errors.length) {
  console.error(errors.map((e) => `error: ${e}`).join("\n"));
  process.exit(1);
}
console.log(`ok: ${ids.length} episode script(s), ${lineCount} narration lines, lexicon valid`);
