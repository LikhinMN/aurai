export type SceneType = "solo" | "group" | "outdoor" | "indoor" | "unknown";

export interface PoseKeypoint {
    x: number;
    y: number;
    z: number;
    visibility: number;
}

function visibilityOrDefault(keypoint?: PoseKeypoint): number {
    if (!keypoint) return 0;
    return Number.isFinite(keypoint.visibility) ? keypoint.visibility : 1;
}

export function detectScene(poses: PoseKeypoint[][]): SceneType {
    if (!poses || poses.length === 0) return "unknown";

    // Group = 2 or more people detected
    if (poses.length >= 2) return "group";

    const keypoints = poses[0];
    if (!keypoints || keypoints.length < 33) return "solo";

    // Check visibility of outdoor indicators:
    // If wrists and ankles are all highly visible → full body → likely outdoor
    const leftWrist   = keypoints[15];
    const rightWrist  = keypoints[16];
    const leftAnkle   = keypoints[27];
    const rightAnkle  = keypoints[28];

    const fullBodyVisible =
        visibilityOrDefault(leftWrist) > 0.6 &&
        visibilityOrDefault(rightWrist) > 0.6 &&
        visibilityOrDefault(leftAnkle) > 0.6 &&
        visibilityOrDefault(rightAnkle) > 0.6;

    if (fullBodyVisible) return "outdoor";

    // If only upper body visible → likely indoor / close up
    const nose       = keypoints[0];
    const leftShoulder  = keypoints[11];
    const rightShoulder = keypoints[12];

    const upperBodyVisible =
        visibilityOrDefault(nose) > 0.7 &&
        visibilityOrDefault(leftShoulder) > 0.7 &&
        visibilityOrDefault(rightShoulder) > 0.7;

    if (upperBodyVisible) return "indoor";

    return "solo";
}

export function sceneLabel(scene: SceneType): string {
    switch (scene) {
        case "solo":    return "Solo portrait detected";
        case "group":   return "Group photo detected";
        case "outdoor": return "Outdoor scene detected";
        case "indoor":  return "Indoor scene detected";
        default:        return "Scene unknown";
    }
}