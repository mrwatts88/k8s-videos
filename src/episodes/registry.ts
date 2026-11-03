// Every episode script. Add new episodes here; the composition id is the script's id.
import type { EpisodeScript } from "../types";
import ep00 from "./ep00-what-is-kubernetes/script.json";
import ep01 from "./ep01-k3s-map/script.json";
import ep02 from "./ep02-running-the-api/script.json";
import ep03 from "./ep03-config/script.json";
import ep04 from "./ep04-database/script.json";
import ep05 from "./ep05-reaching-it/script.json";
import ep06 from "./ep06-health-probes/script.json";
import ep07 from "./ep07-logs/script.json";
import ep08 from "./ep08-tls/script.json";
import ep09 from "./ep09-auth/script.json";
import ep10 from "./ep10-end-to-end/script.json";
import ep11 from "./ep11-scaling/script.json";
import ep12 from "./ep12-kustomize/script.json";
import ep13 from "./ep13-argocd/script.json";
import testClip from "./test-clip/script.json";

const all = [testClip, ep00, ep01, ep02, ep03, ep04, ep05, ep06, ep07, ep08, ep09, ep10, ep11, ep12, ep13] as EpisodeScript[];

export const episodes: Record<string, EpisodeScript> = Object.fromEntries(all.map((s) => [s.id, s]));
