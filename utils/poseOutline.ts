import { PreviewRect } from "@/utils/cameraLayout";

export interface RecommendedPoseKeypoint {
    name: string;
    x: number;
    y: number;
}

export interface OutlinePoint {
    x: number;
    y: number;
}

export interface OutlineStroke {
    name: string;
    points: OutlinePoint[];
    closed?: boolean;
}

type LandmarkName =
    | "nose"
    | "left shoulder"
    | "right shoulder"
    | "left elbow"
    | "right elbow"
    | "left wrist"
    | "right wrist"
    | "left hip"
    | "right hip"
    | "left knee"
    | "right knee"
    | "left ankle"
    | "right ankle";

const OUTLINE_ORDER: readonly LandmarkName[] = [
    "nose",
    "left shoulder",
    "right shoulder",
    "left elbow",
    "right elbow",
    "left wrist",
    "right wrist",
    "left hip",
    "right hip",
    "left knee",
    "right knee",
    "left ankle",
    "right ankle",
] as const;

const LANDMARK_LOOKUP: readonly LandmarkName[] = OUTLINE_ORDER;

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function midpoint(a: OutlinePoint, b: OutlinePoint): OutlinePoint {
    return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
    };
}

function distance(a: OutlinePoint, b: OutlinePoint): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function formatNumber(value: number): string {
    return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function normalizeName(name: string): string {
    return name.trim().toLowerCase();
}

function getScreenPoint(point: RecommendedPoseKeypoint | undefined, previewRect: PreviewRect): OutlinePoint | null {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
    }

    const x = clamp(point.x, 0, 1);
    const y = clamp(point.y, 0, 1);

    return {
        x: previewRect.x + x * previewRect.width,
        y: previewRect.y + y * previewRect.height,
    };
}

function ellipsePoints(center: OutlinePoint, radiusX: number, radiusY: number, segments = 10): OutlinePoint[] {
    const points: OutlinePoint[] = [];
    const safeSegments = Math.max(segments, 4);

    for (let index = 0; index < safeSegments; index += 1) {
        const angle = (-Math.PI / 2) + (index / safeSegments) * Math.PI * 2;
        points.push({
            x: center.x + Math.cos(angle) * radiusX,
            y: center.y + Math.sin(angle) * radiusY,
        });
    }

    return points;
}

function getNamedPointMap(keypoints: RecommendedPoseKeypoint[]): Map<string, RecommendedPoseKeypoint> {
    return keypoints.reduce((map, point) => {
        if (point) {
            map.set(normalizeName(point.name), point);
        }
        return map;
    }, new Map<string, RecommendedPoseKeypoint>());
}

function requiredScreenPoint(
    pointMap: Map<string, RecommendedPoseKeypoint>,
    name: LandmarkName,
    previewRect: PreviewRect
): OutlinePoint | null {
    return getScreenPoint(pointMap.get(normalizeName(name)), previewRect);
}

function buildStrokePoints(points: (OutlinePoint | null)[]): OutlinePoint[] {
    return points.filter((point): point is OutlinePoint => point !== null);
}

