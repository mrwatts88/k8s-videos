# Status

Update this table in every PR that touches an episode.

Stages: planned → scripted → narrated → rendered → reviewed → published

| # | Episode | Composition id | Stage | Notes |
| --- | --- | --- | --- | --- |
| – | Pipeline test clip | `test-clip` | rendered | 25 s; proves narration, captions, terminal and code cards |
| 0 | What Kubernetes actually is | `ep00-what-is-kubernetes` | planned | Needs a diagram scene type |
| 1 | The map: k3s and what it ships | `ep01-k3s-map` | planned | `namespace.yaml` exists |
| 2 | Running the API: Deployment | `ep02-deployment` | planned | `golinks-deployment.yaml` exists |
| 3 | Configuration: ConfigMap and Secret | `ep03-config` | planned | Manifests exist |
| 4 | The database: Postgres StatefulSet | `ep04-postgres` | planned | Manifests exist |
| 5 | Reaching it: Service, Ingress, ServiceLB, DNS | `ep05-networking` | planned | Manifests exist |
| 6 | TLS: cert-manager and the internal CA | `ep06-tls` | planned | |
| 7 | Auth: Keycloak, kept light | `ep07-auth` | planned | |
| 8 | One request, end to end | `ep08-end-to-end` | planned | |
| 9 | Kustomize | `ep09-kustomize` | planned | Base already in place |
| 10 | Argo CD | `ep10-argocd` | planned | |

## Pipeline

| Piece | State |
| --- | --- |
| Remotion project, title, terminal and code cards, captions | done |
| Kokoro narration (CPU) with per-line caching | done |
| Pronunciation lexicon and Whisper check | done |
| Manifest validation (kubeconform, kustomize) | done |
| CI: typecheck, lint, script checks, manifests, smoke render | done |
| Diagram scene (control plane and nodes, reconcile loop) | needed for Episode 0 |
