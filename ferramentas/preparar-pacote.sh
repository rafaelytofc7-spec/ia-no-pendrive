#!/usr/bin/env bash
# ============================================================
#  IA no Pendrive — (re)montar motor e bibliotecas (para quem mantém o projeto)
#  Baixa os binários oficiais do llama.cpp (github.com/ggml-org/llama.cpp)
#  e reempacota o wllama (npm @wllama/wllama + @wllama/wllama-compat).
#  Requer: bash, curl, tar, unzip, python3, node/npm.
#  Uso: ferramentas/preparar-pacote.sh [TAG_LLAMA_CPP] [VERSAO_WLLAMA]
#       ex.: ferramentas/preparar-pacote.sh b11541 3.8.1
#       (sem argumentos = versões testadas acima; "latest" = mais recentes, sem garantia)
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."
RAIZ="$(pwd)"
TAG="${1:-b11541}"
WLV="${2:-3.8.1}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

if [ "$TAG" = "latest" ]; then
  TAG=$(curl -s "https://api.github.com/repos/ggml-org/llama.cpp/releases?per_page=10" | python3 -c "import json,sys;print([r['tag_name'] for r in json.load(sys.stdin) if r['tag_name'].startswith('b')][0])")
fi
[ "$WLV" = "latest" ] && WLV=$(npm view @wllama/wllama version)
echo "llama.cpp: $TAG   wllama: $WLV"

URL="https://github.com/ggml-org/llama.cpp/releases/download/$TAG"
baixa() { echo "  baixando $1"; curl -fsSL -o "$TMP/$1" "$URL/$1"; }
baixa "llama-$TAG-bin-ubuntu-vulkan-x64.tar.gz"
baixa "llama-$TAG-bin-win-vulkan-x64.zip"
baixa "llama-$TAG-bin-macos-arm64.tar.gz"
baixa "llama-$TAG-bin-macos-x64.tar.gz"

mkdir -p "$TMP/lx" "$TMP/win" "$TMP/ma" "$TMP/mi"
tar xzf "$TMP/llama-$TAG-bin-ubuntu-vulkan-x64.tar.gz" -C "$TMP/lx"
unzip -oq "$TMP/llama-$TAG-bin-win-vulkan-x64.zip" -d "$TMP/win"
tar xzf "$TMP/llama-$TAG-bin-macos-arm64.tar.gz" -C "$TMP/ma"
tar xzf "$TMP/llama-$TAG-bin-macos-x64.tar.gz" -C "$TMP/mi"