export function buildOutlineStrokes(
    keypoints: RecommendedPoseKeypoint[],
    previewRect: PreviewRect
): OutlineStroke[] {
    if (!Array.isArray(keypoints) || keypoints.length === 0) {
        return [];
    }

    if (
        !Number.isFinite(previewRect.x) ||
        !Number.isFinite(previewRect.y) ||
        !Number.isFinite(previewRect.width) ||
        !Number.isFinite(previewRect.height) ||
        previewRect.width <= 0 ||
        previewRect.height <= 0
    ) {
        return [];
    }

    const pointMap = getNamedPointMap(keypoints);
    const resolvedPoints = new Map<LandmarkName, OutlinePoint>();

    for (const name of LANDMARK_LOOKUP) {
        const screenPoint = requiredScreenPoint(pointMap, name, previewRect);
        if (!screenPoint) {
            return [];
        }
        resolvedPoints.set(name, screenPoint);
    }

    const nose = resolvedPoints.get("nose");
    const leftShoulder = resolvedPoints.get("left shoulder");
    const rightShoulder = resolvedPoints.get("right shoulder");
    const leftHip = resolvedPoints.get("left hip");
    const rightHip = resolvedPoints.get("right hip");

    if (!nose || !leftShoulder || !rightShoulder || !leftHip || !rightHip) {
        return [];
    }

    const shoulderMid = midpoint(leftShoulder, rightShoulder);
    const hipMid = midpoint(leftHip, rightHip);
    const shoulderWidth = distance(leftShoulder, rightShoulder);
    const torsoHeight = distance(shoulderMid, hipMid);

    const headRadiusX = clamp(shoulderWidth * 0.42, 16, previewRect.width * 0.22);
    const headRadiusY = clamp(Math.max(shoulderWidth * 0.52, torsoHeight * 0.24), 20, previewRect.height * 0.2);
    const headCenter = {
        x: nose.x,
        y: nose.y - headRadiusY * 0.22,
    };

    const headStroke: OutlineStroke = {
        name: "head",
        points: ellipsePoints(headCenter, headRadiusX, headRadiusY, 10),
        closed: true,
    };

    const torsoStroke: OutlineStroke = {
        name: "torso",
        points: buildStrokePoints([
            resolvedPoints.get("right shoulder") ?? null,
            resolvedPoints.get("right hip") ?? null,
            resolvedPoints.get("left hip") ?? null,
            resolvedPoints.get("left shoulder") ?? null,
        ]),
    };

    const rightArmStroke: OutlineStroke = {
        name: "right arm",
        points: buildStrokePoints([
            resolvedPoints.get("right shoulder") ?? null,
            resolvedPoints.get("right elbow") ?? null,
            resolvedPoints.get("right wrist") ?? null,
        ]),
    };

    const leftArmStroke: OutlineStroke = {
        name: "left arm",
        points: buildStrokePoints([
            resolvedPoints.get("left shoulder") ?? null,
            resolvedPoints.get("left elbow") ?? null,
            resolvedPoints.get("left wrist") ?? null,
        ]),
    };

    const rightLegStroke: OutlineStroke = {
        name: "right leg",
        points: buildStrokePoints([
            resolvedPoints.get("right hip") ?? null,
            resolvedPoints.get("right knee") ?? null,
            resolvedPoints.get("right ankle") ?? null,
        ]),
    };

    const leftLegStroke: OutlineStroke = {
        name: "left leg",
        points: buildStrokePoints([
            resolvedPoints.get("left hip") ?? null,
            resolvedPoints.get("left knee") ?? null,
            resolvedPoints.get("left ankle") ?? null,
        ]),
    };

    return [headStroke, torsoStroke, rightArmStroke, leftArmStroke, rightLegStroke, leftLegStroke].filter(
        (stroke) => stroke.points.length > 0
    );
}

export function pointsToSVGPath(points: OutlinePoint[], closed = false): string {
    if (!Array.isArray(points) || points.length === 0) {
        return "";
    }

    if (points.length === 1) {
        const point = points[0];
        return `M ${formatNumber(point.x)} ${formatNumber(point.y)}`;
    }

    if (closed) {
        const start = midpoint(points[points.length - 1], points[0]);
        const commands = [`M ${formatNumber(start.x)} ${formatNumber(start.y)}`];

        for (let index = 0; index < points.length; index += 1) {
            const current = points[index];
            const next = points[(index + 1) % points.length];
            const end = midpoint(current, next);
            commands.push(
                `Q ${formatNumber(current.x)} ${formatNumber(current.y)} ${formatNumber(end.x)} ${formatNumber(end.y)}`
            );
        }

        commands.push("Z");
        return commands.join(" ");
    }

    const commands = [`M ${formatNumber(points[0].x)} ${formatNumber(points[0].y)}`];

    for (let index = 1; index < points.length; index += 1) {
        const previous = points[index - 1];
        const current = points[index];
        const end = index === points.length - 1 ? current : midpoint(previous, current);
        commands.push(
            `Q ${formatNumber(previous.x)} ${formatNumber(previous.y)} ${formatNumber(end.x)} ${formatNumber(end.y)}`
        );
    }

    return commands.join(" ");
}

