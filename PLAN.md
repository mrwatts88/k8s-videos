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

The "cool" machine-to-machine example for Episode 8: the release pipeline (another
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
| Public hostname | `go.corp.internal` (with `corp.internal` in the DNS search list, `go/standup` resolves) |
| In-cluster DNS name | `golinks.golinks.svc.cluster.local` |
| Database | `postgres-0.postgres.golinks.svc.cluster.local`, database `golinks` |
| Keycloak realm | `corp`, issuer `https://sso.corp.internal/realms/corp` |
| Internal CA | `corp-internal-ca` ClusterIssuer (cert-manager) |

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
- Checks: `kubectl get configmap golinks-config -o yaml`,
  `kubectl exec ... -- env | grep DATABASE`.
- Manifests: `golinks-configmap.yaml`, `postgres-secret.yaml`.

### Episode 4: The database (Postgres StatefulSet)

- Why a database is not a Deployment: stable names, stable storage, ordered start.
- StatefulSet, `volumeClaimTemplates`, PersistentVolumeClaim, and the
  local-path provisioner creating a PersistentVolume on a node's disk.
- Headless Service (`clusterIP: None`) and the stable DNS name `postgres-0.postgres`.
- Kept basic on purpose: one replica, no replication or backups.
- Checks: `kubectl get sts,pvc,pv -n golinks`, `kubectl exec -it postgres-0 -- psql`.
- Manifests: `postgres-statefulset.yaml`, `postgres-service.yaml`.

### Episode 5: Reaching it (Service, Ingress, ServiceLB, DNS)

- ClusterIP Service: a stable virtual IP and DNS name in front of changing pods;
  EndpointSlices.
- Traefik Ingress: route `Host: go.corp.internal` to the Service.
- ServiceLB: how Traefik's own `LoadBalancer` Service gets the nodes' IPs.
- Internal DNS: the company DNS points `go.corp.internal` at those IPs, and the
  DNS search list makes `go/standup` work in a browser.
- Checks: `kubectl get svc,endpointslices,ingress -n golinks`,
  `curl -I http://go.corp.internal/standup`.
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
  - Stop Postgres: `/readyz` fails, `kubectl get pods` shows `0/1` READY,
    `kubectl get endpointslices -n golinks` shows no ready endpoints, and
    `curl` gets a `503` from Traefik; no restarts. Start Postgres; traffic returns.
  - Freeze the process: liveness fails, the RESTARTS count climbs,
    `kubectl describe pod` shows "Liveness probe failed" events.
  - Slow start: with the startup probe the pod survives a 40 s migration;
    without it, liveness kills it mid-migration.
- Manifest: the probe section of `golinks-deployment.yaml`.

### Episode 7: TLS (cert-manager and the internal CA)

- Why browsers and other services need HTTPS even inside the company.
- cert-manager: Issuer vs ClusterIssuer, a CA issuer backed by the company's
  internal CA key pair stored in a Secret.
- `Certificate` for `go.corp.internal`, or the Ingress annotation shortcut;
  the TLS Secret Traefik serves.
- Renewal is a controller too (Episode 0 again).
- Checks: `kubectl get certificate,certificaterequest -n golinks`,
  `curl -v https://go.corp.internal/standup`.

### Episode 8: Auth (Keycloak, kept light)

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

### Episode 9: One request, end to end

- Follow `https://go.corp.internal/jira/1234` from a laptop: company DNS →
  ServiceLB node IP → Traefik (TLS) → Ingress rule → Service → EndpointSlice →
  pod → Postgres → `302`.
- Then a write: release pipeline → Keycloak token → API middleware → database.
- At each hop, the `kubectl` command that proves that piece works.

### Episode 10: Kustomize

- The problem: the same app in dev and prod with small differences.
- Refactor the series' manifests into `manifests/base` plus
  `manifests/overlays/dev` and `manifests/overlays/prod` (replica counts,
  hostnames, resource sizes, image tags).
- `kubectl kustomize` to preview, `kubectl apply -k` to apply.

### Episode 11: Argo CD (GitOps)

- Git becomes the spec. Argo CD is a controller whose desired state is a path
  in a repository, which ties straight back to Episode 0's reconcile loop.
- An `Application` pointing at `manifests/overlays/prod`.
- Sync, drift detection and self-heal: someone runs `kubectl scale` by hand and
  Argo CD puts it back.
- Checks: `argocd app get golinks`, `kubectl get applications -n argocd`.

## Manifests layout

`manifests/base/` holds one file per resource and a `kustomization.yaml` from
day one, so Episode 10 only adds overlays instead of moving files. Episodes 2 to 5
add files to the base as they introduce them. cert-manager, Keycloak and Argo CD
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
    golinks-ingress.yaml
    postgres-service.yaml
    postgres-statefulset.yaml
  overlays/            (Episode 10)
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
