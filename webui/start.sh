#!/bin/sh
# Compatibility launcher; all local commands use the same Waitress startup.
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$SCRIPT_DIR/../start" "$@"
