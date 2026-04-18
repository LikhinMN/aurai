import { useRef, useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import type { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";

interface Props {
    onModelReady: () => void;
    onResult: (poses: unknown[], worldPoses: unknown[]) => void;
    onRef: (ref: WebView | null) => void;
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
    }, [htmlUri, onRef]);

    const handleMessage = (event: WebViewMessageEvent) => {
        let data: { type?: string; poses?: unknown[]; worldPoses?: unknown[] };
        try {
            data = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }

        if (data.type === "MODEL_READY") {
            onModelReady();
        }

        if (data.type === "RESULT") {
            onResult(data.poses ?? [], data.worldPoses ?? []);
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