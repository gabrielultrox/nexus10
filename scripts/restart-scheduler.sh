#!/usr/bin/env sh
set -eu

pm2 restart nexus10-ze-delivery-sync || pm2 start ecosystem.config.js --only nexus10-ze-delivery-sync
