import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import type { ExportFormat } from "./Services/ImageExport";

interface HandwrittenScannerSettings {
	exportDefaultFolder: string;
	exportDefaultFormat: ExportFormat;
	closeAfterExport: boolean;
	insertLinkAfterExport: boolean;
	svgTintColor: string;
}

const DEFAULT_SETTINGS: HandwrittenScannerSettings = {
	exportDefaultFolder: "Scanned",
	exportDefaultFormat: "png",
	closeAfterExport: true,
	insertLinkAfterExport: true,
	svgTintColor: "#000000",
};

export default class HandWrittenPlugin extends Plugin {
	settings: HandwrittenScannerSettings;

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon("scan", "JZS Handwritten Scanner", async (_evt: MouseEvent) => {
			const { ScannerModal } = await import("./UI/Modals/scannerModal");
			new ScannerModal(this.app, this).open();
		});

		this.addCommand({
			id: "open-handwritten-scanner",
			name: "Open handwritten scanner",
			icon: "scan",
			callback: async () => {
				const { ScannerModal } = await import("./UI/Modals/scannerModal");
				new ScannerModal(this.app, this).open();
			},
		});

		this.addSettingTab(new HandwrittenScannerSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class HandwrittenScannerSettingTab extends PluginSettingTab {
	plugin: HandWrittenPlugin;

	constructor(app: App, plugin: HandWrittenPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Default export folder")
			.setDesc("Folder path where scanned images will be saved (e.g., 'Scanned' or 'Notes/Scans')")
			.addText((text) =>
				text
					.setPlaceholder("Scanned")
					.setValue(this.plugin.settings.exportDefaultFolder)
					.onChange(async (value) => {
						this.plugin.settings.exportDefaultFolder = value || "Scanned";
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
					.onChange(async (value: ExportFormat) => {
						this.plugin.settings.exportDefaultFormat = value;
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
			.setName("Insert link after export")
			.setDesc("Automatically insert a markdown image link into the active note after exporting")
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
			.setDesc("Automatically close the scanner window after successfully exporting an image")
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
