import { App, ButtonComponent, Modal, Notice } from "obsidian";
import { uploadImageToCanvas } from "Services/ImageUpload";
import { detectPageCorners } from "Services/PageDetection";
import { ImagePreview } from "UI/Components/ImagePreview";
import { ExportControls } from "UI/Components/ExportControls";
import type HandWrittenPlugin from "../../main";

export class ScannerModal extends Modal {
	private plugin: HandWrittenPlugin;
	private container: HTMLElement;
	private buttonWrapper: HTMLElement;
	private confirmButtonWrapper: HTMLElement;
	private canvas: ImagePreview;
	private btnPhotoUpload: ButtonComponent;
	private btnDetectCorners: ButtonComponent;
	private btnCrop: ButtonComponent;
	private btnExport: ButtonComponent;
	private btnConfirm: ButtonComponent;
	private btnCancel: ButtonComponent;
	private processingNotice: Notice | null;
	private exportControls: ExportControls;

	constructor(app: App, plugin: HandWrittenPlugin) {
		super(app);
		this.plugin = plugin;
		this.setTitle("Scan image");
		this.modalEl.addClass("scanner-modal");

		this.container = this.contentEl.createDiv("scanner-modal-container");
		this.canvas = new ImagePreview(
			this.container,
			this.container.createEl("canvas"),
			1,  // Square 1:1 ratio for initial placeholder
		);

		this.buttonWrapper = this.contentEl.createDiv("button-wrapper");
		this.confirmButtonWrapper = this.contentEl.createDiv(
			"confirm-button-wrapper",
		);
		this.confirmButtonWrapper.hide();
		this.processingNotice = null;
	}

	onOpen() {
		try {
			this.canvas.setup();
		} catch (error) {
			console.error(`Error: ${error.message}`);
			new Notice(
				"Cannot create image preview canvas, please review details in console",
			);
		}

		this.btnPhotoUpload = new ButtonComponent(this.buttonWrapper)
			.setIcon("image")
			.setTooltip("Upload image from gallery")
			.setCta()
			.onClick(() =>
				uploadImageToCanvas((file) => {
					this.canvas.darawImage(file, () => this.detectAndShowCorners());
				}),
			);

		this.btnDetectCorners = new ButtonComponent(this.buttonWrapper)
			.setIcon("scan")
			.setTooltip("Detect page corners")
			.onClick(() => this.detectAndShowCorners());

		this.btnCrop = new ButtonComponent(this.buttonWrapper)
			.setIcon("crop")
			.setTooltip("Crop image")
			.onClick(() => this.toggleCropMode());

		// Initialize export controls
		this.exportControls = new ExportControls(
			this.app,
			(targetLongEdge?: number) => this.canvas.getExportCanvas(targetLongEdge),
			this.plugin,
			() => this.canvas.isImageLoaded(),
			() => this.close(),
		);
		this.btnExport = this.exportControls.createExportButton(this.buttonWrapper);

		// Confirmation buttons
		this.btnConfirm = new ButtonComponent(this.confirmButtonWrapper)
			.setIcon("check")
			.setTooltip("Confirm")
			.setCta()
			.onClick(() => this.confirmCrop());

		this.btnCancel = new ButtonComponent(this.confirmButtonWrapper)
			.setIcon("x")
			.setTooltip("Cancel")
			.onClick(() => this.cancelCrop());
	}

	private detectAndShowCorners() {
		if (!this.canvas.isImageLoaded()) {
			new Notice("Please upload photo first!");
			return;
		}

		// Get image data for page detection
		const previewCanvas = this.canvas.getCanvas();
		const ctx = previewCanvas.getContext("2d");
		if (!ctx) {
			new Notice("Failed to get canvas context");
			return;
		}

		const imageData = ctx.getImageData(0, 0, previewCanvas.width, previewCanvas.height);
		const dpr = window.devicePixelRatio || 1;

		new Notice("Detecting page corners...", 2000);

		// Attempt auto-detection
		const detectedCorners = detectPageCorners(imageData);

		if (detectedCorners) {
			const dpr = window.devicePixelRatio || 1;
			const scaledCorners = detectedCorners.map(corner => ({
				x: corner.x / dpr,
				y: corner.y / dpr,
				isDragging: false,
			}));

			const { success } = this.canvas.toggleCroppingPoints(true, scaledCorners);
			if (success) {
				this.buttonWrapper.hide();
				this.confirmButtonWrapper.show();
			} else {
				new Notice("Failed to display detected corners");
			}
		} else {
			new Notice("✗ No page corners detected. Try adjusting the image or use manual crop.", 5000);
		}
	}

	private toggleCropMode() {
		const { success, message } = this.canvas.toggleCroppingPoints(true);
		new Notice(message);
		if (!success) {
			return;
		}
		// Hide main buttons and show confirm/cancel buttons
		this.buttonWrapper.hide();
		this.confirmButtonWrapper.show();
	}

	private async confirmCrop() {
		try {
			// Show processing notice
			this.processingNotice = new Notice("Processing perspective crop...", 0);

			// Disable buttons during processing
			this.setButtonsEnabled(false);

			// Add a small delay to allow UI to update
			await new Promise(resolve => setTimeout(resolve, 100));

			// Perform the perspective crop
			const result = this.canvas.performPerspectiveCrop();

			// Hide processing notice
			if (this.processingNotice) {
				this.processingNotice.hide();
				this.processingNotice = null;
			}

			if (result.success) {
				// Show success message
				new Notice(result.message, 3000);

				// Wait a brief moment for the crop to render
				await new Promise(resolve => setTimeout(resolve, 100));

				// Hide crop confirmation buttons and show main buttons
				this.confirmButtonWrapper.hide();
				this.buttonWrapper.show();

				// Re-enable buttons
				this.setButtonsEnabled(true);
			} else {
				// Show error message
				new Notice(result.message, 5000);

				// Re-enable buttons so user can try again or cancel
				this.setButtonsEnabled(true);
			}
		} catch (error) {
			// Hide processing notice if it's still showing
			if (this.processingNotice) {
				this.processingNotice.hide();
				this.processingNotice = null;
			}

			// Log error for debugging
			console.error("Error in confirmCrop:", error);

			// Show user-friendly error message
			new Notice(
				`Crop failed: ${error.message || "Unknown error"}\nCheck console for details.`,
				6000,
			);

			// Re-enable buttons
			this.setButtonsEnabled(true);
		}
	}

	private cancelCrop() {
		// Remove the cropping points
		const { message } = this.canvas.toggleCroppingPoints(false);
		new Notice(message, 2000);

		// Hide crop confirmation buttons and show main buttons
		this.confirmButtonWrapper.hide();
		this.buttonWrapper.show();
	}

	/**
	 * Enable or disable all buttons during processing
	 */
	private setButtonsEnabled(enabled: boolean) {
		// Main buttons
		this.btnPhotoUpload.setDisabled(!enabled);
		this.btnDetectCorners.setDisabled(!enabled);
		this.btnCrop.setDisabled(!enabled);
		this.btnExport.setDisabled(!enabled);

		// Confirmation buttons
		this.btnConfirm.setDisabled(!enabled);
		this.btnCancel.setDisabled(!enabled);
	}

	onClose() {
		// Clean up processing notice if modal is closed while processing
		if (this.processingNotice) {
			this.processingNotice.hide();
			this.processingNotice = null;
		}

		// Clean up export controls
		if (this.exportControls) {
			// No destroy method needed, just null it
		}
	}
}
