/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImagePreview } from "../UI/Components/ImagePreview";
import type { MockCtx } from "./setup";

describe("ImagePreview", () => {
	let parent: HTMLElement;
	let canvas: HTMLCanvasElement;
	let imagePreview: ImagePreview;
	let mockCtx: MockCtx;

	const loadImage = async (file: File) => {
		imagePreview.darawImage(file);
		await vi.runAllTimersAsync();
	};

	beforeEach(() => {
		vi.useFakeTimers();

		// Setup DOM elements
		parent = document.createElement("div");
		parent.style.width = "1000px";
		parent.style.height = "750px";
		Object.defineProperty(parent, "clientWidth", {
			configurable: true,
			value: 1000,
		});
		Object.defineProperty(parent, "clientHeight", {
			configurable: true,
			value: 750,
		});
		document.body.appendChild(parent);

		canvas = document.createElement("canvas");
		mockCtx = canvas.getContext("2d", {
			willReadFrequently: true,
		}) as unknown as MockCtx;

		imagePreview = new ImagePreview(parent, canvas, 4 / 3);
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe("setup", () => {
		it("should initialize the canvas and append to parent", () => {
			imagePreview.setup();

			expect(parent.contains(canvas)).toBe(true);
		});

		it("should throw error if canvas context is not available", () => {
			const badCanvas = document.createElement("canvas");
			badCanvas.getContext = vi.fn(() => null);

			const badPreview = new ImagePreview(parent, badCanvas, 4 / 3);

			expect(() => badPreview.setup()).toThrow(
				"Failed to get 2D contect",
			);
		});

		it("should initialize with rotation degree of 0", async () => {
			imagePreview.setup();

			// Load an image first
			const file = new File([""], "test.png", { type: "image/png" });
			await loadImage(file);

			mockCtx.clearRect.mockClear();

			// Rotate by 0 should still trigger redraw
			imagePreview.rotate(0);
			expect(mockCtx.clearRect).toHaveBeenCalled();
		});
	});

	describe("toggleCroppingPoints", () => {
		beforeEach(() => {
			imagePreview.setup();
		});

		it("should return error state when no image is loaded", () => {
			const result = imagePreview.toggleCroppingPoints(true);

			expect(result.success).toBe(false);
			expect(result.message).toBe("Please upload photo first!");
		});

		it("should show cropping points when image is loaded", async () => {
			const file = new File([""], "test.png", { type: "image/png" });
			await loadImage(file);

			const result = imagePreview.toggleCroppingPoints(true);
			expect(result.success).toBe(true);
		});

		it("should draw cropping points with correct message", async () => {
			const file = new File([""], "test.png", { type: "image/png" });
			await loadImage(file);

			mockCtx.beginPath.mockClear();
			mockCtx.arc.mockClear();

			const result = imagePreview.toggleCroppingPoints(true);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Cropping points displayed");
			expect(mockCtx.beginPath).toHaveBeenCalled();
			expect(mockCtx.arc).toHaveBeenCalled();
		});

		it("should remove cropping points when toggled off", async () => {
			const file = new File([""], "test.png", { type: "image/png" });
			await loadImage(file);

			// First show the points
			imagePreview.toggleCroppingPoints(true);

			mockCtx.clearRect.mockClear();

			// Then remove them
			const result = imagePreview.toggleCroppingPoints(false);

			expect(result.success).toBe(true);
			expect(result.message).toBe("Cropping points removed");
			expect(mockCtx.clearRect).toHaveBeenCalled();
		});

		it("should draw 4 cropping points at image corners", async () => {
			const file = new File([""], "test.png", { type: "image/png" });
			await loadImage(file);

			mockCtx.arc.mockClear();
			imagePreview.toggleCroppingPoints(true);

			// Should draw 4 points × 2 circles each (outer + inner) = 8 arcs
			expect(mockCtx.arc).toHaveBeenCalledTimes(8);
		});

		it("should draw connecting lines between crop points", async () => {
			const file = new File([""], "test.png", { type: "image/png" });
			await loadImage(file);

			mockCtx.moveTo.mockClear();
			mockCtx.lineTo.mockClear();
			mockCtx.closePath.mockClear();

			imagePreview.toggleCroppingPoints(true);

			expect(mockCtx.moveTo).toHaveBeenCalledTimes(1);
			expect(mockCtx.lineTo).toHaveBeenCalledTimes(3);
			expect(mockCtx.closePath).toHaveBeenCalledTimes(1);
		});

		it("should not remove points if they are not visible", async () => {
			const file = new File([""], "test.png", { type: "image/png" });
			await loadImage(file);

			// Try to remove without showing first
			const clearRectCalls = mockCtx.clearRect.mock.calls.length;
			imagePreview.toggleCroppingPoints(false);

			// clearRect should not be called additionally
			expect(mockCtx.clearRect.mock.calls.length).toBe(clearRectCalls);
		});
	});

	describe("darawImage", () => {
		beforeEach(() => {
			imagePreview.setup();
		});

		it("should load and draw image from file", async () => {
			const file = new File([""], "test.png", { type: "image/png" });

			mockCtx.drawImage.mockClear();
			mockCtx.fillRect.mockClear();

			await loadImage(file);

			expect(mockCtx.drawImage).toHaveBeenCalled();
			expect(mockCtx.fillRect).toHaveBeenCalled();
		});

		it("should create object URL for the file", () => {
			const file = new File([""], "test.png", { type: "image/png" });

			imagePreview.darawImage(file);

			expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
		});

		it("should revoke object URL after loading", async () => {
			const file = new File([""], "test.png", { type: "image/png" });

			await loadImage(file);

			expect(global.URL.revokeObjectURL).toHaveBeenCalled();
		});

		it("should clear canvas before drawing", async () => {
			const file = new File([""], "test.png", { type: "image/png" });

			mockCtx.clearRect.mockClear();

			await loadImage(file);

			expect(mockCtx.clearRect).toHaveBeenCalled();
		});

		it("should center image on canvas", async () => {
			const file = new File([""], "test.png", { type: "image/png" });

			mockCtx.drawImage.mockClear();

			await loadImage(file);

			const drawImageCall = mockCtx.drawImage.mock.calls[0];
			expect(drawImageCall).toBeDefined();
			expect(drawImageCall.length).toBeGreaterThan(0);
			// Image should be drawn (parameters exist)
			expect(drawImageCall[0]).toBeDefined(); // image
		});
	});
});
