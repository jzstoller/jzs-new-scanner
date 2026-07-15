# iOS Photo Capture Diagnostic Guide

## Quick Start: How to Read the Logs

All plugin logs start with `[Photo]`. To debug iOS photo capture:

### On iOS (iPhone/iPad):
1. Open Obsidian on Safari
2. In Safari on macOS, open **Develop → [Device Name] → Obsidian** to see the JavaScript console
3. Alternatively, open Xcode → Window → Devices and Simulators → select device → Open Console
4. Look for all messages starting with `[Photo]`

### On macOS/Windows:
- Press **Ctrl+Shift+I** (or **Cmd+Shift+I** on Mac) to open Developer Tools
- Click the **Console** tab
- Filter for `[Photo]` to see only plugin logs

---

## Expected Log Sequence (Successful Photo Capture)

Here's what a **successful** photo capture should look like in the console:

```
[Photo] 📂 Opening file picker
[Photo] 🖱️ Triggering file picker click
[Photo] 🎯 Picker change event fired
[Photo] 📸 File received: "IMG_1234.jpg" (3145728 bytes, type="image/jpeg")
[Photo] 🔐 Starting file readiness validation...
[Photo] 🔍 Starting file readiness check for "IMG_1234.jpg"
[Photo] ⏳ Attempt 1: size=3145728, type=image/jpeg, name="IMG_1234.jpg"
[Photo] ✅ File ready after 1 attempts (0ms): 3145728 bytes, type=image/jpeg
[Photo] ✅ File validation passed! Opening scanner modal...
[Photo] 🆕 ScannerModal constructor called, initialFile: yes
[Photo] 🪟 ScannerModal.onOpen() called
[Photo] 📁 initialFile: "IMG_1234.jpg"
[Photo] 🎨 Setting up canvas...
[Photo] ✅ Canvas setup complete
[Photo] ⚙️ Initializing export controls...
[Photo] ✅ ScannerModal.onOpen() complete, modal ready
[Photo] 📋 Initial file received, deferring to requestAnimationFrame...
[Photo] 🎬 Animation frame fired, now processing initial file "IMG_1234.jpg"
[Photo] 🖼️ darawImage() called with file: "IMG_1234.jpg" (3145728 bytes)
[Photo] ✅ File validation passed: size=3145728, type="image/jpeg"
[Photo] 🔗 Created blob URL: blob:https://...
[Photo] 🎨 Created Image object
[Photo] ⏰ Setting 5 second timeout for image load
[Photo] 📌 Attaching onload handler...
[Photo] 📌 Attaching onerror handler...
[Photo] ✨ img.decode() is available, using it
[Photo] 🔗 Assigned src, now calling decode()...
[Photo] ✅ decode() promise resolved!
[Photo] 📥 loadImage() handler fired!
[Photo] ⏰ Cleared timeout
[Photo] 📐 Checking dimensions: naturalWidth=4032, naturalHeight=3024
[Photo] ✅ Image dimensions valid: 4032x3024
[Photo] 💾 Stored image in this.img
[Photo] 🧹 Revoked blob URL
[Photo] 📏 Resized canvas to image dimensions
[Photo] ⏳ Requesting animation frame for layout flush...
[Photo] 🎬 Animation frame callback fired
[Photo] 📐 Canvas CSS dimensions: 1024x768
[Photo] 🎨 Drawing checkerboard...
[Photo] 🖌️ Drawing image to canvas (0,0,1024,768)...
[Photo] ✅ Image rendered successfully: 4032x3024 → 1024x768
[Photo] 🔔 Firing callback: success=true, msg=""
[Photo] ✅ onReady() callback executing...
[Photo] ✅ Initial file loaded, running detectAndShowCorners
```

---

## Failure Cases & Diagnostics

### Case 1: File Picker Opens But User Cancels
```
[Photo] 📂 Opening file picker
[Photo] 🖱️ Triggering file picker click
[Photo] ⚠️ User cancelled picker (no file selected)
```
✅ **This is expected** — user cancelled, no error.

---

