import { App } from "obsidian";

/**
 * Diagnostic logger that captures [Photo] logs and appends them to the active note
 * Useful for iOS debugging where browser console is not accessible
 */
export class DiagnosticLogger {
	private static logs: string[] = [];
	private static app: App | null = null;
	private static enabled: boolean = true;
	private static targetEditor: any = null; // Persisted editor reference

	static initialize(app: App) {
		this.app = app;
		this.logs = [];
		console.log("[Photo] 🔧 DiagnosticLogger initialized");
	}

	/**
	 * Set the target editor for log flushing (persists across modal lifecycle)
	 * Call this when modal opens to ensure logs go to the right note
	 */
	static setTargetEditor(editor: any) {
		this.targetEditor = editor;
		console.log("[Photo] 🔧 Target editor captured and will persist for this session");
	}

	/**
	 * Clear the target editor (call after successful flush to allow fresh capture next time)
	 */
	static clearTargetEditor() {
		this.targetEditor = null;
		console.log("[Photo] 🔧 Target editor cleared after successful flush");
	}

	static log(message: string) {
		if (!this.enabled) return;

		// Add timestamp
		const timestamp = new Date().toLocaleTimeString();
		const timestampedMsg = `[${timestamp}] ${message}`;

		// Log to console
		console.log(timestampedMsg);

		// Add to buffer
		this.logs.push(timestampedMsg);
	}

	static clear() {
		this.logs = [];
	}

	static getLogs(): string[] {
		return [...this.logs];
	}

	/**
	 * Append all captured logs to the active note
	 * @param success - whether the operation succeeded
	 */
	static async flushToNote(success: boolean) {
		if (!this.app) {
			console.error("[Photo] 🔧 DiagnosticLogger not initialized (no app reference)");
			return;
		}

		// Always prefer the current activeEditor (most reliable, especially after modal closes)
		// Fall back to persisted target editor only if no active editor
		let editor = this.app.workspace.activeEditor?.editor;
		if (!editor) {
			editor = this.targetEditor;
		}

		if (!editor) {
			console.error("[Photo] 🔧 CRITICAL: No editor available at flush time");
			console.error("[Photo] 🔧 activeEditor exists?", !!this.app.workspace.activeEditor);
			console.error("[Photo] 🔧 targetEditor persisted?", !!this.targetEditor);

			// If we have logs but no editor, at least log them to console so they're not lost
			if (this.logs.length > 0) {
				console.log("[Photo] 🔧 FALLBACK: Logging all captured logs to console since no editor available:");
				this.logs.forEach(log => console.log(log));
			}
			return;
		}

		// Validate editor has required methods
		if (typeof editor.getCursor !== 'function' || typeof editor.replaceRange !== 'function') {
			console.error("[Photo] 🔧 CRITICAL: Editor object missing required methods");
			console.error("[Photo] 🔧 getCursor?", typeof editor.getCursor);
			console.error("[Photo] 🔧 replaceRange?", typeof editor.replaceRange);
			return;
		}

		try {
			const status = success ? "✅ SUCCESS" : "❌ FAILED";
			const timestamp = new Date().toISOString();
			const logCount = this.logs.length;

			console.log(`[Photo] 🔧 flushToNote() starting: ${logCount} logs, success=${success}`);

			const header = `\n\n---\n## 📸 Photo Capture Diagnostics — ${status}\n*${timestamp}*\n\`\`\`log\n`;
			const footer = `\n\`\`\`\n`;

			let content: string;
			if (logCount === 0) {
				content = header + "[NO LOGS CAPTURED - check if all steps completed]\n" + footer;
				console.warn("[Photo] 🔧 WARNING: No logs captured during operation");
			} else {
				content = header + this.logs.join("\n") + footer;
			}

			// Get cursor position
			const cursor = editor.getCursor();
			console.log(`[Photo] 🔧 Cursor position: line=${cursor.line}, ch=${cursor.ch}`);

			// Append logs to note
			editor.replaceRange(content, cursor);

			console.log(
				`[Photo] 🔧 ✅ Successfully flushed ${logCount} log lines to note`,
			);

			// Clear logs after flushing
			this.clear();

			// Clear target editor to allow fresh capture on next modal open
			this.clearTargetEditor();
		} catch (error) {
			console.error("[Photo] 🔧 CRITICAL ERROR: Exception during flush:", error);
			console.error("[Photo] 🔧 Error stack:", error instanceof Error ? error.stack : "no stack");

			// Try to append error message anyway
			try {
				const fallbackEditor = this.targetEditor || this.app.workspace.activeEditor?.editor;
				if (fallbackEditor && typeof fallbackEditor.replaceRange === 'function') {
					const cursor = fallbackEditor.getCursor();
					const errMsg = error instanceof Error ? error.message : String(error);
					fallbackEditor.replaceRange(`\n\n🔴 ERROR: Failed to flush logs: ${errMsg}\n`, cursor);
					console.log("[Photo] 🔧 Fallback: Appended error message");
				}
			} catch (fallbackError) {
				console.error("[Photo] 🔧 CRITICAL: Even fallback error append failed", fallbackError);
			}
		}
	}

	static disable() {
		this.enabled = false;
	}

	static enable() {
		this.enabled = true;
	}
}
