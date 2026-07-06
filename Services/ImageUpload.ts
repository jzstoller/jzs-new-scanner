/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

export function uploadImageToCanvas(drawImageOnCanvas: (file: File) => void) {
	const input: HTMLInputElement = activeDocument.createElement("input");
	input.type = "file";
	input.accept = "image/*";
	// Remove capture="camera" to allow both camera and photo library on mobile

	input.onchange = (e: Event) => {
		const target = e.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;
		drawImageOnCanvas(file);
		input.value = "";
	};
	input.click();
}
