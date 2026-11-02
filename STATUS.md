# Status

Update this table in every PR that touches an episode.

Stages: planned → scripted → narrated → rendered → reviewed → published

| # | Episode | Composition id | Stage | Notes |
| --- | --- | --- | --- | --- |
| – | Pipeline test clip | `test-clip` | rendered | 29 s at the slower pacing; proves narration, captions, terminal and code cards |
| 0 | What Kubernetes actually is | `ep00-what-is-kubernetes` | rendered | About 4 min; 10 scenes, 6 of them diagrams; pronunciation check clean |
| 1 | The map: k3s and what it ships | `ep01-k3s-map` | rendered | About 4 min 45 s; 11 scenes, 3 of them diagrams; pronunciation check clean apart from "a hundred" written as "100" |
| 2 | Running the API: Deployment | `ep02-running-the-api` | rendered | About 5 min 30 s; 13 scenes, 4 of them diagrams; pronunciation check clean apart from possessives written without the apostrophe |
| 3 | Configuration: ConfigMap and Secret | `ep03-config` | rendered | About 4 min; 11 scenes, 3 of them diagrams; first `kubectl logs`; pronunciation check clean |
| 4 | The database: Postgres StatefulSet | `ep04-database` | rendered | About 6 min; 13 scenes, 2 of them diagrams; no operator, one replica; LOG_LEVEL restart demo; pronunciation check clean |
| 5 | Reaching it: load balancer, Ingress, Service, DNS | `ep05-reaching-it` | rendered | About 5 min 20 s; 13 scenes, 3 of them diagrams; ServiceLB, Traefik Ingress, company DNS; pronunciation check clean |
| 6 | Health checks: startup, liveness and readiness probes | `ep06-health-probes` | rendered | About 6 min 40 s; 14 scenes, 5 of them diagrams; database-down and frozen-process demos; pronunciation check clean |
| 7 | Logs: where they go, on-prem | `ep07-logs` | rendered | About 7 min; 18 scenes, 6 of them diagrams; Alloy, Loki and Grafana as k3s HelmCharts; delete-a-pod demo; pronunciation check clean apart from "336 hours" written as digits |
| 8 | TLS: cert-manager and the internal CA | `ep08-tls` | rendered | About 8.5 min; 18 scenes, 4 of them diagrams; cert-manager as a k3s HelmChart, a corp-ca ClusterIssuer on the cluster's intermediate CA, an explicit Certificate for go and the annotation shortcut for Grafana; pronunciation check clean |
| 9 | Auth: Keycloak, kept light | `ep09-auth` | rendered | About 9 min; 18 scenes, 7 of them diagrams; client credentials for the release pipeline, a decoded JWT, the five checks (401 vs 403), the company root CA mounted from a ConfigMap, first links (release-notes, standup); pronunciation check clean |
| 10 | One request, end to end | `ep10-end-to-end` | rendered | About 6.5 min; 16 scenes, 5 of them diagrams; follows go/jira/1234 hop by hop with the command that proves each hop, the same trip on the three machines, a write on the same road, and a symptom-to-hop debugging table; pronunciation check clean |
| 11 | Scaling: HPA, and node autoscaling in concept | `ep11-scaling` | rendered | About 7 min 45 s; 13 scenes, 4 of them diagrams; kubectl top, the HPA manifest and its math, replicas out of the Deployment, a load test that scales 2 to 6 and back, the nodes as the ceiling, node autoscaling as a concept; pronunciation check clean apart from numbers written as digits |
| 12 | Kustomize | `ep12-kustomize` | rendered | About 6.5 min; 14 scenes, 4 of them diagrams; prod and dev overlays, strategic merge and JSON patches, `kubectl kustomize` preview, the namespace trap in the database host, `kubectl diff -k` and `apply -k`; pronunciation check clean apart from words Whisper splits (name space, host name) |
| 13 | Argo CD | `ep13-argocd` | planned | |

## Pipeline

| Piece | State |
| --- | --- |
| Remotion project, title, terminal and code cards, captions | done |
| Kokoro narration (CPU) with per-line caching | done |
| Pronunciation lexicon and Whisper check | done |
| Manifest validation (kubeconform, kustomize) | done |
| CI: typecheck, lint, script checks, manifests, smoke render | done |
| Slower pacing: line gaps, a beat after typed commands, `pauseAfter` | done |
| Diagram scene (boxes, arrows, focus, flow) | done |
| Terminal lines wrap at 79 characters, like a real terminal | done |
