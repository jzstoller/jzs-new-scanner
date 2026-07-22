import { describe, expect, it } from "vitest";

import { compressCanvas } from "../Services/ImageCompress";

function makeCanvas(width: number, height: number): HTMLCanvasElement {
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		ctx.fillStyle = "#336699";
		ctx.fillRect(0, 0, width, height);
	}
	return canvas;
}

// These tests focus on the dimension/shape contract of compressCanvas: the
// long-edge resize, the optional aspect-ratio reshape that runs after it,
// and that omitting aspectRatio leaves existing behavior untouched.
describe("compressCanvas", () => {
	it("resizes to maxDimension and leaves aspect ratio untouched by default", async () => {
		const canvas = makeCanvas(4000, 3000); // 4:3, long edge 4000
		const result = await compressCanvas(canvas, {
			maxDimension: 2000,
			outputMime: "image/png",
		});
		expect(result.width).toBe(2000);
		expect(result.height).toBe(1500);
	});

	it("produces byte/dimension-identical output when aspectRatio is 'original'", async () => {
		const canvas = makeCanvas(4000, 3000);
		const withoutOption = await compressCanvas(canvas, {
			maxDimension: 2000,
			outputMime: "image/png",
		});
		const withOriginal = await compressCanvas(canvas, {
			maxDimension: 2000,
			outputMime: "image/png",
			aspectRatio: "original",
		});
		expect(withOriginal.width).toBe(withoutOption.width);
		expect(withOriginal.height).toBe(withoutOption.height);
		expect(withOriginal.byteLength).toBe(withoutOption.byteLength);
	});

	it("stretches a landscape result to 16:9 after the long-edge resize", async () => {
		const canvas = makeCanvas(4000, 3000); // 4:3 landscape, long edge 4000
		const result = await compressCanvas(canvas, {
			maxDimension: 2000,
			outputMime: "image/png",
			aspectRatio: "16:9",
		});
		// Long edge (2000, from the maxDimension clamp) stays fixed; the
		// short edge is derived from the 16:9 ratio afterward.
		expect(result.width).toBe(2000);
		expect(result.height).toBe(Math.round(2000 * (9 / 16)));
	});

	it("auto-orients a portrait result to 9:16 after the long-edge resize", async () => {
		const canvas = makeCanvas(3000, 4000); // 3:4 portrait, long edge 4000
		const result = await compressCanvas(canvas, {
			maxDimension: 2000,
			outputMime: "image/png",
			aspectRatio: "16:9",
		});
		expect(result.height).toBe(2000);
		expect(result.width).toBe(Math.round(2000 * (9 / 16)));
	});
});
