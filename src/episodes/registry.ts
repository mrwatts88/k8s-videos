// Every episode script. Add new episodes here; the composition id is the script's id.
import type { EpisodeScript } from "../types";
import ep00 from "./ep00-what-is-kubernetes/script.json";
import ep01 from "./ep01-k3s-map/script.json";
import testClip from "./test-clip/script.json";

const all = [testClip, ep00, ep01] as EpisodeScript[];

export const episodes: Record<string, EpisodeScript> = Object.fromEntries(all.map((s) => [s.id, s]));
