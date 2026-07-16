import { App, TFile } from "obsidian";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
	prefix?: string;
	logFilePath?: string;
	newline?: boolean;
}

export default class Logger {
	// Obsidian has no built-in plugin log sink, so this logger persists messages into a vault note instead.
	private readonly app: App;
	private readonly prefix: string;
	private readonly logFilePath: string;
	private readonly newline: boolean;
	private cachedFile: TFile | null = null;
	private resolvingFile: Promise<TFile> | null = null;

	constructor(app: App, options: LoggerOptions = {}) {
		this.app = app;
		this.prefix = options.prefix ?? "Plugin";
		this.logFilePath = options.logFilePath ?? "Logs/Plugin Log.md";
		this.newline = options.newline ?? true;
	}

	private timestamp(): string {
		return new Date().toISOString();
	}

	private format(level: LogLevel, message: string): string {
		return `[${this.timestamp()}] [${this.prefix}] [${level.toUpperCase()}] ${message}`;
	}

	private async resolveLogFile(): Promise<TFile> {
		if (
			this.cachedFile &&
			this.app.vault.getAbstractFileByPath(this.cachedFile.path) ===
				this.cachedFile
		) {
			return this.cachedFile;
		}

		this.cachedFile = null;

		if (this.resolvingFile) {
			return this.resolvingFile;
		}

		this.resolvingFile = (async () => {
			const existing = this.app.vault.getAbstractFileByPath(
				this.logFilePath,
			);
			if (existing instanceof TFile) {
				this.cachedFile = existing;
				return existing;
			}

			const folderIndex = this.logFilePath.lastIndexOf("/");
			if (folderIndex > 0) {
				const folderPath = this.logFilePath.slice(0, folderIndex);
				const folderExists =
					this.app.vault.getAbstractFileByPath(folderPath);
				if (!folderExists) {
					await this.app.vault.createFolder(folderPath);
				}
			}

			try {
				this.cachedFile = await this.app.vault.create(
					this.logFilePath,
					"",
				);
				return this.cachedFile;
			} catch (err) {
				const retry = this.app.vault.getAbstractFileByPath(
					this.logFilePath,
				);
				if (retry instanceof TFile) {
					this.cachedFile = retry;
					return retry;
				}

				throw err;
			}
		})();

		try {
			return await this.resolvingFile;
		} finally {
			this.resolvingFile = null;
		}
	}

	private async appendToLogFile(text: string): Promise<void> {
		const payload = this.newline ? `${text}\n` : text;
		try {
			const file = await this.resolveLogFile();
			await this.app.vault.append(file, payload);
		} catch (err) {
			throw new Error(
				`Logger: failed to append to ${this.logFilePath}: ${String(err)}`,
			);
		}
	}

	async debug(message: string, toNote = true): Promise<void> {
		const formatted = this.format("debug", message);
		if (toNote) await this.appendToLogFile(formatted);
	}

	async info(message: string, toNote = true): Promise<void> {
		const formatted = this.format("info", message);
		if (toNote) await this.appendToLogFile(formatted);
	}

	async warn(message: string, toNote = true): Promise<void> {
		const formatted = this.format("warn", message);
		if (toNote) await this.appendToLogFile(formatted);
	}

	async error(message: string, toNote = true): Promise<void> {
		const formatted = this.format("error", message);
		if (toNote) await this.appendToLogFile(formatted);
	}

	async appendRaw(text: string): Promise<void> {
		await this.appendToLogFile(text);
	}
}
