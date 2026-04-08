#!/usr/bin/env bash
# Validate .github/workflows/*.yml with actionlint (YAML + GHA foot-guns).
#
# Resolution order:
#   1) actionlint on PATH
#   2) Docker: digest-pinned image (override ACTIONLINT_DOCKER_IMAGE)
#   3) If ACTIONLINT_BOOTSTRAP=1: download official release tarball + checksums from GitHub,
#      verify SHA256 against actionlint_${ver}_checksums.txt, extract to .cache/pqat-actionlint/
#      (needs curl; sha256 via openssl, sha256sum, or shasum)
#   4) Error with install hints
#
# Phase 80–81: default Docker ref uses multi-arch index digest; bootstrap verifies checksums.
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

sha256_file() {
  local f="$1"
  if command -v openssl >/dev/null 2>&1; then
    openssl dgst -sha256 "$f" | awk '{print $NF}'
  elif command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$f" | awk '{print $1}'
  else
    shasum -a 256 "$f" | awk '{print $1}'
  fi
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
  if ! command -v openssl >/dev/null 2>&1 && ! command -v sha256sum >/dev/null 2>&1 && ! command -v shasum >/dev/null 2>&1; then
    echo "lint-workflows: ACTIONLINT_BOOTSTRAP=1 needs openssl, sha256sum, or shasum for checksum verify" >&2
    return 1
  fi

  local ver="$ACTIONLINT_VERSION_BOOTSTRAP"
  local base="https://github.com/rhysd/actionlint/releases/download/v${ver}"
  local tball="actionlint_${ver}_${plat}.tar.gz"
  local url="${base}/${tball}"
  local tmp
  tmp="$(mktemp -d "${TMPDIR:-/tmp}/pqat-actionlint.XXXXXX")"
  cleanup_tmp() { rm -rf "$tmp"; }

  echo "lint-workflows: downloading actionlint v${ver} (${plat}) checksums + archive" >&2
  if ! curl -sSfL "${base}/actionlint_${ver}_checksums.txt" -o "$tmp/checksums.txt"; then
    cleanup_tmp
    return 1
  fi
  if ! curl -sSfL "$url" -o "$tmp/archive.tar.gz"; then
    cleanup_tmp
    return 1
  fi

  local expected
  expected="$(awk -v fn="$tball" '$2 == fn { print $1; exit }' "$tmp/checksums.txt")"
  if [[ -z "$expected" ]]; then
    echo "lint-workflows: no checksum line for ${tball} in upstream checksums file" >&2
    cleanup_tmp
    return 1
  fi

  local actual
  actual="$(sha256_file "$tmp/archive.tar.gz")"
  if [[ "$actual" != "$expected" ]]; then
    echo "lint-workflows: SHA256 mismatch for ${tball}" >&2
    echo "  expected: ${expected}" >&2
    echo "  actual:   ${actual}" >&2
    cleanup_tmp
    return 1
  fi

  mkdir -p "$(dirname "$CACHE_BIN")"
  tar xzf "$tmp/archive.tar.gz" -C "$(dirname "$CACHE_BIN")"
  chmod +x "$CACHE_BIN"
  cleanup_tmp
  echo "lint-workflows: checksum OK; installed ${CACHE_BIN}" >&2
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
echo "  - No Docker: ACTIONLINT_BOOTSTRAP=1 $0  (checksum-verified download to .cache/pqat-actionlint/)" >&2
exit 1
