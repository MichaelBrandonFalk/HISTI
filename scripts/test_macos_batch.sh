#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="${ROOT_DIR}/build/verification"
TEST_APP="${TEST_DIR}/HISTI Batch Test.app"
FIXTURES="${HISTI_TEST_FIXTURES:-${TEST_DIR}/fixtures}"
OUTPUTS="${TEST_DIR}/outputs"

mkdir -p "${TEST_DIR}/module-cache" "${OUTPUTS}"
if [[ ! -d "${FIXTURES}" ]]; then
  xcrun swiftc -O -module-cache-path "${TEST_DIR}/module-cache" \
    "${ROOT_DIR}/tests/create_batch_fixtures.swift" -o "${TEST_DIR}/create-fixtures"
  "${TEST_DIR}/create-fixtures" "${FIXTURES}"
fi
ditto "${ROOT_DIR}/build/v1.7/HISTI v1.7.app" "${TEST_APP}"
xcrun swiftc -O -module-cache-path "${TEST_DIR}/module-cache" -framework AppKit -framework WebKit \
  "${ROOT_DIR}/macos/HISTIApp.swift" "${ROOT_DIR}/tests/macos_batch_smoke.swift" \
  -o "${TEST_APP}/Contents/MacOS/HISTI"
codesign --force --sign - "${TEST_APP}"
for mode in both 16x9 1x1; do
  "${TEST_APP}/Contents/MacOS/HISTI" "${FIXTURES}" "${OUTPUTS}/${mode}" "${mode}"
  node "${ROOT_DIR}/tests/verify_batch_zip.js" "${OUTPUTS}/${mode}/HISTI_V1_7_outputs.zip" "${FIXTURES}" "${mode}"
  unzip -t "${OUTPUTS}/${mode}/HISTI_V1_7_outputs.zip" | tail -n 1
done
unzip -o -j "${OUTPUTS}/both/HISTI_V1_7_outputs.zip" "ActionBible_051_1x1_3000x3000.jpg" -d "${OUTPUTS}/both" >/dev/null
xcrun swiftc -O -module-cache-path "${TEST_DIR}/module-cache" \
  "${ROOT_DIR}/tests/verify_crop.swift" -o "${TEST_DIR}/verify-crop"
"${TEST_DIR}/verify-crop" "${OUTPUTS}/both/ActionBible_051_16x9_1920x1080.jpg" "${OUTPUTS}/both/ActionBible_051_1x1_3000x3000.jpg"
