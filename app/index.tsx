import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Index() {
    const [facing, setFacing] = useState<CameraType>('back');
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureStatus, setCaptureStatus] = useState<string | null>(null);

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
                return;
            }

            let mediaPermission = await MediaLibrary.getPermissionsAsync();
            if (!mediaPermission.granted) {
                mediaPermission = await MediaLibrary.requestPermissionsAsync();
            }

            if (!mediaPermission.granted) {
                setCaptureStatus('Storage permission denied. Photo was not saved.');
                return;
            }

            await MediaLibrary.saveToLibraryAsync(photo.uri);
            setCaptureStatus('Photo saved to your library.');
        } catch {
            setCaptureStatus('Failed to capture photo. Please try again.');
        } finally {
            setIsCapturing(false);
        }
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

            <View style={styles.controlsOverlay}>
                <TouchableOpacity
                    style={[styles.shutterButton, isCapturing && styles.disabledControl]}
                    activeOpacity={0.8}
                    onPress={handleTakePhoto}
                    disabled={isCapturing}
                >
                    <View style={styles.shutterInner} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.flipButton, isCapturing && styles.disabledControl]}
                    activeOpacity={0.8}
                    onPress={toggleFacing}
                    disabled={isCapturing}
                >
                    <Text style={styles.flipText}>Flip</Text>
                </TouchableOpacity>
            </View>

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
});