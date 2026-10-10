# 🤖 IA no Pendrive

Uma IA de conversa **de código aberto** que cabe num pendrive de **8 GB** e funciona no
**PC (Windows, Linux e Mac)** e no **celular**. Roda de preferência com **modelos locais**
(sem internet, nada sai do seu aparelho) e, se você quiser, também usa a
**API do Hugging Face** ou qualquer API compatível com OpenAI (OpenRouter, Groq, Ollama, LM Studio…).

- Interface em português, tema escuro, funciona no celular
- Histórico de conversas salvo no navegador (pode exportar/importar)
- Respostas aparecendo em tempo real, com formatação (listas, tabelas, código)
- Instrução de sistema (personalidade) configurável
- Motor: [llama.cpp](https://github.com/ggml-org/llama.cpp) no PC e [wllama](https://github.com/ngxson/wllama) dentro do navegador
- Licença MIT

---

## 📦 O que tem no pacote

```
ia-pendrive/
├── INICIAR-WINDOWS.bat        ← Windows: dois cliques para ligar a IA
├── iniciar-linux.sh           ← Linux
├── iniciar-mac.command        ← Mac
├── iniciar-android-termux.sh  ← Android avançado (Termux), opcional
├── baixar-modelos.bat         ← baixa os modelos (Windows)
├── baixar-modelos.sh          ← baixa os modelos (Linux)
├── baixar-modelos-mac.command ← baixa os modelos (Mac)
├── app/                       ← a interface de chat (abre no navegador)
├── motor/                     ← programas do llama.cpp para cada sistema
├── modelos/                   ← os "cérebros" (.gguf) ficam aqui
├── ferramentas/               ← para quem quer atualizar o motor
├── README.md  e  LICENSE
```

Os modelos **não** vêm no .zip (são grandes). Você baixa uma vez com o `baixar-modelos`.

---

## 1️⃣ Preparar o pendrive (uma vez só)

1. **Formate o pendrive em exFAT** (funciona em Windows, Mac, Linux e Android, e aceita arquivos grandes).
   - Windows: Explorador de Arquivos → botão direito no pendrive → *Formatar…* → Sistema de arquivos **exFAT** → Iniciar.
   - Mac: *Utilitário de Disco* → selecione o pendrive → *Apagar* → Formato **ExFAT**.
   - Linux: `sudo mkfs.exfat -n IA /dev/sdX1` (troque `sdX1` pelo seu pendrive!) ou use o app *Discos*.
   - ⚠️ Formatar **apaga tudo** que está no pendrive.
2. **Extraia o .zip** e copie a pasta `ia-pendrive` inteira para o pendrive.
   - Windows: antes de extrair, clique com o botão direito no .zip → *Propriedades* → marque **Desbloquear** → OK. Isso evita avisos do SmartScreen.
3. **Baixe os modelos** (precisa de internet só agora):
   - Windows: dois cliques em `baixar-modelos.bat`
   - Linux: abra o terminal na pasta e rode `./baixar-modelos.sh`
   - Mac: dois cliques em `baixar-modelos-mac.command` (na 1ª vez: botão direito → *Abrir*)
   - Escolha a opção **1 (Recomendado)**. Se a internet cair, rode de novo: ele continua de onde parou.

### Modelos recomendados

| Arquivo | Tamanho | Para quê |
|---|---|---|
| `Qwen3.5-4B-Q4_K_M.gguf` | 2,74 GB | **PC** – o mais inteligente. Precisa de ~6 GB de RAM livre. |
| `Qwen3.5-2B-Q4_K_M.gguf` | 1,28 GB | PC fraco (4 GB de RAM) ou celular bom |
| `Qwen3.5-0.8B-Q4_K_M.gguf` | 0,53 GB | **Celular** e “modelo dentro do navegador” (rápido, mas erra mais) |

Opção 1 = 4B + 0.8B ≈ **3,3 GB**. Todos os três ≈ 4,6 GB. Somando o motor (~230 MB) e o app (~35 MB), sobra espaço num pendrive de 8 GB.
São modelos Qwen3.5 (Alibaba, licença Apache 2.0), muito bons em português.
Você pode colocar **qualquer outro arquivo .gguf** na pasta `modelos` (Llama, Gemma, Mistral, Phi…).

---

## 2️⃣ Usar no computador

| Sistema | Como ligar |
|---|---|
| **Windows 10/11** (64 bits) | Dois cliques em **`INICIAR-WINDOWS.bat`** |
| **Linux** (x86_64) | No terminal, dentro da pasta: **`./iniciar-linux.sh`** |
| **Mac** (Apple M1/M2/M3/M4 ou Intel) | Dois cliques em **`iniciar-mac.command`** (1ª vez: botão direito → *Abrir* → *Abrir*) |

O que acontece:
1. Se houver mais de um modelo, ele pergunta qual usar (o maior é o mais inteligente).
2. Pergunta se você quer **liberar o acesso pelo celular** na mesma Wi-Fi (padrão: não).
3. Carrega o modelo (10 s a 1 min, pendrive é mais lento que SSD) e **abre o navegador sozinho** em `http://localhost:8080`.
4. Para desligar a IA, **feche a janela preta** (ou aperte Ctrl+C).

Dicas:
- Mais rápido: copie a pasta do pendrive para o PC e rode de lá.
- A placa de vídeo é usada automaticamente quando dá (Vulkan no Windows/Linux, Metal no Mac). Se der erro, o INICIAR oferece **tentar só com CPU**.
- Linux, opções: `./iniciar-linux.sh --rede` (libera o celular), `--local`, `--cpu`, `--sem-navegador`. Porta diferente: `PORTA=8081 ./iniciar-linux.sh`. Windows: edite `PORTA` no começo do `.bat`.
- Na tela do chat, toque no ⚙ para trocar o motor de IA, a personalidade, a temperatura etc.
- **Modo raciocínio** (⚙): o modelo “pensa” antes de responder. Fica mais esperto em contas e lógica, mas bem mais lento.

---

## 3️⃣ Usar no celular

Celular **não consegue rodar os programas do PC** que estão no pendrive. Por isso há 4 caminhos — do mais fácil ao mais avançado:

### A) Celular usando a IA do PC pela Wi-Fi (o melhor)
1. No PC, ligue o INICIAR e responda **S** em “Liberar acesso pelo celular”.
2. A janela mostra um endereço tipo **`http://192.168.0.10:8080`**.
3. No celular (na **mesma Wi-Fi**), abra esse endereço no navegador. Pronto: mesma interface, usando a força do PC.
   - Windows pode perguntar sobre o Firewall: clique em **Permitir**.
   - Use só em rede de confiança (casa): qualquer aparelho dessa rede consegue usar a IA enquanto estiver ligada.

### B) Modelo **dentro do navegador** do celular (100% offline)
A interface carrega um modelo pequeno (`Qwen3.5-0.8B-Q4_K_M.gguf`) e roda tudo no próprio celular.
1. Abra a interface:
   - pelo PC na Wi-Fi (caminho A) uma vez, **ou**
   - abrindo `app/index.html` direto no celular (veja a limitação abaixo), **ou**
   - por uma cópia publicada na internet (se você publicar a pasta `app` num site, ex.: GitHub Pages).
2. ⚙ → **Motor de IA: Modelo dentro do navegador** → *Escolher arquivo* → pegue o `.gguf` pequeno (no pendrive pelo adaptador **USB-OTG**, ou copiado para o celular) → **Carregar modelo**.
3. Converse. (Precisa escolher o arquivo de novo cada vez que reabrir a página.)

Limitações honestas:
- **Abrir `index.html` direto do pendrive no celular**: o Chrome do Android normalmente **não** abre páginas locais com seus arquivos auxiliares. Pode funcionar em alguns aparelhos/navegadores (ex.: Firefox), mas não é garantido. Por isso prefira os caminhos A, C ou uma cópia publicada.
- Celular tem pouca memória: use modelos até ~1,5 GB (o 0.8B é o ideal; o 2B só em celulares com 8 GB+ de RAM). O navegador não aceita arquivos acima de 2 GB.
- É mais lento que no PC (alguns tokens por segundo). Se “Usar GPU (WebGPU)” der erro, desmarque.
- iPhone/iPad (Safari): funciona em modo de compatibilidade, mais lento. Não testado em aparelho real.

### C) Android com Termux (offline e mais rápido que o navegador)
1. Instale o **Termux** pelo [F-Droid](https://f-droid.org/packages/com.termux/) (a versão da Play Store é antiga).
2. Copie a pasta `ia-pendrive` (com o modelo pequeno) do pendrive para a pasta **Download** do celular.
3. No Termux: `termux-setup-storage` (permita), depois:
   `bash ~/storage/downloads/ia-pendrive/iniciar-android-termux.sh`
4. Ele instala o llama.cpp do Termux (1ª vez, com internet) e abre a mesma interface em `http://localhost:8080`.

### D) Apps prontos que leem .gguf
- **PocketPal AI** (Android/iPhone, código aberto) e **ChatterUI** (Android, código aberto): dá para importar o `.gguf` do pendrive/celular. Não usam esta interface, mas são uma ótima alternativa offline.

### E) Hugging Face ou outra API (internet)
Funciona em qualquer aparelho com internet: ⚙ → *Hugging Face* (ou *Outra API*). Veja abaixo.

---

## 4️⃣ Hugging Face e outras APIs (online)

**Hugging Face**
1. Crie uma conta em [huggingface.co](https://huggingface.co) → *Settings* → *Access Tokens* → *Create new token* (tipo *Fine-grained*, marque **“Make calls to Inference Providers”**).
2. Na interface: ⚙ → Motor de IA: **Hugging Face** → cole o token (`hf_…`).
3. Modelo: o padrão é `google/gemma-4-26B-A4B-it`. Toque em **“Listar modelos disponíveis”** para escolher outro (ex.: `meta-llama/Llama-3.3-70B-Instruct`, `Qwen/Qwen3-235B-A22B-Instruct-2507`, `openai/gpt-oss-120b`).
4. A conta grátis tem um crédito mensal pequeno; depois disso é pago.

**Outra API compatível com OpenAI** (⚙ → *Outra API*):

| Serviço | Endereço base | Precisa de chave? |
|---|---|---|
| OpenRouter | `https://openrouter.ai/api` | sim |
| Groq | `https://api.groq.com/openai` | sim |
| Ollama (no PC) | `http://localhost:11434` | não |
| LM Studio (no PC) | `http://localhost:1234` | não |

🔒 **Tokens e chaves ficam salvos só no navegador** (localStorage) do aparelho onde você digitou. **Nunca** são gravados em arquivos do pendrive. Em computador dos outros, apague depois (⚙ → limpe o campo) ou use aba anônima.

---

## 🧯 Problemas comuns

| Problema | Solução |
|---|---|
| Windows: “O Windows protegeu o computador” | *Mais informações* → *Executar assim mesmo*. Para evitar: desbloqueie o .zip antes de extrair (passo 1). |
| Antivírus bloqueou `llama-server.exe` | É o programa oficial do llama.cpp. Adicione uma exceção ou baixe de novo de github.com/ggml-org/llama.cpp. |
| Mac: “não pode ser aberto porque é de desenvolvedor não identificado” | Botão direito no `.command` → *Abrir* → *Abrir*. Ou Ajustes → Privacidade e Segurança → *Abrir Mesmo Assim*. |
| Linux: “Permissão negada” | `chmod +x *.sh` ou rode `bash iniciar-linux.sh`. Se o pendrive estiver montado sem execução, o script copia o motor para `/tmp` sozinho. |
| Linux: erro de `libssl.so.3` ou `GLIBC` | Precisa de Ubuntu 22.04+, Debian 12+, Fedora 36+ ou similar. |
| Linux ARM / Raspberry Pi | Não incluído. Baixe `llama-…-bin-ubuntu-arm64.tar.gz` em github.com/ggml-org/llama.cpp/releases e coloque o conteúdo em `motor/linux`. |
| “Local · desconectado” na interface | O INICIAR não está rodando ou ainda está carregando. Espere a mensagem “Servidor pronto”. |
| Celular não abre `http://IP-DO-PC:8080` | Mesma Wi-Fi? Respondeu **S** no INICIAR? Firewall permitiu? Wi-Fi de visitante/escola às vezes bloqueia aparelhos entre si. |
| Muito lento | Use um modelo menor (2B ou 0.8B), copie a pasta para o PC, feche outros programas. |
| Erro de memória | Modelo grande demais para a RAM. Use um menor. No navegador, reduza o “Contexto”. |
| Porta 8080 ocupada | Linux/Mac: `PORTA=8081 ./iniciar-linux.sh`. Windows: edite `set "PORTA=8080"` no `.bat`. |
| Resposta vazia no modo raciocínio | O modelo gastou o limite pensando. Aumente “Máx. de tokens” ou desligue o modo raciocínio. |

---

## 🛠️ Para quem quer mexer

- A interface é só HTML + JS + CSS em `app/` (sem etapa de build). Bibliotecas em `app/vendor/` (marked, DOMPurify, wllama). Nada é baixado de CDN.
- O motor é o `llama-server` oficial, iniciado com `--path app` (serve a interface) e API compatível com OpenAI em `/v1/chat/completions`.
- Para atualizar o llama.cpp e o wllama: `ferramentas/preparar-pacote.sh latest` (precisa de curl, python3 e node).
- No navegador, o wllama roda em 1 thread (páginas sem cabeçalhos COOP/COEP não liberam multithread). Fica mais lento que o motor do PC, mas funciona em qualquer lugar.

## 📄 Licença

MIT — veja `LICENSE`. Componentes de terceiros mantêm suas licenças (llama.cpp MIT, wllama MIT, marked MIT, DOMPurify Apache-2.0/MPL-2.0). Modelos Qwen3.5: Apache 2.0.
