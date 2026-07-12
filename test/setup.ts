/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { beforeEach, vi } from "vitest";

// Create a shared mock context that persists across operations
export interface MockCtx {
	canvas: HTMLCanvasElement;
	clearRect: ReturnType<typeof vi.fn>;
	fillRect: ReturnType<typeof vi.fn>;
	fillStyle: string;
	strokeStyle: string;
	lineWidth: number;
	lineCap: string;
	lineJoin: string;
	textAlign: string;
	textBaseline: string;
	font: string;
	setTransform: ReturnType<typeof vi.fn>;
	save: ReturnType<typeof vi.fn>;
	restore: ReturnType<typeof vi.fn>;
	translate: ReturnType<typeof vi.fn>;
	rotate: ReturnType<typeof vi.fn>;
	scale: ReturnType<typeof vi.fn>;
	drawImage: ReturnType<typeof vi.fn>;
	beginPath: ReturnType<typeof vi.fn>;
	moveTo: ReturnType<typeof vi.fn>;
	lineTo: ReturnType<typeof vi.fn>;
	closePath: ReturnType<typeof vi.fn>;
	stroke: ReturnType<typeof vi.fn>;
	fill: ReturnType<typeof vi.fn>;
	arc: ReturnType<typeof vi.fn>;
	fillText: ReturnType<typeof vi.fn>;
	strokeRect: ReturnType<typeof vi.fn>;
	getImageData: ReturnType<typeof vi.fn>;
	putImageData: ReturnType<typeof vi.fn>;
}
let mockCtx: MockCtx;

// Mock HTMLCanvasElement methods that are not available in happy-dom
beforeEach(() => {
	// Initialize fresh mocks for each test
	mockCtx = {
		canvas: document.createElement("canvas"),
		clearRect: vi.fn(),
		fillRect: vi.fn(),
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 0,
		lineCap: "",
		lineJoin: "",
		textAlign: "",
		textBaseline: "",
		font: "",
		setTransform: vi.fn(),
		save: vi.fn(),
		restore: vi.fn(),
		translate: vi.fn(),
		rotate: vi.fn(),
		scale: vi.fn(),
		drawImage: vi.fn(),
		beginPath: vi.fn(),
		moveTo: vi.fn(),
		lineTo: vi.fn(),
		closePath: vi.fn(),
		stroke: vi.fn(),
		fill: vi.fn(),
		arc: vi.fn(),
		fillText: vi.fn(),
		strokeRect: vi.fn(),
		getImageData: vi.fn(
			(x: number, y: number, width: number, height: number) =>
				new ImageData(width, height),
		),
		putImageData: vi.fn(),
	};

	// Mock canvas getContext to return our shared mock
	HTMLCanvasElement.prototype.getContext = vi.fn((contextType: string) => {
		if (contextType === "2d") {
			return mockCtx as unknown as CanvasRenderingContext2D;
		}
		return null;
	}) as unknown as typeof HTMLCanvasElement.prototype.getContext;

	// Mock Image
	global.Image = class Image {
		src = "";
		width = 800;
		height = 600;
		naturalWidth = 800;
		naturalHeight = 600;
		onload: (() => void) | null = null;
		onerror: (() => void) | null = null;
		decode = vi.fn(() => Promise.resolve());

		constructor() {
			setTimeout(() => {
				if (this.onload) {
					this.onload();
				}
			}, 0);
		}
	} as unknown as typeof global.Image;

	// Mock URL.createObjectURL and revokeObjectURL
	global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
	global.URL.revokeObjectURL = vi.fn();

	// Mock window.devicePixelRatio
	Object.defineProperty(window, "devicePixelRatio", {
		writable: true,
		configurable: true,
		value: 2,
	});

	// Mock requestAnimationFrame
	global.requestAnimationFrame = vi.fn((cb) => {
		cb(0);
		return 0;
	});

	// Mock ImageData for filter tests
	global.ImageData = class ImageData {
		data: Uint8ClampedArray;
		width: number;
		height: number;

		constructor(width: number, height: number);
		constructor(data: Uint8ClampedArray, width: number, height?: number);
		constructor(
			dataOrWidth: Uint8ClampedArray | number,
			widthOrHeight: number,
			height?: number,
		) {
			if (typeof dataOrWidth === "number") {
				// new ImageData(width, height)
				this.width = dataOrWidth;
				this.height = widthOrHeight;
				this.data = new Uint8ClampedArray(this.width * this.height * 4);
			} else {
				// new ImageData(data, width, height?)
				this.data = dataOrWidth;
				this.width = widthOrHeight;
				this.height =
					height || Math.floor(dataOrWidth.length / (this.width * 4));
			}
		}
	} as unknown as typeof global.ImageData;
});
