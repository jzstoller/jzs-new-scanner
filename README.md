# Simple Scanner2

An Obsidian plugin for scanning and processing images and documents. Capture or upload a photo, let the plugin automatically detect the page corners, apply perspective correction, and save the result directly to your vault.

## Features

### Instant File Picker on Launch
- Clicking the ribbon icon or running the command immediately opens the system file picker (macOS) or the native photo sheet — "Photo Library / Take Photo / Choose File" — (iOS/iPadOS)
- The scanner modal opens only after a file is selected, so you never see an empty canvas

### Auto Corner Detection
- After an image loads, the plugin automatically runs a full computer-vision pipeline to find the four corners of the page
- Pipeline: HSV paper mask → median blur → Gaussian blur → Sobel edge detection → non-maximum suppression → hysteresis thresholding → double dilation → contour finding → convex hull → quad approximation → validation
- Detected corners are shown immediately as draggable blue handles so you can review and adjust before confirming
- If detection fails, a notice is shown and you can place corners manually using the Crop button

### Interactive Perspective Crop
- Four draggable corner handles (blue circles with white outline)
- A magnifying loupe appears while dragging a handle for precise placement
- Confirm (✓) applies the perspective transform and replaces the canvas image
- Cancel (✗) removes the handles without modifying the image
- Crop operates on the full native image resolution, not the scaled preview

### Manual Crop Mode
- The Crop button places handles at the four corners of the current image
- Drag any handle to define an arbitrary quadrilateral
- Confirm to apply perspective correction

### Export
- Export happens on a single button click with no modal — all options are configured in Settings
- PNG: lossless, preserves transparency
- JPG: lossy, configurable quality, alpha flattened to white background
- Exported filename is auto-generated as `scan-YYYY-MM-DD-HHmmss`
- File is saved directly to the configured vault folder
- A success notice shows the exported dimensions and file size in KB
- Optionally inserts `![[path/to/file]]` at the cursor in the active note
- Optionally closes the scanner modal after export

### Export Aspect Ratio (16:9)
- Optionally stretches the exported image to a fixed 16:9 aspect ratio instead of keeping its original shape
- **Auto** orientation (default) picks a wide 16:9 result for landscape scans and a tall 9:16 result for portrait scans, so a single "16:9" setting adapts to either shape
- Orientation can be forced to **Force landscape** or **Force portrait** to override that detection — useful when you always want the same output shape regardless of how the source was scanned
- This stretches (not crops or letterboxes) the image to fill the target dimensions exactly; forcing an orientation opposite a scan's natural shape (e.g. Force landscape on a portrait scan) will look noticeably more squashed/stretched than Auto — this is expected, not a bug
- If the source already matches the target ratio (within 1% tolerance), the image is left untouched
- A quick-override icon button (ratio icon) next to the export button in the scanner modal opens a small popover with the same two dropdowns (ratio + orientation) as the Settings tab — both read/write the same persisted settings, so changing it in one place is reflected in the other
- **Why this exists:** this was added to fix photos of 16:9 PowerPoint/Keynote slides that get captured at a distorted angle or aspect ratio — stretching back to 16:9 restores the correct proportions of the slide content. Since it stretches to a fixed 16:9/9:16 ratio, it won't currently produce an undistorted result for 4:3 slides — that ratio isn't supported yet

---

## Installation

### From Obsidian Community Plugins (Coming Soon)
1. Open Obsidian Settings → Community Plugins
2. Search for "Simple Scanner2"
3. Click Install, then Enable

### Beta Testing with BRAT (Recommended)

> **Note:** Until the official community plugin release, BRAT is the recommended installation method.

