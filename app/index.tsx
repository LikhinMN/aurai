import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Feather } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BlurView } from 'expo-blur';
import { ActivityIndicator, Button, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import MediaPipeView from '@/components/MediaPipeView';
import { detectScene, sceneLabel, SceneType, PoseKeypoint } from '@/utils/sceneDetector';
import SkeletonOverlay from "@/components/SkeletonOverlay";
import { CameraAspectRatio, computePreviewRect, getCameraAspectRatioStyle } from '@/utils/cameraLayout';
import { getRecommendedPose, RecommendedPose } from '@/utils/ollamaService';

type PoseResult = {
    poses: unknown[];
    worldPoses: unknown[];
};

function normalizePoses(poses: unknown[]): PoseKeypoint[][] {
    return poses
        .map((pose) => {
            if (!Array.isArray(pose)) {
                return [];
            }

            return pose
                .map((point) => {
                    if (!point || typeof point !== 'object') {
                        return null;
                    }

                    const maybePoint = point as Partial<PoseKeypoint>;
                    const x = maybePoint.x;
                    const y = maybePoint.y;

                    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
                        return null;
                    }

                    const z = typeof maybePoint.z === 'number' && Number.isFinite(maybePoint.z) ? maybePoint.z : 0;
                    const visibilityRaw =
                        typeof maybePoint.visibility === 'number' && Number.isFinite(maybePoint.visibility)
                            ? maybePoint.visibility
                            : 1;

                    return {
                        x,
                        y,
                        z,
                        visibility: Math.max(0, Math.min(1, visibilityRaw)),
                    };
                })
                .filter((point): point is PoseKeypoint => point !== null);
        })
        .filter((pose): pose is PoseKeypoint[] => pose.length > 0);
}

