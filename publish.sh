#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "$0")"
export npm_config_cache="${TMPDIR:-/tmp}/auth-core-npm-cache"

echo "Building @suonpisey/auth-core..."
npm run build -- auth-core --configuration production

echo "Files that will be published:"
npm pack ./dist/auth-core --dry-run

echo "Publishing @suonpisey/auth-core to GitHub Packages..."
npm publish ./dist/auth-core
