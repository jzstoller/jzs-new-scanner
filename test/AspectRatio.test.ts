import { describe, expect, it } from "vitest";

import { stretchCanvasToAspectRatio } from "../Services/AspectRatio";

// These tests focus purely on the dimension math: drawImage is mocked as a
// no-op in test/setup.ts, so we only assert on the returned canvas's size
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

	it("is a no-op when the source already matches the target ratio", () => {
		const canvas = makeCanvas(1600, 900); // exactly 16:9
		const result = stretchCanvasToAspectRatio(canvas, "16:9");
		expect(result).toBe(canvas);
		expect(result.width).toBe(1600);
		expect(result.height).toBe(900);
	});

	it("is a no-op when the portrait source already matches 9:16", () => {
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
});
