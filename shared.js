// ── Supabase config ──
const SUPA_URL = 'https://ytehtjgbxkwpfabqhojm.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWh0amdieGt3cGZhYnFob2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDkyOTYsImV4cCI6MjA5MzgyNTI5Nn0.SeToYeh4Fbbz4xUvoY2iF1ZQ5av70IJC3TCjzIEwowE';

// ── Raiz do site (funciona na raiz e em subpastas, ex.: /conquistas/) ──
const SITE_ROOT = (function () {
  const s = document.currentScript && document.currentScript.src;
  return s ? s.replace(/shared\.js(\?.*)?$/, '') : '';
})();

// ── Dados locais (pasta /data) com Supabase como reserva ──
// O site lê primeiro os arquivos JSON publicados junto com ele (GitHub Pages),
// então continua funcionando mesmo se o Supabase estiver pausado.
// Uso: dbFetch('articles?platform=eq.xbox&order=published_at.desc&limit=3')
const _dbCache = {};
function _loadTable(table) {
  if (!_dbCache[table]) {
    const local = fetch(SITE_ROOT + 'data/' + table + '.json', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('local ' + r.status); return r.json(); });
    // Notícias: soma as publicadas no banco depois da última geração do site
    // (aparecem na hora; a rotina do GitHub cria a página fixa depois).
    _dbCache[table] = table !== 'articles' ? local : local.then(async rows => {
      try {
        const ultima = rows.reduce((m, r) => (r.published_at > m ? r.published_at : m), '1970-01-01');
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 2500);
        const r = await fetch(`${SUPA_URL}/rest/v1/articles?select=*&published_at=gt.${encodeURIComponent(ultima)}&order=published_at.desc&limit=30`,
          { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }, signal: ctl.signal });
        clearTimeout(timer);
        if (!r.ok) return rows;
        const ids = new Set(rows.map(x => x.id));
        const novas = (await r.json()).filter(x => !ids.has(x.id)).map(x => Object.assign(x, { _remoto: true }));
        return novas.concat(rows);
      } catch (e) { return rows; }
    });
  }
  return _dbCache[table];
}
function _applyQuery(rows, qs) {
  const params = new URLSearchParams(qs);
  let out = rows.slice();
  let order = null, limit = null;
  for (const [k, v] of params) {
    if (k === 'select') continue;
    if (k === 'order') { order = v; continue; }
    if (k === 'limit') { limit = parseInt(v, 10); continue; }
    const dot = v.indexOf('.');
    const op = v.slice(0, dot), val = v.slice(dot + 1);
    if (op === 'eq')  out = out.filter(r => String(r[k]) === val);
    if (op === 'neq') out = out.filter(r => String(r[k]) !== val);
  }
  if (order) {
    const [col, dir] = order.split('.');
    out.sort((a, b) => (a[col] > b[col] ? 1 : a[col] < b[col] ? -1 : 0) * (dir === 'desc' ? -1 : 1));
  }
  if (limit) out = out.slice(0, limit);
  return out;
}
async function dbFetch(path) {
  const [table, qs = ''] = path.split('?');
  try {
    const rows = _applyQuery(await _loadTable(table), qs);
    return { ok: true, status: 200, json: async () => rows };
  } catch (e) {
    // Reserva: Supabase
    return fetch(`${SUPA_URL}/rest/v1/${path}`, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  }
}

// ── Armazenamento seguro ──
// No Safari (modo restrito / cookies bloqueados) o localStorage pode lançar erro.
const store = {
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} },
  del(k) { try { window.localStorage.removeItem(k); } catch (e) {} },
};

// ── Idioma ──
// Retorna 'pt' ou 'en'. Salvo no navegador para persistir entre páginas.
function getLang() {
  return store.get('ck_lang') === 'en' ? 'en' : 'pt';
}
function setLang(lang) {
  store.set('ck_lang', lang);
  location.reload();
}
// Aplica texto localizado a um artigo: se idioma=en e campo _en existir, usa _en; senão usa PT.
function t(article, field) {
  if (getLang() === 'en') {
    const enVal = article[field + '_en'];
    if (enVal) return enVal;
  }
  return article[field] || '';
}
const L = (pt, en) => (getLang() === 'en' ? en : pt);

// ── Tema Dark / Light ──
function getTheme() {
  return store.get('ck_theme') === 'light' ? 'light' : 'dark';
}
function setTheme(theme) {
  store.set('ck_theme', theme);
  applyTheme();
}
function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark');
}
function applyTheme() {
  const theme = getTheme();
  document.body.classList.toggle('light', theme === 'light');
  const track = document.querySelector('.theme-switch-track');
  if (track) track.classList.toggle('dark-on', theme === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'light' ? '#ffffff' : '#0f1117');
}
document.addEventListener('DOMContentLoaded', applyTheme);
(function () { if (getTheme() === 'light' && document.body) document.body.classList.add('light'); })();

