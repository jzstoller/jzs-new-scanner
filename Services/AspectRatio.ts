/**
 * Aspect-ratio export utilities for scanned documents.
 * Pure functions with no Obsidian API dependencies.
 *
 * Stretches (rather than crops or letterboxes) a canvas to a target ratio,
 * auto-detecting landscape vs. portrait from the source so a single "16:9"
 * setting produces a wide 16:9 result for landscape scans and a tall 9:16
 * result for portrait scans.
 */

export type AspectRatioSetting = "original" | "16:9";

// How close the source ratio must already be to the target ratio (relative
// difference) before we treat it as "already matching" and skip the redraw.
const RATIO_MATCH_TOLERANCE = 0.01;

/**
 * Stretch a canvas to fit a target aspect ratio, anchoring the long edge and
 * deriving the short edge from the ratio. No cropping or padding occurs —
 * the source content is non-uniformly scaled to exactly fill the target
 * dimensions, which may visibly distort the image.
 *
 * @param canvas - Source canvas (typically already downscaled to its final export size)
 * @param ratio - "original" is a no-op; "16:9" auto-orients to 16:9 (landscape) or 9:16 (portrait)
 * @returns The same canvas if no change is needed, otherwise a new canvas at the target dimensions
 */
export function stretchCanvasToAspectRatio(
	canvas: HTMLCanvasElement,
	ratio: AspectRatioSetting,
): HTMLCanvasElement {
	if (ratio === "original") return canvas;

	const { width, height } = canvas;
	if (width <= 0 || height <= 0) return canvas;

	const isLandscape = width >= height;
	// 16:9 for landscape sources, 9:16 (auto-flipped) for portrait sources.
	const targetRatio = isLandscape ? 16 / 9 : 9 / 16;
	const currentRatio = width / height;

	if (
		Math.abs(currentRatio - targetRatio) / targetRatio <
		RATIO_MATCH_TOLERANCE
	) {
		return canvas;
	}

	// Long edge stays fixed; the short edge is derived from the target ratio.
	let targetWidth: number;
	let targetHeight: number;
	if (isLandscape) {
		targetWidth = width;
		targetHeight = Math.max(1, Math.round(width / targetRatio));
	} else {
		targetHeight = height;
		targetWidth = Math.max(1, Math.round(height * targetRatio));
	}

	const out = activeDocument.createElement("canvas");
	out.width = targetWidth;
	out.height = targetHeight;
	const ctx = out.getContext("2d");
	if (!ctx) return canvas;

	// Non-uniform draw intentionally stretches/squashes the source to fill
	// the target rectangle exactly — no cropping, no letterbox bars.
	ctx.drawImage(canvas, 0, 0, width, height, 0, 0, targetWidth, targetHeight);

	return out;
}
