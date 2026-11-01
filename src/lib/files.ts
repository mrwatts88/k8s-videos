// Every YAML file under manifests/, loaded as text at bundle time (see the
// asset/source rule in remotion.config.ts). Code cards look files up here by
// their path from the repo root.

const context = require.context("../../manifests", true, /\.ya?ml$/);

const files: Record<string, string> = {};
for (const key of context.keys()) {
  // Keys look like "./base/golinks-deployment.yaml".
  files[`manifests/${key.replace(/^\.\//, "")}`] = context(key) as string;
}

export const readRepoFile = (path: string): string => {
  const text = files[path];
  if (text === undefined) {
    throw new Error(`Code card file not found: ${path}. Only files under manifests/ can be shown.`);
  }
  return text;
};
