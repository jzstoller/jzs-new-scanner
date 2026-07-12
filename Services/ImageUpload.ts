/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

/**
 * iOS file readiness wrapper: retries until file.size > 0
 * iOS sometimes returns the File object before data is flushed to disk
 * @param file - File object from input picker
 * @param maxAttempts - Maximum retry attempts (default 20 = ~2 seconds at 100ms intervals)
 * @returns Resolved file promise or rejects after timeout
 */
function ensureFileReady(
	file: File,
	maxAttempts: number = 20,
): Promise<File> {
	return new Promise((resolve, reject) => {
		let attempts = 0;

		const checkFileSize = () => {
			attempts++;

			// File size is populated = file is ready
			if (file.size > 0) {
				console.debug(`[Photo] File ready on attempt ${attempts}, size: ${file.size}`);
				resolve(file);
				return;
			}

			// Max retries exceeded
			if (attempts >= maxAttempts) {
				const errorMsg = `[Photo] File still has size 0 after ${maxAttempts} attempts (2s timeout)`;
				console.warn(errorMsg);
				reject(new Error(errorMsg));
				return;
			}

			// Retry after 100ms
			window.setTimeout(checkFileSize, 100);
		};

		checkFileSize();
	});
}

export function uploadImageToCanvas(drawImageOnCanvas: (file: File) => void) {
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
			return;
		}

		try {
			// iOS workaround: wait until file size is populated
			const readyFile = await ensureFileReady(file);
			callbackFired = true;
			drawImageOnCanvas(readyFile);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			console.error("[Photo] Failed to ensure file is ready:", message);
			// Don't block UI; let user retry
		}

		// Clean up input so it can be used again
		input.value = "";
	};

	input.click();
}
