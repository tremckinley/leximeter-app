#!/usr/bin/env bash
# Exit on error
set -o errexit

npm install
# Install Playwright chromium browser and its OS-level dependencies
npx playwright install chromium --with-deps
