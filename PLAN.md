# Plan: Kubernetes on k3s, one service end to end

An explainer video series that builds one small, real-feeling internal service on
Kubernetes, from "what is Kubernetes" to a TLS-secured, token-protected API that
other teams can call, deployed with GitOps.

Nothing in the videos runs against a live cluster. Each episode shows `kubectl`
commands on terminal cards and manifests on code cards, with narration explaining
what is happening. The manifests in `manifests/` are real and must validate, so a
viewer could apply them to their own k3s cluster.

## Audience and tone

- Engineers who know how to build a web service and have heard of Kubernetes, but
  do not yet have a mental model of how it works.
- Practical and calm. Each episode answers "what is this piece, why does it exist,
  and how do I know it works?"
- Explain every new term the first time it appears, in one sentence.
- Episodes are short: 5 to 10 minutes each.

## Platform: k3s as an on-prem cluster

The series treats k3s as a company's on-prem cluster. k3s is real, conformant
Kubernetes packaged as a single binary, and it ships with what a small cluster
needs, so the series never has to leave the building:

| Piece | What k3s uses | Episode |
| --- | --- | --- |
| Container networking (CNI) | Flannel | 1 |
| Cluster DNS | CoreDNS | 1, 5 |
| Ingress controller | Traefik | 1, 5 |
| Service load balancer | ServiceLB (formerly Klipper LB) | 1, 5 |
| Storage | local-path provisioner | 1, 4 |
| Datastore | SQLite by default, embedded etcd for HA | 0, 1 |

Cloud platforms (EKS and friends), other control planes and deeper stateful
topics (operators, replication, backups) are saved for later series.

## The example service: go links

An internal "go links" service. Anyone at the company types `go/standup` in a
browser and lands on the right page. It is small enough to understand in one
sentence, but it touches every piece the series needs: a stateless API, a
database, ingress, internal DNS, TLS and service-to-service auth.

### Behavior

- `GET /{name}` answers `302 Found` with `Location:` set to the saved target.
  The target can be any URI: `https://`, `mailto:`, `slack://`, and so on.
- Variables: a target can contain `{1}`, `{2}`, ... placeholders filled from the
  extra path segments. A link `jira` with target
  `https://jira.corp.internal/browse/{1}` makes `go/jira/1234` redirect to
  `https://jira.corp.internal/browse/1234`. `{*}` takes the whole remainder.
- Unknown names answer `404` with a small page that offers to create the link.
- Each redirect increments a hit counter, so `GET /api/links/{name}` can show
  how popular a link is.

### API

| Method and path | Auth | Purpose |
| --- | --- | --- |
| `GET /{name}[/{args...}]` | none (internal network) | Redirect |
| `GET /api/links` | token, scope `golinks.read` | List links |
| `GET /api/links/{name}` | token, scope `golinks.read` | One link with hit count |
| `PUT /api/links/{name}` | token, scope `golinks.write` | Create or replace a link |
| `DELETE /api/links/{name}` | token, scope `golinks.write` | Delete a link |
| `GET /healthz` | none | Liveness: the process is up |
| `GET /readyz` | none | Readiness: the database answers |

