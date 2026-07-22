/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

/**
 * Image export utilities for PNG
 * Pure functions with no Obsidian API dependencies
 */

export type ExportFormat = "png" | "jpg";

/**
 * Parse a hex color string to {r, g, b}
 */
/*
function hexToRgb(hex: string): { r: number; g: number; b: number } {
	const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
	if (!match) return { r: 0, g: 0, b: 0 };
	return {
		r: parseInt(match[1], 16),
		g: parseInt(match[2], 16),
		b: parseInt(match[3], 16),
	};
}
*/
/**
 * Generate default filename with timestamp
 * @param prefix - Filename prefix (default: "scan")
 * @returns Filename like "scan-2026-01-12-095123"
 */
export function generateDefaultFilename(prefix = "scan"): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");

	return `${prefix}-${year}-${month}-${day}-${hours}${minutes}${seconds}`;
}

/**
 * Validate filename for filesystem compatibility
 * Rejects: empty, /, \, :, *, ?, <, >, |, "
 * @param filename - Filename to validate (without extension)
 * @returns Validation result with message
 */
export function validateFilename(filename: string): {
	valid: boolean;
	message: string;
} {
	if (!filename || filename.trim() === "") {
		return { valid: false, message: "Filename cannot be empty" };
	}

	const invalidChars = /[/\\:*?"<>|]/;
	if (invalidChars.test(filename)) {
		const matches = filename.match(invalidChars);
		const char = matches ? matches[0] : "";
		return {
			valid: false,
			message: `Filename contains invalid character: ${char}`,
		};
	}

	return { valid: true, message: "" };
}

/**
 * Resize canvas so its longest edge equals targetSize px, maintaining aspect ratio.
 * Returns the same canvas unchanged if it's already smaller.
 */
/*
export function resizeCanvas(
	canvas: HTMLCanvasElement,
	targetLongEdge = 2000,
): HTMLCanvasElement {
	const { width, height } = canvas;
	const longEdge = Math.max(width, height);
	if (longEdge <= targetLongEdge) return canvas;

	const scale = targetLongEdge / longEdge;
	const out = activeDocument.createElement("canvas");
	out.width = Math.round(width * scale);
	out.height = Math.round(height * scale);
	const outCtx = out.getContext("2d");
	if (outCtx) outCtx.drawImage(canvas, 0, 0, out.width, out.height);
	return out;
}
*/

/**
 * Export canvas to JPG blob
 * @param canvas - Canvas element to export
 * @param quality - JPEG quality (0.0 to 1.0, default 0.92)
 * @returns JPG blob
 */
/*
export function exportCanvasToJPG(
	canvas: HTMLCanvasElement,
	quality = 0.92,
): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error("Failed to create JPG blob"));
				}
			},
			"image/jpeg",
			quality,
		);
	});
}
*/

/**
 * Export canvas to PNG blob with transparent background
 * @param canvas - Canvas element to export
 * @returns PNG blob with maximum quality
 */
export function exportCanvasToPNG(canvas: HTMLCanvasElement): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error("Failed to create PNG blob"));
				}
			},
			"image/png",
			1.0, // Maximum quality
		);
	});
}

/**
 * Convert blob to ArrayBuffer for vault.createBinary()
 * @param blob - Blob to convert
 * @returns ArrayBuffer
 */
export async function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
	return await blob.arrayBuffer();
}

/**
 * Get file extension for export format
 * @param format - "png", or "jpg"
 * @returns File extension with dot (e.g., ".png")
 */
export function getFileExtension(format: ExportFormat): string {
	if (format === "png") return ".png";
	return ".jpg"; // Default to .jpg for now
}
