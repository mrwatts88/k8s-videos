// Shared by remotion.config.ts (CLI and Studio) and scripts/smoke.mjs (Node API).
// Manifests are shown on code cards straight from manifests/, so the video and
// what `kubectl apply` would use never drift apart. Load them as plain text.
/** @param {import("webpack").Configuration} config */
export const webpackOverride = (config) => ({
  ...config,
  module: {
    ...config.module,
    rules: [...(config.module?.rules ?? []), { test: /\.ya?ml$/, type: "asset/source" }],
  },
});
