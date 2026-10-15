#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${ROOT}/.upstream/sloop-v2.6"
REPO="https://github.com/isod89/sloop-fm1.git"
TAG="v2.6"
PIN="d30d6553353373cf5506b9ed285fc4a2aa0c30ef"

mkdir -p "${ROOT}/.upstream"

if [[ ! -d "${DEST}/.git" ]]; then
  git clone --branch "${TAG}" --depth 1 "${REPO}" "${DEST}"
else
  git -C "${DEST}" fetch --tags origin "${TAG}"
  git -C "${DEST}" checkout --detach "${TAG}"
fi

ACTUAL="$(git -C "${DEST}" rev-parse HEAD)"
if [[ "${ACTUAL}" != "${PIN}" ]]; then
  echo "ERROR: upstream ${TAG} resolved to ${ACTUAL}, expected ${PIN}" >&2
  exit 1
fi

echo "SLOOP ${TAG} pinned at ${ACTUAL}"
echo "Source: ${DEST}"
echo "Next: cd '${DEST}' && tests/run_tests.sh"
