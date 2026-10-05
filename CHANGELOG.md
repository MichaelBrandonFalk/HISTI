# Changelog

## V1.5 - 2026-10-05

- Replaced the main download with a launchable `HISTI.app` for Apple Silicon and Intel Macs (macOS 12+), using the supplied app icon.
- Added native file selection and save dialogs for individual JPG and ZIP downloads.
- Processed sources sequentially, decoding each image once for both outputs and releasing output canvases immediately.
- Added image and ZIP progress, accurate source-image counts, and incremental result-row updates for large batches.
- Reduced ZIP memory use by retaining Blob payloads and calculating checksums in small chunks.
- Added output suffixes for filenames without a source-size token, including `ActionBible_86.jpg`.
- Kept a separately labeled offline web package; both packages embed the hosted page's versioned source.

## V1.4 - 2026-08-20

- Added default dual-output generation for each valid JPG: `16x9_1920x1080` and `1x1_3000x3000`.
- Added square output naming that changes `16x9_3840x2160` to `1x1_3000x3000`.
- Added 3000x3000 square rendering by scaling the source to 3000px high and center-cropping the width.
- Updated metadata dimension patching to use each output target's actual dimensions.

## V1.3 - 2026-08-17

- Added explicit Add to Queue / Replace Queue choice when selecting files after a queue already exists.
- Added immediate skipped rows for non-JPG selections.
- Preserved source JPEG metadata segments in resized outputs while updating common EXIF/XMP dimension fields to 1920x1080.
- Added `release_source.json` so the hosted page and downloadable ZIP can be confirmed against the same versioned source marker.

## V1.2 - 2026-08-14

- Updated the display name to `Honey, I Shrunk the Images`.
- Added the supplied HISTI icon as the app icon, web page icon, and visible page branding.
- Clarified app package download versus batch output download actions.
- Moved individual JPG download buttons to the far-left results column and simplified the results table.

## V1.1 - 2026-08-14

- Added the first public HISTI browser app.
- Added bulk JPG upload and local browser-side resizing from 3840x2160 to 1920x1080.
- Added filename conversion from `3840x2160` to `1920x1080` with all other filename text preserved.
- Added versioned offline ZIP packaging and GitHub Pages documentation.
