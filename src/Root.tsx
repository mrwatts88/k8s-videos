import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import React from "react";
import { CalculateMetadataFunction, Composition, staticFile } from "remotion";
import { Episode, EpisodeProps } from "./Episode";
import { episodes } from "./episodes/registry";
import { FPS, estimateTiming, timingMatchesScript } from "./lib/timeline";
import timingConfig from "./timing.json";
import type { EpisodeTiming } from "./types";

/**
 * Uses public/narration/<id>/timings.json from tools/narrate.py when it exists
 * and still matches the script. Otherwise falls back to a silent estimate, so
 * the episode can still be previewed and smoke-rendered.
 */
const calculateMetadata: CalculateMetadataFunction<EpisodeProps> = async ({ props }) => {
  const script = episodes[props.episodeId];
  let timing: EpisodeTiming | null = null;
  try {
    const res = await fetch(staticFile(`narration/${props.episodeId}/timings.json`));
    if (res.ok) {
      const generated = (await res.json()) as EpisodeTiming;
      if (timingMatchesScript(generated, script)) {
        timing = generated;
      } else {
        console.warn(`${props.episodeId}: timings.json is stale, run tools/narrate.py. Using a silent estimate.`);
      }
    }
  } catch {
    // No narration generated yet.
  }
  timing ??= estimateTiming(script);
  return { durationInFrames: timing.durationInFrames, props: { ...props, timing } };
};

export const RemotionRoot: React.FC = () => (
  <>
    {Object.values(episodes).map((script) => (
      <Composition
        key={script.id}
        id={script.id}
        component={Episode}
        fps={FPS}
        width={timingConfig.width}
        height={timingConfig.height}
        durationInFrames={1}
        defaultProps={{ episodeId: script.id, timing: null }}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);