### Case 2: iOS File Delay (File Not Ready Immediately)
```
[Photo] 📂 Opening file picker
[Photo] 🖱️ Triggering file picker click
[Photo] 🎯 Picker change event fired
[Photo] 📸 File received: "IMG_5678.jpg" (0 bytes, type="")
[Photo] 🔐 Starting file readiness validation...
[Photo] 🔍 Starting file readiness check for "IMG_5678.jpg"
[Photo] ⏳ Attempt 1: size=0, type=(empty), name="IMG_5678.jpg"
[Photo] ⏳ Attempt 2: size=0, type=(empty), name="IMG_5678.jpg"
[Photo] ⏳ Attempt 3: size=3145728, type=image/jpeg, name="IMG_5678.jpg"
[Photo] ✅ File ready after 3 attempts (150ms): 3145728 bytes, type=image/jpeg
[Photo] ✅ File validation passed! Opening scanner modal...
```
✅ **This is iOS working correctly** — file was delayed, retried, succeeded.

---

### Case 3: iOS Multiple Picker Events (Null Then Real)
```
[Photo] 📂 Opening file picker
[Photo] 🖱️ Triggering file picker click
[Photo] 🎯 Picker change event fired
[Photo] ℹ️ Change event fired but no file in files[0], waiting for next event
[Photo] 🎯 Picker change event fired
[Photo] 📸 File received: "IMG_9999.jpg" (5242880 bytes, type="image/jpeg")
[Photo] 🔐 Starting file readiness validation...
[Photo] ✅ File ready after 1 attempts (0ms): 5242880 bytes, type=image/jpeg
```
✅ **iOS handling null-file retries** — modal opened successfully.

---

### ❌ Case 4: File Never Becomes Ready (FAILURE)
```
[Photo] 📂 Opening file picker
[Photo] 🖱️ Triggering file picker click
[Photo] 🎯 Picker change event fired
[Photo] 📸 File received: "IMG_CORRUPT.jpg" (0 bytes, type="")
[Photo] 🔐 Starting file readiness validation...
[Photo] 🔍 Starting file readiness check for "IMG_CORRUPT.jpg"
[Photo] ⏳ Attempt 1: size=0, type=(empty), name="IMG_CORRUPT.jpg"
[Photo] ⏳ Attempt 2: size=0, type=(empty), name="IMG_CORRUPT.jpg"
[Photo] ⏳ Still waiting... attempt 10/50 (900ms)
[Photo] ⏳ Still waiting... attempt 20/50 (1900ms)
[Photo] ⏳ Still waiting... attempt 30/50 (2900ms)
[Photo] ⏳ Still waiting... attempt 40/50 (3900ms)
[Photo] ❌ File not ready after 50 attempts (4900ms): size=0, type=(empty). Possible causes: iOS cache delay, network buffering, or corrupted file.
[Photo] ❌ File validation failed: File not ready after 50 attempts...
```
❌ **File is corrupted or unreadable** — user will see error notice.

---

### ❌ Case 5: Image Load Timeout (FAILURE)
```
[Photo] 🖼️ darawImage() called with file: "IMG_LARGE.jpg" (15728640 bytes)
[Photo] ✅ File validation passed: size=15728640, type="image/jpeg"
[Photo] 🔗 Created blob URL: blob:https://...
[Photo] 🎨 Created Image object
[Photo] ⏰ Setting 5 second timeout for image load
[Photo] 📌 Attaching onload handler...
[Photo] 📌 Attaching onerror handler...
[Photo] ✨ img.decode() is available, using it
[Photo] 🔗 Assigned src, now calling decode()...
[Photo] ⏰ Cleared timeout
[Photo] ❌ Image load timeout (5s) - file may be incomplete or corrupted
[Photo] 🔔 Firing callback: success=false, msg="❌ Image load timeout (5s) - file may be incomplete or corrupted"
```
❌ **Image took >5 seconds to load** — user will see error notice, can retry.

---

### ❌ Case 6: decode() Promise Rejected (FAILURE)
```
[Photo] 🔗 Created blob URL: blob:https://...
[Photo] ✨ img.decode() is available, using it
[Photo] 🔗 Assigned src, now calling decode()...
[Photo] ❌ decode() promise rejected: TypeError: Unsupported image format
[Photo] ❌ onImageError() handler fired!
[Photo] Error details: Unsupported image format
[Photo] 🔔 Firing callback: success=false, msg="Failed to load image: Unsupported image format"
```
❌ **File is not a valid image** — user will see error notice.

