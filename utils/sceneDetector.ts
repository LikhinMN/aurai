export type SceneType = "solo" | "group" | "outdoor" | "indoor" | "unknown";

export interface PoseKeypoint {
    x: number;
    y: number;
    z: number;
    visibility: number;
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
        leftWrist?.visibility  > 0.6 &&
        rightWrist?.visibility > 0.6 &&
        leftAnkle?.visibility  > 0.6 &&
        rightAnkle?.visibility > 0.6;

    if (fullBodyVisible) return "outdoor";

    // If only upper body visible → likely indoor / close up
    const nose       = keypoints[0];
    const leftShoulder  = keypoints[11];
    const rightShoulder = keypoints[12];

    const upperBodyVisible =
        nose?.visibility         > 0.7 &&
        leftShoulder?.visibility > 0.7 &&
        rightShoulder?.visibility > 0.7;

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