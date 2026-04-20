# AGENTS Guide

## Project Snapshot
- Expo Router + React Native app (`main: expo-router/entry`) with TypeScript strict mode; React 19.1.0, React Native 0.81.5; current route tree is `app/_layout.tsx`, `app/index.tsx`, and `app/preview.tsx`.
- Platform targets are Android, iOS, and static web (`app.json` -> `web.output: "static"`).
- New React Native architecture and React Compiler experiment are enabled (`app.json` -> `newArchEnabled`, `experiments.reactCompiler`).

## Architecture and Data Flow
- File-based routing is the app boundary: every screen is a file under `app/`; stack navigation is declared centrally in `app/_layout.tsx` via `<Stack screenOptions={{headerShown:false}}/>`.
- `app/index.tsx` is the current entry screen; UI is rendered with React Native primitives and is the first place to validate route-level behavior.
- No global state manager exists yet; route components own flow/state, with reusable helpers in `components/MediaPipeView.tsx`, `components/SkeletonOverlay.tsx`, `utils/sceneDetector.ts`, and `utils/skeletonConnections.ts`.
- Frame analysis pattern: camera runs continuous frame callbacks via `handleAnalyzeFrame`, processes results through normalization and scene detection, updates keypoint state in `setKeypoints`.
- Skeleton rendering: `SkeletonOverlay.tsx` uses `@shopify/react-native-skia` for high-performance drawing of 33-point pose keypoints (defined in `skeletonConnections.ts`) with color-grouped connections (face, torso, arms, legs) and opacity animations via `react-native-reanimated`.

## Core Workflows
- Install deps with `npm install`.
- Main dev loop: `npm run start` (or `npm run android`, `npm run ios`, `npm run web`).
- Linting: `npm run lint` (Expo ESLint flat config from `eslint.config.js`).
- Available scripts in `package.json` are `start`, `android`, `ios`, `web`, and `lint`; `README.md` still mentions `npm run reset-project`, but that script is not present in this repo state.

## Conventions in This Repo
- TypeScript is strict; prefer explicit types when inference is unclear (`tsconfig.json` -> `compilerOptions.strict: true`).
- Use path alias `@/*` for root imports instead of long relative paths (`tsconfig.json` -> `paths`).
- Keep router-related generated typings included (`.expo/types/**/*.ts`, `expo-env.d.ts`).
- Typed routes are enabled (`app.json` -> `experiments.typedRoutes`); prefer route-safe params patterns used in `app/preview.tsx` (`useLocalSearchParams<{ uri?: string | string[] }>()`).
- ESLint ignores only `dist/*`; no custom lint rules beyond Expo defaults (`eslint.config.js`).

## Integration Points and Dependencies
- Navigation stack comes from `expo-router`; do not add React Navigation containers manually unless intentionally diverging.
- Camera capture + save flow is implemented in `app/index.tsx` with `expo-camera` and `expo-media-library` (permission check, `takePictureAsync`, and `saveToLibraryAsync`); the same screen also runs frame analysis (`handleAnalyzeFrame`/`handleAnalyzeResult`) and renders keypoints with `components/SkeletonOverlay.tsx`.
- Pose analysis runs through a hidden WebView bridge: `components/MediaPipeView.tsx` loads `assets/mediapipe.html` (bundled via `app.json` `assetBundlePatterns`) and exchanges `MODEL_READY`/`RESULT` messages with `app/index.tsx`; frame data is normalized via `normalizePoses()` which validates x/y/z/visibility fields and bounds visibility to [0, 1].
- Scene detection: `utils/sceneDetector.ts` exports `detectScene()` which classifies poses as "solo", "group" (2+ people), "outdoor" (full body visible), or "indoor" (upper body only) based on visibility thresholds of keypoint subsets (wrists, ankles for outdoor; nose, shoulders for indoor).
- Image manipulation: `expo-image-manipulator` is used in `app/index.tsx` to process captured frames before saving (referenced in `manipulateAsync` calls).
- Animations and performance: `react-native-reanimated` provides `useSharedValue`/`withTiming`/`Easing` for skeleton overlay fade effects; `react-native-worklets` may be used for future optimizations.
- Splash screen behavior is plugin-configured in `app.json` (`expo-splash-screen` block); update branding assets through `assets/images/*`.
- Deep-link scheme is `aurai` (`app.json` -> `scheme`); preserve this when adding auth/callback URLs.

## Change Guardrails for Agents
- Prefer small route-driven increments: add new screens under `app/` and wire options in `_layout.tsx` only when needed.
- Validate every change with `npm run lint` at minimum before handing off.
- When adding new commands or workflows, update both `README.md` and `package.json` so docs and scripts stay consistent.
