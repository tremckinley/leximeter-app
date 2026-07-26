#!/usr/bin/env bash
# Exit on error
set -o errexit

rm -rf node_modules
npm install
npx playwright install chromium
