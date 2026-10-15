#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

bash "${ROOT}/scripts/bootstrap-sloop.sh"
python3 "${ROOT}/scripts/apply-overlay.py"

cd "${ROOT}/.upstream/sloop-v2.6"
./build.sh
tests/run_tests.sh

echo
echo "Saibertin S-FM M1 build/tests completed."
echo "Firmware package: ${ROOT}/.upstream/sloop-v2.6/build/felucca.fwsc"
