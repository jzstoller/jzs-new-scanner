/**
 * Aspect-ratio export utilities for scanned documents.
 * Pure functions with no Obsidian API dependencies.
 *
 * Stretches (rather than crops or letterboxes) a canvas to a target ratio.
 * By default ("auto" orientation) it detects landscape vs. portrait from the
 * source, so a single "16:9" setting produces a wide 16:9 result for
 * landscape scans and a tall 9:16 result for portrait scans. Orientation can
 * also be forced ("landscape" or "portrait") to override that detection.
 */

export type AspectRatioSetting = "original" | "16:9";
export type AspectRatioOrientation = "auto" | "landscape" | "portrait";

// How close the source ratio must already be to the target ratio (relative
// difference) before we treat it as "already matching" and skip the redraw.
const RATIO_MATCH_TOLERANCE = 0.01;

/**
 * Stretch a canvas to fit a target aspect ratio, anchoring the source's long
 * edge (in pixel count) and deriving the short edge from the ratio. No
 * cropping or padding occurs — the source content is non-uniformly scaled to
 * exactly fill the target dimensions, which may visibly distort the image.
 *
 * @param canvas - Source canvas (typically already downscaled to its final export size)
 * @param ratio - "original" is a no-op; "16:9" stretches to a 16:9 or 9:16 target
 * @param orientation - "auto" (default) picks 16:9 for landscape sources and 9:16
 *   for portrait sources; "landscape" or "portrait" forces that orientation
 *   regardless of the source's actual shape
 * @returns The same canvas if no change is needed, otherwise a new canvas at the target dimensions
 */
export function stretchCanvasToAspectRatio(
	canvas: HTMLCanvasElement,
	ratio: AspectRatioSetting,
	orientation: AspectRatioOrientation = "auto",
): HTMLCanvasElement {
	if (ratio === "original") return canvas;

	const { width, height } = canvas;
	if (width <= 0 || height <= 0) return canvas;

	const isWide =
		orientation === "auto" ? width >= height : orientation === "landscape";
	// 16:9 for a wide target, 9:16 for a tall target.
	const targetRatio = isWide ? 16 / 9 : 9 / 16;
	const currentRatio = width / height;

	if (
		Math.abs(currentRatio - targetRatio) / targetRatio <
		RATIO_MATCH_TOLERANCE
	) {
		return canvas;
	}

	// The source's long edge stays fixed in pixel count; it's mapped onto
	// whichever axis the target orientation needs, so forcing an
	// orientation opposite the source's natural shape doesn't quietly
	// shrink the export's resolution budget.
	const sourceLongEdge = Math.max(width, height);

	let targetWidth: number;
	let targetHeight: number;
	if (isWide) {
		targetWidth = sourceLongEdge;
		targetHeight = Math.max(1, Math.round(sourceLongEdge / targetRatio));
	} else {
		targetHeight = sourceLongEdge;
		targetWidth = Math.max(1, Math.round(sourceLongEdge * targetRatio));
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
