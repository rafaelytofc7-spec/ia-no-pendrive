#!/usr/bin/env bash
# ============================================================
#  IA no Pendrive — iniciar no Linux (e base do Mac)
#  Uso: ./iniciar-linux.sh            (pergunta tudo)
#       ./iniciar-linux.sh --rede     (libera acesso pelo celular na Wi-Fi)
#       ./iniciar-linux.sh --local    (só neste PC)
#       ./iniciar-linux.sh --cpu      (sem GPU, se der erro)
#       ./iniciar-linux.sh --sem-navegador
#  Variáveis opcionais: PORTA=8080  CONTEXTO=8192  MODELO=arquivo.gguf
# ============================================================
set -u
cd "$(dirname "$0")" || exit 1
RAIZ="$(pwd)"
PORTA="${PORTA:-8080}"
CONTEXTO="${CONTEXTO:-8192}"
REDE=""; SO_CPU=0; ABRIR=1
for a in "$@"; do
  case "$a" in
    --rede) REDE=s ;; --local) REDE=n ;; --cpu) SO_CPU=1 ;; --sem-navegador) ABRIR=0 ;;
  esac
done

SISTEMA="$(uname -s)"; ARQ="$(uname -m)"
case "$SISTEMA" in
  Linux)  MOTOR_DIR="$RAIZ/motor/linux"
          [ "$ARQ" = "x86_64" ] || { echo "⚠️  Este pendrive traz o motor para Linux x86_64 (seu sistema: $ARQ)."; echo "   Veja o README (seção Linux ARM / Raspberry Pi)."; } ;;
  Darwin) if [ "$ARQ" = "arm64" ]; then MOTOR_DIR="$RAIZ/motor/mac-arm64"; else MOTOR_DIR="$RAIZ/motor/mac-intel"; fi ;;
  *) echo "Sistema não suportado: $SISTEMA"; exit 1 ;;
esac

echo "============================================"
echo "        🤖  IA no Pendrive"
echo "============================================"

