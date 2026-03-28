#!/usr/bin/env sh
set -eu

pm2 stop nexus10-ze-delivery-sync || true
pm2 delete nexus10-ze-delivery-sync || true
