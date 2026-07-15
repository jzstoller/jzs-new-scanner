/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { App, ButtonComponent, Modal, Notice } from "obsidian";
import { uploadImageToCanvas } from "Services/ImageUpload";
import { detectPageCorners } from "Services/PageDetection";
import { DiagnosticLogger } from "Services/DiagnosticLogger";
import { ExportControls } from "UI/Components/ExportControls";
import { ImagePreview } from "UI/Components/ImagePreview";
import type ScannerPlugin from "../../main";

export class ScannerModal extends Modal {
	private plugin: ScannerPlugin;
	private initialFile: File | null;
	private container: HTMLElement;
	private buttonWrapper: HTMLElement;
	private confirmButtonWrapper: HTMLElement;
	private canvas: ImagePreview;
	private btnPhotoUpload!: ButtonComponent;
	private btnDetectCorners!: ButtonComponent;
	private btnCrop!: ButtonComponent;
	private btnExport!: ButtonComponent;
	private btnConfirm!: ButtonComponent;
	private btnCancel!: ButtonComponent;
	private processingNotice: Notice | null;
	private exportControls!: ExportControls;

	constructor(
		app: App,
		plugin: ScannerPlugin,
		initialFile: File | null = null,
	) {
		super(app);
		DiagnosticLogger.log(`[Photo] 🆕 ScannerModal constructor called, initialFile: ${initialFile ? "yes" : "null"}`);
		this.plugin = plugin;
		this.initialFile = initialFile;
		this.setTitle("Scan image");
		this.modalEl.addClass("scanner-modal");

		this.container = this.contentEl.createDiv("scanner-modal-container");
		this.canvas = new ImagePreview(
			this.container,
			this.container.createEl("canvas"),
			1, // Square 1:1 ratio for initial placeholder
		);

		this.buttonWrapper = this.contentEl.createDiv("button-wrapper");
		this.confirmButtonWrapper = this.contentEl.createDiv(
			"confirm-button-wrapper",
		);
		this.confirmButtonWrapper.hide();
		this.processingNotice = null;
	}

	onOpen() {
		console.log("[Photo] 🪟 ScannerModal.onOpen() called");
		DiagnosticLogger.log("[Photo] 🪟 ScannerModal.onOpen() called");
		console.log(`[Photo] 📁 initialFile: ${this.initialFile ? `"${this.initialFile.name}"` : "null"}`);
		DiagnosticLogger.log(`[Photo] 📁 initialFile: ${this.initialFile ? `"${this.initialFile.name}"` : "null"}`);

		// Capture the target editor BEFORE modal takes focus
		// This ensures logs are flushed to the original note even if modal becomes activeEditor
		const targetEditor = this.app.workspace.activeEditor?.editor;
		if (targetEditor) {
			DiagnosticLogger.setTargetEditor(targetEditor);
			DiagnosticLogger.log("[Photo] 📝 Captured target editor for log flushing");
			console.log("[Photo] 📝 Target editor set in DiagnosticLogger");
		} else {
			console.warn("[Photo] ⚠️ WARNING: No active editor found when opening modal!");
			DiagnosticLogger.log("[Photo] ⚠️ WARNING: No active editor found when opening modal!");
		}

		try {
			console.log("[Photo] 🎨 Setting up canvas...");
			DiagnosticLogger.log("[Photo] 🎨 Setting up canvas...");
			this.canvas.setup();
			console.log("[Photo] ✅ Canvas setup complete");
			DiagnosticLogger.log("[Photo] ✅ Canvas setup complete");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			console.error(`[Photo] ❌ Canvas setup error: ${message}`);
			DiagnosticLogger.log(`[Photo] ❌ Canvas setup error: ${message}`);
			new Notice(
				"Cannot create image preview canvas, please review details in console",
			);
			return;
		}

		this.btnPhotoUpload = new ButtonComponent(this.buttonWrapper)
			.setIcon("image")
			.setTooltip("Upload image from gallery")
			.setCta()
			.onClick(() => {
				console.log("[Photo] 📸 Manual upload button clicked");
				DiagnosticLogger.log("[Photo] 📸 Manual upload button clicked");
				uploadImageToCanvas(
					(file) => {
						console.log(`[Photo] 📸 Manual upload callback: drawing image "${file.name}"`);
						DiagnosticLogger.log(`[Photo] 📸 Manual upload callback: drawing image "${file.name}"`);
						this.canvas.darawImage(file, () =>
							this.detectAndShowCorners(),
						);
					},
					(errorMsg) => {
						console.error(`[Photo] ❌ Manual upload error: ${errorMsg}`);
						DiagnosticLogger.log(`[Photo] ❌ Manual upload error: ${errorMsg}`);
						new Notice(
							`📸 Photo capture failed: ${errorMsg}. Please try again.`,
							5000,
						);
					},
				);
			});

		this.btnDetectCorners = new ButtonComponent(this.buttonWrapper)
			.setIcon("scan")
			.setTooltip("Detect page corners")
			.onClick(() => this.detectAndShowCorners());

		this.btnCrop = new ButtonComponent(this.buttonWrapper)
			.setIcon("crop")
			.setTooltip("Crop image")
			.onClick(() => this.toggleCropMode());

		// Defer initial file processing until canvas is fully sized
		// This ensures requestAnimationFrame from setup() completes first
		if (this.initialFile) {
			console.log(`[Photo] 📋 Initial file received, deferring to requestAnimationFrame...`);
			DiagnosticLogger.log(`[Photo] 📋 Initial file received, deferring to requestAnimationFrame...`);
			window.requestAnimationFrame(() => {
				console.log(`[Photo] 🎬 Animation frame fired, now processing initial file "${this.initialFile?.name}"`);
				DiagnosticLogger.log(`[Photo] 🎬 Animation frame fired, now processing initial file "${this.initialFile?.name}"`);
				this.canvas.darawImage(
					this.initialFile as File,
					() => {
						console.log(`[Photo] ✅ Initial file loaded, running detectAndShowCorners`);
						DiagnosticLogger.log(`[Photo] ✅ Initial file loaded, running detectAndShowCorners`);
						this.detectAndShowCorners();
					},
					(errorMsg) => {
						console.error(`[Photo] ❌ Initial file processing error: ${errorMsg}`);
						DiagnosticLogger.log(`[Photo] ❌ Initial file processing error: ${errorMsg}`);
						new Notice(
							`📸 Photo processing failed: ${errorMsg}. Please try again.`,
							5000,
						);
					},
				);
			});
		} else {
			console.log("[Photo] ℹ️ No initial file, waiting for manual upload");
			DiagnosticLogger.log("[Photo] ℹ️ No initial file, waiting for manual upload");
		}

		// Initialize export controls
		console.log("[Photo] ⚙️ Initializing export controls...");
		DiagnosticLogger.log("[Photo] ⚙️ Initializing export controls...");
		this.exportControls = new ExportControls(
			this.app,
			(targetLongEdge?: number) =>
				this.canvas.getExportCanvas(targetLongEdge),
			this.plugin,
			() => this.canvas.isImageLoaded(),
			() => this.close(),
		);
		this.btnExport = this.exportControls.createExportButton(
			this.buttonWrapper,
		);

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

		console.log("[Photo] ✅ ScannerModal.onOpen() complete, modal ready");
		DiagnosticLogger.log("[Photo] ✅ ScannerModal.onOpen() complete, modal ready");
	}

