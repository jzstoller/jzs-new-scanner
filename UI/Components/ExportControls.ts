import { App, ButtonComponent, Notice } from "obsidian";
import { compressCanvas } from "Services/ImageCompress";
import {
	// exportCanvasToSVG,
	generateDefaultFilename,
	// getFileExtension,
} from "Services/ImageExport";
import { saveToVault } from "Services/VaultExport";
import { applyWhiteBalanceToCanvas } from "Services/WhiteBalance";
import type ScannerPlugin from "../../main";

// ExportControls owns the vault write-back path so the modal can stay focused on preview and cropping.
export class ExportControls {
	private app: App;
	private getCanvas: (targetLongEdge?: number) => HTMLCanvasElement;
	private plugin: ScannerPlugin;
	private isImageLoaded: () => boolean;
	private onExportComplete?: () => void;
	private editorReference: unknown; // Store editor reference before modal takes focus

	constructor(
		app: App,
		getCanvas: (targetLongEdge?: number) => HTMLCanvasElement,
		plugin: ScannerPlugin,
		isImageLoaded: () => boolean,
		onExportComplete?: () => void,
	) {
		this.app = app;
		this.getCanvas = getCanvas;
		this.plugin = plugin;
		this.isImageLoaded = isImageLoaded;
		this.onExportComplete = onExportComplete;
		this.editorReference = null;
	}

	public createExportButton(container: HTMLElement): ButtonComponent {
		return new ButtonComponent(container)
			.setIcon("download")
			.setTooltip("Export image")
			.onClick(() => this.handleExportClick());
	}

	private async handleExportClick(): Promise<void> {
		if (!this.isImageLoaded()) {
			new Notice("Please upload photo first!");
			return;
		}

		// Save the current editor because the modal steals focus before Obsidian can insert the exported link.
		// Capture editor reference before modal takes focus
		this.editorReference = this.app.workspace.activeEditor?.editor ?? null;

		const {
			exportDefaultFormat,
			exportDefaultFolder,
			// svgTintColor,
			insertLinkAfterExport,
			closeAfterExport,
			optimizeImageSize,
			exportQuality,
		} = this.plugin.settings;

		const processingNotice = new Notice("Exporting...", 0);

		try {
			// SVG bypasses compression entirely
			/*
			if (exportDefaultFormat === "svg") {
				let canvas = this.getCanvas();
				if (this.plugin.settings.autoWhiteBalance) {
					canvas = applyWhiteBalanceToCanvas(canvas);
				}
				// const canvas = this.getCanvas();
				const blob = exportCanvasToSVG(
					canvas,
					svgTintColor || undefined,
				);
				const filename =
					generateDefaultFilename() + getFileExtension("svg");
				const file = await saveToVault(
					this.app.vault,
					exportDefaultFolder,
					filename,
					blob,
				);
				processingNotice.hide();
				this.finalize(
					file.path,
					insertLinkAfterExport,
					closeAfterExport,
				);
				return;
			}
			*/

			// For raster formats, use compressCanvas which handles resize + alpha flatten + encode
			const targetLongEdge = optimizeImageSize ? 2000 : undefined;
			// const canvas = this.getCanvas(targetLongEdge);
			let canvas = this.getCanvas(targetLongEdge);
			if (this.plugin.settings.autoWhiteBalance) {
				canvas = applyWhiteBalanceToCanvas(canvas);
			}

			// Define the allowed export formats
			type ExportFormat = "png" | "jpg";

			// ExportFormat should be your union type: "png" | "jpg"
			const formatMimeMap: Record<ExportFormat, "image/jpeg" | "image/png"> = {
				png: "image/png",
				jpg: "image/jpeg",
			};

			const requestedMime = formatMimeMap[exportDefaultFormat];

			const result = await compressCanvas(canvas, {
				maxDimension: targetLongEdge,
				quality: exportQuality,
				outputMime: requestedMime,
			});

			const filename = generateDefaultFilename() + "." + result.ext;
			const blob = new Blob([result.buffer], { type: requestedMime });
			const file = await saveToVault(
				this.app.vault,
				exportDefaultFolder,
				filename,
				blob,
			);

			processingNotice.hide();
			new Notice(
				`Exported ${result.width}×${result.height} · ${(result.byteLength / 1024).toFixed(0)} KB → ${file.path}`,
				4000,
			);
			this.finalize(file.path, insertLinkAfterExport, closeAfterExport);
		} catch (error) {
			processingNotice.hide();
			const message =
				error instanceof Error ? error.message : String(error);
			new Notice(message, 5000);
		}
	}

	private finalize(
		filePath: string,
		insertLink: boolean,
		closeAfter: boolean,
	) {
		if (insertLink && this.editorReference) {
			try {
				const editor = this.editorReference as {
					replaceRange: (text: string, cursor: unknown) => void;
					getCursor: () => unknown;
				};
				editor.replaceRange(`![[${filePath}]]\n`, editor.getCursor());
			} catch (err) {
				console.warn("Failed to insert link:", err);
			}
		}
		if (closeAfter && this.onExportComplete) {
			this.onExportComplete();
		}
	}
}
