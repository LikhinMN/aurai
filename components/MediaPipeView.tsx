import { useRef, useEffect, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { Asset } from "expo-asset";
import type { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";

export type MediaPipeBridgeRef = {
    postMessage: (data: string) => void;
};

interface Props {
    onModelReady: () => void;
    onResult: (poses: unknown[], worldPoses: unknown[]) => void;
    onRef: (ref: MediaPipeBridgeRef | null) => void;
}

export default function MediaPipeView({ onModelReady, onResult, onRef }: Props) {
    const webviewRef = useRef<WebView>(null);
    const [htmlUri, setHtmlUri] = useState<string | null>(null);

    useEffect(() => {
        // Load the local HTML file from assets
        async function loadHtml() {
            const asset = Asset.fromModule(require("../assets/mediapipe.html"));
            await asset.downloadAsync();
            setHtmlUri(asset.localUri ?? asset.uri);
        }

        loadHtml();
    }, []);

    const postMessage = useCallback((data: string) => {
        const webview = webviewRef.current;
        if (!webview) {
            console.log("[MediaPipeView] postMessage skipped: WebView is not ready");
            return;
        }

        const escapedData = JSON.stringify(data);
        const script = `
            (function() {
                var payload = ${escapedData};
                var windowEvent = new MessageEvent("message", { data: payload });
                var documentEvent = new MessageEvent("message", { data: payload });
                window.dispatchEvent(windowEvent);
                document.dispatchEvent(documentEvent);
            })();
            true;
        `;

        webview.injectJavaScript(script);
    }, []);

    useEffect(() => {
        if (!htmlUri) {
            return;
        }

        onRef({ postMessage });

        return () => {
            onRef(null);
        };
    }, [htmlUri, onRef, postMessage]);

    const handleMessage = (event: WebViewMessageEvent) => {
        const raw = event.nativeEvent.data;
        console.log("[MediaPipeView] raw message:", raw);

        try {
            const data = JSON.parse(raw) as {
                type?: string;
                poses?: unknown[];
                worldPoses?: unknown[];
                message?: string;
            };

            const type = data.type ?? "UNKNOWN";
            const message = data.message ?? "";

            if (type === "LOG") {
                console.log("[MediaPipeView][LOG]", message);
                return;
            }

            if (type === "ERROR") {
                console.log("[MediaPipeView][ERROR]", message || "Unknown WebView error");
                return;
            }

            if (type === "MODEL_READY") {
                console.log("[MediaPipeView][MODEL_READY]");
                onModelReady();
                return;
            }

            if (type === "RESULT") {
                console.log("[MediaPipeView][RESULT] poses:", data.poses?.length ?? 0);
                onResult(data.poses ?? [], data.worldPoses ?? []);
                return;
            }

            console.log("[MediaPipeView][UNKNOWN]", data);
        } catch (error) {
            console.log("[MediaPipeView][PARSE_ERROR]", error);
        }
    };

    if (!htmlUri) return null;

    return (
        <View style={styles.hidden}>
            <WebView
                ref={webviewRef}
                source={{ uri: htmlUri }}
                onMessage={handleMessage}
                onLoad={() => console.log("[MediaPipeView] WebView loaded")}
                onError={(e) => console.log("[MediaPipeView] WebView error:", e.nativeEvent)}
                onHttpError={(e) => console.log("[MediaPipeView] HTTP error:", e.nativeEvent)}
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