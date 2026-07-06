/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { ExportFormat } from "./Services/ImageExport";

interface ScannerSettings {
	exportDefaultFolder: string;
	exportDefaultFormat: ExportFormat;
	closeAfterExport: boolean;
	insertLinkAfterExport: boolean;
	svgTintColor: string;
	optimizeImageSize: boolean;
	stripAlpha: boolean;
	exportQuality: number;
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
};

export default class ScannerPlugin extends Plugin {
	settings!: ScannerSettings;

	async onload() {
		await this.loadSettings();

		const openWithFilePicker = async () => {
			const { ScannerModal } = await import("./UI/Modals/scannerModal");
			const input = activeDocument.createElement("input");
			input.type = "file";
			input.accept = "image/*";
			input.onchange = () => {
				const file = input.files?.[0];
				new ScannerModal(this.app, this, file ?? null).open();
				input.value = "";
			};
			input.click();
		};

		this.addRibbonIcon("scan", "Simple Scanner2", openWithFilePicker);

		this.addCommand({
			id: "open-scanner2",
			name: "Open scanner",
			icon: "scan",
			callback: openWithFilePicker,
		});

		this.addSettingTab(new ScannerSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			((await this.loadData()) as Partial<ScannerSettings> | null) ?? {},
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
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

		new Setting(containerEl)
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
