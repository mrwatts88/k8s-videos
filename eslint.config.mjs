import { config } from "@remotion/eslint-config-flat";

export default [
  { ignores: ["node_modules", "out", "public", ".cache", ".venv", "build"] },
  ...config,
  {
    // Node scripts.
    files: ["scripts/**/*.mjs", "*.mjs"],
    languageOptions: { globals: { process: "readonly", console: "readonly" } },
  },
];
