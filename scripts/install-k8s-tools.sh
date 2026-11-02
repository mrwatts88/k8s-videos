#!/usr/bin/env bash
# Installs pinned kubeconform and kubectl into .cache/bin, and Helm too when it
# isn't already on PATH (GitHub's runners ship it).
set -euo pipefail
cd "$(dirname "$0")/.."
KUBECONFORM_VERSION=v0.7.0
KUBECTL_VERSION=v1.33.0
HELM_VERSION=v3.17.3
mkdir -p .cache/bin
if [[ ! -x .cache/bin/kubeconform ]]; then
  curl -fsSL "https://github.com/yannh/kubeconform/releases/download/$KUBECONFORM_VERSION/kubeconform-linux-amd64.tar.gz" \
    | tar xz -C .cache/bin kubeconform
fi
if [[ ! -x .cache/bin/kubectl ]]; then
  curl -fsSL -o .cache/bin/kubectl "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/amd64/kubectl"
  chmod +x .cache/bin/kubectl
fi
if ! command -v helm >/dev/null && [[ ! -x .cache/bin/helm ]]; then
  curl -fsSL "https://get.helm.sh/helm-$HELM_VERSION-linux-amd64.tar.gz" \
    | tar xz -C .cache/bin --strip-components=1 linux-amd64/helm
fi
.cache/bin/kubeconform -v
.cache/bin/kubectl version --client
