// Services/WhiteBalance.ts

import { OperationResult } from "./types";

// White balance is applied at export time so the preview canvas remains a faithful view of the captured image.
/**
 * Automatically corrects color cast in a scanned document image using
 * percentile-based white balance. Finds the brightest ~2% of pixels per
 * channel and stretches that channel so it reads as neutral white.
 *
 * @param imageData - Source image data (e.g. from a canvas)
 * @param percentile - Which percentile to treat as "white" (default 0.98)
 * @returns OperationResult with the corrected ImageData
 */
export function performAutoWhiteBalance(
	imageData: ImageData,
	percentile: number = 0.98,
): OperationResult & { imageData?: ImageData } {
	const { data, width, height } = imageData;
	const pixelCount = width * height;

	if (pixelCount === 0) {
		return { success: false, message: "Empty image data" };
	}

	// Build per-channel histograms (0-255)
	const histR = new Uint32Array(256);
	const histG = new Uint32Array(256);
	const histB = new Uint32Array(256);

	for (let i = 0; i < data.length; i += 4) {
		histR[data[i]]++;
		histG[data[i + 1]]++;
		histB[data[i + 2]]++;
	}

	// Find the value at the given percentile for each channel
	const findPercentileValue = (hist: Uint32Array): number => {
		const target = pixelCount * percentile;
		let cumulative = 0;
		for (let v = 255; v >= 0; v--) {
			cumulative += hist[v];
			if (cumulative >= pixelCount - target) {
				return v;
			}
		}
		return 255;
	};

	const whiteR = findPercentileValue(histR);
	const whiteG = findPercentileValue(histG);
	const whiteB = findPercentileValue(histB);

	// Avoid division by zero / degenerate images (e.g. solid black)
	const scaleR = whiteR > 0 ? 255 / whiteR : 1;
	const scaleG = whiteG > 0 ? 255 / whiteG : 1;
	const scaleB = whiteB > 0 ? 255 / whiteB : 1;

	const output = new Uint8ClampedArray(data.length);
	for (let i = 0; i < data.length; i += 4) {
		output[i] = data[i] * scaleR;
		output[i + 1] = data[i + 1] * scaleG;
		output[i + 2] = data[i + 2] * scaleB;
		output[i + 3] = data[i + 3]; // preserve alpha
	}

	const corrected = new ImageData(output, width, height);

	return {
		success: true,
		message: "White balance corrected",
		imageData: corrected,
	};
}

/**
 * Applies auto white balance to a canvas in place, returning the same
 * canvas with corrected pixel data. Safe no-op wrapper for callers that
 * only have a canvas, not raw ImageData.
 */
export function applyWhiteBalanceToCanvas(
	canvas: HTMLCanvasElement,
): HTMLCanvasElement {
	const ctx = canvas.getContext("2d", { willReadFrequently: true });
	if (!ctx) {
		console.error("Failed to get canvas context for white balance");
		return canvas;
	}

	const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
	const result = performAutoWhiteBalance(imageData);

	if (result.success && result.imageData) {
		ctx.putImageData(result.imageData, 0, 0);
	} else {
		console.error("White balance failed:", result.message);
	}

	return canvas;
}
