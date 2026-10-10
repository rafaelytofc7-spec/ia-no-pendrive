#!/usr/bin/env bash
# ============================================================
#  IA no Pendrive — baixar modelos (Linux e Mac)
#  Baixa arquivos .gguf do Hugging Face para a pasta "modelos".
#  Uso: ./baixar-modelos.sh [1|2|3|4]
#  Se a internet cair, rode de novo: o download continua de onde parou.
# ============================================================
set -u
cd "$(dirname "$0")" || exit 1
mkdir -p modelos
HF="https://huggingface.co"

# nome | repositório | tamanho exato em bytes | descrição
PC="Qwen3.5-4B-Q4_K_M.gguf|unsloth/Qwen3.5-4B-GGUF|2740937888|PC — o mais inteligente (2,7 GB, precisa ~6 GB de RAM livre)"
MEDIO="Qwen3.5-2B-Q4_K_M.gguf|unsloth/Qwen3.5-2B-GGUF|1280835840|PC fraco / celular bom (1,3 GB)"
CEL="Qwen3.5-0.8B-Q4_K_M.gguf|unsloth/Qwen3.5-0.8B-GGUF|532517120|Celular e navegador — leve (0,5 GB)"

echo "============================================"
echo "   🤖 IA no Pendrive — baixar modelos"
echo "============================================"
echo "  [1] Recomendado: PC (Qwen3.5 4B) + celular (Qwen3.5 0.8B)  ≈ 3,3 GB"
echo "  [2] Só o leve para celular/navegador (Qwen3.5 0.8B)          ≈ 0,5 GB"
echo "  [3] Só o intermediário para PC fraco (Qwen3.5 2B)            ≈ 1,3 GB"
echo "  [4] Todos os três                                           ≈ 4,6 GB"
OP="${1:-}"
[ -z "$OP" ] && read -r -p "Escolha [1]: " OP
case "${OP:-1}" in
  2) LISTA=("$CEL") ;; 3) LISTA=("$MEDIO") ;; 4) LISTA=("$PC" "$MEDIO" "$CEL") ;; *) LISTA=("$PC" "$CEL") ;;
esac

command -v curl >/dev/null || { echo "❌ Preciso do 'curl'. Instale (ex.: sudo apt install curl)."; exit 1; }

tamanho() { if stat -c %s "$1" >/dev/null 2>&1; then stat -c %s "$1"; else stat -f %z "$1"; fi; }

FALHAS=0
for item in "${LISTA[@]}"; do
  IFS='|' read -r NOME REPO BYTES DESC <<< "$item"
  DEST="modelos/$NOME"
  echo; echo "▶ $NOME — $DESC"
  if [ -f "$DEST" ] && [ "$(tamanho "$DEST")" = "$BYTES" ]; then echo "  ✔ já baixado."; continue; fi
  if [ -f "$DEST.part" ] && [ "$(tamanho "$DEST.part")" = "$BYTES" ]; then mv -f "$DEST.part" "$DEST"; echo "  ✔ pronto."; continue; fi
  LIVRE_KB=$(df -Pk modelos | awk 'NR==2{print $4}')
  JA=0; [ -f "$DEST.part" ] && JA=$(tamanho "$DEST.part")
  if [ -n "$LIVRE_KB" ] && [ $(( (BYTES - JA) / 1024 )) -gt "$LIVRE_KB" ]; then
    echo "  ❌ Sem espaço livre suficiente no pendrive."; FALHAS=$((FALHAS+1)); continue
  fi
  URL="$HF/$REPO/resolve/main/$NOME?download=true"
  if curl -L --fail --retry 5 --retry-delay 3 -C - -o "$DEST.part" "$URL" --progress-bar; then
    if [ "$(tamanho "$DEST.part")" = "$BYTES" ]; then mv -f "$DEST.part" "$DEST"; echo "  ✔ pronto."
    else echo "  ⚠️  Tamanho diferente do esperado. Rode de novo para continuar."; FALHAS=$((FALHAS+1)); fi
  else
    echo "  ❌ Falha no download. Rode de novo para continuar de onde parou."; FALHAS=$((FALHAS+1))
  fi
done
echo
if [ $FALHAS = 0 ]; then echo "✅ Tudo certo! Agora é só iniciar a IA."; else echo "⚠️  $FALHAS download(s) com problema."; fi
sync 2>/dev/null
[ -t 0 ] && [ -z "${1:-}" ] && read -r -p "Aperte Enter para sair." _
exit $FALHAS
