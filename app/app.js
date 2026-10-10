/* IA no Pendrive — interface de chat (MIT)
 * Script clássico (sem módulos) para funcionar também abrindo o arquivo direto (file://).
 */
(function () {
  'use strict';

  // ---------- utilidades ----------
  var $ = function (s) { return document.querySelector(s); };
  var LS_CFG = 'iap.config.v1', LS_CONV = 'iap.conversas.v1', LS_ATUAL = 'iap.atual.v1';
  var servidoPorHttp = /^https?:$/.test(location.protocol);
  var ehToque = window.matchMedia && matchMedia('(pointer: coarse)').matches;

  function lerJSON(chave, padrao) {
    try { var v = localStorage.getItem(chave); return v ? JSON.parse(v) : padrao; } catch (e) { return padrao; }
  }
  function salvarJSON(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); }
    catch (e) { avisar('Não consegui salvar no navegador (armazenamento cheio?). Exporte e apague conversas antigas.'); }
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function escapar(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function avisar(t) { console.warn(t); alert(t); }
  function baseV1(url) {
    url = String(url || '').trim().replace(/\/+$/, '');
    if (/\/v1$/.test(url)) return url;
    return url + '/v1';
  }
  function fetchComTempo(url, opts, ms) {
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms || 4000);
    opts = opts || {}; opts.signal = ctrl.signal;
    return fetch(url, opts).finally(function () { clearTimeout(t); });
  }

  // ---------- configuração ----------
  var PADRAO = {
    backend: 'local',
    localUrl: servidoPorHttp ? location.origin : 'http://localhost:8080',
    wlUrl: '',
    wlCtx: 2048,
    wlGpu: true,
    hfToken: '',
    hfModel: 'google/gemma-4-26B-A4B-it',
    oaUrl: '',
    oaKey: '',
    oaModel: '',
    sistema: 'Você é um assistente útil e honesto. Responda sempre em português do Brasil, de forma clara e direta. Não use LaTeX: escreva contas e fórmulas em texto simples.',
    temp: 0.7,
    maxTok: 1024,
    pensar: false
  };
  var cfg = Object.assign({}, PADRAO, lerJSON(LS_CFG, {}));
  function salvarCfg() { salvarJSON(LS_CFG, cfg); }

  var NOMES = { local: 'Local', navegador: 'Navegador', hf: 'Hugging Face', openai: 'API' };

  // ---------- conversas ----------
  var conversas = lerJSON(LS_CONV, []);
  var atualId = lerJSON(LS_ATUAL, null);
  function salvarConversas() { salvarJSON(LS_CONV, conversas); salvarJSON(LS_ATUAL, atualId); }
  function conversaAtual() {
    var c = conversas.find(function (x) { return x.id === atualId; });
    return c || null;
  }
  function novaConversa() {
    var c = { id: uid(), titulo: 'Nova conversa', criada: Date.now(), msgs: [] };
    conversas.unshift(c); atualId = c.id; salvarConversas();
    renderLista(); renderMensagens(); fecharSide();
    $('#entrada').focus();
    return c;
  }

  // ---------- markdown ----------
  if (window.marked && marked.setOptions) marked.setOptions({ gfm: true, breaks: true });
  function md(texto) {
    var html;
    try { html = window.marked ? marked.parse(texto || '') : escapar(texto).replace(/\n/g, '<br>'); }
    catch (e) { html = escapar(texto); }
    return window.DOMPurify ? DOMPurify.sanitize(html) : escapar(texto);
  }
  function enfeitarCodigo(el) {
    el.querySelectorAll('pre').forEach(function (pre) {
      if (pre.querySelector('.copiar')) return;
      var b = document.createElement('button');
      b.className = 'copiar'; b.type = 'button'; b.textContent = 'copiar';
      b.onclick = function () { copiar(pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText, b); };
      pre.appendChild(b);
    });
    el.querySelectorAll('a').forEach(function (a) { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  }
  function copiar(txt, botao) {
    var ok = function () { if (botao) { var o = botao.textContent; botao.textContent = 'copiado!'; setTimeout(function () { botao.textContent = o; }, 1200); } };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(ok, function () { copiarVelho(txt); ok(); });
    else { copiarVelho(txt); ok(); }
  }
  function copiarVelho(txt) {
    var t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) { } t.remove();
  }

  // ---------- renderização ----------
  function renderLista() {
    var ul = $('#listaConversas'); ul.innerHTML = '';
    conversas.forEach(function (c) {
      var li = document.createElement('li');
      if (c.id === atualId) li.className = 'ativa';
      li.innerHTML = '<span></span><button title="Renomear">✎</button><button title="Apagar">🗑</button>';
      li.querySelector('span').textContent = c.titulo;
      li.onclick = function () { if (gerando) return; atualId = c.id; salvarConversas(); renderLista(); renderMensagens(); fecharSide(); };
      var bs = li.querySelectorAll('button');
      bs[0].onclick = function (ev) { ev.stopPropagation(); var n = prompt('Novo nome da conversa:', c.titulo); if (n) { c.titulo = n.trim().slice(0, 80) || c.titulo; salvarConversas(); renderLista(); } };
      bs[1].onclick = function (ev) {
        ev.stopPropagation(); if (gerando) return;
        if (!confirm('Apagar a conversa "' + c.titulo + '"?')) return;
        conversas = conversas.filter(function (x) { return x.id !== c.id; });
        if (atualId === c.id) atualId = conversas[0] ? conversas[0].id : null;
        salvarConversas(); renderLista(); renderMensagens();
      };
      ul.appendChild(li);
    });
  }

  function boasVindas() {
    var dica = '';
    if (!servidoPorHttp) dica = '<p class="dica">Você abriu o arquivo direto do pendrive. Para usar a IA do PC, rode o <b>INICIAR</b> do seu sistema. Sem PC? Use o <b>modelo dentro do navegador</b>.</p>';
    return '<div class="boasvindas"><div style="font-size:44px">🤖</div><h1>IA no Pendrive</h1>' +
      '<p>Sua IA de código aberto, que roda no seu computador ou celular.</p>' + dica +
      '<div class="cards">' +
      '<div class="card" data-b="local"><b>💻 Servidor local</b><small>Modelo rodando no PC pelo INICIAR. Rápido e offline. Celular na mesma Wi-Fi também usa.</small></div>' +
      '<div class="card" data-b="navegador"><b>📱 Dentro do navegador</b><small>Carrega um .gguf pequeno direto no aparelho. 100% offline, mais lento.</small></div>' +
      '<div class="card" data-b="hf"><b>🤗 Hugging Face</b><small>Modelos grandes pela internet, com seu token.</small></div>' +
      '<div class="card" data-b="openai"><b>🌐 Outra API</b><small>OpenRouter, Groq, Ollama, LM Studio…</small></div>' +
      '</div><p class="dica" style="margin-top:14px">Motor atual: <b>' + NOMES[cfg.backend] + '</b>. Toque num cartão para trocar.</p></div>';
  }

  function htmlMensagem(m, i, ultima) {
    var quem = m.role === 'user' ? 'Você' : 'IA';
    var av = m.role === 'user' ? '🙂' : '🤖';
    var botoes = '<button data-acao="copiar" data-i="' + i + '">copiar</button>';
    if (m.role === 'assistant' && ultima) botoes += '<button data-acao="refazer" data-i="' + i + '">refazer</button>';
    if (m.role === 'user') botoes += '<button data-acao="editar" data-i="' + i + '">editar</button>';
    botoes += '<button data-acao="apagar" data-i="' + i + '">apagar</button>';
    var corpo = '';
    if (m.role === 'user') corpo = '<div class="texto">' + escapar(m.content) + '</div>';
    else {
      if (m.reasoning) corpo += '<details class="pensamento"' + (m.content ? '' : ' open') + '><summary>Raciocínio</summary><div>' + escapar(m.reasoning) + '</div></details>';
      corpo += '<div class="texto">' + md(m.content) + '</div>';
      if (m.erro) corpo += '<div class="erro-msg">⚠️ ' + escapar(m.erro) + '</div>';
      if (m.stats) corpo += '<div class="stats">' + escapar(m.stats) + '</div>';
    }
    return '<div class="msg ' + m.role + '" data-i="' + i + '"><div class="av">' + av + '</div><div class="corpo"><div class="quem">' + quem + botoes + '</div>' + corpo + '</div></div>';
  }

  function renderMensagens() {
    var box = $('#mensagens');
    var c = conversaAtual();
    if (!c || !c.msgs.length) { box.innerHTML = boasVindas(); ligarCards(); return; }
    box.innerHTML = c.msgs.map(function (m, i) { return htmlMensagem(m, i, i === c.msgs.length - 1); }).join('');
    enfeitarCodigo(box);
    box.scrollTop = box.scrollHeight;
  }
  function ligarCards() {
    document.querySelectorAll('.card[data-b]').forEach(function (el) {
      el.onclick = function () { cfg.backend = el.getAttribute('data-b'); salvarCfg(); abrirConfig(); };
    });
  }

  var agendado = false;
  function atualizarUltima() {
    if (agendado) return; agendado = true;
    requestAnimationFrame(function () {
      agendado = false;
      var c = conversaAtual(); if (!c) return;
      var i = c.msgs.length - 1, m = c.msgs[i];
      var box = $('#mensagens');
      var perto = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
      var el = box.querySelector('.msg[data-i="' + i + '"]');
      var tmp = document.createElement('div'); tmp.innerHTML = htmlMensagem(m, i, true);
      var novo = tmp.firstChild;
      if (gerando) { var t = novo.querySelector('.texto'); if (t) t.classList.add('cursor'); }
      var detAntigo = el && el.querySelector('details.pensamento'), detNovo = novo.querySelector('details.pensamento');
      // mantém aberto/fechado como o usuário deixou, mas fecha sozinho quando a resposta começa
      if (detAntigo && detNovo && (m.content ? detAntigo.dataset.temResposta : true)) detNovo.open = detAntigo.open;
      if (detNovo && m.content) detNovo.dataset.temResposta = '1';
      if (el) el.replaceWith(novo); else box.appendChild(novo);
      enfeitarCodigo(novo);
      if (perto) box.scrollTop = box.scrollHeight;
    });
  }

  $('#mensagens').addEventListener('click', function (ev) {
    var b = ev.target.closest('button[data-acao]'); if (!b || gerando) return;
    var c = conversaAtual(); if (!c) return;
    var i = +b.getAttribute('data-i'), m = c.msgs[i], acao = b.getAttribute('data-acao');
    if (acao === 'copiar') copiar(m.content || '', b);
    else if (acao === 'apagar') { c.msgs.splice(i, 1); salvarConversas(); renderMensagens(); }
    else if (acao === 'refazer') { c.msgs.splice(i, 1); salvarConversas(); renderMensagens(); gerarResposta(c); }
    else if (acao === 'editar') {
      $('#entrada').value = m.content; c.msgs.splice(i); salvarConversas(); renderMensagens(); autoAltura(); $('#entrada').focus();
    }
  });

  // ---------- chip de status ----------
  var chipSeq = 0;
  function chip(estado, texto) {
    var el = $('#chipBackend'); el.className = 'chip ' + (estado || ''); $('#chipTexto').textContent = texto;
  }
  function nomeCurto(id) { return String(id || '').split(/[\\/]/).pop().replace(/\.gguf$/i, ''); }
  function atualizarChip() {
    var seq = ++chipSeq, b = cfg.backend;
    if (b === 'local') {
      chip('', 'Local · verificando…');
      fetchComTempo(baseV1(cfg.localUrl) + '/models', {}, 4000).then(function (r) { return r.json(); }).then(function (j) {
        if (seq !== chipSeq) return;
        var id = j && j.data && j.data[0] ? j.data[0].id : '';
        chip('ok', 'Local · ' + (nomeCurto(id) || 'conectado'));
      }).catch(function () { if (seq === chipSeq) chip('erro', 'Local · desconectado'); });
    } else if (b === 'navegador') {
      if (wl) chip('ok', 'Navegador · ' + wlNome);
      else chip('aviso', 'Navegador · sem modelo');
    } else if (b === 'hf') {
      chip(cfg.hfToken ? 'ok' : 'aviso', 'HF · ' + (cfg.hfToken ? nomeCurto(cfg.hfModel) : 'falta token'));
    } else {
      chip(cfg.oaUrl ? 'ok' : 'aviso', 'API · ' + (cfg.oaUrl ? (cfg.oaModel || 'sem modelo') : 'configure'));
    }
  }

  // ---------- backends ----------
  function montarMensagens(c) {
    var out = [];
    if (cfg.sistema && cfg.sistema.trim()) out.push({ role: 'system', content: cfg.sistema.trim() });
    c.msgs.forEach(function (m, i) {
      if (i === c.msgs.length - 1 && m.role === 'assistant') return; // a que está sendo gerada
      if (m.role === 'assistant' && !m.content) return;
      out.push({ role: m.role, content: m.content });
    });
    return out;
  }

  function extrairErro(texto) {
    try {
      var j = JSON.parse(texto), e = j.error || j;
      if (typeof e === 'string') return e;
      return (e && (e.message || (typeof e.error === 'string' ? e.error : ''))) || texto;
    } catch (e2) { return texto; }
  }

  async function streamOpenAI(url, cabecalhos, corpo, onDelta, signal) {
    var r = await fetch(url, {
      method: 'POST', signal: signal,
      headers: Object.assign({ 'Content-Type': 'application/json' }, cabecalhos),
      body: JSON.stringify(corpo)
    });
    if (!r.ok) {
      var t = await r.text().catch(function () { return ''; });
      var dica = r.status === 401 || r.status === 403 ? '\nVerifique o token/chave em ⚙ Configurações.' : r.status === 402 ? '\nCréditos esgotados nesta conta.' : r.status === 404 ? '\nConfira o nome do modelo e o endereço.' : '';
      throw new Error('Erro ' + r.status + ': ' + String(extrairErro(t)).slice(0, 500) + dica);
    }
    var tipo = r.headers.get('content-type') || '';
    if (!r.body || tipo.indexOf('event-stream') < 0) {
      var j = await r.json();
      var msg = j.choices && j.choices[0] && j.choices[0].message;
      if (msg) onDelta(msg.content || '', msg.reasoning_content || msg.reasoning || '', j.timings);
      return;
    }
    var leitor = r.body.getReader(), dec = new TextDecoder(), buf = '';
    for (;;) {
      var lido = await leitor.read();
      if (lido.done) break;
      buf += dec.decode(lido.value, { stream: true });
      var k;
      while ((k = buf.indexOf('\n')) >= 0) {
        var linha = buf.slice(0, k).trim(); buf = buf.slice(k + 1);
        if (linha.indexOf('data:') !== 0) continue;
        var dado = linha.slice(5).trim();
        if (dado === '[DONE]') return;
        var obj; try { obj = JSON.parse(dado); } catch (e) { continue; }
        if (obj.error) throw new Error(obj.error.message || JSON.stringify(obj.error));
        var d = obj.choices && obj.choices[0] && obj.choices[0].delta;
        if (d) onDelta(d.content || '', d.reasoning_content || d.reasoning || '', obj.timings);
        else if (obj.timings) onDelta('', '', obj.timings);
      }
    }
  }

  function maxTokens() { return cfg.pensar ? Math.max(+cfg.maxTok || 0, 4096) : (+cfg.maxTok || 1024); }

  var backends = {
    local: function (msgs, onDelta, signal) {
      return streamOpenAI(baseV1(cfg.localUrl) + '/chat/completions', {}, {
        messages: msgs, stream: true, temperature: +cfg.temp, max_tokens: maxTokens(),
        chat_template_kwargs: { enable_thinking: !!cfg.pensar }
      }, onDelta, signal).catch(function (e) {
        if (e.name === 'AbortError') throw e;
        if (e instanceof TypeError) throw new Error('Não consegui falar com o servidor em ' + cfg.localUrl + '.\n' +
          '• No PC: rode o INICIAR do seu sistema e espere aparecer "servidor pronto".\n' +
          '• No celular: use o endereço mostrado na janela do PC (http://IP-DO-PC:8080) e fique na mesma rede Wi-Fi.');
        throw e;
      });
    },
    hf: function (msgs, onDelta, signal) {
      if (!cfg.hfToken) return Promise.reject(new Error('Coloque seu token do Hugging Face em ⚙ Configurações.'));
      return streamOpenAI('https://router.huggingface.co/v1/chat/completions', { Authorization: 'Bearer ' + cfg.hfToken.trim() }, {
        model: cfg.hfModel.trim(), messages: msgs, stream: true, temperature: +cfg.temp, max_tokens: maxTokens()
      }, onDelta, signal);
    },
    openai: function (msgs, onDelta, signal) {
      if (!cfg.oaUrl) return Promise.reject(new Error('Configure o endereço da API em ⚙ Configurações.'));
      var cab = cfg.oaKey ? { Authorization: 'Bearer ' + cfg.oaKey.trim() } : {};
      var corpo = { messages: msgs, stream: true, temperature: +cfg.temp, max_tokens: maxTokens() };
      if (cfg.oaModel) corpo.model = cfg.oaModel.trim();
      return streamOpenAI(baseV1(cfg.oaUrl) + '/chat/completions', cab, corpo, onDelta, signal);
    },
    navegador: async function (msgs, onDelta, signal) {
      if (!wl) throw new Error('Nenhum modelo carregado no navegador.\nAbra ⚙ Configurações → escolha o arquivo .gguf → "Carregar modelo".');
      var stream = await wl.createChatCompletion({
        messages: msgs, stream: true, temperature: +cfg.temp, max_tokens: maxTokens(),
        abortSignal: signal, chat_template_kwargs: { enable_thinking: !!cfg.pensar }
      });
      for await (var ch of stream) {
        var d = ch && ch.choices && ch.choices[0] && ch.choices[0].delta;
        if (d) onDelta(d.content || '', d.reasoning_content || '', ch.timings);
        if (signal.aborted) break;
      }
    }
  };

  // ---------- envio ----------
  var gerando = false, controle = null;
  function modoGerando(sim) {
    gerando = sim;
    $('#btnEnviar').hidden = sim; $('#btnParar').hidden = !sim;
  }

  async function gerarResposta(c) {
    var resp = { role: 'assistant', content: '', reasoning: '' };
    c.msgs.push(resp); renderMensagens();
    controle = new AbortController();
    modoGerando(true); atualizarUltima();
    var inicio = performance.now(), tokens = 0, ultimoTiming = null;
    try {
      await backends[cfg.backend](montarMensagens(c), function (txt, rac, timings) {
        if (txt) { resp.content += txt; tokens++; }
        if (rac) { resp.reasoning += rac; tokens++; }
        if (timings) ultimoTiming = timings;
        atualizarUltima();
      }, controle.signal);
      if (!resp.content && !resp.reasoning) resp.erro = 'O modelo não retornou texto.';
      else if (!resp.content) resp.erro = 'O modelo gastou todo o limite de tokens só pensando. Aumente “Máx. de tokens” ou desligue o modo raciocínio em ⚙.';
    } catch (e) {
      if (controle.signal.aborted || (e && e.name === 'AbortError')) resp.stats = '(interrompido)';
      else resp.erro = (e && e.message) ? e.message : String(e);
    } finally {
      var seg = (performance.now() - inicio) / 1000;
      if (!resp.stats && !resp.erro) {
        if (ultimoTiming && ultimoTiming.predicted_per_second) resp.stats = ultimoTiming.predicted_n + ' tokens · ' + ultimoTiming.predicted_per_second.toFixed(1) + ' tokens/s';
        else if (tokens) resp.stats = '~' + (tokens / seg).toFixed(1) + ' tokens/s · ' + seg.toFixed(1) + ' s';
      }
      if (!resp.reasoning) delete resp.reasoning;
      modoGerando(false); controle = null;
      salvarConversas(); atualizarUltima(); atualizarChip();
    }
  }

  async function enviar() {
    var ent = $('#entrada'), texto = ent.value.trim();
    if (!texto || gerando) return;
    var c = conversaAtual() || novaConversa();
    if (!c.msgs.length) { c.titulo = texto.slice(0, 50); renderLista(); }
    c.msgs.push({ role: 'user', content: texto });
    ent.value = ''; autoAltura();
    salvarConversas();
    await gerarResposta(c);
  }

  $('#formEnvio').addEventListener('submit', function (ev) { ev.preventDefault(); enviar(); });
  $('#btnParar').onclick = function () { if (controle) controle.abort(); };
  function autoAltura() { var t = $('#entrada'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, window.innerHeight * 0.4) + 'px'; }
  $('#entrada').addEventListener('input', autoAltura);
  $('#entrada').addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && !ev.shiftKey && !ehToque && !ev.isComposing) { ev.preventDefault(); enviar(); }
  });

  // ---------- modelo no navegador (wllama) ----------
  var wl = null, wlNome = '';
  function carregarScript(src) {
    return new Promise(function (ok, falha) {
      var s = document.createElement('script'); s.src = src;
      s.onload = ok; s.onerror = function () { falha(new Error('Falha ao carregar ' + src)); };
      document.head.appendChild(s);
    });
  }
  function b64ParaUrl(b64, tipo) {
    var bin = atob(b64), n = bin.length, u = new Uint8Array(n);
    for (var i = 0; i < n; i++) u[i] = bin.charCodeAt(i);
    return URL.createObjectURL(new Blob([u], { type: tipo }));
  }
  function suportaMem64() {
    try { new WebAssembly.Memory({ address: 'i64', initial: BigInt(1) }); return true; } catch (e) { return false; }
  }
  var urlWasm = null, urlWasmCompat = null;
  // Em file:// o worker não consegue baixar blob: criado pela página (origens "null" diferentes).
  // Então o código do worker recebe o .wasm embutido e um fetch() que o entrega localmente.
  window.__IAP_PREFIXO_WORKER = function () {
    var mapa = {};
    if (urlWasm) mapa[urlWasm] = window.__WLLAMA_WASM_B64;
    if (urlWasmCompat) mapa[urlWasmCompat] = window.__WLLAMA_COMPAT_WASM_B64;
    return 'self.__IAP_MAPA=' + JSON.stringify(mapa) + ';(' + function () {
      var original = self.fetch;
      self.fetch = function (u, o) {
        var k = typeof u === 'string' ? u : (u && u.url);
        var b64 = self.__IAP_MAPA[k];
        if (b64) {
          var bin = atob(b64), n = bin.length, a = new Uint8Array(n);
          for (var i = 0; i < n; i++) a[i] = bin.charCodeAt(i);
          return Promise.resolve(new Response(a, { status: 200, headers: { 'Content-Type': 'application/wasm' } }));
        }
        return original.apply(self, arguments);
      };
    }.toString() + ')();\n';
  };
  async function criarWllama(status) {
    if (typeof WebAssembly !== 'object') throw new Error('Este navegador não suporta WebAssembly.');
    if (!window.WllamaLib) {
      status('Carregando o motor do navegador (≈12 MB)…');
      await carregarScript('vendor/wllama.bundle.js');
      await carregarScript('vendor/wllama-wasm.js');
    }
    if (!urlWasm) urlWasm = b64ParaUrl(window.__WLLAMA_WASM_B64, 'application/wasm');
    var inst = new WllamaLib.Wllama({ default: urlWasm }, { logger: WllamaLib.LoggerWithoutDebug });
    var firefox = /Firefox\//.test(navigator.userAgent);
    var precisaCompat = !WebAssembly.Suspending || !suportaMem64();
    if (precisaCompat && !firefox) {
      if (!window.__WLLAMA_COMPAT_JS) {
        status('Navegador sem JSPI/Memory64: carregando modo de compatibilidade (≈22 MB)…');
        await carregarScript('vendor/wllama-compat.js');
      }
      if (!urlWasmCompat) urlWasmCompat = b64ParaUrl(window.__WLLAMA_COMPAT_WASM_B64, 'application/wasm');
      inst.setCompat({ worker: { code: window.__WLLAMA_COMPAT_JS }, wasm: urlWasmCompat });
    }
    return inst;
  }

  async function carregarModeloNavegador() {
    var st = $('#wlStatus'), prog = $('#wlProgresso'), botao = $('#btnCarregarModelo');
    var status = function (t) { st.textContent = t; };
    var arq = $('#cfgArquivo').files[0];
    var url = $('#cfgWlUrl').value.trim();
    if (!arq && !url) { status('Escolha um arquivo .gguf ou informe um link.'); return; }
    if (arq && !/\.gguf$/i.test(arq.name)) { status('O arquivo precisa terminar em .gguf'); return; }
    if (arq && arq.size > 2.1e9) { status('Arquivo grande demais para o navegador (máx. ~2 GB). Use um modelo menor, como o Qwen3.5-0.8B.'); return; }
    botao.disabled = true; prog.hidden = false; prog.removeAttribute('value');
    try {
      if (wl) { status('Descarregando modelo anterior…'); try { await wl.exit(); } catch (e) { } wl = null; wlNome = ''; }
      var inst = await criarWllama(status);
      var params = { n_ctx: Math.max(512, +cfg.wlCtx || 2048) };
      if (!cfg.wlGpu) params.n_gpu_layers = 0;
      var t0 = performance.now();
      if (arq) {
        status('Lendo ' + arq.name + ' (' + (arq.size / 1e9).toFixed(2) + ' GB)… pode levar até 1 minuto.');
        await inst.loadModel([arq], params);
        wlNome = nomeCurto(arq.name);
      } else {
        status('Baixando modelo…');
        await inst.loadModelFromUrl(url, Object.assign({}, params, {
          progressCallback: function (p) {
            if (p.total) { prog.value = Math.round(p.loaded / p.total * 100); status('Baixando: ' + (p.loaded / 1e6).toFixed(0) + ' / ' + (p.total / 1e6).toFixed(0) + ' MB'); }
          }
        }));
        wlNome = nomeCurto(url.split('?')[0]);
      }
      wl = inst;
      var thr = 1; try { thr = inst.getNumThreads(); } catch (e) { }
      var multi = false; try { multi = inst.isMultithread(); } catch (e) { }
      status('✅ Modelo carregado: ' + wlNome + ' em ' + ((performance.now() - t0) / 1000).toFixed(1) + ' s · ' +
        (multi ? thr + ' threads' : '1 thread (modo simples)') + '. Pode fechar e conversar.');
    } catch (e) {
      console.error(e);
      wl = null; wlNome = '';
      var msg = (e && e.message) ? e.message : String(e);
      if (/memory|alloc|Out of/i.test(msg)) msg += ' — pouca memória: use um modelo menor ou reduza o contexto.';
      if (cfg.wlGpu) msg += ' (Dica: tente desmarcar "Usar GPU".)';
      status('❌ Erro ao carregar: ' + msg);
    } finally {
      botao.disabled = false; prog.hidden = true; atualizarChip();
    }
  }
  $('#btnCarregarModelo').onclick = carregarModeloNavegador;

  // ---------- diálogo de configurações ----------
  var CAMPOS = {
    cfgBackend: 'backend', cfgLocalUrl: 'localUrl', cfgWlUrl: 'wlUrl', cfgWlCtx: 'wlCtx', cfgWlGpu: 'wlGpu',
    cfgHfToken: 'hfToken', cfgHfModel: 'hfModel', cfgOaUrl: 'oaUrl', cfgOaKey: 'oaKey', cfgOaModel: 'oaModel',
    cfgSistema: 'sistema', cfgTemp: 'temp', cfgMaxTok: 'maxTok', cfgPensar: 'pensar'
  };
  function preencherConfig() {
    Object.keys(CAMPOS).forEach(function (id) {
      var el = document.getElementById(id), v = cfg[CAMPOS[id]];
      if (el.type === 'checkbox') el.checked = !!v; else el.value = v == null ? '' : v;
    });
    mostrarSecoes();
  }
  function lerConfig() {
    Object.keys(CAMPOS).forEach(function (id) {
      var el = document.getElementById(id), k = CAMPOS[id];
      if (el.type === 'checkbox') cfg[k] = el.checked;
      else if (el.type === 'number') cfg[k] = el.value === '' ? PADRAO[k] : +el.value;
      else cfg[k] = el.value;
    });
    salvarCfg();
  }
  function mostrarSecoes() {
    var b = $('#cfgBackend').value;
    document.querySelectorAll('fieldset[data-backend]').forEach(function (f) { f.hidden = f.getAttribute('data-backend') !== b; });
  }
  function abrirConfig() {
    preencherConfig();
    var d = $('#dlgConfig');
    if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  }
  $('#formConfig').addEventListener('input', function () { lerConfig(); mostrarSecoes(); });
  $('#formConfig').addEventListener('change', function () { lerConfig(); mostrarSecoes(); });
  $('#dlgConfig').addEventListener('close', function () { lerConfig(); atualizarChip(); renderMensagens(); });
  $('#btnConfig').onclick = abrirConfig;
  $('#chipBackend').onclick = abrirConfig;

  $('#btnTestarLocal').onclick = function () {
    var r = $('#resTestarLocal'); r.textContent = 'testando…';
    fetchComTempo(cfg.localUrl.replace(/\/+$/, '') + '/health', {}, 5000).then(function (x) { return x.json(); }).then(function (j) {
      r.textContent = j && j.status === 'ok' ? '✅ servidor pronto!' : '⏳ servidor respondeu: ' + JSON.stringify(j);
    }).catch(function () {
      r.textContent = '❌ sem resposta. O servidor está ligado? Mesma rede Wi-Fi?' +
        (location.protocol === 'https:' && /^http:/.test(cfg.localUrl) && !/localhost|127\.0\.0\.1/.test(cfg.localUrl) ? ' (Página https não acessa http da rede local: abra o endereço do PC direto no navegador.)' : '');
    });
  };
  function listarModelos(url, cab, listaId, resId, filtro) {
    var r = document.getElementById(resId); r.textContent = 'buscando…';
    fetchComTempo(url, { headers: cab }, 15000).then(function (x) {
      if (!x.ok) throw new Error('HTTP ' + x.status); return x.json();
    }).then(function (j) {
      var ids = (j.data || j.models || []).map(function (m) { return m.id || m.name; }).filter(Boolean);
      if (filtro) ids = ids.filter(filtro);
      ids.sort();
      document.getElementById(listaId).innerHTML = ids.map(function (id) { return '<option value="' + escapar(id) + '">'; }).join('');
      r.textContent = ids.length + ' modelos — toque no campo “Modelo” para escolher.';
    }).catch(function (e) { r.textContent = '❌ ' + e.message; });
  }
  $('#btnListarHf').onclick = function () {
    listarModelos('https://router.huggingface.co/v1/models', {}, 'listaHfModelos', 'resListarHf');
  };
  $('#btnListarOa').onclick = function () {
    if (!cfg.oaUrl) { $('#resListarOa').textContent = 'Informe o endereço base primeiro.'; return; }
    listarModelos(baseV1(cfg.oaUrl) + '/models', cfg.oaKey ? { Authorization: 'Bearer ' + cfg.oaKey.trim() } : {}, 'listaOaModelos', 'resListarOa');
  };

  // ---------- barra lateral ----------
  function fecharSide() { $('#app').classList.remove('side-aberta'); }
  $('#btnMenu').onclick = function () { $('#app').classList.toggle('side-aberta'); };
  $('#sideOverlay').onclick = fecharSide;
  $('#btnNova').onclick = function () { if (!gerando) novaConversa(); };
  $('#btnNovaSide').onclick = function () { if (!gerando) novaConversa(); };
  $('#btnApagarTudo').onclick = function () {
    if (gerando || !confirm('Apagar TODAS as conversas deste navegador?')) return;
    conversas = []; atualId = null; salvarConversas(); renderLista(); renderMensagens();
  };
  $('#btnExportar').onclick = function () {
    var blob = new Blob([JSON.stringify({ app: 'ia-no-pendrive', versao: 1, conversas: conversas }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'conversas-ia-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  };
  $('#inpImportar').onchange = function (ev) {
    var f = ev.target.files[0]; if (!f) return;
    f.text().then(function (t) {
      var j = JSON.parse(t), lista = Array.isArray(j) ? j : j.conversas;
      if (!Array.isArray(lista)) throw new Error('arquivo inválido');
      var ids = {}; conversas.forEach(function (c) { ids[c.id] = 1; });
      lista.forEach(function (c) { if (c && c.id && Array.isArray(c.msgs) && !ids[c.id]) conversas.push(c); });
      salvarConversas(); renderLista(); alert('Importado!');
    }).catch(function (e) { avisar('Não consegui importar: ' + e.message); });
    ev.target.value = '';
  };

  // ---------- início ----------
  function iniciar() {
    if (atualId && !conversaAtual()) atualId = null;
    if (!atualId && conversas[0]) atualId = conversas[0].id;
    renderLista(); renderMensagens(); atualizarChip();
    // Se esta página veio do próprio servidor do pendrive (PC ou celular pela Wi-Fi),
    // aponta o "Servidor local" para cá automaticamente.
    if (servidoPorHttp) {
      fetchComTempo(location.origin + '/health', {}, 3000).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.status && cfg.localUrl !== location.origin) {
          cfg.localUrl = location.origin; salvarCfg(); atualizarChip();
        }
      }).catch(function () { });
    }
  }
  window.IAP = { cfg: cfg, versao: '1.0.0' };
  iniciar();
})();
