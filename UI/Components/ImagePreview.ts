/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import {
	fillCanvasWithCheckerboard,
	renderCropPoints,
	renderMagnifier,
	renderPlaceholder,
} from "Services/CanvasRenderer";
import {
	initializeCropPoints,
	setCropPointDragging,
	updateCropPoint,
	validateCropPoints,
} from "Services/CropPointManager";
import {
	calculateRotatedDimensions,
	createImageFromImageData,
	drawImageWithRotation,
	performPerspectiveCrop,
} from "Services/ImageTransform";
import { findCropPointAtPosition } from "Services/Interaction";
import {
	CropPoint,
	CropPointStyle,
	MagnifierConfig,
	OperationResult,
	PlaceholderConfig,
} from "Services/types";

// ImagePreview owns the interactive canvas state so the modal only orchestrates loading, cropping, and export actions.
export class ImagePreview {
	private parent: HTMLElement;
	private canvas: HTMLCanvasElement;
	private ctx!: CanvasRenderingContext2D;
	private ratio: number;
	private img!: HTMLImageElement;

	// Store image position and dimensions for future reference
	private imgX!: number;
	private imgY!: number;
	private imgWidth!: number;
	private imgHeight!: number;

	// for continuous rotation
	private toRotateDegree!: number;

	// for cropping points
	private croppingPointsVisible!: boolean;
	private cropPoints!: CropPoint[];
	private draggedPointIndex!: number;

	// Configuration
	private magnifierConfig: MagnifierConfig;
	private cropPointStyle: CropPointStyle;
	private placeholderConfig: PlaceholderConfig;

	constructor(
		parent: HTMLElement,
		element: HTMLCanvasElement,
		ratio: number,
	) {
		this.parent = parent;
		this.canvas = element;
		this.ratio = ratio;

		// Initialize configurations
		this.magnifierConfig = {
			radius: 60,
			zoom: 2.5,
			offset: 90,
		};

		this.cropPointStyle = {
			outerRadius: 12,
			innerRadius: 7,
			outerColor: "#ffffff",
			innerColor: "#3b82f6",
			lineColor: "#3b82f6",
			lineWidth: 2,
		};

		this.placeholderConfig = {
			primaryText: "Upload or take a picture",
			// secondaryText: "to process your note",
			backgroundColor: "#f5f5f5",
			iconColor: "#888888",
			textColor: "#888888",
			secondaryTextColor: "#aaaaaa",
		};
	}

	public setup() {
		const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
		if (!ctx) throw new Error("Failed to get 2D contect");
		this.ctx = ctx;

		this.parent.appendChild(this.canvas);
		this.toRotateDegree = 0;
		this.croppingPointsVisible = false;
		this.cropPoints = [];
		this.draggedPointIndex = -1;

		// Setup input event handlers (mouse and touch)
		this.setupInputEvents();

		// Wait for next frame to ensure parent has dimensions
		window.requestAnimationFrame(() => {
			this.resize();
			this.initializePlaceholder();
		});
	}

	private setupInputEvents() {
		// Mouse events (desktop)
		this.canvas.addEventListener("mousedown", this.onMouseDown.bind(this));
		this.canvas.addEventListener("mousemove", this.onMouseMove.bind(this));
		this.canvas.addEventListener("mouseup", this.onMouseUp.bind(this));

		// Touch events (mobile)
		this.canvas.addEventListener(
			"touchstart",
			this.onTouchStart.bind(this),
			{ passive: false },
		);
		this.canvas.addEventListener("touchmove", this.onTouchMove.bind(this), {
			passive: false,
		});
		this.canvas.addEventListener("touchend", this.onTouchEnd.bind(this));
	}

	/**
	 * Get pointer position from mouse or touch event
	 * @param event - Mouse or Touch event
	 * @returns Position {x, y} relative to canvas, or null if invalid
	 */
	private getPointerPositionFromMouse(event: MouseEvent): {
		x: number;
		y: number;
	} {
		const rect = this.canvas.getBoundingClientRect();
		const computedStyle = window.getComputedStyle(this.canvas);
		const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
		const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
		return {
			x: event.clientX - rect.left - borderLeft,
			y: event.clientY - rect.top - borderTop,
		};
	}