export default function Index() {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const router = useRouter();
    const [facing, setFacing] = useState<CameraType>('back');
    const [flashMode, setFlashMode] = useState<'on' | 'off' | 'auto'>('off');
    const [permission, requestPermission] = useCameraPermissions();
    const [zoom, setZoom] = useState(0);
    const [activeZoom, setActiveZoom] = useState(1);
    const cameraRef = useRef<CameraView>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureStatus, setCaptureStatus] = useState<string | null>(null);
    const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRecommending, setIsRecommending] = useState(false);
    const [analyzeStageLabel, setAnalyzeStageLabel] = useState<string | null>(null);
    const [isModelReady, setIsModelReady] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeRatio, setActiveRatio] = useState<CameraAspectRatio>('Full');
    const [activeTimer, setActiveTimer] = useState('off');
    const [countdown, setCountdown] = useState<number | null>(null);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const [lastBase64, setLastBase64] = useState<string | null>(null);
    const [, setRecommendedPose] = useState<RecommendedPose | null>(null);
    const [keypoints, setKeypoints] = useState<PoseKeypoint[][]>([]);
    const [scene, setScene] = useState<SceneType>('unknown');
    const mediaPipeRef = useRef<{ postMessage: (data: string) => void } | null>(null);
    const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const previewRect = useMemo(
        () =>
            computePreviewRect({
                windowWidth,
                windowHeight,
                aspectRatio: activeRatio,
                zoom,
            }),
        [windowWidth, windowHeight, activeRatio, zoom]
    );

    const cameraAspectRatio = getCameraAspectRatioStyle(activeRatio);

    useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
            if (analyzeTimeoutRef.current) {
                clearTimeout(analyzeTimeoutRef.current);
            }
            if (countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
            }
        };
    }, []);

    const clearAnalyzeTimeout = () => {
        if (analyzeTimeoutRef.current) {
            clearTimeout(analyzeTimeoutRef.current);
            analyzeTimeoutRef.current = null;
        }
    };

    const clearStatusAfterDelay = () => {
        if (statusTimeoutRef.current) {
            clearTimeout(statusTimeoutRef.current);
        }
        statusTimeoutRef.current = setTimeout(() => {
            setCaptureStatus(null);
        }, 3000);
    };

    const toggleFacing = () => {
        setFacing((current) => (current === 'back' ? 'front' : 'back'));
    };

    const capturePhoto = async () => {
        if (!cameraRef.current) {
            return;
        }

        setIsCapturing(true);
        setCaptureStatus(null);

        try {
            const photo = await cameraRef.current.takePictureAsync();

            if (!photo?.uri) {
                setCaptureStatus('Could not capture photo. Please try again.');
                clearStatusAfterDelay();
                return;
            }

            let finalUri = photo.uri;

            if (activeRatio !== 'Full') {
                const [rWidth, rHeight] = activeRatio.split(':').map(Number);
                const targetRatio = rWidth / rHeight;
                
                const { width, height } = photo;
                let cropWidth = width;
                let cropHeight = height;
                let originX = 0;
                let originY = 0;

                // Adjust for orientation (photo might be portrait or landscape)
                // expo-camera usually returns the photo with dimensions relative to sensor
                // We want to match the visual ratio.
                if (width / height > targetRatio) {
                    cropWidth = height * targetRatio;
                    originX = (width - cropWidth) / 2;
                } else {
                    cropHeight = width / targetRatio;
                    originY = (height - cropHeight) / 2;
                }

                const result = await manipulateAsync(
                    photo.uri,
                    [{ crop: { originX, originY, width: cropWidth, height: cropHeight } }],
                    { format: SaveFormat.JPEG, compress: 0.9 }
                );
                finalUri = result.uri;
            }

            setCapturedPhotos((prev) => [finalUri, ...prev]);

            let mediaPermission = await MediaLibrary.getPermissionsAsync();
            if (!mediaPermission.granted) {
                mediaPermission = await MediaLibrary.requestPermissionsAsync();
            }

            if (!mediaPermission.granted) {
                setCaptureStatus('Storage permission denied. Photo was not saved.');
                clearStatusAfterDelay();
                return;
            }

            await MediaLibrary.saveToLibraryAsync(finalUri);
            setCaptureStatus('Photo saved to your library.');
            clearStatusAfterDelay();
        } catch {
            setCaptureStatus('Failed to capture photo. Please try again.');
            clearStatusAfterDelay();
        } finally {
            setIsCapturing(false);
        }
    };

    const handleTakePhotoPress = () => {
        if (isCapturing || !cameraRef.current || countdown !== null) {
            return;
        }

        if (activeTimer !== 'off') {
            const seconds = parseInt(activeTimer, 10);
            if (!isNaN(seconds)) {
                let timeLeft = seconds;
                setCountdown(timeLeft);
                countdownIntervalRef.current = setInterval(() => {
                    timeLeft -= 1;
                    if (timeLeft > 0) {
                        setCountdown(timeLeft);
                    } else {
                        if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
                        setCountdown(null);
                        capturePhoto();
                    }
                }, 1000);
                return;
            }
        }
        capturePhoto();
    };

    const handleOpenPreview = () => {
        if (capturedPhotos.length === 0) {
            return;
        }

        router.push({ pathname: '/preview', params: { uris: JSON.stringify(capturedPhotos) } });
    };

    const handleAnalyzeFrame = async () => {
        if (isCapturing || isAnalyzing || !cameraRef.current || !mediaPipeRef.current) {
            return;
        }

        if (!isModelReady) {
            setCaptureStatus('Model is still loading. Try again in a moment.');
            clearStatusAfterDelay();
            return;
        }

        setIsAnalyzing(true);
        setAnalyzeStageLabel('Capturing frame...');
        setCaptureStatus('Capturing frame for analysis...');
        clearAnalyzeTimeout();

        try {
            const photo = await cameraRef.current.takePictureAsync({ base64: true, quality: 0.5 });

            if (!photo?.base64) {
                setIsAnalyzing(false);
                setAnalyzeStageLabel(null);
                setCaptureStatus('Failed to get base64 string.');
                clearStatusAfterDelay();
                return;
            }

            const normalizedBase64 = photo.base64.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, '');
            setLastBase64(normalizedBase64);

            mediaPipeRef.current.postMessage(
                JSON.stringify({
                    type: 'ANALYZE',
                    image: `data:image/jpeg;base64,${photo.base64}`,
                })
            );

            setAnalyzeStageLabel('Running pose detection...');
            setCaptureStatus('Analyzing frame...');
            analyzeTimeoutRef.current = setTimeout(() => {
                setIsAnalyzing(false);
                setAnalyzeStageLabel(null);
                setCaptureStatus('Analysis timed out. Please try again.');
                clearStatusAfterDelay();
            }, 12000);
        } catch {
            setIsAnalyzing(false);
            setAnalyzeStageLabel(null);
            setCaptureStatus('Analysis failed.');
            clearStatusAfterDelay();
        }
    };

    const handleAnalyzeResult = ({ poses }: PoseResult) => {
        clearAnalyzeTimeout();
        setIsAnalyzing(false);
        setAnalyzeStageLabel(null);

        const typedPoses = normalizePoses(poses);
        const poseCount = typedPoses.length;
        setKeypoints(typedPoses);

        // Detect scene
        const detectedScene = detectScene(typedPoses);
        setScene(detectedScene);

        setCaptureStatus(
            poseCount > 0
                ? `${sceneLabel(detectedScene)} — ${poseCount} pose${poseCount === 1 ? "" : "s"} found.`
                : "Analysis complete: no poses found."
        );
        clearStatusAfterDelay();
    };

    const handleRecommendPose = async () => {
        if (isRecommending || isAnalyzing) {
            return;
        }

        if (keypoints.length === 0) {
            console.log('No detected keypoints available for recommendation yet.');
            return;
        }

        if (!lastBase64) {
            console.log('No analyzed frame available yet. Run Analyze first.');
            return;
        }

        setIsRecommending(true);

        try {
            const recommendation = await getRecommendedPose({
                keypoints,
                scene,
                imageBase64: lastBase64,
            });

            setRecommendedPose(recommendation);
            console.log('✅ Recommended description:', recommendation.description);
            recommendation.keypoints.forEach((point) => {
                console.log(`✅ ${point.name}: x=${point.x.toFixed(2)}, y=${point.y.toFixed(2)}`);
            });
        } catch (error) {
            console.error('Failed to get recommended pose from Ollama:', error);
        } finally {
            setIsRecommending(false);
        }
    };

    const handleModelReady = () => {
        setIsModelReady(true);
        setCaptureStatus('Pose model loaded.');
        clearStatusAfterDelay();
    };

    if (!permission) {
        // Camera permissions are still loading.
        return <View />;
    }

    if (!permission.granted) {
        // Camera permissions are not granted yet.
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <Button onPress={requestPermission} title="grant permission" />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: '#000', alignItems: 'center' }]}>
            <View style={[
                styles.cameraContainer, 
                activeRatio === 'Full' && { flex: 1 },
                cameraAspectRatio !== undefined && { aspectRatio: cameraAspectRatio }
            ]}>
                <CameraView ref={cameraRef} style={styles.camera} facing={facing} flash={flashMode} zoom={zoom} />
                {countdown !== null && (
                    <View style={styles.countdownOverlay}>
                        <Text style={styles.countdownText}>{countdown}</Text>
                    </View>
                )}
            </View>
            <SkeletonOverlay keypoints={keypoints} previewRect={previewRect} />
            <MediaPipeView
                onModelReady={handleModelReady}
                onResult={(poses, worldPoses) => handleAnalyzeResult({ poses, worldPoses })}
                onRef={(ref) => {
                    mediaPipeRef.current = ref;
                }}
            />

            <BlurView intensity={25} tint="dark" style={styles.bottomSection}>
                <View style={styles.zoomContainer}>
                    {[0.5, 1, 2, 5, 10].map((z) => (
                        <TouchableOpacity 
                            key={z} 
                            style={[styles.zoomButton, activeZoom === z && styles.zoomButtonActive]}
                            onPress={() => {
                                setActiveZoom(z);
                                // Map label to 0-1 range for expo-camera
                                let zoomVal = 0;
                                if (z === 1) zoomVal = 0.05;
                                else if (z === 2) zoomVal = 0.15;
                                else if (z === 5) zoomVal = 0.5;
                                else if (z === 10) zoomVal = 1;
                                setZoom(zoomVal);
                            }}
                        >
                            <Text style={[styles.zoomText, activeZoom === z && styles.zoomTextActive]}>
                                {z === 0.5 ? '.5' : z}{activeZoom === z ? 'x' : ''}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.controlsRow}>
                    <TouchableOpacity
                        style={[styles.previewButton, capturedPhotos.length === 0 && styles.disabledControl]}
                        activeOpacity={0.8}
                        onPress={handleOpenPreview}
                        disabled={capturedPhotos.length === 0 || isAnalyzing}
                    >
                        {capturedPhotos.length > 0 ? (
                            <Image source={{ uri: capturedPhotos[0] }} style={styles.previewImage} />
                        ) : (
                            <View style={styles.previewPlaceholder}>
                                <Text style={styles.previewText}>No</Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.shutterButton, (isCapturing || isAnalyzing) && styles.disabledControl]}
                        activeOpacity={0.8}
                        onPress={handleTakePhotoPress}
                        disabled={isCapturing || isAnalyzing}
                    >
                        <View style={styles.shutterInner} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.flipButton, (isCapturing || isAnalyzing) && styles.disabledControl]}
                        activeOpacity={0.8}
                        onPress={toggleFacing}
                        disabled={isCapturing || isAnalyzing}
                    >
                        <Feather name="refresh-ccw" color="#fff" size={22} />
                    </TouchableOpacity>
                </View>

                <View style={styles.modesRow}>
                    <Text style={styles.modeText}>Portrait</Text>
                    <Text style={[styles.modeText, styles.modeTextActive]}>Camera</Text>
                    <Text style={styles.modeText}>Video</Text>
                    <Text style={styles.modeText}>More</Text>
                </View>
            </BlurView>

            <BlurView intensity={25} tint="dark" style={styles.topSection}>
                <View style={styles.topSectionHeader}>
                    <TouchableOpacity style={styles.topIconButton} activeOpacity={0.8} onPress={() => setFlashMode(flashMode === 'on' ? 'off' : 'on')}>
                        <Feather name={flashMode === 'on' ? 'zap' : 'zap-off'} color="#fff" size={24} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.topIconButton, (isCapturing || isAnalyzing || !isModelReady) && styles.disabledControl]}
                        activeOpacity={0.8}
                        onPress={handleAnalyzeFrame}
                        disabled={isCapturing || isAnalyzing || !isModelReady}
                    >
                        {isAnalyzing || !isModelReady ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Feather name="activity" color="#fff" size={24} />
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.topIconButton} activeOpacity={0.8} onPress={() => setIsMenuOpen(!isMenuOpen)}>
                        <Feather name="menu" color="#fff" size={24} />
                    </TouchableOpacity>
                </View>

                {isMenuOpen && (
                    <View style={styles.dropdownMenu}>
                        <View style={styles.menuRow}>
                            {['1:1', '3:4', '9:16', 'Full'].map((r) => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.menuPill, activeRatio === r && styles.menuPillActiveGray]}
                                    onPress={() => setActiveRatio(r as CameraAspectRatio)}
                                >
                                    <Text style={[styles.menuPillText, activeRatio === r && styles.menuPillTextActiveGray]}>{r}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.menuRow}>
                            {['off', '3S', '5S', '10S'].map((t) => (
                                <TouchableOpacity key={t} style={[styles.menuPill, activeTimer === t && styles.menuPillActiveGray]} onPress={() => setActiveTimer(t)}>
                                    {t === 'off' ? (
                                        <Feather name="clock" color={activeTimer === 'off' ? '#fff' : 'rgba(255,255,255,0.6)'} size={16} />
                                    ) : (
                                        <Text style={[styles.menuPillText, activeTimer === t && styles.menuPillTextActiveGray]}>{t}</Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View style={styles.menuSettingsRow}>
                            <TouchableOpacity style={styles.settingsItem}>
                                <View style={styles.settingsIconWrapper}>
                                    <Feather name="settings" color="#fff" size={20} />
                                </View>
                                <Text style={styles.settingsText}>Settings</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </BlurView>

            <TouchableOpacity
                style={[
                    styles.generateButton,
                    (keypoints.length === 0 || isRecommending || isAnalyzing) && styles.disabledControl,
                ]}
                activeOpacity={0.8}
                onPress={handleRecommendPose}
                disabled={keypoints.length === 0 || isRecommending || isAnalyzing}
            >
                {isRecommending ? (
                    <View style={styles.generateButtonContent}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.generateButtonText}>Thinking...</Text>
                    </View>
                ) : (
                    <Text style={styles.generateButtonText}>Generate</Text>
                )}
            </TouchableOpacity>

            {isAnalyzing ? (
                <View style={styles.progressOverlay}>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.progressText}>{analyzeStageLabel ?? 'Processing...'}</Text>
                </View>
            ) : null}

            {captureStatus ? <Text style={styles.captureStatus}>{captureStatus}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
    },
    cameraContainer: {
        width: '100%',
        overflow: 'hidden',
        justifyContent: 'center',
    },
    camera: {
        flex: 1,
    },
    countdownOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
    },
    countdownText: {
        fontSize: 120,
        fontWeight: 'bold',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    bottomSection: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingTop: 20,
        paddingBottom: 40,
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
    },
    zoomContainer: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 20,
        padding: 4,
        marginBottom: 20,
        alignItems: 'center',
    },
    zoomButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomButtonActive: {
        backgroundColor: '#fff',
    },
    zoomText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    zoomTextActive: {
        color: '#000',
        fontWeight: '600',
    },
    controlsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 40,
        marginBottom: 24,
    },
    shutterButton: {
        width: 76,
        height: 76,
        borderRadius: 38,
        borderWidth: 4,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
    },
    shutterInner: {
        width: 62,
        height: 62,
        borderRadius: 31,
        backgroundColor: '#fff',
    },
    flipButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewButton: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    previewPlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    modesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
    },
    modeText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        fontWeight: '500',
    },
    modeTextActive: {
        color: '#fff',
        fontWeight: '700',
    },
    disabledControl: {
        opacity: 0.55,
    },
    captureStatus: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 260,
        textAlign: 'center',
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    topSection: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 24,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
        overflow: 'hidden',
    },
    topSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
    },
    topIconButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dropdownMenu: {
        marginTop: 20,
        gap: 16,
    },
    menuRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: 4,
    },
    menuPill: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
    },

    menuPillActiveGray: {
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    menuPillText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '500',
    },

    menuPillTextActiveGray: {
        color: '#fff',
        fontWeight: '700',
    },
    menuSettingsRow: {
        flexDirection: 'row',
        marginTop: 8,
        paddingHorizontal: 12,
    },
    settingsItem: {
        alignItems: 'center',
        gap: 6,
    },
    settingsIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    settingsText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    progressOverlay: {
        position: 'absolute',
        top: 120,
        left: 24,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderWidth: 1,
        borderColor: '#fff',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
    generateButton: {
        position: 'absolute',
        top: 110,
        right: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderWidth: 1,
        borderColor: '#fff',
    },
    generateButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    generateButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});