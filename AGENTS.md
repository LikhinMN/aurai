# AGENTS Guide

## Project Snapshot
- Expo Router + React Native app (`main: expo-router/entry`) with TypeScript strict mode; current route tree is `app/_layout.tsx`, `app/index.tsx`, and `app/preview.tsx`.
- Platform targets are Android, iOS, and static web (`app.json` -> `web.output: "static"`).
- New React Native architecture and React Compiler experiment are enabled (`app.json` -> `newArchEnabled`, `experiments.reactCompiler`).

## Architecture and Data Flow
- File-based routing is the app boundary: every screen is a file under `app/`; stack navigation is declared centrally in `app/_layout.tsx` via `<Stack />`.
- `app/index.tsx` is the current entry screen; UI is rendered with React Native primitives and is the first place to validate route-level behavior.
- No global state manager exists yet; route components own flow/state, with reusable helpers in `components/MediaPipeView.tsx` and `utils/sceneDetector.ts`.

## Core Workflows
- Install deps with `npm install`.
- Main dev loop: `npm run start` (or `npm run android`, `npm run ios`, `npm run web`).
- Linting: `npm run lint` (Expo ESLint flat config from `eslint.config.js`).
- `npm run reset-project` is defined in `package.json`, but `scripts/reset-project.js` is absent in this repo state; do not rely on it without adding the script.

## Conventions in This Repo
- TypeScript is strict; prefer explicit types when inference is unclear (`tsconfig.json` -> `compilerOptions.strict: true`).
- Use path alias `@/*` for root imports instead of long relative paths (`tsconfig.json` -> `paths`).
- Keep router-related generated typings included (`.expo/types/**/*.ts`, `expo-env.d.ts`).
- Typed routes are enabled (`app.json` -> `experiments.typedRoutes`); prefer route-safe params patterns used in `app/preview.tsx` (`useLocalSearchParams<{ uri?: string | string[] }>()`).
- ESLint ignores only `dist/*`; no custom lint rules beyond Expo defaults (`eslint.config.js`).

## Integration Points and Dependencies
- Navigation stack comes from `expo-router`; do not add React Navigation containers manually unless intentionally diverging.
- Camera capture + save flow is implemented in `app/index.tsx` with `expo-camera` and `expo-media-library` (permission check, `takePictureAsync`, and `saveToLibraryAsync`).
- Pose analysis runs through a hidden WebView bridge: `components/MediaPipeView.tsx` loads `assets/mediapipe.html` (bundled via `app.json` `assetBundlePatterns`) and exchanges `MODEL_READY`/`RESULT` messages with `app/index.tsx`.
- Splash screen behavior is plugin-configured in `app.json` (`expo-splash-screen` block); update branding assets through `assets/images/*`.
- Deep-link scheme is `aurai` (`app.json` -> `scheme`); preserve this when adding auth/callback URLs.

## Change Guardrails for Agents
- Prefer small route-driven increments: add new screens under `app/` and wire options in `_layout.tsx` only when needed.
- Validate every change with `npm run lint` at minimum before handing off.
- When adding new commands or workflows, update both `README.md` and `package.json` so docs and scripts stay consistent.

