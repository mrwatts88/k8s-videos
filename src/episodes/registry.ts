// Every episode script. Add new episodes here; the composition id is the script's id.
import type { EpisodeScript } from "../types";
import ep00 from "./ep00-what-is-kubernetes/script.json";
import testClip from "./test-clip/script.json";

const all = [testClip, ep00] as EpisodeScript[];

export const episodes: Record<string, EpisodeScript> = Object.fromEntries(all.map((s) => [s.id, s]));
