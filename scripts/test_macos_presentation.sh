#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="${ROOT_DIR}/build/presentation"
TEST_APP="${TEST_DIR}/HISTI Presentation Test.app"
mkdir -p "${TEST_DIR}/module-cache"
ditto "${ROOT_DIR}/build/v1.7/HISTI v1.7.app" "${TEST_APP}"
xcrun swiftc -module-cache-path "${TEST_DIR}/module-cache" -framework AppKit -framework WebKit \
  "${ROOT_DIR}/macos/HISTIApp.swift" "${ROOT_DIR}/tests/macos_presentation_smoke.swift" \
  -o "${TEST_APP}/Contents/MacOS/HISTI"
codesign --force --sign - "${TEST_APP}"
"${TEST_APP}/Contents/MacOS/HISTI" "${ROOT_DIR}/tests/presentation_checks.js"
