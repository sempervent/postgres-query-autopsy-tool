#!/usr/bin/env bash
# Validate .github/workflows/*.yml with actionlint (YAML + GHA foot-guns).
#
# Resolution order:
#   1) actionlint on PATH
#   2) Docker: digest-pinned image (override ACTIONLINT_DOCKER_IMAGE)
#   3) If ACTIONLINT_BOOTSTRAP=1: download official v1.7.7 release binary to .cache/pqat-actionlint/ (needs curl)
#   4) Error with install hints
#
# Phase 80: default Docker ref uses multi-arch index digest (same tag as v1.7.7).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DEFAULT_ACTIONLINT_DOCKER='rhysd/actionlint:1.7.7@sha256:887a259a5a534f3c4f36cb02dca341673c6089431057242cdc931e9f133147e9'
ACTIONLINT_DOCKER_IMAGE="${ACTIONLINT_DOCKER_IMAGE:-$DEFAULT_ACTIONLINT_DOCKER}"
ACTIONLINT_VERSION_BOOTSTRAP="${ACTIONLINT_VERSION_BOOTSTRAP:-1.7.7}"
CACHE_BIN="$ROOT/.cache/pqat-actionlint/actionlint"

run_actionlint() {
  exec "$1" -color
}

if command -v actionlint >/dev/null 2>&1; then
  run_actionlint actionlint
fi

if docker info >/dev/null 2>&1; then
  exec docker run --rm \
    -v "$ROOT:/repo" \
    -w /repo \
    "$ACTIONLINT_DOCKER_IMAGE" \
    -color
fi

bootstrap_from_github() {
  local plat=""
  case "$(uname -s).$(uname -m)" in
    Linux.x86_64) plat=linux_amd64 ;;
    Linux.aarch64 | Linux.arm64) plat=linux_arm64 ;;
    Darwin.x86_64) plat=darwin_amd64 ;;
    Darwin.arm64) plat=darwin_arm64 ;;
    *)
      echo "lint-workflows: ACTIONLINT_BOOTSTRAP=1 not supported on $(uname -s)/$(uname -m)" >&2
      return 1
      ;;
  esac
  if ! command -v curl >/dev/null 2>&1; then
    echo "lint-workflows: ACTIONLINT_BOOTSTRAP=1 requires curl on PATH" >&2
    return 1
  fi
  local ver="$ACTIONLINT_VERSION_BOOTSTRAP"
  local url="https://github.com/rhysd/actionlint/releases/download/v${ver}/actionlint_${ver}_${plat}.tar.gz"
  mkdir -p "$(dirname "$CACHE_BIN")"
  echo "lint-workflows: downloading actionlint v${ver} (${plat}) to .cache/pqat-actionlint/" >&2
  curl -sSfL "$url" | tar xz -C "$(dirname "$CACHE_BIN")"
  chmod +x "$CACHE_BIN"
}

if [[ "${ACTIONLINT_BOOTSTRAP:-}" == "1" ]]; then
  if [[ ! -x "$CACHE_BIN" ]]; then
    bootstrap_from_github
  fi
  run_actionlint "$CACHE_BIN"
fi

echo "lint-workflows: need actionlint. Pick one:" >&2
echo "  - Install: https://github.com/rhysd/actionlint/blob/main/docs/install.md (e.g. brew install actionlint)" >&2
echo "  - Use Docker (daemon running): default image is digest-pinned; override ACTIONLINT_DOCKER_IMAGE if needed." >&2
echo "  - No Docker: ACTIONLINT_BOOTSTRAP=1 $0  (downloads v${ACTIONLINT_VERSION_BOOTSTRAP} to .cache/pqat-actionlint/, requires curl)" >&2
exit 1
