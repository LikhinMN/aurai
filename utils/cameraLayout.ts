export interface PreviewRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type CameraAspectRatio = 'Full' | 'fullscreen' | '16:9' | '9:16' | '4:3' | '3:4' | '1:1';

interface ComputePreviewRectParams {
    windowWidth: number;
    windowHeight: number;
    aspectRatio: CameraAspectRatio;
    zoom: number;
}

const EPSILON = 0.0001;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function isFullscreenRatio(aspectRatio: CameraAspectRatio): boolean {
    return aspectRatio === 'Full' || aspectRatio === 'fullscreen';
}

function ratioToNumeric(aspectRatio: CameraAspectRatio): number {
    if (aspectRatio === '16:9') return 16 / 9;
    if (aspectRatio === '9:16') return 9 / 16;
    if (aspectRatio === '4:3') return 4 / 3;
    if (aspectRatio === '3:4') return 3 / 4;
    return 1;
}

/**
 * Computes the on-screen camera preview rect for the selected aspect ratio.
 * Zoom is represented as a centered expansion (digital crop compensation)
 * so keypoint mapping can stay in normalized [0..1] space.
 */
export function computePreviewRect({
    windowWidth,
    windowHeight,
    aspectRatio,
    zoom,
}: ComputePreviewRectParams): PreviewRect {
    const safeWindowWidth = Math.max(windowWidth, EPSILON);
    const safeWindowHeight = Math.max(windowHeight, EPSILON);

    let baseRect: PreviewRect;

    if (isFullscreenRatio(aspectRatio)) {
        baseRect = {
            x: 0,
            y: 0,
            width: safeWindowWidth,
            height: safeWindowHeight,
        };
    } else {
        const targetRatio = ratioToNumeric(aspectRatio);
        const windowRatio = safeWindowWidth / safeWindowHeight;

        let width = safeWindowWidth;
        let height = width / targetRatio;

        if (targetRatio > windowRatio) {
            width = safeWindowWidth;
            height = width / targetRatio;
        } else {
            height = safeWindowHeight;
            width = height * targetRatio;
        }

        baseRect = {
            x: (safeWindowWidth - width) / 2,
            y: (safeWindowHeight - height) / 2,
            width,
            height,
        };
    }

    const clampedZoom = clamp(zoom, 0, 1);
    const zoomScale = 1 + clampedZoom;

    return {
        x: baseRect.x - ((zoomScale - 1) * baseRect.width) / 2,
        y: baseRect.y - ((zoomScale - 1) * baseRect.height) / 2,
        width: baseRect.width * zoomScale,
        height: baseRect.height * zoomScale,
    };
}

export function getCameraAspectRatioStyle(aspectRatio: CameraAspectRatio): number | undefined {
    if (aspectRatio === '1:1') return 1;
    if (aspectRatio === '3:4') return 3 / 4;
    if (aspectRatio === '9:16') return 9 / 16;
    if (aspectRatio === '4:3') return 4 / 3;
    if (aspectRatio === '16:9') return 16 / 9;
    return undefined;
}

