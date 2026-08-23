import { describe, expect, it } from "vitest";

import { stretchCanvasToAspectRatio } from "../Services/AspectRatio";

// These tests focus purely on the dimension math: drawImage is mocked as a
// stub in test/setup.ts, so we only assert on the returned canvas's size
// and identity, not pixel content.
function makeCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	return canvas;
}

describe("stretchCanvasToAspectRatio", () => {
	it("returns the same canvas unchanged when ratio is 'original'", () => {
		const canvas = makeCanvas(2000, 1500);
		const result = stretchCanvasToAspectRatio(canvas, "original");
		expect(result).toBe(canvas);
		expect(result.width).toBe(2000);
		expect(result.height).toBe(1500);
	});

	it("stretches a landscape source to 16:9, anchoring the width", () => {
		const canvas = makeCanvas(2000, 1500); // 4:3 landscape
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).not.toBe(canvas);
		expect(result.width).toBe(2000);
		expect(result.height).toBe(Math.round(2000 * (9 / 16)));
		expect(result.height).toBe(1125);
	});

	it("auto-orients a portrait source to 9:16, anchoring the height", () => {
		const canvas = makeCanvas(1500, 2000); // 3:4 portrait
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).not.toBe(canvas);
		expect(result.height).toBe(2000);
		expect(result.width).toBe(Math.round(2000 * (9 / 16)));
		expect(result.width).toBe(1125);
	});

	it("stretches a near-square source noticeably (expected distortion)", () => {
		const canvas = makeCanvas(1000, 1000); // 1:1, treated as landscape (width >= height)
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).not.toBe(canvas);
		expect(result.width).toBe(1000);
		expect(result.height).toBe(563); // round(1000 * 9/16)
	});

	it("does nothing when the source already matches the target ratio", () => {
		const canvas = makeCanvas(1600, 900); // exactly 16:9
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).toBe(canvas);
		expect(result.width).toBe(1600);
		expect(result.height).toBe(900);
	});

	it("does nothing when the portrait source already matches 9:16", () => {
		const canvas = makeCanvas(900, 1600); // exactly 9:16
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).toBe(canvas);
		expect(result.width).toBe(900);
		expect(result.height).toBe(1600);
	});

	it("treats a ratio within tolerance as already matching", () => {
		// 16/9 ~= 1.7778; this is within 1% relative tolerance of that.
		const canvas = makeCanvas(1780, 1000);
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).toBe(canvas);
	});

	it("returns the source canvas unchanged for zero-dimension input", () => {
		const canvas = makeCanvas(0, 0);
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).toBe(canvas);
	});

	it("forces landscape on a portrait source, bypassing auto-detection", () => {
		const canvas = makeCanvas(1500, 2000); // 3:4 portrait
		const result = stretchCanvasToAspectRatio(canvas, "16:9", "landscape");
		expect(result).not.toBe(canvas);
		expect(result.width).toBe(2000); // long edge anchored, mapped to width
		expect(result.height).toBe(Math.round(2000 * (9 / 16)));
		expect(result.width).toBeGreaterThan(result.height); // wide result
	});

	it("forces portrait on a landscape source, bypassing auto-detection", () => {
		const canvas = makeCanvas(2000, 1500); // 4:3 landscape
		const result = stretchCanvasToAspectRatio(canvas, "16:9", "portrait");
		expect(result).not.toBe(canvas);
		expect(result.height).toBe(2000); // long edge anchored, mapped to height
		expect(result.width).toBe(Math.round(2000 * (9 / 16)));
		expect(result.height).toBeGreaterThan(result.width); // tall result
	});

	it("does nothing when forcing landscape on a source that already matches 16:9", () => {
		const canvas = makeCanvas(1600, 900); // exactly 16:9 landscape
		const result = stretchCanvasToAspectRatio(canvas, "16:9", "landscape");
		expect(result).toBe(canvas);
		expect(result.width).toBe(1600);
		expect(result.height).toBe(900);
	});

	it("does nothing when forcing portrait on a source that already matches 9:16", () => {
		const canvas = makeCanvas(900, 1600); // exactly 9:16 portrait
		const result = stretchCanvasToAspectRatio(canvas, "16:9", "portrait");
		expect(result).toBe(canvas);
		expect(result.width).toBe(900);
		expect(result.height).toBe(1600);
	});

	it("still stretches when the forced orientation opposes the source's already-matching ratio", () => {
		// Exactly 9:16 portrait, but forcing landscape means the target is
		// 16:9 instead — this should still stretch despite already matching 9:16.
		const canvas = makeCanvas(900, 1600);
		const result = stretchCanvasToAspectRatio(canvas, "16:9", "landscape");
		expect(result).not.toBe(canvas);
		expect(result.width).toBeGreaterThan(result.height);
	});

	it("matches all default 'auto' expectations when explicitly passed 'auto'", () => {
		const landscape = makeCanvas(2000, 1500);
		const landscapeAuto = stretchCanvasToAspectRatio(
			landscape,
			"16:9",
			"auto",
		);
		expect(landscapeAuto.width).toBe(2000);
		expect(landscapeAuto.height).toBe(1125);

		const portrait = makeCanvas(1500, 2000);
		const portraitAuto = stretchCanvasToAspectRatio(portrait, "16:9", "auto");
		expect(portraitAuto.height).toBe(2000);
		expect(portraitAuto.width).toBe(1125);

		const original = makeCanvas(2000, 1500);
		expect(stretchCanvasToAspectRatio(original, "original", "auto")).toBe(
			original,
		);

		const matching = makeCanvas(1600, 900);
		expect(stretchCanvasToAspectRatio(matching, "16:9", "auto")).toBe(
			matching,
		);
	});
});
