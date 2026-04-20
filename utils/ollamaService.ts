import { PoseKeypoint, SceneType } from "@/utils/sceneDetector";

const OLLAMA_HOST = "http://10.233.111.99:11434";
const OLLAMA_MODEL = "gemma4:e4b";

export interface RecommendedPose {
    description: string;
    keypoints: { name: string; x: number; y: number }[];
}

interface RecommendPoseParams {
    keypoints: PoseKeypoint[][];
    scene: SceneType;
    imageBase64: string;
}

interface OllamaGenerateResponse {
    response?: string;
}

type LandmarkSpec = {
    name: string;
    index: number;
};

const LANDMARKS: LandmarkSpec[] = [
    { name: "nose", index: 0 },
    { name: "left shoulder", index: 11 },
    { name: "right shoulder", index: 12 },
    { name: "left elbow", index: 13 },
    { name: "right elbow", index: 14 },
    { name: "left wrist", index: 15 },
    { name: "right wrist", index: 16 },
    { name: "left hip", index: 23 },
    { name: "right hip", index: 24 },
    { name: "left knee", index: 25 },
    { name: "right knee", index: 26 },
    { name: "left ankle", index: 27 },
    { name: "right ankle", index: 28 },
];

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function sanitizeBase64(imageBase64: string): string {
    return imageBase64.replace(/^data:image\/[a-zA-Z+.-]+;base64,/, "").trim();
}

function getPrimaryPose(poses: PoseKeypoint[][]): PoseKeypoint[] {
    if (!poses || poses.length === 0) {
        throw new Error("No pose keypoints available for recommendation.");
    }

    const primary = poses[0];
    if (!primary || primary.length === 0) {
        throw new Error("Primary pose keypoints are empty.");
    }

    return primary;
}

function toPoseSummaryLines(primaryPose: PoseKeypoint[]): string[] {
    return LANDMARKS.map(({ name, index }) => {
        const point = primaryPose[index];
        const x = point && Number.isFinite(point.x) ? point.x : 0;
        const y = point && Number.isFinite(point.y) ? point.y : 0;
        return `${name}: x=${x.toFixed(2)}, y=${y.toFixed(2)}`;
    });
}

function buildPrompt(scene: SceneType, primaryPose: PoseKeypoint[]): string {
    const keypointBlock = toPoseSummaryLines(primaryPose).join("\n");

    return [
        "You are an expert mobile photography pose coach.",
        `Scene type: ${scene}`,
        "Current body keypoints (normalized 0..1):",
        keypointBlock,
        "",
        "Use the attached image to understand environment and occasion.",
        "Analyze the current body position from the keypoints.",
        "Recommend a better pose for a great photo in that environment.",
        "",
        "Return ONLY a valid JSON object with this exact structure:",
        '{"description":"one sentence","keypoints":[{"name":"nose","x":0.50,"y":0.30},{"name":"left shoulder","x":0.35,"y":0.45},{"name":"right shoulder","x":0.65,"y":0.45},{"name":"left elbow","x":0.25,"y":0.60},{"name":"right elbow","x":0.75,"y":0.60},{"name":"left wrist","x":0.20,"y":0.75},{"name":"right wrist","x":0.80,"y":0.75},{"name":"left hip","x":0.40,"y":0.65},{"name":"right hip","x":0.60,"y":0.65},{"name":"left knee","x":0.38,"y":0.80},{"name":"right knee","x":0.62,"y":0.80},{"name":"left ankle","x":0.36,"y":0.95},{"name":"right ankle","x":0.64,"y":0.95}]}'
    ].join("\n");
}

function stripMarkdownFences(input: string): string {
    const trimmed = input.trim();
    if (!trimmed.startsWith("```")) {
        return trimmed;
    }

    return trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim();
}

function extractJsonObject(input: string): string {
    const start = input.indexOf("{");
    const end = input.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
        throw new Error("Ollama response did not contain a JSON object.");
    }

    return input.slice(start, end + 1);
}

function parseRecommendedPose(rawResponse: string): RecommendedPose {
    const withoutFences = stripMarkdownFences(rawResponse);
    const jsonText = extractJsonObject(withoutFences);
    const parsed = JSON.parse(jsonText) as Partial<RecommendedPose>;

    const description = typeof parsed.description === "string" ? parsed.description.trim() : "";
    if (!description) {
        throw new Error("Ollama response is missing a valid description.");
    }

    if (!Array.isArray(parsed.keypoints)) {
        throw new Error("Ollama response is missing keypoints array.");
    }

    const keypoints = parsed.keypoints
        .map((point) => {
            if (!point || typeof point !== "object") return null;

            const name = "name" in point && typeof point.name === "string" ? point.name.trim() : "";
            const x = "x" in point && typeof point.x === "number" && Number.isFinite(point.x) ? point.x : NaN;
            const y = "y" in point && typeof point.y === "number" && Number.isFinite(point.y) ? point.y : NaN;

            if (!name || Number.isNaN(x) || Number.isNaN(y)) return null;

            return {
                name,
                x: clamp(x, 0, 1),
                y: clamp(y, 0, 1),
            };
        })
        .filter((point): point is { name: string; x: number; y: number } => point !== null);

    if (keypoints.length !== LANDMARKS.length) {
        throw new Error(`Ollama response must include ${LANDMARKS.length} keypoints, got ${keypoints.length}.`);
    }

    return {
        description,
        keypoints,
    };
}

export async function getRecommendedPose({ keypoints, scene, imageBase64 }: RecommendPoseParams): Promise<RecommendedPose> {
    const cleanBase64 = sanitizeBase64(imageBase64);
    if (!cleanBase64) {
        throw new Error("Image base64 is empty.");
    }

    const primaryPose = getPrimaryPose(keypoints);
    const prompt = buildPrompt(scene, primaryPose);

    console.log("🚀 Sending to Ollama...");
    console.log(`📦 Prompt built, image size: ${cleanBase64.length} chars`);

    const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: OLLAMA_MODEL,
            prompt,
            images: [cleanBase64],
            stream: false,
        }),
    });

    if (!response.ok) {
        throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
    }

    const json = (await response.json()) as OllamaGenerateResponse;
    const raw = typeof json.response === "string" ? json.response : "";

    console.log("✅ Ollama raw response:", raw);

    const parsed = parseRecommendedPose(raw);
    console.log("✅ Parsed keypoints:", parsed.keypoints);

    return parsed;
}