---

### ❌ Case 7: Zero-Dimension Image (FAILURE)
```
[Photo] 📥 loadImage() handler fired!
[Photo] 📐 Checking dimensions: naturalWidth=0, naturalHeight=0
[Photo] ❌ Image data incomplete (zero dimensions)
[Photo] 🔔 Firing callback: success=false, msg="❌ Image data incomplete (zero dimensions)"
```
❌ **Image file was parsed but has no pixel data** — corrupted file, user will see error.

---

### ❌ Case 8: Canvas Layout Not Ready (FAILURE)
```
[Photo] ⏳ Requesting animation frame for layout flush...
[Photo] 🎬 Animation frame callback fired
[Photo] 📐 Canvas CSS dimensions: 0x0
[Photo] ❌ Canvas layout not ready
```
❌ **Modal didn't properly size the canvas** — browser/layout issue.

---

### ❌ Case 9: Modal Never Opens (FAILURE - Silent Drop)
If logs stop after file validation passes but modal doesn't open:
```
[Photo] ✅ File validation passed! Opening scanner modal...
(no more logs)
```
❌ **Possible causes:**
1. `ScannerModal.open()` threw an exception
2. Modal close() was called immediately
3. Plugin unloaded mid-flow

**Solution:** Search console for JavaScript errors (red messages).

---

## Common iOS-Specific Issues & Solutions

### Issue: "Still waiting... attempt 1/50" then file becomes ready
- **Cause**: Slow iOS file write
- **Solution**: Working as designed ✅ Plugin retries automatically

### Issue: Multiple "Picker change event fired" but no file
- **Cause**: iOS fired event before file available
- **Solution**: Working as designed ✅ Plugin waits for next event with real file

### Issue: File validation passes but image never loads (hangs)
- **Cause**: Browser WebKit bug, or network issue with blob: URL
- **Solution**: User will see timeout error after 5s, can retry

### Issue: Logs show `✅ Image rendered successfully` but modal closes anyway
- **Cause**: Modal.close() called elsewhere, or onReady() closed it
- **Solution**: Check if a button click handler is accidentally closing the modal

---

## How to Report Issues

When reporting an iOS photo capture issue, **please include:**

1. **Full console log** (copy from browser DevTools)
2. **iOS version** (e.g., iOS 17.5)
3. **Device** (iPhone 15 Pro, iPad Air, etc.)
4. **Obsidian version** (e.g., Obsidian 1.4.2)
5. **Photo size** (e.g., "5MB", "4032x3024")
6. **What happened**: Did the modal close? Did it hang? Did it show an error?

---

## Quick Troubleshooting Checklist

- [ ] Open Develop menu / DevTools
- [ ] Filter console for `[Photo]`
- [ ] Take a photo via the plugin
- [ ] Look for any red ❌ messages
- [ ] Look for yellow ⏳ "Still waiting" messages (> 10 attempts suggests issue)
- [ ] If it succeeds, look for ✅ "Image rendered successfully"
- [ ] If it fails, check the error message and look for pattern match above

---

## Emoji Legend

| Emoji | Meaning |
|-------|---------|
| 📂 | Opening file picker |
| 🖱️ | User action / click event |
| 🎯 | Event fired |
| 📸 | Photo/file received |
| 🔐 | Validation starting |
| 🔍 | Checking prerequisites |
| ⏳ | Waiting/retrying |
| ✅ | Success/ready |
| ❌ | Error/failure |
| ⏰ | Timeout/timer |
| 🧹 | Cleanup |
| 📌 | Handler attached |
| 🎨 | Canvas/drawing operation |
| 🖌️ | Drawing/rendering |
| 📥 | Callback fired |
| 💾 | Data stored |
| ✨ | Special feature available |
| 🎬 | Animation frame |
| 📐 | Dimension check |
| 📋 | Data queued |
| 🪟 | Modal window |
| 📁 | File data |
| ⚙️ | Configuration/setup |
| 🆕 | New/initialization |
| ℹ️ | Info/neutral |
| ⚠️ | Warning |
| 🔗 | URL/link created |
| 🔔 | Callback |
