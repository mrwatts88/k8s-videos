#!/usr/bin/env bash
# Installs pinned kubeconform and kubectl into .cache/bin.
set -euo pipefail
cd "$(dirname "$0")/.."
KUBECONFORM_VERSION=v0.7.0
KUBECTL_VERSION=v1.33.0
mkdir -p .cache/bin
if [[ ! -x .cache/bin/kubeconform ]]; then
  curl -fsSL "https://github.com/yannh/kubeconform/releases/download/$KUBECONFORM_VERSION/kubeconform-linux-amd64.tar.gz" \
    | tar xz -C .cache/bin kubeconform
fi
if [[ ! -x .cache/bin/kubectl ]]; then
  curl -fsSL -o .cache/bin/kubectl "https://dl.k8s.io/release/$KUBECTL_VERSION/bin/linux/amd64/kubectl"
  chmod +x .cache/bin/kubectl
fi
.cache/bin/kubeconform -v
.cache/bin/kubectl version --client
