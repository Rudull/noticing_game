# Version Management

## Single Source of Truth

The version number for the Noticing Game extension is centralized in **`manifest.json`**.

All other files read the version from this single source:

- **`manifest.json`** - Master version (edit this to update version)
- **`package.json`** - Synced automatically via `sync_version.py`
- **`popup.html`** - Reads version dynamically via JavaScript
- **`ui-manager.js`** - Reads version dynamically via `chrome.runtime.getManifest().version`

## How to Update the Version

1. **Edit only `manifest.json`:**
   ```json
   {
     "version": "0.4.4"
   }
   ```

2. **Run the sync script:**
   ```bash
   python3 sync_version.py
   ```

3. **Verify the changes:**
   - Check that `package.json` was updated
   - The HTML and JS files will automatically use the new version

## Automatic Sync

You can add the sync script to your build process to ensure version consistency:

```bash
# Before building/packaging
cd src/chromium_bassed
python3 sync_version.py
```

## Files Modified

- `manifest.json` - Contains the master version
- `package.json` - Synced from manifest
- `popup.html` - Uses dynamic version display
- `popup.js` - Populates version from manifest
- `ui-manager.js` - Uses manifest version in settings panel
