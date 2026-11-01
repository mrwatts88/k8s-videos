#!/usr/bin/env bash
# Validates every Kubernetes manifest in the repo against the API schemas, and
# checks that every kustomization builds. Needs kubeconform and kubectl on PATH
# (scripts/install-k8s-tools.sh puts both in .cache/bin).
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PWD/.cache/bin:$PATH"

K8S_VERSION=${K8S_VERSION:-1.33.0}
# Custom resources (cert-manager, Argo CD) are checked against the community
# CRD schema catalog once their episodes add them.
SCHEMAS=(
  -schema-location default
  -schema-location 'https://raw.githubusercontent.com/datreeio/CRDs-catalog/main/{{.Group}}/{{.ResourceKind}}_{{.ResourceAPIVersion}}.json'
)

mapfile -t files < <(find manifests -name '*.yaml' ! -name 'kustomization.yaml' | sort)
echo "kubeconform: ${#files[@]} files (Kubernetes $K8S_VERSION)"
kubeconform -strict -summary -kubernetes-version "$K8S_VERSION" "${SCHEMAS[@]}" "${files[@]}"

for k in $(find manifests -name kustomization.yaml | sort); do
  dir=$(dirname "$k")
  echo "kustomize build: $dir"
  kubectl kustomize "$dir" | kubeconform -strict -summary -kubernetes-version "$K8S_VERSION" "${SCHEMAS[@]}" -
done
