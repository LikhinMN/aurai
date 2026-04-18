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
        console.log("=== WebView message received ===");
        console.log("Raw data:", event.nativeEvent.data);

        try {
            const data = JSON.parse(event.nativeEvent.data) as {
                type?: string;
                poses?: unknown[];
                worldPoses?: unknown[];
                message?: string;
            };

            console.log("Parsed type:", data.type);

            if (data.type === "MODEL_READY") {
                console.log("[OK] Model is ready");
                onModelReady();
            }

            if (data.type === "RESULT") {
                console.log("[OK] Got result, poses:", data.poses?.length ?? 0);
                onResult(data.poses ?? [], data.worldPoses ?? []);
            }

            if (data.type === "ERROR") {
                console.log("[ERR] WebView error:", data.message ?? "Unknown error");
            }

            if (data.type === "LOG") {
                console.log("[WEBVIEW LOG]", data.message ?? "");
            }
        } catch (error) {
            console.log("[ERR] Failed to parse message:", error);
        }
    };

    if (!htmlUri) return null;

    return (
        <View style={styles.hidden}>
            <WebView
                ref={webviewRef}
                source={{ uri: htmlUri }}
                onMessage={handleMessage}
                onLoad={() => console.log("[OK] WebView loaded")}
                onError={(e) => console.log("[ERR] WebView error:", e.nativeEvent)}
                onHttpError={(e) => console.log("[ERR] HTTP error:", e.nativeEvent)}
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