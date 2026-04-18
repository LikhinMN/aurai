import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Button, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MediaPipeView from '@/components/MediaPipeView';
import { detectScene, sceneLabel, SceneType, PoseKeypoint } from '@/utils/sceneDetector';

type PoseResult = {
    poses: unknown[];
    worldPoses: unknown[];
};

export default function Index() {
    const router = useRouter();
    const [facing, setFacing] = useState<CameraType>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureStatus, setCaptureStatus] = useState<string | null>(null);
    const [latestPhotoUri, setLatestPhotoUri] = useState<string | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzeStageLabel, setAnalyzeStageLabel] = useState<string | null>(null);
    const [isModelReady, setIsModelReady] = useState(false);
    // Stored for upcoming pose overlay work in Sprint 3.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [keypoints, setKeypoints] = useState<PoseKeypoint[][]>([]);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [scene, setScene] = useState<SceneType>('unknown');
    const mediaPipeRef = useRef<{ postMessage: (data: string) => void } | null>(null);
    const statusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (statusTimeoutRef.current) {
                clearTimeout(statusTimeoutRef.current);
            }
            if (analyzeTimeoutRef.current) {
                clearTimeout(analyzeTimeoutRef.current);
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

    const handleTakePhoto = async () => {
        if (isCapturing || !cameraRef.current) {
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

            setLatestPhotoUri(photo.uri);

            let mediaPermission = await MediaLibrary.getPermissionsAsync();
            if (!mediaPermission.granted) {
                mediaPermission = await MediaLibrary.requestPermissionsAsync();
            }

            if (!mediaPermission.granted) {
                setCaptureStatus('Storage permission denied. Photo was not saved.');
                clearStatusAfterDelay();
                return;
            }

            await MediaLibrary.saveToLibraryAsync(photo.uri);
            setCaptureStatus('Photo saved to your library.');
            clearStatusAfterDelay();
        } catch {
            setCaptureStatus('Failed to capture photo. Please try again.');
            clearStatusAfterDelay();
        } finally {
            setIsCapturing(false);
        }
    };

    const handleOpenPreview = () => {
        if (!latestPhotoUri) {
            return;
        }

        router.push({ pathname: '/preview', params: { uri: latestPhotoUri } });
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

        const typedPoses = poses as PoseKeypoint[][];
        const poseCount = poses.length;
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
        <View style={styles.container}>
            <CameraView ref={cameraRef} style={styles.camera} facing={facing} />
            <MediaPipeView
                onModelReady={handleModelReady}
                onResult={(poses, worldPoses) => handleAnalyzeResult({ poses, worldPoses })}
                onRef={(ref) => {
                    mediaPipeRef.current = ref;
                }}
            />

            <View style={styles.controlsOverlay}>
                <TouchableOpacity
                    style={[styles.previewButton, !latestPhotoUri && styles.disabledControl]}
                    activeOpacity={0.8}
                    onPress={handleOpenPreview}
                    disabled={!latestPhotoUri || isAnalyzing}
                >
                    {latestPhotoUri ? (
                        <Image source={{ uri: latestPhotoUri }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.previewPlaceholder}>
                            <Text style={styles.previewText}>No</Text>
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.shutterButton, (isCapturing || isAnalyzing) && styles.disabledControl]}
                    activeOpacity={0.8}
                    onPress={handleTakePhoto}
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
                    <Text style={styles.flipText}>Flip</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.analyzeButton, (isCapturing || isAnalyzing || !isModelReady) && styles.disabledControl]}
                activeOpacity={0.8}
                onPress={handleAnalyzeFrame}
                disabled={isCapturing || isAnalyzing || !isModelReady}
            >
                {isAnalyzing ? (
                    <View style={styles.analyzeBusyRow}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={styles.analyzeText}>Working</Text>
                    </View>
                ) : (
                    <Text style={styles.analyzeText}>{isModelReady ? 'Analyze' : 'Loading'}</Text>
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
    camera: {
        flex: 1,
    },
    controlsOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    shutterButton: {
        width: 84,
        height: 84,
        borderRadius: 42,
        borderWidth: 5,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    shutterInner: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fff',
    },
    flipButton: {
        position: 'absolute',
        right: 24,
        width: 54,
        height: 54,
        borderRadius: 27,
        borderWidth: 1,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
    },
    previewButton: {
        position: 'absolute',
        left: 24,
        width: 54,
        height: 54,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fff',
        overflow: 'hidden',
        backgroundColor: 'rgba(0, 0, 0, 0.35)',
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
    flipText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    disabledControl: {
        opacity: 0.55,
    },
    captureStatus: {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: 136,
        textAlign: 'center',
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
        textShadowColor: 'rgba(0, 0, 0, 0.45)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    analyzeButton: {
        position: 'absolute',
        top: 60,
        right: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderWidth: 1,
        borderColor: '#fff',
    },
    analyzeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    analyzeBusyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    progressOverlay: {
        position: 'absolute',
        top: 60,
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
});