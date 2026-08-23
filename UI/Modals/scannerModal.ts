/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { App, ButtonComponent, Modal, Notice } from "obsidian";
import type {
	AspectRatioOrientation,
	AspectRatioSetting,
} from "Services/AspectRatio";
import { uploadImageToCanvas } from "Services/ImageUpload";
import { detectPageCorners } from "Services/PageDetection";
import { ExportControls } from "UI/Components/ExportControls";
import { ImagePreview } from "UI/Components/ImagePreview";
import type ScannerPlugin from "../../main";

// The modal ties together file selection, page detection, crop editing, and export controls in one Obsidian dialog.
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
	private btnAspectRatio!: ButtonComponent;
	private aspectRatioPopover!: HTMLElement;
	private aspectRatioSelect!: HTMLSelectElement;
	private orientationRow!: HTMLElement;
	private orientationSelect!: HTMLSelectElement;
	private aspectRatioPopoverOpen = false;
	private outsideClickHandler: ((event: MouseEvent) => void) | null = null;
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
		this.plugin = plugin;
		this.initialFile = initialFile;
		this.setTitle("Scan image");
		this.modalEl.addClass("scanner-modal");

		this.container = this.contentEl.createDiv("scanner-modal-container");
		this.canvas = new ImagePreview(
			this.container,
			this.container.createEl("canvas"),
			1, // Square 1:1 ratio for initial placeholder
			this.plugin.logger,
		);

		this.buttonWrapper = this.contentEl.createDiv("button-wrapper");
		this.confirmButtonWrapper = this.contentEl.createDiv(
			"confirm-button-wrapper",
		);
		this.confirmButtonWrapper.hide();
		this.processingNotice = null;
	}

	onOpen() {
		// void this.plugin.logger.info("Scanner modal onOpen");
		try {
			this.canvas.setup();

			// void this.plugin.logger.info("Canvas setup");
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			console.error(`Error: ${message}`);
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
					this.canvas.darawImage(file, () =>
						this.detectAndShowCorners(),
					);
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

		this.setupAspectRatioControl();

		if (this.initialFile) {
			// 7/18 8p, void this.plugin.logger.info(
			// 	`Initial file provided: ${this.initialFile.name}`,
			// );
			this.canvas.darawImage(this.initialFile, () =>
				this.detectAndShowCorners(),
			);
			// void this.plugin.logger.info("Initial file draw requested");
		} else {
			// 7/18 8p, void this.plugin.logger.info("No initial file provided");
		}

		// Initialize export controls
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
	}

	// The aspect-ratio control is a quick per-scan override for the same
	// plugin.settings.exportAspectRatio value the Settings tab dropdown edits —
	// there is no separate session-only state to keep in sync.
	private setupAspectRatioControl() {
		const wrapper = this.buttonWrapper.createDiv("aspect-ratio-control");

		this.btnAspectRatio = new ButtonComponent(wrapper)
			.setIcon("ratio")
			.setTooltip("Export aspect ratio")
			.onClick(() => this.toggleAspectRatioPopover());

		this.aspectRatioPopover = wrapper.createDiv("aspect-ratio-popover");
		this.aspectRatioPopover.hide();

		this.aspectRatioSelect = this.aspectRatioPopover.createEl("select", {
			cls: "aspect-ratio-select",
		});
		this.aspectRatioSelect.createEl("option", {
			text: "Original",
			value: "original",
		});
		this.aspectRatioSelect.createEl("option", {
			text: "16:9",
			value: "16:9",
		});
		this.aspectRatioSelect.value = this.plugin.settings.exportAspectRatio;

		this.aspectRatioSelect.onchange = async () => {
			this.plugin.settings.exportAspectRatio = this.aspectRatioSelect
				.value as AspectRatioSetting;
			await this.plugin.saveSettings();
			this.updateOrientationVisibility();
		};

		this.orientationRow = this.aspectRatioPopover.createDiv(
			"aspect-ratio-orientation-row",
		);
		this.orientationRow.createEl("label", {
			text: "Orientation",
			cls: "aspect-ratio-orientation-label",
		});
		this.orientationSelect = this.orientationRow.createEl("select", {
			cls: "aspect-ratio-select",
		});
		this.orientationSelect.createEl("option", {
			text: "Auto",
			value: "auto",
		});
		this.orientationSelect.createEl("option", {
			text: "Force landscape",
			value: "landscape",
		});
		this.orientationSelect.createEl("option", {
			text: "Force portrait",
			value: "portrait",
		});
		this.orientationSelect.value =
			this.plugin.settings.exportAspectRatioOrientation;

		this.orientationSelect.onchange = async () => {
			this.plugin.settings.exportAspectRatioOrientation = this
				.orientationSelect.value as AspectRatioOrientation;
			await this.plugin.saveSettings();
		};

		this.updateOrientationVisibility();
	}

	// The orientation dropdown is only relevant once a non-"original" ratio is
	// chosen, mirroring the Settings tab's conditional visibility.
	private updateOrientationVisibility() {
		if (this.aspectRatioSelect.value === "original") {
			this.orientationRow.hide();
		} else {
			this.orientationRow.show();
		}
	}

	private toggleAspectRatioPopover() {
		if (this.aspectRatioPopoverOpen) {
			this.closeAspectRatioPopover();
		} else {
			this.openAspectRatioPopover();
		}
	}

	private openAspectRatioPopover() {
		// Re-sync in case the plugin Settings tab changed these values while the modal was open.
		this.aspectRatioSelect.value = this.plugin.settings.exportAspectRatio;
		this.orientationSelect.value =
			this.plugin.settings.exportAspectRatioOrientation;
		this.updateOrientationVisibility();
		this.aspectRatioPopover.show();
		this.aspectRatioPopoverOpen = true;

		// Defer attaching the outside-click listener so the click that opened
		// the popover doesn't immediately close it again.
		window.setTimeout(() => {
			this.outsideClickHandler = (event: MouseEvent) => {
				const target = event.target as Node;
				if (
					!this.aspectRatioPopover.contains(target) &&
					!this.btnAspectRatio.buttonEl.contains(target)
				) {
					this.closeAspectRatioPopover();
				}
			};
			activeDocument.addEventListener(
				"click",
				this.outsideClickHandler,
				true,
			);
		}, 0);
	}

	private closeAspectRatioPopover() {
		this.aspectRatioPopover.hide();
		this.aspectRatioPopoverOpen = false;
		if (this.outsideClickHandler) {
			activeDocument.removeEventListener(
				"click",
				this.outsideClickHandler,
				true,
			);
			this.outsideClickHandler = null;
		}
	}

	private detectAndShowCorners() {
		if (!this.canvas.isImageLoaded()) {
			new Notice("Please upload photo first!");
			return;
		}

		// Detection runs on the preview canvas, then results are scaled back into the CSS-pixel space used by the overlay.
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
				//void this.plugin.logger.info("Detected corners");
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
				new Notice("✗ No page corners detected. " + message, 5000);
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

				//void this.plugin.logger.info("Processed perspective crop");

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
		this.btnAspectRatio.setDisabled(!enabled);
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

		// Clean up the aspect-ratio popover's outside-click listener so it
		// doesn't leak past this modal's lifetime.
		if (this.outsideClickHandler) {
			activeDocument.removeEventListener(
				"click",
				this.outsideClickHandler,
				true,
			);
			this.outsideClickHandler = null;
		}

		// Clean up export controls
		if (this.exportControls) {
			// No destroy method needed, just null it
		}
	}
}