	private detectAndShowCorners() {
		if (!this.canvas.isImageLoaded()) {
			new Notice("Please upload photo first!");
			return;
		}

		// Get image data for page detection
		const previewCanvas = this.canvas.getCanvas();
		const ctx = previewCanvas.getContext("2d", {
			willReadFrequently: true,
		});
		if (!ctx) {
			new Notice("Failed to get canvas context");
			return;
		}

		const imageData = ctx.getImageData(
			0,
			0,
			previewCanvas.width,
			previewCanvas.height,
		);
		// const dpr = window.devicePixelRatio || 1;

		new Notice("Detecting page corners...", 2000);

		// Attempt auto-detection
		const detectedCorners = detectPageCorners(imageData);

		if (detectedCorners) {
			const dpr = window.devicePixelRatio || 1;
			const scaledCorners = detectedCorners.map((corner) => ({
				x: corner.x / dpr,
				y: corner.y / dpr,
				isDragging: false,
			}));

			const { success } = this.canvas.toggleCroppingPoints(
				true,
				scaledCorners,
			);
			if (success) {
				this.buttonWrapper.hide();
				this.confirmButtonWrapper.show();
			} else {
				new Notice("Failed to display detected corners");
			}
		} else {
			// If detection fails, enable manual crop with full-image corners as fallback
			const { success, message } = this.canvas.toggleCroppingPoints(true);
			if (success) {
				new Notice(
					"✗ No automatic corners found. Manual crop enabled — adjust corners as needed.",
					4000,
				);
				this.buttonWrapper.hide();
				this.confirmButtonWrapper.show();
			} else {
				new Notice(
					"✗ No page corners detected. " + message,
					5000,
				);
			}
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
			this.processingNotice = new Notice(
				"Processing perspective crop...",
				0,
			);

			// Disable buttons during processing
			this.setButtonsEnabled(false);

			// Add a small delay to allow UI to update
			await new Promise((resolve) => window.setTimeout(resolve, 100));

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
				await new Promise((resolve) => window.setTimeout(resolve, 100));

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
			const message =
				error instanceof Error ? error.message : String(error);
			// Hide processing notice if it's still showing
			if (this.processingNotice) {
				this.processingNotice.hide();
				this.processingNotice = null;
			}

			// Log error for debugging
			console.error("Error in confirmCrop:", error);

			// Show user-friendly error message
			new Notice(
				`Crop failed: ${message || "Unknown error"}\nCheck console for details.`,
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

		// Failsafe: if there are any accumulated logs that weren't flushed (e.g., user closed without exporting),
		// flush them now to preserve diagnostics
		const remainingLogs = DiagnosticLogger.getLogs();
		if (remainingLogs.length > 0) {
			console.log(`[Photo] 🔧 Modal closing with ${remainingLogs.length} unflushed logs - flushing now as failsafe`);

			// Capture a fresh editor reference before flushing (activeEditor should be back to the note)
			const currentEditor = this.app.workspace.activeEditor?.editor;
			if (currentEditor) {
				DiagnosticLogger.setTargetEditor(currentEditor);
				console.log("[Photo] 🔧 Failsafe: Refreshed target editor from activeEditor");
			}

			DiagnosticLogger.flushToNote(true).catch((err) => {
				console.error("[Photo] 🔧 Failsafe flush failed:", err);
			});
		} else {
			console.log("[Photo] 🔧 Modal closing - no unflushed logs, nothing to failsafe");
		}

		// Clean up export controls
		if (this.exportControls) {
			// No destroy method needed, just null it
		}
	}
}