	private getPointerPositionFromTouch(
		event: TouchEvent,
	): { x: number; y: number } | null {
		if (event.touches.length === 0) return null;
		const rect = this.canvas.getBoundingClientRect();
		const computedStyle = window.getComputedStyle(this.canvas);
		const borderLeft = parseFloat(computedStyle.borderLeftWidth) || 0;
		const borderTop = parseFloat(computedStyle.borderTopWidth) || 0;
		return {
			x: event.touches[0].clientX - rect.left - borderLeft,
			y: event.touches[0].clientY - rect.top - borderTop,
		};
	}

	private onMouseDown(event: MouseEvent) {
		if (!this.croppingPointsVisible || this.cropPoints.length === 0) {
			return;
		}

		const pos = this.getPointerPositionFromMouse(event);

		// Find which crop point (if any) was clicked (20px hit area)
		const clickedIndex = findCropPointAtPosition(
			pos.x,
			pos.y,
			this.cropPoints,
			20,
		);

		if (clickedIndex !== -1) {
			this.draggedPointIndex = clickedIndex;
			this.cropPoints = setCropPointDragging(
				this.cropPoints,
				clickedIndex,
				true,
			);
		} else {
			this.draggedPointIndex = -1;
		}
	}

	private onMouseMove(event: MouseEvent) {
		if (this.draggedPointIndex === -1) {
			return;
		}

		const pos = this.getPointerPositionFromMouse(event);

		// Update the dragged crop point's position
		this.cropPoints = updateCropPoint(
			this.cropPoints,
			this.draggedPointIndex,
			pos.x,
			pos.y,
		);

		// Redraw the image only (no crop points yet)
		this.redrawImage();

		// Draw magnifier (samples clean canvas without crop points)
		this.renderMagnifierAtPoint(pos.x, pos.y);

		// Draw crop points on top (all at full opacity, outside magnifier)
		this.renderCroppingPointsOnCanvas();
	}

	private onMouseUp(event: MouseEvent) {
		if (this.draggedPointIndex === -1) {
			return;
		}

		// Reset dragging state for all points
		this.cropPoints = setCropPointDragging(this.cropPoints, -1, false);
		this.draggedPointIndex = -1;

		// Redraw without magnifier
		this.redrawCroppingPoints();
	}

	private onTouchStart(event: TouchEvent) {
		if (!this.croppingPointsVisible || this.cropPoints.length === 0) {
			return;
		}

		event.preventDefault();

		const pos = this.getPointerPositionFromTouch(event);
		if (!pos) return;

		// Find which crop point (if any) was touched (30px hit area for touch)
		const clickedIndex = findCropPointAtPosition(
			pos.x,
			pos.y,
			this.cropPoints,
			30,
		);

		if (clickedIndex !== -1) {
			this.draggedPointIndex = clickedIndex;
			this.cropPoints = setCropPointDragging(
				this.cropPoints,
				clickedIndex,
				true,
			);
		} else {
			this.draggedPointIndex = -1;
		}
	}

	private onTouchMove(event: TouchEvent) {
		if (this.draggedPointIndex === -1) {
			return;
		}

		event.preventDefault();

		const pos = this.getPointerPositionFromTouch(event);
		if (!pos) return;

		// Update the dragged crop point's position
		this.cropPoints = updateCropPoint(
			this.cropPoints,
			this.draggedPointIndex,
			pos.x,
			pos.y,
		);

		// Redraw the image only (no crop points yet)
		this.redrawImage();

		// Draw magnifier (samples clean canvas without crop points)
		this.renderMagnifierAtPoint(pos.x, pos.y);

		// Draw crop points on top (all at full opacity, outside magnifier)
		this.renderCroppingPointsOnCanvas();
	}

	private onTouchEnd(event: TouchEvent) {
		if (this.draggedPointIndex === -1) {
			return;
		}

		// Reset dragging state for all points
		this.cropPoints = setCropPointDragging(this.cropPoints, -1, false);
		this.draggedPointIndex = -1;

		// Redraw without magnifier
		this.redrawCroppingPoints();
	}

