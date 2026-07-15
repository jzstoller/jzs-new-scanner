/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { DiagnosticLogger } from "./DiagnosticLogger";

/**
 * iOS file readiness wrapper: validates file is fully written to disk
 * iOS sometimes returns File object before data is flushed
 * Checks: file.size > 0, file.type set (lastModified not required on iOS)
 * @param file - File object from input picker
 * @param maxAttempts - Retry attempts (default 50 = ~5 seconds at 100ms intervals)
 * @returns Resolved file promise or rejects after timeout
 */
function ensureFileReady(
	file: File,
	maxAttempts: number = 50,
): Promise<File> {
	return new Promise((resolve, reject) => {
		let attempts = 0;
		const startTime = Date.now();

		const checkFileReady = () => {
			attempts++;
			const elapsed = Date.now() - startTime;

			// Check file metadata: must have size and MIME type
			// Note: iOS sometimes returns lastModified=0, so we don't require it
			const isReady = file.size > 0 && file.type;

			if (isReady) {
				const msg = `[Photo] ✅ File ready after ${attempts} attempts (${elapsed}ms): ${file.size} bytes, type=${file.type}, name="${file.name}"`;
				console.debug(msg);
				DiagnosticLogger.log(msg);
				resolve(file);
				return;
			}

			// Detailed logging for debugging (only on early attempts)
			if (attempts <= 3) {
				DiagnosticLogger.log(
					`[Photo] ⏳ Attempt ${attempts}: size=${file.size}, type=${file.type || "(empty)"}, name="${file.name}"`,
				);
			} else if (attempts % 10 === 0) {
				// Log every 10 attempts to show progress
				DiagnosticLogger.log(
					`[Photo] ⏳ Still waiting... attempt ${attempts}/${maxAttempts} (${elapsed}ms)`,
				);
			}

			// Max retries exceeded (5 second timeout)
			if (attempts >= maxAttempts) {
				const errorMsg = `[Photo] ❌ File not ready after ${attempts} attempts (${elapsed}ms): size=${file.size}, type=${file.type || "(empty)"}. Possible causes: iOS cache delay, network buffering, or corrupted file.`;
				console.error(errorMsg);
				DiagnosticLogger.log(errorMsg);
				reject(new Error(errorMsg));
				return;
			}

			// Retry after 100ms
			window.setTimeout(checkFileReady, 100);
		};

		DiagnosticLogger.log(`[Photo] 🔍 Starting file readiness check for "${file.name}"`);
		checkFileReady();
	});
}

export function uploadImageToCanvas(
	drawImageOnCanvas: (file: File) => void,
	onError?: (message: string) => void,
) {
	DiagnosticLogger.log("[Photo] 📂 Opening file picker");
	const input: HTMLInputElement = activeDocument.createElement("input");
	input.type = "file";
	input.accept = "image/*";

	let callbackFired = false;
	let lastFileReceived: File | null = null;

	input.onchange = async (e: Event) => {
		DiagnosticLogger.log("[Photo] 🎯 Picker change event fired");

		// On iOS, multiple change events can fire; only process once we have a valid file
		if (callbackFired) {
			DiagnosticLogger.log("[Photo] ⚠️ Callback already fired, ignoring duplicate event");
			return;
		}

		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];

		// iOS can deliver null on first callback, real file on second
		// Only complain about cancellation if we never received any file
		if (!file) {
			if (!lastFileReceived) {
				DiagnosticLogger.log("[Photo] ⚠️ User cancelled picker (no file selected)");
			} else {
				DiagnosticLogger.log("[Photo] ℹ️ Change event fired but no file in files[0], waiting for next event");
			}
			return;
		}

		lastFileReceived = file;
		DiagnosticLogger.log(`[Photo] 📸 File received: "${file.name}" (${file.size} bytes, type="${file.type}")`);

		try {
			// iOS workaround: ensure file is fully written to disk
			// Retries up to 50 times over ~5 seconds
			DiagnosticLogger.log("[Photo] 🔐 Starting file readiness validation...");
			const readyFile = await ensureFileReady(file);
			callbackFired = true;
			DiagnosticLogger.log("[Photo] ✅ File validation passed! Opening scanner modal...");
			drawImageOnCanvas(readyFile);
		} catch (error) {
			callbackFired = true;
			const message =
				error instanceof Error
					? error.message
					: "Photo file could not be read. Please try again.";
			console.error("[Photo] ❌ File validation failed:", message);
			DiagnosticLogger.log(`[Photo] ❌ File validation failed: ${message}`);
			if (onError) {
				onError(message);
			}
		}

		// Clean up input so it can be used again
		input.value = "";
	};

	DiagnosticLogger.log("[Photo] 🖱️ Triggering file picker click");
	input.click();
}
