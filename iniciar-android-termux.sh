#!/data/data/com.termux/files/usr/bin/bash
# ============================================================
#  IA no Pendrive — rodar no ANDROID pelo Termux (opcional, avançado)
#  1) Instale o Termux pelo F-Droid (https://f-droid.org/packages/com.termux/)
#  2) No Termux:  termux-setup-storage      (e permita o acesso)
#  3) Copie a pasta do pendrive para o celular (ex.: Download/ia-pendrive)
#  4) No Termux:  bash ~/storage/downloads/ia-pendrive/iniciar-android-termux.sh
# ============================================================
cd "$(dirname "$0")" || exit 1
RAIZ="$(pwd)"
PORTA="${PORTA:-8080}"
if ! command -v llama-server >/dev/null 2>&1; then
  echo "Instalando o llama.cpp do Termux (só na primeira vez, precisa de internet)…"
  pkg install -y llama-cpp || { echo "❌ Falhou. Rode: pkg update && pkg install llama-cpp"; exit 1; }
fi
MODELOS=(); while IFS= read -r f; do MODELOS+=("$f"); done < <(ls -1Sr "$RAIZ"/modelos/*.gguf 2>/dev/null | grep -vi mmproj)
[ ${#MODELOS[@]} -eq 0 ] && { echo "❌ Nenhum .gguf em $RAIZ/modelos"; exit 1; }
echo "Modelos (o menor é o mais leve para celular):"
i=1; for m in "${MODELOS[@]}"; do echo "  [$i] $(basename "$m") ($(du -h "$m" | cut -f1))"; i=$((i+1)); done
read -r -p "Escolha [1]: " N; N="${N:-1}"
[[ "$N" =~ ^[0-9]+$ ]] && [ "$N" -ge 1 ] && [ "$N" -le ${#MODELOS[@]} ] || N=1
M="${MODELOS[$((N-1))]}"
echo "⏳ Carregando $(basename "$M")… depois abra no navegador: http://localhost:$PORTA/"
( for _ in $(seq 1 300); do curl -s "http://127.0.0.1:$PORTA/health" | grep -q '"ok"' && { termux-open-url "http://localhost:$PORTA/" 2>/dev/null; echo "✅ Pronto: http://localhost:$PORTA/"; break; }; sleep 1; done ) &
exec llama-server -m "$M" --host 127.0.0.1 --port "$PORTA" --path "$RAIZ/app" -c 4096 --jinja -lv 2
