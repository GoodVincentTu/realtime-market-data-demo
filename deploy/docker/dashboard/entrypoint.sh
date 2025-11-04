#!/usr/bin/env sh
set -e

# Render/containers provide PORT; default locally
: "${PORT:=8080}"

# Substitute $PORT into nginx config template
envsubst '$PORT' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf

# Start nginx in foreground
exec nginx -g 'daemon off;'