# ---------- escolher o modelo ----------
MODELOS=()
while IFS= read -r f; do MODELOS+=("$f"); done < <(ls -1S "$RAIZ"/modelos/*.gguf 2>/dev/null | grep -vi mmproj)
if [ ${#MODELOS[@]} -eq 0 ]; then
  echo
  echo "❌ Nenhum modelo (.gguf) encontrado na pasta 'modelos'."
  echo "   Rode primeiro:  ./baixar-modelos.sh   (precisa de internet uma vez)"
  echo "   ou copie um arquivo .gguf para a pasta 'modelos'."
  read -r -p "Aperte Enter para sair." _ ; exit 1
fi
if [ -n "${MODELO:-}" ]; then
  ESCOLHIDO="$RAIZ/modelos/$(basename "$MODELO")"
elif [ ${#MODELOS[@]} -eq 1 ]; then
  ESCOLHIDO="${MODELOS[0]}"
else
  echo; echo "Modelos encontrados (o maior costuma ser o mais inteligente):"
  i=1; for m in "${MODELOS[@]}"; do
    tam=$(du -h "$m" | cut -f1); echo "  [$i] $(basename "$m")  ($tam)"; i=$((i+1))
  done
  read -r -t 30 -p "Escolha o número [1]: " N || true
  N="${N:-1}"
  if ! [[ "$N" =~ ^[0-9]+$ ]] || [ "$N" -lt 1 ] || [ "$N" -gt ${#MODELOS[@]} ]; then N=1; fi
  ESCOLHIDO="${MODELOS[$((N-1))]}"
fi
[ -f "$ESCOLHIDO" ] || { echo "❌ Modelo não encontrado: $ESCOLHIDO"; exit 1; }
echo "✔ Modelo: $(basename "$ESCOLHIDO")"

# ---------- acesso pela rede (celular) ----------
if [ -z "$REDE" ]; then
  read -r -t 15 -p "Liberar acesso pelo celular na mesma Wi-Fi? [s/N]: " REDE || true
  echo
fi
case "${REDE:-n}" in s|S|sim|SIM) HOST="0.0.0.0" ;; *) HOST="127.0.0.1" ;; esac

# ---------- preparar o motor ----------
SERVER="$MOTOR_DIR/llama-server"
[ -f "$SERVER" ] || { echo "❌ Motor não encontrado em $MOTOR_DIR"; exit 1; }
chmod +x "$SERVER" 2>/dev/null
if [ "$SISTEMA" = "Darwin" ]; then
  # tira a "quarentena" do macOS (arquivos baixados da internet)
  xattr -dr com.apple.quarantine "$MOTOR_DIR" 2>/dev/null || true
  export DYLD_LIBRARY_PATH="$MOTOR_DIR${DYLD_LIBRARY_PATH:+:$DYLD_LIBRARY_PATH}"
else
  export LD_LIBRARY_PATH="$MOTOR_DIR${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
fi
if ! "$SERVER" --version >/dev/null 2>&1; then
  # Pendrive montado sem permissão de execução (noexec)? Copia o motor para uma pasta temporária.
  TMPM="${TMPDIR:-/tmp}/ia-pendrive-motor"
  echo "ℹ️  Não consegui executar direto do pendrive. Copiando o motor para $TMPM …"
  rm -rf "$TMPM"; mkdir -p "$TMPM" && cp -R "$MOTOR_DIR/." "$TMPM/" && chmod +x "$TMPM/llama-server"
  MOTOR_DIR="$TMPM"; SERVER="$TMPM/llama-server"
  export LD_LIBRARY_PATH="$MOTOR_DIR"; export DYLD_LIBRARY_PATH="$MOTOR_DIR"
  [ "$SISTEMA" = "Darwin" ] && xattr -dr com.apple.quarantine "$MOTOR_DIR" 2>/dev/null
  if ! "$SERVER" --version >/dev/null 2>&1; then
    echo "❌ O motor não roda neste sistema. Detalhes:"; "$SERVER" --version 2>&1 | tail -5
    echo "   (No Linux é preciso glibc 2.35+ e libssl3 — Ubuntu 22.04 ou mais novo.)"
    read -r -p "Aperte Enter para sair." _ ; exit 1
  fi
fi

# ---------- já está rodando? ----------
if curl -s --max-time 2 "http://127.0.0.1:$PORTA/health" 2>/dev/null | grep -q '"ok"'; then
  echo "ℹ️  Já existe um servidor rodando na porta $PORTA. Abrindo o navegador…"
  [ $ABRIR = 1 ] && { command -v xdg-open >/dev/null && xdg-open "http://localhost:$PORTA/" >/dev/null 2>&1 || open "http://localhost:$PORTA/" 2>/dev/null; }
  exit 0
fi

ip_local() {
  if [ "$SISTEMA" = "Darwin" ]; then
    for i in en0 en1 en2; do ipconfig getifaddr $i 2>/dev/null && return; done
  else
    ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' && return
    hostname -I 2>/dev/null | awk '{print $1}'
  fi
}

abrir_quando_pronto() {
  for _ in $(seq 1 600); do
    if curl -s --max-time 2 "http://127.0.0.1:$PORTA/health" 2>/dev/null | grep -q '"ok"'; then
      echo
      echo "✅ Servidor pronto!  No PC, abra:  http://localhost:$PORTA/"
      if [ "$HOST" = "0.0.0.0" ]; then
        IP="$(ip_local)"
        echo "📱 No celular (mesma Wi-Fi), abra:  http://${IP:-IP-DO-PC}:$PORTA/"
      fi
      echo "   Para desligar a IA, feche esta janela ou aperte Ctrl+C."
      echo
      if [ $ABRIR = 1 ]; then
        if [ "$SISTEMA" = "Darwin" ]; then open "http://localhost:$PORTA/"
        else (xdg-open "http://localhost:$PORTA/" >/dev/null 2>&1 &) ; fi
      fi
      return
    fi
    sleep 1
  done
}

rodar() {
  local extra=()
  [ "$1" = 1 ] && extra=(--device none -ngl 0)
  echo "⏳ Carregando o modelo (pode levar de 10 s a 1 min no pendrive)…"
  abrir_quando_pronto &
  local POLL=$!
  "$SERVER" -m "$ESCOLHIDO" --host "$HOST" --port "$PORTA" --path "$RAIZ/app" \
    -c "$CONTEXTO" --jinja -lv 2 ${extra[@]+"${extra[@]}"}
  local cod=$?
  kill $POLL 2>/dev/null
  return $cod
}

trap 'echo; echo "👋 IA desligada."; exit 0' INT TERM
rodar $SO_CPU
COD=$?
if [ $COD -ne 0 ] && [ $SO_CPU = 0 ]; then
  echo
  echo "⚠️  O motor fechou com erro ($COD)."
  read -r -t 30 -p "Tentar de novo só com CPU (sem placa de vídeo)? [S/n]: " R || true
  case "${R:-s}" in n|N) ;; *) rodar 1; COD=$? ;; esac
fi
[ $COD -ne 0 ] && { echo "❌ Não deu certo. Veja a seção 'Problemas comuns' no README.md"; read -r -t 60 -p "Aperte Enter para sair." _ ; }
exit $COD
