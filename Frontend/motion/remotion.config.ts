/**
 * Configuration Remotion — publicité AlloAppart.
 * Ce dossier (Frontend/motion) est totalement indépendant du build Next.js :
 * il a son propre package.json / node_modules / tsconfig.
 */
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setCodec('h264');
// CRF bas = qualité "master" pour diffusion sur Instagram / TikTok / Facebook,
// qui ré-encodent de toute façon la vidéo à l'upload.
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
Config.setConcurrency(null);
