# HISTI

HISTI is a small browser tool for making 1920x1080 and 3000x3000 JPG copies from 3840x2160 JPG source files.

The app displays as **Honey, I Shrunk the Images**.

## Version

Current public version: `V1.4`

## Browser App

Open the public browser version:

- https://michaelbrandonfalk.github.io/HISTI/

All image processing happens in the browser. Files are not uploaded to a server.

## Download

Download the offline browser app package:

- [HISTI.V1_4.zip](https://github.com/MichaelBrandonFalk/HISTI/releases/download/v1.4/HISTI.V1_4.zip)

The ZIP contains the same browser app and documentation files. Open `index.html` from the package or serve the folder with a small local web server.

## What It Does

- Accepts one or many `.jpg` / `.jpeg` files.
- Shows non-JPG selections immediately as skipped rows.
- Prompts to Add or Replace when a queue already exists and another selection is made.
- Checks that each source image is exactly `3840x2160`.
- Creates both a `16x9_1920x1080` JPG copy and a `1x1_3000x3000` JPG copy.
- Changes the resolution token for 16x9 outputs and changes `16x9_3840x2160` to `1x1_3000x3000` for square outputs.
- Downloads one output JPG directly or multiple outputs as a ZIP.
- Copies JPEG metadata segments into the output, updating common EXIF/XMP dimension fields to the new size.

Example:

```text
jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_3840x2160.jpg
```

creates:

```text
jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_1920x1080.jpg
jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_1x1_3000x3000.jpg
```

## Notes

The 16x9 output is scaled to 1920x1080 with no crop. The 1x1 output is scaled until the source height reaches 3000px, then center-cropped to 3000x3000. Like any browser-based resize, the JPG output is re-encoded by the browser.

## Local Build

Run the versioned build script from this directory:

```bash
./build_histi_v1_4.sh
```

The script creates:

- `downloads/HISTI.V1_4.zip`

The package includes `release_source.json`, which should match the hosted page's `release_source.json` for the same release tag.

## Versioning

Each update should increment `VERSION`, add a `CHANGELOG.md` entry, create a new versioned build script or update the active version, build a new ZIP, tag the release, and publish a new GitHub release.
