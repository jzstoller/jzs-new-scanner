/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { App, Plugin, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type {
	AspectRatioOrientation,
	AspectRatioSetting,
} from "./Services/AspectRatio";
import type { ExportFormat } from "./Services/ImageExport";
import Logger from "./Services/Logger";

interface ScannerSettings {
	exportDefaultFolder: string;
	exportDefaultFormat: ExportFormat;
	closeAfterExport: boolean;
	insertLinkAfterExport: boolean;
	optimizeImageSize: boolean;
	exportQuality: number;
	autoWhiteBalance: boolean;
	exportAspectRatio: AspectRatioSetting;
	exportAspectRatioOrientation: AspectRatioOrientation;
}

const DEFAULT_SETTINGS: ScannerSettings = {
	exportDefaultFolder: "Scanned",
	exportDefaultFormat: "png",
	closeAfterExport: true,
	insertLinkAfterExport: true,
	optimizeImageSize: true,
	exportQuality: 0.92,
	autoWhiteBalance: false,
	exportAspectRatio: "original",
	exportAspectRatioOrientation: "auto",
};

export default class ScannerPlugin extends Plugin {
	settings!: ScannerSettings;
	logger!: Logger;

	// Plugin lifecycle starts here: load settings, register commands, and wire the scanner modal into Obsidian's UI.
	async onload() {
		this.logger = new Logger(this.app, {
			prefix: "Scanner",
			logFilePath: "Logs/Scanner Log.md",
		});

		//await this.logger.info("Plugin loaded");

		await this.loadSettings();

		//await this.logger.info("Settings loaded");

		// Lazy-load the modal so the scanner UI is only loaded when the user actually opens it.
		const openWithFilePicker = async () => {
			// 7/18 5p, await this.logger.info("Opening file picker");
			// JZS - these try/catch fixes this iOS issue?
			try {
				const { ScannerModal } =
					await import("./UI/Modals/scannerModal");

				// 7/18 5p, await this.logger.info("Scanner modal loaded");

				const input = activeDocument.createElement("input");

				//await this.logger.info("File input element created");

				input.type = "file";
				input.accept = "image/*";

				// await this.logger.info(
					// 7/18 5p, `Input connected to DOM before click: ${input.isConnected}`,
				//.);

				const onVisibilityChange = () => {
					//this.logger.info(
					//	`document visibilitychange: ${activeDocument.visibilityState}`,
					//);
				};

				/*
				const onPageHide = () => {
					this.logger.info("window pagehide fired");
				};

				const onPageShow = () => {
					this.logger.info("window pageshow fired");
				};
				const onWindowBlur = () => {
					this.logger.info("window blur fired");
				};
				const onWindowFocus = () => {
					this.logger.info("window focus fired");
				};
				*/

				activeDocument.addEventListener(
					"visibilitychange",
					onVisibilityChange,
				);
				//activeWindow.addEventListener("pagehide", onPageHide);
				//activeWindow.addEventListener("pageshow", onPageShow);
				//activeWindow.addEventListener("blur", onWindowBlur);
				//activeWindow.addEventListener("focus", onWindowFocus);

				/*
				const cleanupDiagnosticListeners = () => {
					activeDocument.removeEventListener(
						"visibilitychange",
						onVisibilityChange,
					);
					activeWindow.removeEventListener(
						"pagehide",
						onPageHide,
					);
					activeWindow.removeEventListener(
						"pageshow",
						onPageShow,
					);
					activeWindow.removeEventListener("blur", onWindowBlur);
					activeWindow.removeEventListener(
						"focus",
						onWindowFocus,
					);
				};
				*/

				input.onchange = () => {

					// 7/18 7p, this.logger.info("File selection changed");

					//cleanupDiagnosticListeners();

					// this.logger.info(
					// 	`Input connected to DOM in onchange: ${input.isConnected}`,
					// );

					const file = input.files?.[0];

					// 7/18 7p, this.logger.info(
					//	file
					//		? `File picked: ${file.name}`
					//		: "File picker closed without selection",
					//);

					// this.logger.info("Scanner modal instance created");

					new ScannerModal(this.app, this, file ?? null).open();

					// 7/18 7p, this.logger.info("Just past Scanner modal");

					input.value = "";

					// this.logger.info("File input reset");
				};
				input.click();

				// 7/18 6p, await this.logger.info("File dialog requested");
			} catch (err) {
				await this.logger.error(
					`Failed to open scanner: ${String(err)}`,
				);
			}
		};

		// Ribbon and command palette both route through the same file-picker entry point.
		this.addRibbonIcon("scan", "Simple Scanner", openWithFilePicker);

		//await this.logger.info("Ribbon icon registered");

		this.addCommand({
			id: "open-scanner",
			name: "Open scanner",
			icon: "scan",
			callback: openWithFilePicker,
		});

		this.addSettingTab(new ScannerSettingTab(this.app, this));
	}

	onunload() {
		//void this.logger.info('Plugin unloaded');
	}

	async loadSettings() {
		// JZS - these try/catch fixes this iOS issue?
		try {
			this.settings = Object.assign(
				{},
				DEFAULT_SETTINGS,
				((await this.loadData()) as Partial<ScannerSettings> | null) ??
					{},
			);
		} catch (err) {
			await this.logger.error(
				`Failed to load settings, using defaults: ${String(err)}`,
			);
			this.settings = { ...DEFAULT_SETTINGS };
		}
	}

	async saveSettings() {
		// JZS - these try/catch fixes this iOS issue?
		try {
			await this.saveData(this.settings);
		} catch (err) {
			await this.logger.error(`Failed to save settings: ${String(err)}`);
		}
	}
}

class ScannerSettingTab extends PluginSettingTab {
	plugin: ScannerPlugin;

	constructor(app: App, plugin: ScannerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: "Default export folder",
				desc: "Folder path where scanned images will be saved (e.g., 'Scanned' or 'Notes/Scans')",
				control: {
					type: "text",
					key: "exportDefaultFolder",
					placeholder: "Scanned",
				},
			},
			{
				name: "Default export format",
				desc: "File format for exported scanned images",
				control: {
					type: "dropdown",
					key: "exportDefaultFormat",
					options: { png: "PNG", jpg: "JPG" },
				},
			},
			{
				name: "Auto white balance",
				desc: "Automatically correct color cast before exporting, using the brightest areas of the scan as a white reference. Helps fix yellow/blue tinted scans.",
				control: { type: "toggle", key: "autoWhiteBalance" },
			},
			{
				name: "Optimize image size",
				desc: "Resize exported image so the longest edge is 2000 px (maintains aspect ratio). Has no effect if the image is already smaller.",
				control: { type: "toggle", key: "optimizeImageSize" },
			},
			{
				name: "Export aspect ratio",
				desc: "Stretch the exported image to a fixed aspect ratio instead of keeping its original shape. 16:9 auto-orients to a wide 16:9 for landscape scans or a tall 9:16 for portrait scans. Note: this stretches (not crops or letterboxes) the image, which can visibly distort content, especially for near-square originals.",
				control: {
					type: "dropdown",
					key: "exportAspectRatio",
					options: { original: "Original", "16:9": "16:9" },
				},
			},
			{
				name: "Aspect ratio orientation",
				desc: "Auto picks a wide result for landscape scans and a tall result for portrait scans. Forcing an orientation opposite a scan's natural shape (e.g. Force landscape on a portrait scan) will look heavily squashed or stretched compared to Auto — that's expected given the stretch-not-crop design, not a bug.",
				// Only relevant once a non-"original" ratio is chosen; re-evaluated via refreshDomState() in setControlValue.
				visible: () =>
					this.plugin.settings.exportAspectRatio !== "original",
				control: {
					type: "dropdown",
					key: "exportAspectRatioOrientation",
					options: {
						auto: "Auto",
						landscape: "Force landscape",
						portrait: "Force portrait",
					},
				},
			},
			{
				name: "Export quality",
				desc: "Compression quality for JPG exports (0.1 = smallest, 1.0 = best). Has no effect on PNG",
				control: {
					type: "slider",
					key: "exportQuality",
					min: 0.1,
					max: 1.0,
					step: 0.05,
					displayFormat: (value) => value.toFixed(2),
				},
			},
			{
				name: "Insert link after export",
				desc: "Automatically insert a markdown image link into the active note after exporting",
				control: { type: "toggle", key: "insertLinkAfterExport" },
			},
			{
				name: "Close scanner after export",
				desc: "Automatically close the scanner window after successfully exporting an image",
				control: { type: "toggle", key: "closeAfterExport" },
			},
		];
	}

	getControlValue(key: string): unknown {
		return (this.plugin.settings as unknown as Record<string, unknown>)[
			key
		];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		// Preserve the old fallback-to-"Scanned" behavior when the folder field is cleared.
		if (key === "exportDefaultFolder" && !value) {
			value = "Scanned";
		}
		(this.plugin.settings as unknown as Record<string, unknown>)[key] =
			value;
		await this.plugin.saveSettings();
		if (key === "exportAspectRatio") {
			this.refreshDomState();
		}
	}
}
