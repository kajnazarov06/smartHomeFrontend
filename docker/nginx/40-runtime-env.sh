#!/bin/sh
# Writes runtime config for the SPA, so one image works with any Reverb key.
set -eu
key=$(printf '%s' "${REVERB_APP_KEY:-}" | sed 's/[^A-Za-z0-9_-]//g')
printf 'window.__ENV__ = { REVERB_APP_KEY: "%s" };\n' "$key" > /usr/share/nginx/html/env.js
