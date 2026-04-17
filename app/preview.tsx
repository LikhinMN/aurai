import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function PreviewScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ uri?: string | string[] }>();
    const uri = Array.isArray(params.uri) ? params.uri[0] : params.uri;

    return (
        <View style={styles.container}>
            {uri ? (
                <Image source={{ uri }} style={styles.image} resizeMode="contain" />
            ) : (
                <Text style={styles.message}>No image selected.</Text>
            )}

            <TouchableOpacity style={styles.closeButton} onPress={() => router.back()} activeOpacity={0.85}>
                <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    message: {
        color: '#fff',
        fontSize: 16,
    },
    closeButton: {
        position: 'absolute',
        top: 56,
        right: 20,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderWidth: 1,
        borderColor: '#fff',
    },
    closeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});