	private resize() {
		const parentWidth = this.parent.clientWidth;

		// Reduced divisor from 1.4 to 1.15 for larger canvas on all devices
		const width: number = parentWidth / 1.15;
		const height: number = width / this.ratio;

		/*
		How dpr works?
			It tells you
			How many physical device's pixel(how many px canvas actually use) is equal to
			css size's pixel(how big on screen) on screen
			2 px on physical device is equal to 1 px of css size
			So, it has dpr 2.
		*/
		const dpr: number = window.devicePixelRatio || 1;

		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;

		this.canvas.width = Math.floor(width * dpr);
		this.canvas.height = Math.floor(height * dpr);

		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	/**
	 * Resize canvas to match the uploaded image's aspect ratio
	 * This ensures maximum resolution usage with no letterboxing
	 * @param imageWidth - Width of the source image
	 * @param imageHeight - Height of the source image
	 */
	private resizeToImage(imageWidth: number, imageHeight: number) {
		const parentWidth = this.parent.clientWidth;
		const parentHeight = this.parent.clientHeight;

		// Calculate image aspect ratio
		const imageRatio = imageWidth / imageHeight;

		// Start with width-constrained size
		let canvasWidth = parentWidth / 1.15;
		let canvasHeight = canvasWidth / imageRatio;

		// Cap maximum height at 80% of parent to leave space for buttons
		const maxHeight = parentHeight * 0.8;
		if (canvasHeight > maxHeight) {
			canvasHeight = maxHeight;
			canvasWidth = canvasHeight * imageRatio;
		}

		// Apply DPR for sharp rendering
		const dpr: number = window.devicePixelRatio || 1;

		this.canvas.style.width = `${canvasWidth}px`;
		this.canvas.style.height = `${canvasHeight}px`;

		this.canvas.width = Math.floor(canvasWidth * dpr);
		this.canvas.height = Math.floor(canvasHeight * dpr);

		this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}

	private getDisplayDimensions(): { width: number; height: number } {
		return {
			width: parseInt(this.canvas.style.width),
			height: parseInt(this.canvas.style.height),
		};
	}

	private getSourceDimensions(): { width: number; height: number } {
		if (!this.img) {
			throw new Error("No image loaded");
		}

		const sourceWidth = this.img.naturalWidth || this.img.width;
		const sourceHeight = this.img.naturalHeight || this.img.height;
		return calculateRotatedDimensions(
			sourceWidth,
			sourceHeight,
			this.toRotateDegree,
		);
	}

	private createHighResWorkingCanvas(): HTMLCanvasElement {
		if (!this.img) {
			throw new Error("No image loaded");
		}

		const dimensions = this.getSourceDimensions();
		const workingCanvas = activeDocument.createElement("canvas");
		workingCanvas.width = dimensions.width;
		workingCanvas.height = dimensions.height;

		const workingCtx = workingCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		if (!workingCtx) {
			throw new Error("Failed to create working canvas context");
		}

		drawImageWithRotation(
			workingCtx,
			this.img,
			dimensions.width,
			dimensions.height,
			this.toRotateDegree,
		);

		return workingCanvas;
	}

	private initializePlaceholder() {
		const cssWidth = parseInt(this.canvas.style.width);
		const cssHeight = parseInt(this.canvas.style.height);
		// const dpr = window.devicePixelRatio || 1;

		renderPlaceholder(
			this.ctx,
			cssWidth,
			cssHeight,
			this.placeholderConfig,
		);
	}

	public darawImage(file: File, onReady?: () => void) {
		// Clean up previous object URL if exists
		if (this.img?.src?.startsWith("blob:")) {
			URL.revokeObjectURL(this.img.src);
		}

		const objectUrl = URL.createObjectURL(file);
		const img = new Image();
		img.src = objectUrl;

		img.decode()
			.then(() => {
				this.img = img;
				URL.revokeObjectURL(objectUrl);
				this.resizeToImage(
					this.img.naturalWidth,
					this.img.naturalHeight,
				);

				// Wait for layout flush so canvas CSS dimensions are readable
				window.requestAnimationFrame(() => {
					const cssWidth = parseInt(this.canvas.style.width);
					const cssHeight = parseInt(this.canvas.style.height);

					if (!cssWidth || !cssHeight) {
						console.error(
							"Canvas dimensions not ready after layout flush",
						);
						return;
					}

					fillCanvasWithCheckerboard(this.ctx, cssWidth, cssHeight);

					this.imgX = 0;
					this.imgY = 0;
					this.imgWidth = cssWidth;
					this.imgHeight = cssHeight;

					this.ctx.drawImage(this.img, 0, 0, cssWidth, cssHeight);

					onReady?.();
				});
			})
			.catch((err) => {
				console.error("Failed to decode image:", err);
				URL.revokeObjectURL(objectUrl);
			});
	}

	private redrawImage() {
		const cssWidth = parseInt(this.canvas.style.width);
		const cssHeight = parseInt(this.canvas.style.height);

		// Draw checkerboard pattern first for transparency visibility
		fillCanvasWithCheckerboard(this.ctx, cssWidth, cssHeight);

		// Draw the rotated image
		drawImageWithRotation(
			this.ctx,
			this.img,
			cssWidth,
			cssHeight,
			this.toRotateDegree,
		);
	}

	public rotate(degree: number): OperationResult {
		// Check if image is loaded
		if (this.img == null) {
			return {
				success: false,
				message: "Please upload photo first!",
			};
		}

		// Clear crop points for safety (positions become invalid after rotation)
		this.removeCroppingPoints();

		// Update rotation degree
		this.toRotateDegree = this.toRotateDegree + degree;

		// Calculate new dimensions based on rotation
		const newDimensions = calculateRotatedDimensions(
			this.img.width,
			this.img.height,
			this.toRotateDegree,
		);

		// Resize canvas to match rotated dimensions
		this.resizeToImage(newDimensions.width, newDimensions.height);

		// Update image dimensions to match new canvas size
		const cssWidth = parseInt(this.canvas.style.width);
		const cssHeight = parseInt(this.canvas.style.height);
		this.imgWidth = cssWidth;
		this.imgHeight = cssHeight;

		// Redraw the image with new rotation
		this.redrawImage();

		return {
			success: true,
			message: "Image rotated successfully",
		};
	}

	private drawCroppingPoints(detectedPoints?: CropPoint[]) {
		// Use detected points if provided, otherwise initialize at corners
		if (detectedPoints && detectedPoints.length === 4) {
			this.cropPoints = detectedPoints;
		} else {
			this.cropPoints = initializeCropPoints({
				x: this.imgX,
				y: this.imgY,
				width: this.imgWidth,
				height: this.imgHeight,
			});
		}

		this.renderCroppingPointsOnCanvas();
		this.croppingPointsVisible = true;
	}

	private renderCroppingPointsOnCanvas() {
		renderCropPoints(this.ctx, this.cropPoints, this.cropPointStyle);
	}

	private redrawCroppingPoints() {
		// Redraw the image (this clears the old crop points)
		this.redrawImage();

		// Render crop points at their updated positions
		this.renderCroppingPointsOnCanvas();
	}

	private renderMagnifierAtPoint(pointX: number, pointY: number) {
		const cssWidth = parseInt(this.canvas.style.width);
		const cssHeight = parseInt(this.canvas.style.height);

		renderMagnifier(
			this.ctx,
			pointX,
			pointY,
			cssWidth,
			cssHeight,
			this.magnifierConfig,
		);
	}

	private removeCroppingPoints() {
		if (!this.croppingPointsVisible) return;

		// Redraw the image to remove the crop points
		this.redrawImage();

		this.cropPoints = [];
		this.croppingPointsVisible = false;
	}

	public toggleCroppingPoints(
		show: boolean,
		detectedPoints?: CropPoint[],
	): OperationResult {
		let state = false;
		let message = "";
		if (this.img == null) {
			state = false;
			message = "Please upload photo first!";
		} else {
			if (show) {
				this.drawCroppingPoints(detectedPoints);
				state = true;
				message = detectedPoints
					? "Auto-detected corners displayed"
					: "Cropping points displayed";
			} else {
				this.removeCroppingPoints();
				state = true;
				message = "Cropping points removed";
			}
		}
		return { success: state, message };
	}

	/**
	 * Perform perspective crop transformation
	 * Transforms the quadrilateral defined by crop points into a rectangle
	 * @returns Object with success status and message
	 */
	public performPerspectiveCrop(): OperationResult {
		// Validate crop points exist
		if (!validateCropPoints(this.cropPoints)) {
			return {
				success: false,
				message:
					"Need exactly 4 valid crop points. Please show crop points first.",
			};
		}

		// Validate image exists
		if (!this.img) {
			return {
				success: false,
				message: "No image loaded. Please upload an image first.",
			};
		}

		const workingCanvas = this.createHighResWorkingCanvas();
		const workingCtx = workingCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		if (!workingCtx) {
			return {
				success: false,
				message: "Failed to create working canvas context.",
			};
		}

		const sourceImageData = workingCtx.getImageData(
			0,
			0,
			workingCanvas.width,
			workingCanvas.height,
		);

		const displayDimensions = this.getDisplayDimensions();
		const scaleX = workingCanvas.width / displayDimensions.width;
		const scaleY = workingCanvas.height / displayDimensions.height;
		const scaledCropPoints = this.cropPoints.map((point) => ({
			...point,
			x: point.x * scaleX,
			y: point.y * scaleY,
		}));

		// Perform the transformation
		const result = performPerspectiveCrop(
			sourceImageData,
			workingCanvas.width,
			workingCanvas.height,
			scaledCropPoints,
			1,
		);

		if (!result.success || !result.imageData || !result.dimensions) {
			return {
				success: result.success,
				message: result.message,
			};
		}

		// Create new image from the result
		createImageFromImageData(
			result.imageData,
			result.dimensions.width,
			result.dimensions.height,
		)
			.then((croppedImage) => {
				// Replace the current image with the cropped version
				this.img = croppedImage;

				// Reset rotation
				this.toRotateDegree = 0;

				// Resize canvas to match the cropped image dimensions
				this.resizeToImage(this.img.width, this.img.height);

				// Update image dimensions to match new canvas size
				const cssWidth = parseInt(this.canvas.style.width);
				const cssHeight = parseInt(this.canvas.style.height);
				this.imgX = 0;
				this.imgY = 0;
				this.imgWidth = cssWidth;
				this.imgHeight = cssHeight;

				// Redraw the cropped image
				this.redrawImage();

				// Hide crop points
				this.cropPoints = [];
				this.croppingPointsVisible = false;
			})
			.catch((error) => {
				console.error("Error creating image from crop:", error);
			});

		return {
			success: true,
			message: "Perspective crop applied successfully",
		};
	}

	/**
	 * Check if an image is loaded
	 * @returns true if image is loaded, false otherwise
	 */
	public isImageLoaded(): boolean {
		return this.img != null;
	}

	/**
	 * Get canvas element for export
	 * @returns Canvas element
	 */
	public getCanvas(): HTMLCanvasElement {
		return this.canvas;
	}

	/**
	 * Get a clean export canvas without checkerboard background
	 * Creates a temporary canvas with only the image content
	 * @returns Canvas element ready for export with transparent background
	 */
	public getExportCanvas(targetLongEdge?: number): HTMLCanvasElement {
		if (!this.img) {
			throw new Error("No image loaded");
		}

		const dimensions = this.getSourceDimensions();

		// Apply resize at canvas creation time so the encoder never sees the full-res image
		let exportWidth = dimensions.width;
		let exportHeight = dimensions.height;
		if (targetLongEdge) {
			const longEdge = Math.max(exportWidth, exportHeight);
			if (longEdge > targetLongEdge) {
				const scale = targetLongEdge / longEdge;
				exportWidth = Math.round(exportWidth * scale);
				exportHeight = Math.round(exportHeight * scale);
			}
		}

		const exportCanvas = activeDocument.createElement("canvas");
		exportCanvas.width = exportWidth;
		exportCanvas.height = exportHeight;
		const exportCtx = exportCanvas.getContext("2d", {
			willReadFrequently: true,
		});

		if (!exportCtx) {
			throw new Error("Failed to create export canvas context");
		}

		drawImageWithRotation(
			exportCtx,
			this.img,
			exportWidth,
			exportHeight,
			this.toRotateDegree,
		);

		return exportCanvas;
	}
}
