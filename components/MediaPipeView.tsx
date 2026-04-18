import { useRef, useEffect,useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";

interface Props {
    onModelReady: () => void;
    onResult: (poses: any[], worldPoses: any[]) => void;
    onRef: (ref: any) => void;
}

export default function MediaPipeView({ onModelReady, onResult, onRef }: Props) {
    const webviewRef = useRef<WebView>(null);
    const [htmlUri, setHtmlUri] = useState<string | null>(null);

    useEffect(() => {
        // Load the local HTML file from assets
        async function loadHtml() {
            const asset = Asset.fromModule(require("../assets/mediapipe.html"));
            await asset.downloadAsync();
            setHtmlUri(asset.localUri);
        }
        loadHtml();
    }, []);

    useEffect(() => {
        if (webviewRef.current) {
            onRef(webviewRef.current);
        }
    }, [htmlUri]);

    const handleMessage = (event: any) => {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === "MODEL_READY") {
            onModelReady();
        }

        if (data.type === "RESULT") {
            onResult(data.poses, data.worldPoses);
        }
    };

    if (!htmlUri) return null;

    return (
        <View style={styles.hidden}>
            <WebView
                ref={webviewRef}
                source={{ uri: htmlUri }}
                onMessage={handleMessage}
                javaScriptEnabled
                originWhitelist={["*"]}
                allowFileAccess
                allowUniversalAccessFromFileURLs
                mixedContentMode="always"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    hidden: {
        width: 1,
        height: 1,
        opacity: 0,
        position: "absolute",
    },
});