import { Config } from "@remotion/cli/config";
import { webpackOverride } from "./webpack-override.mjs";

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(4);
Config.setCodec("h264");
Config.setAudioCodec("aac");
Config.setChromiumOpenGlRenderer("swangle");
Config.overrideWebpackConfig(webpackOverride);
