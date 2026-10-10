#!/usr/bin/env bash
# IA no Pendrive — iniciar no macOS (dê dois cliques).
# Na primeira vez: clique com o botão direito → Abrir (por causa do Gatekeeper).
cd "$(dirname "$0")" || exit 1
xattr -dr com.apple.quarantine . 2>/dev/null
exec bash ./iniciar-linux.sh "$@"
