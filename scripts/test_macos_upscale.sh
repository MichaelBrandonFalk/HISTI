#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="${ROOT_DIR}/build/upscale-verification"
TEST_APP="${TEST_DIR}/HISTI Upscale Test.app"
mkdir -p "${TEST_DIR}/module-cache" "${TEST_DIR}/fixtures" "${TEST_DIR}/outputs"
xcrun swiftc -O -module-cache-path "${TEST_DIR}/module-cache" "${ROOT_DIR}/tests/create_batch_fixtures.swift" -o "${TEST_DIR}/create-fixtures"
"${TEST_DIR}/create-fixtures" "${TEST_DIR}/fixtures" upscale
ditto "${ROOT_DIR}/build/v1.9/HISTI v1.9.app" "${TEST_APP}"
xcrun swiftc -module-cache-path "${TEST_DIR}/module-cache" -framework AppKit -framework WebKit \
  "${ROOT_DIR}/macos/HISTIApp.swift" "${ROOT_DIR}/tests/macos_batch_smoke.swift" -o "${TEST_APP}/Contents/MacOS/HISTI"
codesign --force --sign - "${TEST_APP}"
"${TEST_APP}/Contents/MacOS/HISTI" "${TEST_DIR}/fixtures" "${TEST_DIR}/outputs" upscale
node "${ROOT_DIR}/tests/verify_batch_zip.js" "${TEST_DIR}/outputs/HISTI_V1_9_upscaled_outputs.zip" "${TEST_DIR}/fixtures" upscale
unzip -t "${TEST_DIR}/outputs/HISTI_V1_9_upscaled_outputs.zip" | tail -n 1
