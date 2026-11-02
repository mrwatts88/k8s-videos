// Renders every k3s HelmChart resource under manifests/ with Helm, using the
// chart, version and values it names, and validates what comes out with
// kubeconform. This catches values the chart rejects and objects the API
// server would refuse, without a cluster.
//
// Needs helm and kubeconform on PATH (scripts/install-k8s-tools.sh). To try a
// local copy of a chart instead of its repository, set CHART_PATH_<CHART> (for
// example CHART_PATH_LOKI=../helm-charts/charts/loki).
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import yaml from "js-yaml";

const K8S_VERSION = process.env.K8S_VERSION ?? "1.33.0";
const SCHEMAS = [
  "-schema-location", "default",
  "-schema-location",
  "https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json",
];

function yamlFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return yamlFiles(p);
    return p.endsWith(".yaml") && name !== "kustomization.yaml" ? [p] : [];
  });
}

const tmp = mkdtempSync(join(tmpdir(), "helmcharts-"));
let count = 0;
for (const file of yamlFiles("manifests").sort()) {
  for (const doc of yaml.loadAll(readFileSync(file, "utf8"))) {
    if (doc?.kind !== "HelmChart") continue;
    const { repo, chart, version, targetNamespace, valuesContent = "" } = doc.spec;
    const values = join(tmp, `${doc.metadata.name}.yaml`);
    writeFileSync(values, valuesContent);
    const local = process.env[`CHART_PATH_${chart.toUpperCase().replace(/-/g, "_")}`];
    const source = local ? [local] : [chart, "--repo", repo, "--version", version];
    console.log(`helm template: ${file} (${chart} ${local ? `from ${local}` : version})`);
    const rendered = execFileSync(
      "helm",
      ["template", doc.metadata.name, ...source, "--namespace", targetNamespace, "--kube-version", K8S_VERSION, "-f", values],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    );
    execFileSync("kubeconform", ["-strict", "-summary", "-kubernetes-version", K8S_VERSION, ...SCHEMAS, "-"], {
      input: rendered,
      stdio: ["pipe", "inherit", "inherit"],
    });
    count++;
  }
}
console.log(`ok: ${count} Helm chart(s) rendered and valid`);
