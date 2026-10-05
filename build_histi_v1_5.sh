#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${ROOT_DIR}/build/v1.5"
APP_DIR="${BUILD_DIR}/HISTI.app"
WEB_DIR="${BUILD_DIR}/HISTI V1_5 Web"
SIGN_IDENTITY="${HISTI_SIGN_IDENTITY:--}"

if [[ -e "${BUILD_DIR}" ]]; then
  echo "Build directory already exists: ${BUILD_DIR}" >&2
  exit 1
fi

for asset in HISTI.V1_5.macOS.zip HISTI.V1_5.web.zip; do
  if [[ -e "${ROOT_DIR}/downloads/${asset}" ]]; then
    echo "Package already exists: ${asset}" >&2
    exit 1
  fi
done

mkdir -p "${APP_DIR}/Contents/MacOS" "${APP_DIR}/Contents/Resources/site/assets" \
  "${WEB_DIR}/assets" "${BUILD_DIR}/HISTI.iconset" "${BUILD_DIR}/module-cache" "${ROOT_DIR}/downloads"

for file in index.html styles.css app.js histi_core.js zip_store.js site.webmanifest release_source.json README.md CHANGELOG.md VERSION; do
  cp -X "${ROOT_DIR}/${file}" "${APP_DIR}/Contents/Resources/site/"
  cp -X "${ROOT_DIR}/${file}" "${WEB_DIR}/"
done
cp -X "${ROOT_DIR}/assets/histi_icon.png" "${APP_DIR}/Contents/Resources/site/assets/"
cp -X "${ROOT_DIR}/assets/histi_icon.png" "${WEB_DIR}/assets/"
cp -X "${ROOT_DIR}/macos/Info.plist" "${APP_DIR}/Contents/Info.plist"

for size in 16 32 128 256 512; do
  sips -z "${size}" "${size}" "${ROOT_DIR}/assets/histi_icon.png" --out "${BUILD_DIR}/HISTI.iconset/icon_${size}x${size}.png" >/dev/null
  retina_size=$((size * 2))
  sips -z "${retina_size}" "${retina_size}" "${ROOT_DIR}/assets/histi_icon.png" --out "${BUILD_DIR}/HISTI.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "${BUILD_DIR}/HISTI.iconset" -o "${APP_DIR}/Contents/Resources/HISTI.icns"

for arch in arm64 x86_64; do
  xcrun swiftc -O -target "${arch}-apple-macos12.0" -module-cache-path "${BUILD_DIR}/module-cache" \
    -framework AppKit -framework WebKit "${ROOT_DIR}/macos/HISTIApp.swift" "${ROOT_DIR}/macos/main.swift" \
    -o "${BUILD_DIR}/HISTI-${arch}"
done
lipo -create "${BUILD_DIR}/HISTI-arm64" "${BUILD_DIR}/HISTI-x86_64" -output "${APP_DIR}/Contents/MacOS/HISTI"

if [[ "${SIGN_IDENTITY}" == "-" ]]; then
  codesign --force --sign - "${APP_DIR}"
else
  codesign --force --options runtime --timestamp --sign "${SIGN_IDENTITY}" "${APP_DIR}"
fi
codesign --verify --deep --strict "${APP_DIR}"

ditto -c -k --sequesterRsrc --keepParent "${APP_DIR}" "${ROOT_DIR}/downloads/HISTI.V1_5.macOS.zip"
if [[ -n "${HISTI_NOTARY_PROFILE:-}" ]]; then
  xcrun notarytool submit "${ROOT_DIR}/downloads/HISTI.V1_5.macOS.zip" --keychain-profile "${HISTI_NOTARY_PROFILE}" --wait
  xcrun stapler staple "${APP_DIR}"
  ditto -c -k --sequesterRsrc --keepParent "${APP_DIR}" "${ROOT_DIR}/downloads/HISTI.V1_5.macOS.zip"
fi
ditto -c -k --sequesterRsrc --keepParent "${WEB_DIR}" "${ROOT_DIR}/downloads/HISTI.V1_5.web.zip"

echo "Created ${ROOT_DIR}/downloads/HISTI.V1_5.macOS.zip"
echo "Created ${ROOT_DIR}/downloads/HISTI.V1_5.web.zip"
