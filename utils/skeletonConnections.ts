// MediaPipe Pose returns 33 keypoints, indexed 0–32
// This defines which points connect to draw a human skeleton

export const CONNECTIONS: [number, number][] = [
    // Face
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],

    // Torso
    [11, 12], // shoulders
    [11, 23], // left shoulder → left hip
    [12, 24], // right shoulder → right hip
    [23, 24], // hips

    // Left arm
    [11, 13], // shoulder → elbow
    [13, 15], // elbow → wrist
    [15, 17], // wrist → pinky
    [15, 19], // wrist → index
    [15, 21], // wrist → thumb

    // Right arm
    [12, 14],
    [14, 16],
    [16, 18],
    [16, 20],
    [16, 22],

    // Left leg
    [23, 25], // hip → knee
    [25, 27], // knee → ankle
    [27, 29], // ankle → heel
    [27, 31], // ankle → foot index

    // Right leg
    [24, 26],
    [26, 28],
    [28, 30],
    [28, 32],
];

// Color groups for different body parts
export const CONNECTION_COLORS: Record<string, [number, number][]> = {
    face:  [[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8]],
    torso: [[11,12],[11,23],[12,24],[23,24]],
    arms:  [[11,13],[13,15],[15,17],[15,19],[15,21],[12,14],[14,16],[16,18],[16,20],[16,22]],
    legs:  [[23,25],[25,27],[27,29],[27,31],[24,26],[26,28],[28,30],[28,32]],
};

// Color per body part group
export const GROUP_COLORS = {
    face:  "#A78BFA", // soft purple
    torso: "#818CF8", // indigo
    arms:  "#38BDF8", // sky blue
    legs:  "#34D399", // emerald
};

export const DOT_COLOR  = "#FFFFFF";
export const DOT_RADIUS = 4;
export const LINE_WIDTH  = 2;