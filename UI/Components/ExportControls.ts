import { App, ButtonComponent, Notice } from "obsidian";
import {
	generateDefaultFilename,
	exportCanvasToSVG,
	getFileExtension,
} from "Services/ImageExport";
import { compressCanvas, mimeToExt } from "Services/ImageCompress";
import { saveToVault } from "Services/VaultExport";
import type HandWrittenPlugin from "../../main";

export class ExportControls {
	private app: App;
	private getCanvas: (targetLongEdge?: number) => HTMLCanvasElement;
	private plugin: HandWrittenPlugin;
	private isImageLoaded: () => boolean;
	private onExportComplete?: () => void;

	constructor(
		app: App,
		getCanvas: (targetLongEdge?: number) => HTMLCanvasElement,
		plugin: HandWrittenPlugin,
		isImageLoaded: () => boolean,
		onExportComplete?: () => void,
	) {
		this.app = app;
		this.getCanvas = getCanvas;
		this.plugin = plugin;
		this.isImageLoaded = isImageLoaded;
		this.onExportComplete = onExportComplete;
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

		const {
			exportDefaultFormat,
			exportDefaultFolder,
			svgTintColor,
			insertLinkAfterExport,
			closeAfterExport,
			optimizeImageSize,
			exportQuality,
		} = this.plugin.settings;

		const processingNotice = new Notice("Exporting...", 0);

		try {
			// SVG bypasses compression entirely
			if (exportDefaultFormat === "svg") {
				const canvas = this.getCanvas();
				const blob = exportCanvasToSVG(canvas, svgTintColor || undefined);
				const filename = generateDefaultFilename() + getFileExtension("svg");
				const file = await saveToVault(this.app.vault, exportDefaultFolder, filename, blob);
				processingNotice.hide();
				this.finalize(file.path, insertLinkAfterExport, closeAfterExport);
				return;
			}

			// For raster formats, use compressCanvas which handles resize + alpha flatten + encode
			const targetLongEdge = optimizeImageSize ? 2000 : undefined;
			const canvas = this.getCanvas(targetLongEdge);

			const formatMimeMap: Record<string, "image/jpeg" | "image/png"> = {
				png: "image/png",
				jpg: "image/jpeg",
			};
			const requestedMime = formatMimeMap[exportDefaultFormat] ?? "image/jpeg";

			const result = await compressCanvas(canvas, {
					maxDimension: targetLongEdge,
					quality: exportQuality,
					outputMime: requestedMime,
				});

			const filename = generateDefaultFilename() + "." + result.ext;
			const blob = new Blob([result.buffer], { type: `image/${result.ext === "jpg" ? "jpeg" : result.ext}` });
			const file = await saveToVault(this.app.vault, exportDefaultFolder, filename, blob);

			processingNotice.hide();
			new Notice(`Exported ${result.width}×${result.height} · ${(result.byteLength / 1024).toFixed(0)} KB → ${file.path}`, 4000);
			this.finalize(file.path, insertLinkAfterExport, closeAfterExport);

		} catch (error) {
			processingNotice.hide();
			new Notice(error.message, 5000);
		}
	}

	private finalize(filePath: string, insertLink: boolean, closeAfter: boolean) {
		if (insertLink) {
			const editor = this.app.workspace.activeEditor?.editor;
			if (editor) {
				editor.replaceRange(`![[${filePath}]]\n`, editor.getCursor());
			}
		}
		if (closeAfter && this.onExportComplete) {
			this.onExportComplete();
		}
	}
}
