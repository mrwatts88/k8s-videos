// Every episode script. Add new episodes here; the composition id is the script's id.
import type { EpisodeScript } from "../types";
import ep00 from "./ep00-what-is-kubernetes/script.json";
import ep01 from "./ep01-k3s-map/script.json";
import ep02 from "./ep02-running-the-api/script.json";
import ep03 from "./ep03-config/script.json";
import testClip from "./test-clip/script.json";

const all = [testClip, ep00, ep01, ep02, ep03] as EpisodeScript[];

export const episodes: Record<string, EpisodeScript> = Object.fromEntries(all.map((s) => [s.id, s]));
