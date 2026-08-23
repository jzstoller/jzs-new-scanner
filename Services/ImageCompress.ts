/**
 * Mobile-safe image downscale + flatten utility for scanned documents.
 * Uses only Canvas / createImageBitmap / Blob APIs — no Node, no fs.
 * Works in the Obsidian mobile WKWebView sandbox.
 *
 * - Resizes so the longer side is at most maxDimension (default 2000px)
 * - Flattens alpha onto a white background
 * - Optionally stretches to a target aspect ratio (e.g. 16:9), after the
 *   long-edge resize, so the ratio math always operates on the final size
 * - Re-encodes in the requested format
 * - Detects iOS WebP fallback-to-PNG and throws instead of mislabeling the file
 */

import {
	stretchCanvasToAspectRatio,
	type AspectRatioOrientation,
	type AspectRatioSetting,
} from "./AspectRatio";

export interface CompressOptions {
	maxDimension?: number;
	quality?: number;
	backgroundColor?: string;
	outputMime?: "image/jpeg" | "image/png";
	aspectRatio?: AspectRatioSetting;
	aspectRatioOrientation?: AspectRatioOrientation;
}

export interface CompressResult {
	buffer: ArrayBuffer;
	ext: string;
	width: number;
	height: number;
	byteLength: number;
}

const DEFAULTS = {
	maxDimension: 2000,
	quality: 0.82,
	backgroundColor: "#ffffff",
};

// Raster exports normalize size, flatten transparency, and encode in one place so the modal can stay simple.
export async function compressCanvas(
	canvas: HTMLCanvasElement,
	options: CompressOptions = {},
): Promise<CompressResult> {
	const opts = {
		...DEFAULTS,
		outputMime: "image/jpeg" as CompressOptions["outputMime"],
		...options,
	};

	const { width: srcW, height: srcH } = canvas;
	const longSide = Math.max(srcW, srcH);
	const scale =
		longSide > opts.maxDimension ? opts.maxDimension / longSide : 1;
	const outW = Math.max(1, Math.round(srcW * scale));
	const outH = Math.max(1, Math.round(srcH * scale));

	const out = activeDocument.createElement("canvas");
	out.width = outW;
	out.height = outH;
	const ctx = out.getContext("2d", { willReadFrequently: true });
	if (!ctx) throw new Error("Could not get 2D canvas context");

	ctx.fillStyle = opts.backgroundColor;
	ctx.fillRect(0, 0, outW, outH);
	ctx.imageSmoothingEnabled = true;
	ctx.imageSmoothingQuality = "high";
	ctx.drawImage(canvas, 0, 0, outW, outH);

	// Aspect-ratio reshaping runs after the long-edge resize above, so it
	// always operates on the final, already-downscaled canvas rather than
	// the full-resolution source.
	const finalCanvas = stretchCanvasToAspectRatio(
		out,
		opts.aspectRatio ?? "original",
		opts.aspectRatioOrientation,
	);

	const requestedMime = opts.outputMime ?? "image/jpeg";
	const outBlob = await canvasToBlob(finalCanvas, requestedMime, opts.quality);

	const buffer = await outBlob.arrayBuffer();
	return {
		buffer,
		ext: mimeToExt(requestedMime),
		width: finalCanvas.width,
		height: finalCanvas.height,
		byteLength: buffer.byteLength,
	};
}

function canvasToBlob(
	canvas: HTMLCanvasElement,
	mime: string,
	quality: number,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob
					? resolve(blob)
					: reject(new Error("canvas.toBlob returned null")),
			mime,
			quality,
		);
	});
}

export function mimeToExt(mime: string): string {
	switch (mime) {
		case "image/jpeg":
			return "jpg";
		case "image/png":
			return "png";
		default:
			return "jpg";
	}
}
