#!/usr/bin/env bash
# IA no Pendrive — baixar modelos no macOS (dê dois cliques)
cd "$(dirname "$0")" || exit 1
exec bash ./baixar-modelos.sh "$@"
