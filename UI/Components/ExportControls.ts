import { App, ButtonComponent, Notice } from "obsidian";
import {
	generateDefaultFilename,
	exportCanvasToPNG,
	exportCanvasToJPG,
	exportCanvasToSVG,
	getFileExtension,
} from "Services/ImageExport";
import { saveToVault } from "Services/VaultExport";
import type HandWrittenPlugin from "../../main";

export class ExportControls {
	private app: App;
	private getCanvas: () => HTMLCanvasElement;
	private plugin: HandWrittenPlugin;
	private isImageLoaded: () => boolean;
	private onExportComplete?: () => void;

	constructor(
		app: App,
		getCanvas: () => HTMLCanvasElement,
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

		const { exportDefaultFormat, exportDefaultFolder, svgTintColor, insertLinkAfterExport, closeAfterExport } = this.plugin.settings;

		const filename = generateDefaultFilename() + getFileExtension(exportDefaultFormat);
		const processingNotice = new Notice("Exporting...", 0);

		try {
			let blob: Blob;
			const canvas = this.getCanvas();

			if (exportDefaultFormat === "png") {
				blob = await exportCanvasToPNG(canvas);
			} else if (exportDefaultFormat === "jpg") {
				blob = await exportCanvasToJPG(canvas);
			} else {
				blob = exportCanvasToSVG(canvas, svgTintColor || undefined);
			}

			const file = await saveToVault(this.app.vault, exportDefaultFolder, filename, blob);

			if (insertLinkAfterExport) {
				const editor = this.app.workspace.activeEditor?.editor;
				if (editor) {
					const cursor = editor.getCursor();
					editor.replaceRange(`![[${file.path}]]\n`, cursor);
				}
			}

			processingNotice.hide();
			new Notice(`Exported to ${file.path}`, 3000);

			if (closeAfterExport && this.onExportComplete) {
				this.onExportComplete();
			}
		} catch (error) {
			processingNotice.hide();
			new Notice(error.message, 5000);
		}
	}
}