The "cool" machine-to-machine example for Episode 9: the release pipeline (another
team's service) gets a token from Keycloak with client credentials and calls
`PUT /api/links/release-notes` on every release, so `go/release-notes` always
points at the newest notes.

### Data

One Postgres table:

```sql
CREATE TABLE links (
  name        text PRIMARY KEY,   -- "jira", "standup"
  target      text NOT NULL,      -- "https://jira.corp.internal/browse/{1}"
  owner       text NOT NULL,      -- token subject that created it
  hits        bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
```

### Names and addresses used everywhere

| Thing | Value |
| --- | --- |
| Namespace | `golinks` |
| Image | `registry.corp.internal/platform/golinks:0.1.0` (placeholder; source code is out of scope) |
| App port | `8080` |
| Public hostname | `go.corp.internal` (links look like `go.corp.internal/standup`) |
| In-cluster DNS name | `golinks.golinks.svc.cluster.local` |
| Database | `postgres-0.postgres.golinks.svc.cluster.local`, database `golinks` |
| Keycloak realm | `corp`, issuer `https://sso.corp.internal/realms/corp` |
| Internal CA | `corp-ca` ClusterIssuer (cert-manager), on the cluster's intermediate CA |

## Episodes

Each outline lists what the episode teaches, the manifests it introduces and the
`kubectl` checks it shows. Scripts live in `src/episodes/<id>/script.json`.

### Episode 0: What Kubernetes actually is

The big idea before any YAML: Kubernetes is a spec for what you want, plus a set
of controllers that keep making it true. The spec itself does nothing.

- Why it exists: you have a pool of machines and you want to stop caring which
  server runs what. Kubernetes abstracts the hardware into one place to ask for
  "run three copies of this".
- Desired state: you write a spec (YAML), the API server validates it and stores
  it (in etcd, or SQLite on a small k3s). Storing it changes nothing on its own.
- Controllers and the reconcile loop: watch the spec, look at the real world,
  act to close the gap, repeat forever. Example: a ReplicaSet asks for 3 pods,
  one dies, the controller notices and a new one appears.
- The scheduler picks a node for each new pod; the kubelet on that node starts
  the containers and reports back.
- One picture: control plane (API server, datastore, scheduler, controller
  manager) and worker nodes (kubelet, container runtime, kube-proxy).
- Close with a preview of the go links service the series will build.

### Episode 1: The map (k3s and what it ships)

- k3s as the control plane and agents, in one binary; server node vs agent node.
- Tour of what comes built in: Flannel, CoreDNS, Traefik, ServiceLB,
  local-path storage. One sentence each on what problem it solves; later
  episodes go deeper.
- `kubectl get nodes -o wide`, `kubectl get pods -n kube-system`.
- Namespaces as folders for resources; create `golinks`.
- Manifest: `namespace.yaml`.

### Episode 2: Running the API (Deployment)

- Image, container port, labels and selectors.
- Deployment → ReplicaSet → Pods, tying back to Episode 0's reconcile loop.
- `replicas: 2`, rolling updates in one sentence.
- Probes in one sentence each (startup, liveness, readiness) as a preview;
  Episode 6 goes deep once the Service and database exist.
- Resource requests and limits, and what the scheduler does with requests.
- Checks: `kubectl get deploy,rs,pods -n golinks`, `kubectl describe pod`,
  `kubectl rollout status`.
- Manifest: `golinks-deployment.yaml`.

### Episode 3: Configuration (ConfigMap and Secret)

- Keep config out of the image: ConfigMap for `DATABASE_HOST`, `LOG_LEVEL`,
  Keycloak issuer URL.
- Secret for the database password; Secrets are base64-encoded, not encrypted,
  and how teams keep them out of git (mention Sealed Secrets or External
  Secrets in passing).
- `envFrom` and `secretKeyRef` in the Deployment.
- Environment variables are copied in once, when the container starts: a
  changed ConfigMap reaches running pods only after a restart
  (`kubectl rollout restart`). Files mounted from a ConfigMap do update in
  place, a minute or so later.
- First look at `kubectl logs`: the app's own startup lines show the settings
  it loaded and the level it logs at. `kubectl logs deploy/golinks` picks one
  pod; `-l app.kubernetes.io/name=golinks --prefix` reads them all; `-f`
  follows. Episode 7 covers where logs actually live.
- Checks: `kubectl get configmap golinks-config -o yaml`,
  `kubectl exec ... -- env | grep DATABASE`, `kubectl logs deploy/golinks -n golinks`.
- Manifests: `golinks-configmap.yaml`, `postgres-secret.yaml`.

### Episode 4: The database (Postgres StatefulSet)

- Why a database is not a Deployment: stable names, stable storage, ordered start.
- StatefulSet, `volumeClaimTemplates`, PersistentVolumeClaim, and the
  local-path provisioner creating a PersistentVolume on a node's disk.
- Headless Service (`clusterIP: None`) and the stable DNS name `postgres-0.postgres`.
- Kept basic on purpose: one replica, no replication or backups.
- Checks: `kubectl get sts,pvc,pv -n golinks`, `kubectl exec -it postgres-0 -- psql`,
  `kubectl logs postgres-0 -n golinks` (Postgres' own startup log), and the API
  pods turning ready on their own.
- With the pods ready, finish Episode 3's point: set `LOG_LEVEL` to `debug`,
  apply, see that the running pods still say `info`, run
  `kubectl rollout restart`, and watch the new pods log at debug level.
- Manifests: `postgres-statefulset.yaml`, `postgres-service.yaml`.

### Episode 5: Reaching it (load balancer, Ingress, Service, DNS)

Follows one request from a laptop to a pod, built from the inside out.

- ClusterIP Service: a stable virtual IP and DNS name in front of changing pods;
  EndpointSlices list only ready pods.
- ServiceLB, the load balancer built into k3s: Traefik's own `LoadBalancer`
  Service gets the nodes' IPs, and a svclb pod on every node forwards ports 80
  and 443 to Traefik.
- Traefik Ingress: route `Host: go.corp.internal` to the Service. A request
  without that host gets Traefik's own 404; with it, the app answers.
- Company DNS (not Kubernetes): the internal DNS server gives `go.corp.internal`
  one A record per node. The episode assumes those records stay current.
- Two kinds of DNS: CoreDNS answers cluster names for pods; the company DNS
  answers the names people type.
- Checks: `kubectl get svc,endpointslices -n golinks`, `kubectl describe ingress`,
  `dig +short go.corp.internal`, `curl -i http://go.corp.internal/standup`.
- Manifests: `golinks-service.yaml`, `golinks-ingress.yaml`.

### Episode 6: Health checks (startup, liveness and readiness probes)

Placed after networking on purpose: a failing readiness probe is easiest to see
as pods leaving the Service's EndpointSlice, and the database from Episode 4 is
the dependency readiness checks.

- What a probe is: the kubelet on the pod's node calls an endpoint (HTTP, TCP,
  gRPC or a command) on a schedule. Settings that matter: `periodSeconds`,
  `timeoutSeconds`, `failureThreshold` (and `successThreshold` for readiness).
  Time to act is roughly `periodSeconds × failureThreshold`.
- Startup probe:
  - Runs first; liveness and readiness wait until it succeeds once.
  - On failure: after `failureThreshold` misses the kubelet kills and restarts
    the container, like liveness.
  - Use it for slow starts (database migrations, cache warm-up) so liveness can
    stay strict afterwards. Ours allows 30 × 2 s = 60 s.
- Liveness probe:
  - "Is this process stuck beyond repair?"
  - On failure: the container is restarted. Repeated restarts show as
    `CrashLoopBackOff` with growing back-off.
  - What `/healthz` should check: only the process itself (it can serve HTTP,
    no deadlock). It must not check the database or other services; if it did,
    a database blip would restart every pod at once and make things worse.
- Readiness probe:
  - "Should this pod get traffic right now?"
  - On failure: the pod is marked not ready and removed from the Service's
    EndpointSlices, so Traefik and other callers stop sending it requests. The
    container is not restarted, and it comes back once the probe passes.
  - What `/readyz` should check: the things a request needs, with short
    timeouts (`SELECT 1` against Postgres), plus "am I shutting down?" so a pod
    can drain cleanly during a rolling update.
  - Rolling updates wait for new pods to become ready before removing old ones.
- Common mistakes: liveness that checks dependencies, a missing startup probe
  on a slow app (it gets killed before it boots), timeouts shorter than a slow
  but healthy response, and identical liveness and readiness checks.
- Demos:
  - Stop Postgres (`kubectl scale statefulset postgres --replicas=0`): `/readyz`
    fails, `kubectl get pods` shows `0/1` READY, the EndpointSlice marks both
    pods `Ready: false`, and `curl` gets Traefik's plain 404 (its Ingress
    support drops a route whose Service has no ready pods, unless
    `allowEmptyServices` is set); no restarts. Start Postgres; traffic returns.
  - Freeze the process (on the node, `sudo kill -STOP <pid>`; a signal sent
    from inside the container cannot stop PID 1): liveness fails, the RESTARTS count climbs,
    `kubectl describe pod` shows "Liveness probe failed" events, and
    `kubectl logs --previous` shows the last lines of the container that was
    killed.
  - Slow start: with the startup probe the pod survives a 40 s migration;
    without it, liveness kills it mid-migration (shown as a timeline
    diagram, not a live demo).
