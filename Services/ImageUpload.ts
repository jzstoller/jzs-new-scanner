/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

// The file input is created in the active document so Obsidian popouts and mobile webviews get the native picker.
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
