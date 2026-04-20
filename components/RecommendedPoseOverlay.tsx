import { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import { Canvas, Path, Skia } from "@shopify/react-native-skia";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withTiming,
    useDerivedValue,
} from "react-native-reanimated";
import { PreviewRect } from "@/utils/cameraLayout";
import {
    buildOutlineStrokes,
    OutlineStroke,
    pointsToSVGPath,
    RecommendedPoseKeypoint,
} from "@/utils/poseOutline";

interface Props {
    keypoints: RecommendedPoseKeypoint[];
    previewRect: PreviewRect;
    visible: boolean;
}

const STROKE_DRAW_DURATION = 400;
const STROKE_GAP = 100;
const STROKE_SPACING = STROKE_DRAW_DURATION + STROKE_GAP;

export default function RecommendedPoseOverlay({ keypoints, previewRect, visible }: Props) {
    const { width, height } = useWindowDimensions();
    const opacity = useSharedValue(0);
    const overlayStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
    }));

    const outlineStrokes = useMemo(() => buildOutlineStrokes(keypoints, previewRect), [keypoints, previewRect]);

    useEffect(() => {
        if (!visible || outlineStrokes.length === 0) {
            opacity.value = withTiming(0, {
                duration: 300,
                easing: Easing.out(Easing.ease),
            });
            return;
        }

        opacity.value = 0;
        opacity.value = withTiming(1, {
            duration: 180,
            easing: Easing.out(Easing.ease),
        });
    }, [outlineStrokes.length, opacity, visible]);

    if (outlineStrokes.length === 0) {
        return null;
    }

    return (
        <Animated.View pointerEvents="none" style={[styles.overlay, { width, height }, overlayStyle]}>
            <Canvas style={StyleSheet.absoluteFillObject} pointerEvents="none">
                {outlineStrokes.map((stroke, index) => (
                    <AnimatedOutlineStroke key={stroke.name} stroke={stroke} index={index} visible={visible} />
                ))}
            </Canvas>
        </Animated.View>
    );
}

function AnimatedOutlineStroke({ stroke, index, visible }: { stroke: OutlineStroke; index: number; visible: boolean }) {
    const progress = useSharedValue(0);

    const basePath = useMemo(() => {
        const svg = pointsToSVGPath(stroke.points, stroke.closed);
        return svg ? Skia.Path.MakeFromSVGString(svg) : null;
    }, [stroke.closed, stroke.points]);

    const animatedPath = useDerivedValue(() => {
        if (!basePath) {
            return Skia.Path.Make();
        }

        const trimmed = basePath.copy();
        trimmed.trim(0, progress.value, false);
        return trimmed;
    }, [basePath]);

    useEffect(() => {
        if (!basePath || !visible) {
            return;
        }

        progress.value = 0;
        progress.value = withDelay(
            index * STROKE_SPACING,
            withTiming(1, {
                duration: STROKE_DRAW_DURATION,
                easing: Easing.out(Easing.ease),
            })
        );
    }, [index, basePath, progress, visible]);

    if (!basePath) {
        return null;
    }

    return (
        <Path
            path={animatedPath}
            color="white"
            style="stroke"
            strokeWidth={3}
            strokeCap="round"
            strokeJoin="round"
        />
    );
}

const styles = StyleSheet.create({
    overlay: {
        position: "absolute",
        top: 0,
        left: 0,
    },
});


