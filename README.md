# k8s-videos

An explainer video series that builds one internal service, a "go links"
redirector, on k3s: Deployment, config, Postgres, ingress and DNS, TLS, Keycloak
auth, then Kustomize and Argo CD. Videos are made with
[Remotion](https://www.remotion.dev/) and narrated with
[Kokoro](https://github.com/thewh1teagle/kokoro-onnx) text-to-speech on CPU.

- `PLAN.md`: the series, episode by episode, and the example service
- `STATUS.md`: where each episode stands
- `AGENTS.md`: repo layout, how to add an episode, render, and run the checks

Quick start:

```bash
npm ci
npm run setup:python
npm run narrate -- test-clip
npm run render -- test-clip     # out/test-clip.mp4
```
