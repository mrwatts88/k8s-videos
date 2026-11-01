// Every episode script. Add new episodes here; the composition id is the script's id.
import type { EpisodeScript } from "../types";
import testClip from "./test-clip/script.json";

const all = [testClip] as EpisodeScript[];

export const episodes: Record<string, EpisodeScript> = Object.fromEntries(all.map((s) => [s.id, s]));
