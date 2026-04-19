import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, Dimensions } from 'react-native';

const { width: WINDOW_WIDTH } = Dimensions.get('window');

export default function PreviewScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ uris?: string }>();
    
    // Parse the stringified array
    let uris: string[] = [];
    try {
        uris = params.uris ? JSON.parse(params.uris) : [];
    } catch (e) {
        console.error("[PreviewScreen] Failed to parse URIs:", e);
    }
    
    console.log("[PreviewScreen] URIs received:", uris.length);

    return (
        <View style={styles.container}>
            {uris.length > 0 ? (
                <FlatList
                    data={uris}
                    keyExtractor={(item, index) => `${item}-${index}`}
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={{ flex: 1 }}
                    renderItem={({ item }) => (
                        <View style={[styles.imageContainer, { backgroundColor: '#0a0a0a' }]}>
                            <Image source={{ uri: item }} style={styles.image} resizeMode="contain" />
                        </View>
                    )}
                />
            ) : (
                <Text style={styles.message}>No images selected.</Text>
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
    },
    imageContainer: {
        width: WINDOW_WIDTH,
        height: '100%',
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
        textAlign: 'center',
        marginTop: '50%',
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
        zIndex: 10,
    },
    closeText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
});

