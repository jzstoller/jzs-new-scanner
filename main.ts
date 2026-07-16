/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { ExportFormat } from "./Services/ImageExport";
import Logger from "./Services/Logger";

interface ScannerSettings {
	exportDefaultFolder: string;
	exportDefaultFormat: ExportFormat;
	closeAfterExport: boolean;
	insertLinkAfterExport: boolean;
	svgTintColor: string;
	optimizeImageSize: boolean;
	stripAlpha: boolean;
	exportQuality: number;
	autoWhiteBalance: boolean;
}

const DEFAULT_SETTINGS: ScannerSettings = {
	exportDefaultFolder: "Scanned",
	exportDefaultFormat: "png",
	closeAfterExport: true,
	insertLinkAfterExport: true,
	svgTintColor: "#000000",
	optimizeImageSize: true,
	stripAlpha: false,
	exportQuality: 0.92,
	autoWhiteBalance: false,
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

		await this.logger.info("Plugin loaded");

		await this.loadSettings();

		await this.logger.info("Settings loaded");

		// Lazy-load the modal so the scanner UI is only loaded when the user actually opens it.
		const openWithFilePicker = async () => {
			await this.logger.info("Opening file picker");
			try {
				const { ScannerModal } =
					await import("./UI/Modals/scannerModal");
				await this.logger.info("Scanner modal loaded");
				const input = activeDocument.createElement("input");
				await this.logger.info("File input element created");
				input.type = "file";
				input.accept = "image/*";
				await this.logger.info("Image picker configured");
				input.onchange = () => {
					this.logger.info("File selection changed");
					const file = input.files?.[0];
					this.logger.info(
						file
							? `File picked: ${file.name}`
							: "File picker closed without selection",
					);
					this.logger.info("Opening scanner modal");
					new ScannerModal(this.app, this, file ?? null).open();
					input.value = "";
				};
				input.click();
				await this.logger.info("File dialog requested");
			} catch (err) {
				await this.logger.error(
					`Failed to open scanner: ${String(err)}`,
				);
			}
		};

		// Ribbon and command palette both route through the same file-picker entry point.
		this.addRibbonIcon("scan", "Simple Scanner2", openWithFilePicker);

		await this.logger.info("Ribbon icon registered");

		this.addCommand({
			id: "open-scanner2",
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

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Default export folder")
			.setDesc(
				"Folder path where scanned images will be saved (e.g., 'Scanned' or 'Notes/Scans')",
			)
			.addText((text) =>
				text
					.setPlaceholder("Scanned")
					.setValue(this.plugin.settings.exportDefaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.exportDefaultFolder =
							value || "Scanned";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Default export format")
			.setDesc("File format for exported scanned images")
			.addDropdown((dropdown) =>
				dropdown
					.addOption("png", "PNG")
					.addOption("jpg", "JPG")
					.addOption("svg", "SVG")
					.setValue(this.plugin.settings.exportDefaultFormat)
					.onChange(async (value: string) => {
						this.plugin.settings.exportDefaultFormat =
							value as ExportFormat;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("SVG tint color")
			.setDesc("Color applied to ink areas when exporting as SVG")
			.addColorPicker((picker) =>
				picker
					.setValue(this.plugin.settings.svgTintColor)
					.onChange(async (value) => {
						this.plugin.settings.svgTintColor = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Auto white balance")
			.setDesc(
				"Automatically correct color cast before exporting, using the brightest areas of the scan as a white reference. Helps fix yellow/blue tinted scans. Note: has little visible effect on SVG exports, since those are recolored using the SVG tint color rather than the scan's original colors.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoWhiteBalance)
					.onChange(async (value) => {
						this.plugin.settings.autoWhiteBalance = value;
						await this.plugin.saveSettings();
					}),
			);
		new Setting(containerEl)
			.setName("Optimize image size")
			.setDesc(
				"Resize exported image so the longest edge is 2000 px (maintains aspect ratio). Has no effect if the image is already smaller.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.optimizeImageSize)
					.onChange(async (value) => {
						this.plugin.settings.optimizeImageSize = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Strip alpha channel")
			.setDesc(
				"Flatten transparency to a white background before exporting. Reduces file size for JPG. Has no effect on SVG.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.stripAlpha)
					.onChange(async (value) => {
						this.plugin.settings.stripAlpha = value;
						await this.plugin.saveSettings();
					}),
			);

		const exportQualitySetting = new Setting(containerEl)
			.setName("Export quality")
			.setDesc(
				"Compression quality for JPG exports (0.1 = smallest, 1.0 = best). Has no effect on PNG or SVG.",
			)
			.addSlider((slider) =>
				slider
					.setLimits(0.1, 1.0, 0.05)
					.setValue(this.plugin.settings.exportQuality)
					.onChange(async (value) => {
						this.plugin.settings.exportQuality = value;
						await this.plugin.saveSettings();
					}),
			);

		const valueDisplay = exportQualitySetting.controlEl.createEl("span", {
			text: this.plugin.settings.exportQuality.toFixed(2),
			cls: "export-quality-value",
		});
		valueDisplay.style.marginLeft = "12px";
		valueDisplay.style.fontWeight = "bold";
		valueDisplay.style.color = "var(--text-accent)";

		// Hook into the slider's input event to update display while dragging
		const sliderInput = exportQualitySetting.controlEl.querySelector(
			'input[type="range"]',
		) as HTMLInputElement | null;
		if (sliderInput) {
			sliderInput.addEventListener("input", (e) => {
				const target = e.target as HTMLInputElement;
				valueDisplay.textContent = parseFloat(target.value).toFixed(2);
			});
		}

		new Setting(containerEl)
			.setName("Insert link after export")
			.setDesc(
				"Automatically insert a markdown image link into the active note after exporting",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.insertLinkAfterExport)
					.onChange(async (value) => {
						this.plugin.settings.insertLinkAfterExport = value;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Close scanner after export")
			.setDesc(
				"Automatically close the scanner window after successfully exporting an image",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.closeAfterExport)
					.onChange(async (value) => {
						this.plugin.settings.closeAfterExport = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