// ── Configuração do site (data/site.json): plataformas, gerações, categorias, rodapé ──
let _sitePromise = null;
function loadSite() {
  if (!_sitePromise) {
    _sitePromise = fetch(SITE_ROOT + 'data/site.json', { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('site.json ' + r.status); return r.json(); })
      .then(s => {
        s.porId = {};
        s.plataformas.forEach(p => { s.porId[p.id] = p; });
        s.cat = {};
        s.categorias.forEach(c => { s.cat[c.id] = c; s.cat[c.en] = c; });
        return s;
      });
  }
  return _sitePromise;
}

// ── Utilidades de notícias (usadas na home, nas plataformas e no artigo) ──
function escHTML(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function fmtDate(iso, opts) {
  return new Date(iso).toLocaleDateString(getLang() === 'en' ? 'en-US' : 'pt-BR',
    opts || { day: '2-digit', month: 'short', year: 'numeric' });
}
function catLabel(site, cat) {
  const c = site && site.cat[cat];
  return c ? (getLang() === 'en' ? c.en : c.id) : (cat || '');
}
function catBadge(site, cat) {
  const c = site && site.cat[cat];
  return c ? c.badge : 'badge-new';
}
function genLabel(site, plat, gen) {
  const p = site && site.porId[plat];
  const g = p && p.geracoes.find(x => x.id === gen);
  return g ? g.nome : (p ? p.nome : '');
}
// Endereço da notícia: página fixa (melhor para Google/redes) ou dinâmica se ainda não foi gerada
function newsURL(a) {
  return a._remoto ? `artigo.html?id=${encodeURIComponent(a.id)}` : `noticias/${encodeURIComponent(a.id)}.html`;
}
// Card de notícia padrão. opts.tag = 'plataforma' (padrão) ou 'geracao'
function newsCardHTML(a, site, opts) {
  opts = opts || {};
  const base = opts.base || '';
  const p = (site && site.porId[a.platform]) || { emoji: '📰', nome: '' };
  const title = t(a, 'title'), excerpt = t(a, 'excerpt');
  const fallback = `<div class="card-img-fallback ${escHTML(a.platform)}">${p.emoji}</div>`;
  const img = a.image_url
    ? `<img src="${escHTML(/^https?:/.test(a.image_url) ? a.image_url : base + a.image_url)}" alt="" loading="lazy" onerror="this.outerHTML=this.dataset.fb" data-fb="${escHTML(fallback)}">`
    : fallback;
  const tag = opts.tag === 'geracao' ? genLabel(site, a.platform, a.gen) || p.nome : `${p.emoji} ${p.nome}`;
  return `
    <a href="${base}${newsURL(a)}" class="news-card" data-plat="${escHTML(a.platform)}" data-gen="${escHTML(a.gen || '')}" data-cat="${escHTML(a.category || '')}">
      <div class="card-img-wrap">
        ${img}
        <div class="card-hover-overlay"><div class="card-hover-excerpt">${escHTML(excerpt)}</div></div>
      </div>
      <div class="card-body">
        <div class="card-tags">
          <span class="tag tag-${escHTML(a.platform)}">${escHTML(tag)}</span>
          <span class="badge ${catBadge(site, a.category)}">${escHTML(catLabel(site, a.category))}</span>
        </div>
        <div class="card-title">${escHTML(title)}</div>
        <div class="card-meta"><span>${fmtDate(a.published_at)}</span><span class="sep"></span><span>${escHTML(a.read_time || '3 min')}</span></div>
      </div>
    </a>`;
}

// ── Header HTML compartilhado ──
// base: prefixo para os hrefs (ex: '../' quando em subpastas). Padrão: ''
function renderHeader(activePage, base) {
  base = base || '';
  const lang = getLang();
  const isEN = lang === 'en';

  const pages = [
    { id: 'home',  labelPT: 'Home',          labelEN: 'Home',           href: base + 'index.html',        cls: 'active-home' },
    { id: 'xbox',  labelPT: 'Xbox',          labelEN: 'Xbox',           href: base + 'xbox.html',         cls: 'active-xbox' },
    { id: 'ps',    labelPT: 'PlayStation',   labelEN: 'PlayStation',    href: base + 'playstation.html',  cls: 'active-ps' },
    { id: 'nin',   labelPT: 'Nintendo',      labelEN: 'Nintendo',       href: base + 'nintendo.html',     cls: 'active-nin' },
    { id: 'steam', labelPT: 'Steam',         labelEN: 'Steam',          href: base + 'steam.html',        cls: 'active-steam' },
    { id: 'ach',   labelPT: '🏆 Conquistas', labelEN: '🏆 Achievements', href: base + 'conquistas.html',   cls: 'active-ach' },
    { id: 'mj',    labelPT: '⭐ Meus Jogos',  labelEN: '⭐ My Games',      href: base + 'meus-jogos.html',  cls: 'active-ach' },
  ];

  const nav = pages.map(p =>
    `<a class="nav-btn${p.id === activePage ? ' ' + p.cls : ''}" href="${p.href}">${isEN ? p.labelEN : p.labelPT}</a>`
  ).join('');

  const isDark = getTheme() === 'dark';

  // Seletor de idioma
  const langToggle = `
    <div class="lang-toggle">
      <button onclick="setLang('pt')" class="lang-btn${!isEN ? ' lang-active' : ''}">PT</button>
      <span class="lang-sep">|</span>
      <button onclick="setLang('en')" class="lang-btn${isEN ? ' lang-active' : ''}">EN</button>
    </div>`;

  // Switch dark/light
  const themeSwitch = `
    <div class="theme-switch" onclick="toggleTheme()" title="${isDark ? 'Mudar para Light Mode' : 'Mudar para Dark Mode'}">
      <span class="theme-switch-icon">☀️</span>
      <div class="theme-switch-track${isDark ? ' dark-on' : ''}">
        <div class="theme-switch-thumb"></div>
      </div>
      <span class="theme-switch-icon">🌙</span>
    </div>`;

  // Botão de conta (lê o usuário salvo pelo auth.js)
  let ckUser = null;
  try { ckUser = JSON.parse(store.get('ck_user')); } catch (e) {}
  const nomeUser = ckUser && ckUser.usuario ? String(ckUser.usuario).replace(/[^A-Za-z0-9_.]/g, '') : '';
  const accountBtn = nomeUser
    ? `<a class="account-btn logged${activePage === 'conta' ? ' active' : ''}" href="${base}conta.html" title="${isEN ? 'My account' : 'Minha conta'}"><span class="account-avatar">${nomeUser[0].toUpperCase()}</span><span class="account-name">${nomeUser}</span></a>`
    : `<a class="account-btn${activePage === 'conta' ? ' active' : ''}" href="${base}conta.html">👤 <span class="account-name">${isEN ? 'Sign in' : 'Entrar'}</span></a>`;

  document.getElementById('site-header').innerHTML = `
    <div class="header-inner">
      <a class="logo" href="${base}index.html">Checkpoint<span> Digital</span></a>
      <nav class="main-nav">${nav}</nav>
      <div class="header-controls">
        ${accountBtn}
        ${langToggle}
        ${themeSwitch}
      </div>
    </div>`;

  // Re-aplica tema para sincronizar o switch visual após render
  applyTheme();

  // Altura do cabeçalho fixo: usada pelas barras de filtro "grudadas" logo abaixo dele
  const medir = () => {
    const h = document.getElementById('site-header');
    if (h) document.documentElement.style.setProperty('--header-h', h.offsetHeight + 'px');
  };
  medir();
  const ativo = document.querySelector('.main-nav .nav-btn[class*="active-"]');
  if (ativo && ativo.scrollIntoView && window.innerWidth <= 860) {
    const nav = ativo.parentElement;
    nav.scrollLeft = ativo.offsetLeft - 16;
  }
  if (!window._ckHeaderResize) { window._ckHeaderResize = true; window.addEventListener('resize', medir); }
}

// ── Footer HTML compartilhado (montado a partir de data/site.json) ──
// base: prefixo para os hrefs (ex: '../' quando em subpastas). Padrão: ''
function renderFooter(base) {
  base = base || '';
  const el = document.getElementById('site-footer');
  if (!el) return;
  loadSite().then(site => {
    const lang = getLang();
    const cols = site.plataformas.map(p => `
        <div>
          <div class="footer-col-title ${p.id}">${escHTML(p.nome)}</div>
          <ul class="footer-links">
            ${p.geracoes.map(g => `<li><a href="${base}${p.pagina}?gen=${encodeURIComponent(g.id)}">${escHTML(g.nome)}</a></li>`).join('')}
          </ul>
        </div>`).join('');
    el.innerHTML = `
    <div class="footer-inner">
      <div class="footer-logo">Checkpoint<span> Digital</span></div>
      <div class="footer-tagline">${escHTML(site.rodape.slogan[lang])}</div>
      <div class="footer-grid">${cols}</div>
      <div class="footer-bottom">
        <span>${escHTML(site.rodape.direitos[lang])} · <a href="${base}privacidade.html">${lang === 'en' ? 'Privacy' : 'Privacidade'}</a> · <a href="${base}termos.html">${lang === 'en' ? 'Terms' : 'Termos'}</a></span>
        <span>${escHTML(site.rodape.assinatura[lang])}</span>
      </div>
    </div>`;
  }).catch(() => {
    el.innerHTML = `<div class="footer-inner"><div class="footer-logo">Checkpoint<span> Digital</span></div></div>`;
  });
}
