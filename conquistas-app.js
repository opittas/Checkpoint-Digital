// ══════════════════════════════════════════════════════════
// ÁREA DE CONQUISTAS — funções compartilhadas
// Requer shared.js carregado antes (SITE_ROOT, getLang).
// ══════════════════════════════════════════════════════════
const CK = (function () {
  const isEN = () => getLang() === 'en';
  const tr = (pt, en) => (isEN() ? en : pt);

  // ── Progresso (salvo no navegador) ──
  const KEY = gid => 'ck_prog_' + gid;
  function getProg(gid) {
    try { return JSON.parse(localStorage.getItem(KEY(gid))) || {}; } catch (e) { return {}; }
  }
  // remoto = true quando o dado veio da conta (não reenviar)
  function setProg(gid, obj, remoto) {
    const ts = remoto && remoto.ts ? remoto.ts : new Date().toISOString();
    try {
      localStorage.setItem(KEY(gid), JSON.stringify(obj));
      localStorage.setItem('ck_ts_' + gid, ts);
    } catch (e) {}
    if (!remoto && window.CK_AUTH) CK_AUTH.salvar(gid, obj, ts);
  }
  function isDone(a, prog) {
    return !!prog[a.k];
  }
  function exportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ck_prog_')) out[k.slice(8)] = getProg(k.slice(8));
    }
    return out;
  }
  function importAll(obj) {
    let n = 0;
    Object.entries(obj || {}).forEach(([gid, prog]) => {
      if (prog && typeof prog === 'object') { setProg(gid, prog); n++; }
    });
    return n;
  }


  // ── Meus Jogos (biblioteca) ──
  // ck_lib = { game_id: { plataformas: [], status, favorito, origem, ts } }
  const STATUS = {
    jogando:   ['Jogando', 'Playing', '🎮'],
    zerado:    ['Zerado', 'Beaten', '✅'],
    platinado: ['Platinado / 100%', 'Platinum / 100%', '🏆'],
    pausado:   ['Pausado', 'Paused', '⏸️'],
    quero:     ['Quero jogar', 'Want to play', '⭐'],
  };
  function getLib() {
    try { return JSON.parse(localStorage.getItem('ck_lib')) || {}; } catch (e) { return {}; }
  }
  function saveLib(lib) {
    try { localStorage.setItem('ck_lib', JSON.stringify(lib)); } catch (e) {}
  }
  // item = null remove o jogo. remoto = true quando veio da conta.
  function setLibItem(gid, item, remoto) {
    const lib = getLib();
    if (item) lib[gid] = Object.assign({}, item, { ts: remoto && item.ts ? item.ts : new Date().toISOString() });
    else delete lib[gid];
    saveLib(lib);
    if (!remoto && window.CK_AUTH) CK_AUTH.salvarLib(gid, lib[gid] || null);
    return lib[gid] || null;
  }
  function inLib(gid) { return !!getLib()[gid]; }
  const statusLabel = s => (STATUS[s] ? `${STATUS[s][2]} ${tr(STATUS[s][0], STATUS[s][1])}` : s);


  // ── Progresso separado: jogo base × cada DLC ──
  // Usa data/conquistas/index.json ({ total, base, dlcs: { nome: [chaves] } })
  function gameProgress(gid, index) {
    const inf = (index && index[gid]) || {};
    const prog = getProg(gid);
    const feitas = new Set(Object.keys(prog).filter(k => k[0] !== '#' && prog[k]));
    const dlcSets = Object.entries(inf.dlcs || {});
    const noDlc = new Set(dlcSets.flatMap(([, ks]) => ks));
    const tenho = ((getLib()[gid] || {}).dlcs) || [];
    const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
    const baseTotal = inf.base != null ? inf.base : (inf.total || 0);
    const baseFeitas = Math.min(baseTotal, [...feitas].filter(k => !noDlc.has(k)).length);
    const dlcs = dlcSets.map(([nome, ks]) => {
      const f = ks.filter(k => feitas.has(k)).length;
      return { nome, total: ks.length, feitas: f, pct: pct(f, ks.length), tenho: tenho.includes(nome) };
    });
    return { base: { total: baseTotal, feitas: baseFeitas, pct: pct(baseFeitas, baseTotal) }, dlcs };
  }

  // ── Carregamento de dados ──
  const cache = {};
  function loadJSON(path) {
    if (!cache[path]) {
      cache[path] = fetch(SITE_ROOT + path, { cache: 'no-cache' }).then(r => {
        if (!r.ok) throw new Error(path + ' ' + r.status);
        return r.json();
      });
    }
    return cache[path];
  }
  const loadGames = () => loadJSON('data/jogos.json');
  const loadIndex = () => loadJSON('data/conquistas/index.json').catch(() => ({}));
  const loadAch   = gid => loadJSON(`data/conquistas/${gid}.json`);
  const loadGuide = gid => loadJSON(`data/guias/${gid}.json`).catch(() => null);
  const loadLojas = () => loadJSON('data/lojas.json').catch(() => null);

  // Onde comprar: link próprio do jogo (data/lojas.json → jogos) ou busca na loja
  function lojasDoJogo(lojas, game) {
    if (!lojas || !game) return [];
    const proprios = (lojas.jogos || {})[game.id] || {};
    return (lojas.lojas || []).filter(l => proprios[l.id] || (l.busca && (l.plataformas || []).some(p => game.platforms.includes(p))))
      .map(l => {
        let url = proprios[l.id];
        if (!url) {
          url = l.busca.replace('{q}', encodeURIComponent(game.title));
          if (l.parametros) url += (url.includes('?') ? '&' : '?') + l.parametros;
        }
        return { id: l.id, nome: l.nome, icone: l.icone, tipo: tr(l.tipo.pt, l.tipo.en), url, direto: !!proprios[l.id] };
      });
  }

  // Junta lista da Steam + guia manual
  function mergeGuide(achData, guide) {
    const extras = (guide && guide.conquistas) || {};
    const grupos = achData.grupos || [];
    return (achData.conquistas || []).map((a, idx) => {
      const x = extras[a.k] || {};
      const g = grupos[a.g] || {};
      return Object.assign({}, a, {
        ordem: idx,
        missavel: !!x.missavel,
        dlc: x.dlc || (g.dlc ? g.nome : ''),
        online: !!x.online,
        dica: x.dica || '',
        guia: x.guia || null,
        dificil: !!x.dificil,
      });
    });
  }

  // ── Visual ──
  function rarity(p) {
    if (p === null || p === undefined) return null;
    if (p < 5)  return { cls: 'ultra',   label: tr('Ultra rara', 'Ultra rare') };
    if (p < 15) return { cls: 'rara',    label: tr('Rara', 'Rare') };
    if (p < 40) return { cls: 'incomum', label: tr('Incomum', 'Uncommon') };
    return { cls: 'comum', label: tr('Comum', 'Common') };
  }
  function diffColor(s) {
    return s >= 8 ? '#ef4444' : s >= 6 ? '#f97316' : s >= 4 ? '#f59e0b' : '#22c55e';
  }
  function diffMeter(s) {
    if (!s) return '';
    let h = `<span class="ck-diff" style="--d:${diffColor(s)}" title="${tr('Dificuldade', 'Difficulty')} ${s}/10">`;
    for (let i = 1; i <= 10; i++) h += `<i class="${i <= s ? 'on' : ''}"></i>`;
    return h + '</span>';
  }
  const PLAT = { xbox: 'Xbox', ps: 'PlayStation', nin: 'Nintendo', steam: 'Steam' };
  function platBadges(j) {
    return (j.platforms || []).map(pl => {
      let lbl = (j.labels || {})[pl] || '';
      if (isEN()) lbl = lbl.replace('Platina', 'Platinum').replace('Conquistas', 'Achievements')
                         .replace('Sem conquistas', 'No achievements').replace('Checklist 100%', '100% checklist');
      return `<span class="ck-plat ${pl}">${PLAT[pl]}${lbl ? ' · ' + lbl : ''}</span>`;
    }).join('');
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  }
  function toast(msg) {
    let t = document.querySelector('.ck-toast');
    if (!t) { t = document.createElement('div'); t.className = 'ck-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove('show'), 1800);
  }
  function imgSrc(path) {
    return /^https?:/.test(path || '') ? path : SITE_ROOT + (path || '');
  }

  return { isEN, tr, getProg, setProg, isDone, exportAll, importAll,
           loadGames, loadIndex, loadAch, loadGuide, loadLojas, lojasDoJogo, mergeGuide,
           rarity, diffMeter, platBadges, esc, norm, toast, imgSrc,
           STATUS, getLib, saveLib, setLibItem, inLib, statusLabel, gameProgress };
})();
window.CK = CK;
