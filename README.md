# HISTI

HISTI is a small browser tool for making 1920x1080 JPG copies from 3840x2160 JPG source files.

The app displays as **Honey I Shrunk The Images**.

## Version

Current public version: `V1.1`

## Browser App

Open the public browser version:

- https://michaelbrandonfalk.github.io/HISTI/

All image processing happens in the browser. Files are not uploaded to a server.

## Download

Download the offline browser app package:

- [HISTI V1_1.zip](https://github.com/MichaelBrandonFalk/HISTI/releases/download/v1.1/HISTI%20V1_1.zip)

The ZIP contains the same browser app and documentation files. Open `index.html` from the package or serve the folder with a small local web server.

## What It Does

- Accepts one or many `.jpg` / `.jpeg` files.
- Checks that each source image is exactly `3840x2160`.
- Creates a `1920x1080` JPG copy.
- Changes only the dimension token in the filename.
- Downloads one output JPG directly or multiple outputs as a ZIP.

Example:

```text
jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_3840x2160.jpg
```

becomes:

```text
jep_and_jess_beyond_the_bayou_s01_e01_eng_bg_16x9_1920x1080.jpg
```

## Notes

The visual content is scaled to 1920x1080 with no crop, rotation, watermark, or filename changes beyond the resolution token. Like any browser-based resize, the JPG output is re-encoded by the browser.

## Local Build

Run the versioned build script from this directory:

```bash
./build_histi_v1_1.sh
```

The script creates:

- `downloads/HISTI V1_1.zip`

## Versioning

Each update should increment `VERSION`, add a `CHANGELOG.md` entry, create a new versioned build script or update the active version, build a new ZIP, tag the release, and publish a new GitHub release.