# copia só o servidor e as bibliotecas (sem links simbólicos: exFAT não suporta)
copiar() { # origem destino
  local src; src=$(dirname "$(find "$1" -name 'llama-server*' -type f | head -1)")
  rm -rf "$2"; mkdir -p "$2"
  for f in "$src"/*; do b=$(basename "$f"); case "$b" in
    llama-server|llama-server.exe|LICENSE*) cp -L "$f" "$2/" ;;
    *-impl.so|*-impl.dll|*-impl.dylib) [[ $b == *server-impl* ]] && cp -L "$f" "$2/" ;;
    *.so|*.so.*|*.dll|*.dylib) cp -L "$f" "$2/" ;;
  esac; done
}
copiar "$TMP/lx" "$RAIZ/motor/linux"
copiar "$TMP/win" "$RAIZ/motor/windows"
copiar "$TMP/ma" "$RAIZ/motor/mac-arm64"
copiar "$TMP/mi" "$RAIZ/motor/mac-intel"
# remove cópias duplicadas de bibliotecas (o programa usa os nomes .so.0 / .0.dylib)
( cd "$RAIZ/motor/linux" && rm -f libggml.so libggml-base.so libllama.so libllama-common.so libmtmd.so ./*.so.0.* )
for d in mac-arm64 mac-intel; do
  ( cd "$RAIZ/motor/$d" && for f in *.dylib; do [[ $f =~ ^lib[a-z-]+\.0\.dylib$ || $f == *server-impl* ]] || rm -f "$f"; done )
done
cp "$RAIZ/motor/linux/LICENSE" "$RAIZ/motor/LICENSE-llama.cpp.txt"
chmod +x "$RAIZ"/motor/linux/llama-server "$RAIZ"/motor/mac-*/llama-server
sed -i.bak "s/^Versão do llama.cpp: .*/Versão do llama.cpp: $TAG/" "$RAIZ/motor/LEIA-ME.txt" && rm -f "$RAIZ/motor/LEIA-ME.txt.bak"

# ---------- wllama ----------
echo "  montando wllama $WLV"
( cd "$TMP" && npm init -y >/dev/null && npm i --silent "@wllama/wllama@$WLV" "@wllama/wllama-compat@$WLV" esbuild marked dompurify >/dev/null )
N="$TMP/node_modules"; V="$RAIZ/app/vendor"; mkdir -p "$V/licencas"
echo "import { Wllama, LoggerWithoutDebug } from '@wllama/wllama'; window.WllamaLib = { Wllama, LoggerWithoutDebug };" > "$TMP/entry.js"
( cd "$TMP" && npx esbuild entry.js --bundle --format=iife --minify --target=es2020 --outfile="$TMP/wllama.bundle.js" --log-level=warning )
python3 - "$TMP" "$V" "$N" "$WLV" <<'PY'
import base64, json, sys
tmp, V, N, ver = sys.argv[1:]
s = open(tmp + '/wllama.bundle.js').read()
# 1) em file:// usar worker "classic"; 2) injetar prefixo que entrega o .wasm ao worker
import re
m = re.search(r'return new Worker\((\w+),\{type:"module"\}\)', s)
assert m, 'padrão do Worker não encontrado — revise o patch para esta versão do wllama'
s = s.replace(m.group(0), 'return new Worker(%s,location.protocol==="file:"?{}:{type:"module"})' % m.group(1))
m2 = re.search(r'(\w+)\((\w+)\)\?new Blob\(\[\2\],\{type:"text/javascript"\}\)', s)
assert m2, 'padrão do Blob do worker não encontrado'
s = s.replace(m2.group(0), '%s(%s)?new Blob([(location.protocol==="file:"&&self.__IAP_PREFIXO_WORKER?self.__IAP_PREFIXO_WORKER():"")+%s],{type:"text/javascript"})' % (m2.group(1), m2.group(2), m2.group(2)), 1)
open(V + '/wllama.bundle.js', 'w').write('/* wllama %s (MIT, github.com/ngxson/wllama) empacotado como script clássico para o IA no Pendrive.\n   Ajustes para file://: worker "classic" e prefixo (window.__IAP_PREFIXO_WORKER) que entrega o .wasm. */\n' % ver + s)
w = open(N + '/@wllama/wllama/esm/wasm/wllama.wasm', 'rb').read()
open(V + '/wllama-wasm.js', 'w').write('/* wllama %s wasm (MIT) em base64 para funcionar via file:// */\nwindow.__WLLAMA_WASM_B64="%s";\n' % (ver, base64.b64encode(w).decode()))
c = open(N + '/@wllama/wllama-compat/wasm/wllama.wasm', 'rb').read()
js = open(N + '/@wllama/wllama-compat/wasm/wllama.js').read()
open(V + '/wllama-compat.js', 'w').write('/* wllama-compat %s (MIT) para Safari/navegadores sem JSPI/Memory64 */\nwindow.__WLLAMA_COMPAT_WASM_B64="%s";\nwindow.__WLLAMA_COMPAT_JS=%s;\n' % (ver, base64.b64encode(c).decode(), json.dumps(js)))
PY
cp "$N/marked/lib/marked.umd.js" "$V/marked.umd.js"
cp "$N/dompurify/dist/purify.min.js" "$V/purify.min.js"
cp "$N/marked/LICENSE" "$V/licencas/marked-LICENSE.txt"
cp "$N/dompurify/LICENSE" "$V/licencas/dompurify-LICENSE.txt"
cp "$N/@wllama/wllama/LICENCE" "$V/licencas/wllama-LICENSE.txt" 2>/dev/null || true
echo "✅ Pronto. Teste: ./iniciar-linux.sh"