- Manifest: the probe section of `golinks-deployment.yaml`.

### Episode 7: Logs (where they go, on-prem)

Placed after probes: Episode 6 ends with a restarted container whose logs are
half gone, which is the question this episode answers.

- Apps write logs to stdout and stderr, one JSON object per line. They never
  write log files inside the container, and they never send logs to a service
  themselves.
- Where they land: containerd writes each container's output to a file on its
  node, under `/var/log/pods/<namespace>_<pod>_<uid>/<container>/`. The kubelet
  rotates those files (by default at 10 MiB, keeping 5).
- `kubectl logs` asks the API server, which asks that node's kubelet to read the
  file. So: one pod at a time, only what is still on that node, and
  `--previous` reaches back one restart only.
- A Service has no logs of its own; pods do. `kubectl logs svc/...` just picks
  one pod behind it.
- What is lost and when: delete the pod, or let a rolling update replace it,
  and its log files are deleted with it. Lose the node, and they go too.
  Kubernetes itself keeps no log history ("cluster-level logging" is left to
  you).
- The standard answer, on-prem:
  - A node agent as a DaemonSet (one pod per node) tails `/var/log/pods`, adds
    the namespace, pod and labels, and ships each line off the node. We use
    Grafana Alloy (Promtail, its predecessor, reached end of life in March 2026);
    Fluent Bit is the other common choice.
  - A log store inside the cluster: Grafana Loki in monolithic mode (one pod), with
    its data on a PersistentVolume (local-path in the demo; a NAS-backed
    storage class or S3-compatible storage such as MinIO in production) and a
    retention period, for example 14 days.
  - Grafana to search it: `{namespace="golinks"} |= "error"` across every pod,
    including pods that no longer exist.
  - Many companies also forward to an existing on-prem system (Elasticsearch,
    OpenSearch, Splunk or syslog to the security team's SIEM); the agent can
    send to both.
- Why not write logs to a PersistentVolume from the app: each replica would need
  its own file, nothing rotates or searches them, and a volume can only be
  mounted in some places. The sidecar pattern exists for old apps that can
  only write files, and we skip it.
- Demo: follow logs across both pods, delete one pod, `kubectl logs` can no
  longer find it, but Grafana still shows its last lines.
- Checks: `kubectl get daemonset -n logging`, `kubectl logs -n logging ds/alloy`,
  a LogQL query in Grafana.
- Manifests: one k3s HelmChart resource each for Loki, Alloy and Grafana in
  `manifests/logging/`, values inline, so nothing outside the cluster is
  needed. Loki's and Grafana's charts now live in the community repository
  (`https://grafana-community.github.io/helm-charts`, since early 2026);
  Alloy's is still at `https://grafana.github.io/helm-charts`. CI renders each
  chart with its pinned version and values (`npm run check:helm`) and validates
  the output.
- As built: the Grafana admin password is generated by the chart and read back
  from its Secret (ties to Episode 3's base64), and the LogQL demo finds the
  Episode 6 database outage, because Alloy reads existing files from the start.

### Episode 8: TLS (cert-manager and the internal CA)

- Why browsers and other services need HTTPS even inside the company.
- cert-manager: Issuer vs ClusterIssuer, a CA issuer backed by the company's
  internal CA key pair stored in a Secret.
- `Certificate` for `go.corp.internal`, or the Ingress annotation shortcut;
  the TLS Secret Traefik serves.
- Renewal is a controller too (Episode 0 again).
- Checks: `kubectl get certificate,certificaterequest -n golinks`,
  `curl -v https://go.corp.internal/standup`.
- As built: cert-manager v1.21.3 from Jetstack's chart as a k3s HelmChart with
  its CRDs, in `manifests/cert-manager/`. The `corp-ca` ClusterIssuer lives in
  `manifests/cert-manager/issuers/`, applied second because its kind only
  exists once the chart is installed. Its Secret holds the cluster's
  intermediate CA (signed by the company root, kept offline) and is created by
  hand, never committed. The golinks Certificate (90 days, renewing 30 days
  before expiry, ECDSA key) is in the base, which now needs cert-manager first.
  Grafana gets its certificate through the Ingress annotation shortcut. The
  curl demo still gets a 404, since links are only created from Episode 9.
  CI validates the chart's CustomResourceDefinitions too.

### Episode 9: Auth (Keycloak, kept light)

- The company has a Keycloak realm, `corp`. Keycloak issues tokens; the API
  checks them.
- Client credentials: the release pipeline is a confidential client with an id
  and secret; it asks Keycloak for an access token (a JWT) with the
  `golinks.write` scope.
- The API verifies the token in its own middleware: signature against
  Keycloak's public keys (JWKS), issuer, audience, expiry, scope.
- Where else tokens can be checked, in passing: at the ingress (a Traefik
  middleware) or in a service mesh (for example Istio's RequestAuthentication).
- Clear up a common mix-up: Kubernetes' own auth and RBAC control who can use
  the cluster API (`kubectl`), not who can call your product.
- Checks: `curl` the token endpoint, then `PUT /api/links/release-notes` with
  and without the token (201 vs 401).

### Episode 10: One request, end to end

- Follow `https://go.corp.internal/jira/1234` from a laptop: company DNS →
  ServiceLB node IP → Traefik (TLS) → Ingress rule → Service → EndpointSlice →
  pod → Postgres → `302`.
- Then a write: release pipeline → Keycloak token → API middleware → database.
- At each hop, the `kubectl` command that proves that piece works.

### Episode 11: Kustomize

- The problem: the same app in dev and prod with small differences.
- Refactor the series' manifests into `manifests/base` plus
  `manifests/overlays/dev` and `manifests/overlays/prod` (replica counts,
  hostnames, resource sizes, image tags).
- `kubectl kustomize` to preview, `kubectl apply -k` to apply.

### Episode 12: Argo CD (GitOps)

- Git becomes the spec. Argo CD is a controller whose desired state is a path
  in a repository, which ties straight back to Episode 0's reconcile loop.
- An `Application` pointing at `manifests/overlays/prod`.
- Sync, drift detection and self-heal: someone runs `kubectl scale` by hand and
  Argo CD puts it back.
- Checks: `argocd app get golinks`, `kubectl get applications -n argocd`.

## Manifests layout

`manifests/base/` holds one file per resource and a `kustomization.yaml` from
day one, so Episode 11 only adds overlays instead of moving files. Episodes 2 to 5
add files to the base as they introduce them. Logging, cert-manager, Keycloak and Argo CD
resources go in their own folders when their episodes are built.

```
manifests/
  base/
    kustomization.yaml
    namespace.yaml
    golinks-configmap.yaml
    postgres-secret.yaml
    golinks-deployment.yaml
    golinks-service.yaml
    golinks-certificate.yaml (Episode 8)
    golinks-ingress.yaml
    postgres-service.yaml
    postgres-statefulset.yaml
  logging/             (Episode 7: HelmChart resources for Loki, Alloy, Grafana)
  cert-manager/        (Episode 8: the cert-manager HelmChart)
    issuers/           (Episode 8: the corp-ca ClusterIssuer, applied second)
  overlays/            (Episode 11)
    dev/
    prod/
```

## Video format

- 1920x1080, 30 fps, H.264 MP4 with AAC audio.
- Dark theme, colors and fonts in `src/theme.ts`. Inter for text, JetBrains
  Mono for code; both are bundled from npm, so renders never depend on system
  fonts.
- Narration: Kokoro-82M (ONNX, CPU) through `kokoro-onnx`, default voice
  `af_heart` at speed 0.92 (`defaultSpeed` in `src/timing.json`), overridable
  per episode in `script.json`.
- One narration line is one sentence, short enough for a two-line caption.
  Captions show the current line, split into chunks if it is long.
- Spoken text can differ from caption text. The `say` field on a line, and the
  shared lexicon in `narration/lexicon.json`, turn `kubectl` into "cube control",
  `k3s` into "k three s", and so on.
- Scene types, all data-driven from `script.json`:
  - `title`: episode number, title, subtitle.
  - `terminal`: commands typed out with their output, each step appearing when
    a given narration line starts.
  - `code`: a manifest file from `manifests/` with line ranges highlighted in
    step with narration.
  - `diagram`: boxes and arrows that appear, change color, take focus or
    carry a moving dot as narration goes, used for the control plane and
    node picture and the reconcile loop.
- Pacing is unhurried, for people learning. Every scene has a lead-in and
  tail, lines are separated by a half-second gap, and a line can add
  `pauseAfter` seconds of silence when a point needs to land.
- Terminal cards type each command, hold a beat with the cursor still on the
  command line, then print the output. The next narration line waits until the
  output has been on screen long enough to read. The constants live in
  `src/timing.json`; `src/lib/timeline.ts` and `tools/layout.py` both read them
  and CI checks that the two produce the same timeline.
