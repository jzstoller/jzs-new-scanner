/*
  Portions of this file are derived from the obsidian-scan-sketch plugin
  by Show Wai Yan, licensed under the Zero-Clause BSD (0BSD) License.
  See THIRD_PARTY_NOTICES/obsidian-scan-sketch/ for details.
*/

import type { PlaceholderConfig } from "./types";

export interface PlaceholderInitMessage {
	type: "init-placeholder";
	requestId: number;
	width: number;
	height: number;
	config: PlaceholderConfig;
}

export interface PlaceholderResultMessage {
	type: "placeholder-result";
	requestId: number;
	width: number;
	height: number;
	bitmap: ImageBitmap | null;
	errorMessage?: string;
}

export function createPlaceholderWorker(): Worker | null {
	if (typeof Worker === "undefined") {
		return null;
	}

	const objectUrl = URL.createObjectURL(
		new Blob([placeholderWorkerSource], {
			type: "text/javascript",
		}),
	);

	try {
		const worker = new Worker(objectUrl);
		window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
		return worker;
	} catch (error) {
		URL.revokeObjectURL(objectUrl);
		console.error("Failed to create placeholder worker:", error);
		return null;
	}
}

const placeholderWorkerSource = [
	'self.onmessage = (event) => {',
	'	const data = event.data;',
	'	if (!data || data.type !== "init-placeholder") {',
	'		return;',
	'	}',
	'',
	'	try {',
	'		const canvas = new OffscreenCanvas(data.width, data.height);',
	'		const ctx = canvas.getContext("2d");',
	'		if (!ctx) {',
	'			self.postMessage({',
	'				type: "placeholder-result",',
	'				requestId: data.requestId,',
	'				width: data.width,',
	'				height: data.height,',
	'				bitmap: null,',
	'				errorMessage: "Failed to get OffscreenCanvas context",',
	'			});',
	'			return;',
	'		}',
	'',
	'		renderPlaceholder(ctx, data.width, data.height, data.config);',
	'		const bitmap = canvas.transferToImageBitmap();',
	'		self.postMessage({',
	'			type: "placeholder-result",',
	'			requestId: data.requestId,',
	'			width: data.width,',
	'			height: data.height,',
	'			bitmap,',
	'		}, [bitmap]);',
	'	} catch (error) {',
	'		self.postMessage({',
	'			type: "placeholder-result",',
	'			requestId: data.requestId,',
	'			width: data.width,',
	'			height: data.height,',
	'			bitmap: null,',
	'			errorMessage: error instanceof Error ? error.message : String(error),',
	'		});',
	'	}',
	'};',
	'',
	'function renderPlaceholder(ctx, width, height, config) {',
	'	clearCanvas(ctx, width, height);',
	'	fillCanvas(ctx, width, height, config.backgroundColor);',
	'',
	'	const centerX = width / 2;',
	'	const centerY = height / 2;',
	'	const iconSize = Math.min(width, height) / 8;',
	'',
	'	renderImageIcon(ctx, centerX, centerY - iconSize, iconSize, config.iconColor);',
	'',
	'	ctx.textAlign = "center";',
	'	ctx.textBaseline = "top";',
	'	const primaryFontSize = Math.max(16, Math.min(width, height) / 20);',
	'	ctx.font = `${primaryFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;',
	'	ctx.fillStyle = config.textColor;',
	'	ctx.fillText(config.primaryText, centerX, centerY + iconSize / 2);',
	'}',
	'',
	'function clearCanvas(ctx, width, height) {',
	'	ctx.clearRect(0, 0, width, height);',
	'}',
	'',
	'function fillCanvas(ctx, width, height, color) {',
	'	ctx.fillStyle = color;',
	'	ctx.fillRect(0, 0, width, height);',
	'}',
	'',
	'function renderImageIcon(ctx, x, y, size, color) {',
	'	ctx.save();',
	'	ctx.strokeStyle = color;',
	'	ctx.fillStyle = color;',
	'	ctx.lineWidth = 2;',
	'	ctx.lineCap = "round";',
	'	ctx.lineJoin = "round";',
	'',
	'	const frameSize = size;',
	'	const frameX = x - frameSize / 2;',
	'	const frameY = y - frameSize / 2;',
	'',
	'	ctx.strokeRect(frameX, frameY, frameSize, frameSize);',
	'',
	'	ctx.beginPath();',
	'	ctx.moveTo(frameX + frameSize * 0.15, frameY + frameSize * 0.7);',
	'	ctx.lineTo(frameX + frameSize * 0.4, frameY + frameSize * 0.4);',
	'	ctx.lineTo(frameX + frameSize * 0.65, frameY + frameSize * 0.7);',
	'	ctx.stroke();',
	'',
	'	ctx.beginPath();',
	'	ctx.moveTo(frameX + frameSize * 0.5, frameY + frameSize * 0.7);',
	'	ctx.lineTo(frameX + frameSize * 0.7, frameY + frameSize * 0.5);',
	'	ctx.lineTo(frameX + frameSize * 0.9, frameY + frameSize * 0.7);',
	'	ctx.stroke();',
	'',
	'	ctx.beginPath();',
	'	ctx.arc(',
	'		frameX + frameSize * 0.75,',
	'		frameY + frameSize * 0.25,',
	'		frameSize * 0.1,',
	'		0,',
	'		Math.PI * 2,',
	'	);',
	'	ctx.fill();',
	'',
	'	ctx.restore();',
	'}',
].join("\n");