1. Install [BRAT](https://github.com/TfTHacker/obsidian42-brat) from Community Plugins
2. Open BRAT settings → "Add Beta plugin"
3. Enter: `jzstoller/jzs-new-scanner`
4. Click "Add Plugin"
5. Go to Settings → Community Plugins and enable "Simple Scanner2"

BRAT keeps the plugin updated automatically with each new release.

### Manual Installation

> **Warning:** Manual installation bypasses BRAT's update mechanism. You will need to re-download files for each update.

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest GitHub release](https://github.com/jzstoller/jzs-new-scanner/releases/latest)
2. Copy them to `<vault>/.obsidian/plugins/jzs-new-scanner/`
3. Reload Obsidian
4. Enable the plugin in Settings → Community Plugins

---

## Usage

### Basic Workflow

1. Click the scan icon in the ribbon, or run "Open scanner" from the Command Palette
2. The system file picker (or iOS photo sheet) opens immediately
3. Select or capture an image
4. The scanner modal opens with the image loaded and corner handles already placed
5. Drag the four blue handles to align with the document corners if needed
6. Tap ✓ to apply perspective correction
7. Tap the export button (download icon) to save to your vault

### Perspective Crop in Detail

1. Corner handles appear automatically after the image loads (auto-detection)
2. If auto-detection fails, tap the Crop button to place handles at the image corners manually
3. Drag each handle to the corresponding corner of the document
4. The magnifying loupe shows a zoomed view of the area under your finger/cursor while dragging
5. Tap ✓ to transform the quadrilateral into a rectangle — the canvas updates to show the corrected image
6. Tap ✗ to cancel without changing the image

### Re-uploading an Image

While the modal is open, tap the image button (gallery icon) to replace the current image with a new one from the file picker.

### Manual Corner Detection

Tap the scan button (scan icon) to re-run auto corner detection on the current image at any time.

### Quick Aspect Ratio Override

Tap the ratio icon in the scanner modal to open a popover with two dropdowns: aspect ratio (Original / 16:9) and orientation (Auto / Force landscape / Force portrait). The orientation dropdown only appears once a ratio other than Original is selected. Both controls edit the same settings used by the Settings tab, so there's no separate per-scan-only state — changes made here persist as your new defaults.

---

## Settings

Access via Settings → Simple Scanner2.

| Setting | Default | Description |
|---|---|---|
| Default export folder | `Scanned` | Vault folder where exported files are saved. Supports nested paths like `Notes/Scans`. Created automatically if it does not exist. |
| Default export format | `PNG` | File format: PNG, or JPG. |
| Optimize image size | On | Resizes the exported image so the longest edge is at most 2000 px, maintaining aspect ratio. Has no effect if the image is already smaller. |
| Strip alpha channel | Off | Flattens transparency to a white background before exporting. Useful for JPG (which does not support transparency). |
| Export aspect ratio | `Original` | Stretches the exported image to a fixed ratio: `Original` (does nothing) or `16:9`. Auto-orients to wide 16:9 for landscape scans and tall 9:16 for portrait scans. |
| Aspect ratio orientation | `Auto` | Only shown when Export aspect ratio is not `Original`. `Auto` uses the auto-orientation above; `Force landscape` / `Force portrait` override it regardless of the scan's natural shape. |
| Export quality | `0.92` | JPEG compression quality from 0.1 (smallest file) to 1.0 (best quality). Has no effect on PNG. |
| Insert link after export | On | Inserts `![[path/to/exported/file]]` at the cursor position in the active note after a successful export. |
| Close scanner after export | On | Automatically closes the scanner modal after a successful export. |

---

## Technical Notes

- Requires Obsidian **1.8.10** or later (`setIcon` and `setTooltip` on `ButtonComponent` require this version)
- `isDesktopOnly: false` — works on iOS and Android
- Perspective transform uses the [perspective-transform](https://github.com/jlouthan/perspective-transform) library with flat 8-number coordinate arrays
- Corner detection downscales to a maximum of 800 px on the long edge for performance, then scales results back to full resolution
- Export canvas is built at full native image resolution; resize (if enabled) happens at canvas creation time so the encoder never processes an oversized image

---

## Project Structure

```
jzs-new-scanner/
├── main.ts                        # Plugin entry point, settings
├── Services/
│   ├── AspectRatio.ts             # 16:9 aspect-ratio stretch helper (auto/forced orientation)
│   ├── CanvasRenderer.ts          # Canvas drawing utilities
│   ├── CropPointManager.ts        # Crop point logic and ordering
│   ├── ImageCompress.ts           # Resize + flatten + encode pipeline
│   ├── ImageExport.ts             # PNG / JPG export functions
│   ├── ImageTransform.ts          # Perspective crop, rotation
│   ├── ImageUpload.ts             # File input handling
│   ├── Interaction.ts             # Hit-testing utilities
│   ├── PageDetection.ts           # Computer-vision corner detection
│   ├── VaultExport.ts             # Vault folder creation and file saving
│   └── types.ts                   # Shared TypeScript types
├── UI/
│   ├── Components/
│   │   ├── ExportControls.ts      # Export button and export logic
│   │   └── ImagePreview.ts        # Canvas preview, crop handles, magnifier
│   └── Modals/
│       └── scannerModal.ts        # Main scanner modal
├── test/                          # Vitest test suite
└── styles.css                     # Plugin styles
```

---

## Development

### Prerequisites
- Node.js v16 or higher
- npm

### Setup

```bash
git clone https://github.com/jzstoller/jzs-new-scanner.git
cd jzs-new-scanner
npm install
```

### Commands

```bash
npm run dev          # Watch mode (esbuild)
npm run build        # Production build with TypeScript check
npm test             # Run all tests (Vitest)
npm run test:ui      # Interactive test UI
npm run test:coverage  # Coverage report
```

### Releasing

```bash
bash bump.sh <version>   # Bumps version, builds, commits, tags, pushes, creates GitHub release
```

### Code Style

- Indentation: tabs (width 4)
- Quotes: double
- Semicolons: required
- Obsidian imports first, then a blank line, then local imports using path aliases (`Services/`, `UI/`)

---

## Support

- Bug reports: [GitHub Issues](https://github.com/jzstoller/jzs-new-scanner/issues)
- Questions: [GitHub Discussions](https://github.com/jzstoller/jzs-new-scanner/discussions)
- Obsidian plugin docs: [docs.obsidian.md](https://docs.obsidian.md/Plugins)

---

## License

This plugin is licensed under the MIT License.

It includes portions of code from the `obsidian-scan-sketch` plugin by Show Wai Yan, which is licensed under the Zero-Clause BSD (0BSD) License.

The original 0BSD license and copyright notice are preserved in:

THIRD_PARTY_NOTICES/obsidian-scan-sketch/

---

## Acknowledgments

- Built with the [Obsidian API](https://github.com/obsidianmd/obsidian-api)
- Perspective correction via [perspective-transform](https://github.com/jlouthan/perspective-transform) by [@jlouthan](https://github.com/jlouthan)
