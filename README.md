# HISTI

HISTI is a Mac app and browser tool for making 1920x1080 and 3000x3000 JPG copies from 3840x2160 JPG source files. Select 100 or more images in one batch to create both outputs for every source.

The app displays as **Honey, I Shrunk the Images**.

## Version

Current public version: `V1.5`

## Browser App

Open the public browser version:

- https://michaelbrandonfalk.github.io/HISTI/

All image processing happens in the browser. Files are not uploaded to a server.

## Download

Download the launchable Mac app:

- [HISTI.V1_5.macOS.zip](https://github.com/MichaelBrandonFalk/HISTI/releases/download/v1.5/HISTI.V1_5.macOS.zip)

Unzip, move `HISTI.app` into Applications, and open it. The universal app supports Apple Silicon and Intel Macs running macOS 12 or later. It works offline without Node, Python, or a local web server. File selection and output saving use native Mac dialogs.

This release is ad-hoc signed, not Apple-notarized. If macOS blocks its first launch, use System Settings > Privacy & Security > Open Anyway. See [Apple's instructions](https://support.apple.com/en-us/102445).

The [offline web files](https://github.com/MichaelBrandonFalk/HISTI/releases/download/v1.5/HISTI.V1_5.web.zip) remain available separately. Open their `index.html` in a browser.

## What It Does

- Accepts one or many `.jpg` / `.jpeg` files.
- Shows non-JPG selections immediately as skipped rows.
- Prompts to Add or Replace when a queue already exists and another selection is made.
- Checks that each source image is exactly `3840x2160`.
- Creates both a `16x9_1920x1080` JPG copy and a `1x1_3000x3000` JPG copy.
- Changes the resolution token for 16x9 outputs and changes `16x9_3840x2160` to `1x1_3000x3000` for square outputs.
- If the filename has no size token, appends the output ratio and dimensions: `ActionBible_86.jpg` becomes `ActionBible_86_16x9_1920x1080.jpg` and `ActionBible_86_1x1_3000x3000.jpg`.
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

The 16x9 output is scaled to 1920x1080 with no crop. The 1x1 output is scaled until the source height reaches 3000px, then center-cropped to 3000x3000. JPG output is re-encoded. Each source is decoded once, processed sequentially, and its decoded pixel buffers are released before the next image. ZIP checksums are calculated in 1 MB chunks without retaining a second full copy of every output.

## Local Build

Run the versioned build script from this directory:

```bash
bash ./build_histi_v1_5.sh
```

The script creates:

- `downloads/HISTI.V1_5.macOS.zip` containing `HISTI.app`
- `downloads/HISTI.V1_5.web.zip` containing the offline web files

Requires Apple's Command Line Tools. Set `HISTI_SIGN_IDENTITY` and `HISTI_NOTARY_PROFILE` to build a Developer ID signed and notarized release when those credentials are available. With no credentials, the build uses ad-hoc signing.

The app embeds the exact root web files under `HISTI.app/Contents/Resources/site`. Both downloads include `release_source.json`, matching the hosted page's marker for the same tag. Verify all shared files with:

```bash
node scripts/verify_packages.js
node --test tests/core.test.js
```

Run the Mac integration check (opens a test window, selects 100 full-size JPGs and a PNG through the native picker, saves a JPG and the 200-file ZIP, and validates names, dimensions and metadata):

```bash
bash scripts/test_macos_batch.sh
```

## Versioning

Each update should increment `VERSION`, add a `CHANGELOG.md` entry, create a new versioned build script or update the active version, build a new ZIP, tag the release, and publish a new GitHub release.
