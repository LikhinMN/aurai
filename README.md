# Aurai

Aurai is a camera-first Expo app that detects human poses, classifies the scene, and can suggest improved poses for better photos. It combines real-time pose estimation (MediaPipe via a hidden WebView) with a skeleton overlay and optional AI-based pose recommendations.

## Features

- Live camera preview with capture, timer, and aspect ratio controls.
- Pose detection and skeleton overlay using MediaPipe and Skia.
- Scene classification (solo, group, indoor, outdoor).
- Photo capture and gallery preview.
- Optional pose recommendations backed by an Ollama model endpoint.

## Getting started

### Prerequisites

- Node.js 18+ and npm
- Expo Go or a development build for running on device

### Install dependencies

```bash
npm install
```

### Run the app

```bash
npm run start
```

Then choose a platform:

- `npm run android`
- `npm run ios`
- `npm run web`

## App permissions

The app requests camera access for pose detection and photo capture. It also requests media library access to save captured photos.

## Pose analysis flow

- `components/MediaPipeView.tsx` loads `assets/mediapipe.html` in a hidden WebView.
- The camera captures a frame and posts it to MediaPipe for pose detection.
- `utils/sceneDetector.ts` classifies the detected pose into a scene type.
- `components/SkeletonOverlay.tsx` renders the 33-point skeleton overlay.

## Pose recommendations (Ollama)

Pose recommendations are powered by an Ollama endpoint defined in `utils/ollamaService.ts`:

- Update `OLLAMA_HOST` to point to your Ollama server.
- Update `OLLAMA_MODEL` to the model you want to use.

The recommendation uses the detected keypoints plus the captured frame to return a suggested pose and description.

## Project structure

- `app/` — route-based screens (`index.tsx`, `preview.tsx`)
- `components/` — camera overlays and MediaPipe bridge
- `utils/` — scene detection, camera layout helpers, Ollama integration
- `assets/` — static assets and `mediapipe.html`

## Scripts

- `npm run start` — start Expo dev server
- `npm run android` — launch on Android
- `npm run ios` — launch on iOS
- `npm run web` — launch on web
- `npm run lint` — run Expo lint

## Troubleshooting

- If `expo` is not found, run `npm install` first or use `npx expo start`.
- MediaPipe needs the bundled `assets/mediapipe.html`; ensure assets are included when publishing.
