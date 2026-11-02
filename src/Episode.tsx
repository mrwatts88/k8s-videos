import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Sequence, continueRender, delayRender, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Captions } from "./components/Captions";
import { CodeCard } from "./components/CodeCard";
import { DiagramCard } from "./components/DiagramCard";
import { TerminalCard } from "./components/TerminalCard";
import { TitleCard } from "./components/TitleCard";
import { episodes } from "./episodes/registry";
import { readRepoFile } from "./lib/files";
import { activeLineIndex, lineStart } from "./lib/timeline";
import { theme } from "./theme";
import type { EpisodeTiming, Scene, SceneTiming } from "./types";

export type EpisodeProps = {
  episodeId: string;
  /** Filled in by calculateMetadata in Root.tsx. */
  timing: EpisodeTiming | null;
};

const SCENE_FADE = 8;

const useFonts = () => {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    Promise.all([
      document.fonts.load("500 38px Inter"),
      document.fonts.load("700 96px Inter"),
      document.fonts.load("400 28px 'JetBrains Mono'"),
    ])
      .then(() => continueRender(handle))
      .catch(() => continueRender(handle));
  }, [handle]);
};

export const Episode: React.FC<EpisodeProps> = ({ episodeId, timing }) => {
  useFonts();
  const script = episodes[episodeId];
  if (!script || !timing) throw new Error(`No script or timing for episode ${episodeId}`);
  return (
    <AbsoluteFill style={{ background: theme.bg, fontVariantLigatures: "none" }}>
      <Backdrop />
      {timing.audio ? <Audio src={staticFile(timing.audio)} /> : null}
      {script.scenes.map((scene, i) => {
        const t = timing.scenes[i];
        return (
          <Sequence key={scene.id} from={t.from} durationInFrames={t.durationInFrames} name={scene.id}>
            <SceneView scene={scene} timing={t} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1400px 900px at 50% 35%, ${theme.bgGlow} 0%, ${theme.bg} 70%)`,
    }}
  />
);

const SceneView: React.FC<{ scene: Scene; timing: SceneTiming }> = ({ scene, timing }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, SCENE_FADE, timing.durationInFrames - SCENE_FADE, timing.durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const startOf = (at: number) => lineStart(timing, at);

  let body: React.ReactNode;
  switch (scene.type) {
    case "title":
      body = <TitleCard frame={frame} kicker={scene.kicker} title={scene.title} subtitle={scene.subtitle} />;
      break;
    case "terminal":
      body = (
        <TerminalCard
          frame={frame}
          title={scene.title ?? "~"}
          prompt={scene.prompt ?? "$"}
          steps={scene.steps.map((s) => ({ startFrame: startOf(s.at), command: s.command, output: s.output ?? [] }))}
        />
      );
      break;
    case "code":
      body = (
        <CodeCard
          frame={frame}
          file={scene.file}
          source={readRepoFile(scene.file)}
          range={scene.range}
          highlights={(scene.highlights ?? []).map((h) => ({ startFrame: startOf(h.at), lines: h.lines }))}
        />
      );
      break;
    case "diagram":
      body = (
        <DiagramCard
          frame={frame}
          title={scene.title}
          boxes={scene.boxes}
          arrows={scene.arrows ?? []}
          steps={(scene.steps ?? []).map((s) => ({ ...s, startFrame: startOf(s.at) }))}
        />
      );
      break;
  }

  return (
    <AbsoluteFill data-active-line={activeLineIndex(timing, frame)}>
      <AbsoluteFill style={{ opacity, alignItems: "center", justifyContent: "center", paddingBottom: 90 }}>
        {body}
      </AbsoluteFill>
      <Captions frame={frame} lines={timing.lines} />
    </AbsoluteFill>
  );
};
