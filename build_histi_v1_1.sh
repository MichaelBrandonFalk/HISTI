#!/usr/bin/env bash
set -euo pipefail

APP_NAME="HISTI"
VERSION="V1_1"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="${ROOT_DIR}/build/${APP_NAME} ${VERSION}"
ZIP_PATH="${ROOT_DIR}/downloads/${APP_NAME} ${VERSION}.zip"

if [[ -e "${PACKAGE_DIR}" ]]; then
  echo "Package directory already exists: ${PACKAGE_DIR}" >&2
  exit 1
fi

if [[ -e "${ZIP_PATH}" ]]; then
  echo "ZIP already exists: ${ZIP_PATH}" >&2
  exit 1
fi

mkdir -p "${PACKAGE_DIR}" "${ROOT_DIR}/downloads"
cp "${ROOT_DIR}/index.html" "${PACKAGE_DIR}/"
cp "${ROOT_DIR}/styles.css" "${PACKAGE_DIR}/"
cp "${ROOT_DIR}/app.js" "${PACKAGE_DIR}/"
cp "${ROOT_DIR}/histi_core.js" "${PACKAGE_DIR}/"
cp "${ROOT_DIR}/zip_store.js" "${PACKAGE_DIR}/"
cp "${ROOT_DIR}/README.md" "${PACKAGE_DIR}/"
cp "${ROOT_DIR}/CHANGELOG.md" "${PACKAGE_DIR}/"
cp "${ROOT_DIR}/VERSION" "${PACKAGE_DIR}/"

(
  cd "${ROOT_DIR}/build"
  zip -qry "${ZIP_PATH}" "${APP_NAME} ${VERSION}"
)

echo "Created ${ZIP_PATH}"
