import { useEffect } from "react";
import { useWindowDimensions } from "react-native";
import {
    Canvas,
    Circle,
    Line,
    vec,
    Group,
} from "@shopify/react-native-skia";
import {
    useSharedValue,
    withTiming,
    Easing,
} from "react-native-reanimated";
import {
    CONNECTION_COLORS,
    GROUP_COLORS,
    DOT_COLOR,
    DOT_RADIUS,
    LINE_WIDTH,
} from "@/utils/skeletonConnections";
import { PoseKeypoint } from "@/utils/sceneDetector";

interface Props {
    keypoints: PoseKeypoint[][];
    minVisibility?: number;
}

export default function SkeletonOverlay({ keypoints, minVisibility = 0.4 }: Props) {
    const { width, height } = useWindowDimensions();
    const opacity = useSharedValue(0);

    // Fade in every time new keypoints arrive
    useEffect(() => {
        if (keypoints && keypoints.length > 0) {
            opacity.value = 0;
            opacity.value = withTiming(1, {
                duration: 600,
                easing: Easing.out(Easing.ease),
            });
        } else {
            opacity.value = withTiming(0, { duration: 300 });
        }
    }, [keypoints, opacity]);

    if (!keypoints || keypoints.length === 0) return null;

    const scale = (kp: PoseKeypoint) => ({
        x: kp.x * width,
        y: kp.y * height,
    });

    const isVisible = (kp: PoseKeypoint | undefined) => {
        if (!kp || !Number.isFinite(kp.x) || !Number.isFinite(kp.y)) {
            return false;
        }
        const visibility = Number.isFinite(kp.visibility) ? kp.visibility : 1;
        return visibility >= minVisibility;
    };

    return (
        <Canvas pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, width, height }}>
            <Group opacity={opacity}>
                {keypoints.map((pose, poseIndex) => (
                    <SkeletonPose
                        key={poseIndex}
                        pose={pose}
                        scale={scale}
                        isVisible={isVisible}
                    />
                ))}
            </Group>
        </Canvas>
    );
}

function SkeletonPose({
                          pose,
                          scale,
                          isVisible,
                      }: {
    pose: PoseKeypoint[];
    scale: (kp: PoseKeypoint) => { x: number; y: number };
    isVisible: (kp: PoseKeypoint) => boolean;
}) {
    return (
        <>
            {Object.entries(CONNECTION_COLORS).map(([group, connections]) =>
                connections.map(([startIdx, endIdx]) => {
                    const start = pose[startIdx];
                    const end = pose[endIdx];

                    if (!isVisible(start) || !isVisible(end)) return null;

                    const s = scale(start);
                    const e = scale(end);

                    return (
                        <Line
                            key={`${group}-${startIdx}-${endIdx}`}
                            p1={vec(s.x, s.y)}
                            p2={vec(e.x, e.y)}
                            color={GROUP_COLORS[group as keyof typeof GROUP_COLORS]}
                            strokeWidth={LINE_WIDTH}
                            style="stroke"
                        />
                    );
                })
            )}

            {pose.map((kp, idx) => {
                if (!isVisible(kp)) return null;
                const { x, y } = scale(kp);
                return (
                    <Circle
                        key={`dot-${idx}`}
                        cx={x}
                        cy={y}
                        r={DOT_RADIUS}
                        color={DOT_COLOR}
                    />
                );
            })}
        </>
    );
}