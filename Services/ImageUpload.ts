/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

/**
 * iOS file readiness wrapper: validates file is fully written to disk
 * iOS sometimes returns File object before data is flushed
 * Checks: file.size > 0, file.type set, file.lastModified recent
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

			// Check file metadata (size, type, timestamp)
			const isReady = file.size > 0 && file.type && file.lastModified > 0;

			if (isReady) {
				console.debug(
					`[Photo] File ready after ${attempts} attempts (${elapsed}ms): ${file.size} bytes, type=${file.type}`,
				);
				resolve(file);
				return;
			}

			// Detailed logging for debugging (only on early attempts)
			if (attempts <= 3) {
				console.debug(
					`[Photo] Attempt ${attempts}: size=${file.size}, type=${file.type || "(empty)"}, lastMod=${file.lastModified}`,
				);
			}

			// Max retries exceeded (5 second timeout)
			if (attempts >= maxAttempts) {
				const errorMsg = `[Photo] File not ready after ${attempts} attempts (${elapsed}ms): size=${file.size}, type=${file.type || "(empty)"}. Possible causes: iOS cache delay, network buffering, or corrupted file.`;
				console.error(errorMsg);
				reject(new Error(errorMsg));
				return;
			}

			// Retry after 100ms
			window.setTimeout(checkFileReady, 100);
		};

		checkFileReady();
	});
}

export function uploadImageToCanvas(
	drawImageOnCanvas: (file: File) => void,
	onError?: (message: string) => void,
) {
	const input: HTMLInputElement = activeDocument.createElement("input");
	input.type = "file";
	input.accept = "image/*";
	// Remove capture="camera" to allow both camera and photo library on mobile

	let callbackFired = false;

	input.onchange = async (e: Event) => {
		// Prevent duplicate processing if input fires multiple events
		if (callbackFired) {
			console.debug("[Photo] Input change already processed, ignoring duplicate event");
			return;
		}

		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) {
			console.warn("[Photo] No file selected");
			// Don't fire onError for user cancellation
			return;
		}

		try {
			// iOS workaround: ensure file is fully written to disk
			// Checks: file.size > 0, file.type set, file.lastModified valid
			const readyFile = await ensureFileReady(file);
			callbackFired = true;
			console.debug("[Photo] File validation passed, invoking image handler");
			drawImageOnCanvas(readyFile);
		} catch (error) {
			callbackFired = true;
			const message =
				error instanceof Error
					? error.message
					: "Photo file could not be read. Please try again.";
			console.error("[Photo] File validation failed:", message);
			if (onError) {
				onError(message);
			}
		}

		// Clean up input so it can be used again
		input.value = "";
	};

	input.click();
}
