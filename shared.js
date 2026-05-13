// ── Supabase config ──
const SUPA_URL = 'https://ytehtjgbxkwpfabqhojm.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWh0amdieGt3cGZhYnFob2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDkyOTYsImV4cCI6MjA5MzgyNTI5Nn0.SeToYeh4Fbbz4xUvoY2iF1ZQ5av70IJC3TCjzIEwowE';

// ── Idioma ──
// Retorna 'pt' ou 'en'. Salvo em localStorage para persistir entre páginas.
function getLang() {
  return localStorage.getItem('ck_lang') || 'pt';
}
function setLang(lang) {
  localStorage.setItem('ck_lang', lang);
  location.reload();
}
// Aplica texto localizado a um artigo: se idioma=en e campo _en existir, usa _en; senão usa PT.
function t(article, field) {
  const lang = getLang();
  if (lang === 'en') {
    const enVal = article[field + '_en'];
    if (enVal) return enVal;
  }
  return article[field] || '';
}

// ── Tema Dark / Light ──
function getTheme() {
  return localStorage.getItem('ck_theme') || 'dark';
}
function setTheme(theme) {
  localStorage.setItem('ck_theme', theme);
  applyTheme();
}
function toggleTheme() {
  const current = getTheme();
  setTheme(current === 'dark' ? 'light' : 'dark');
}
function applyTheme() {
  const theme = getTheme();
  document.body.classList.toggle('light', theme === 'light');
  const track = document.querySelector('.theme-switch-track');
  if (track) {
    track.classList.toggle('dark-on', theme === 'dark');
  }
}
// Aplica o tema imediatamente ao carregar qualquer página (antes do render do header)
document.addEventListener('DOMContentLoaded', applyTheme);
// Também aplica inline (antes do DOMContentLoaded) para evitar flash
(function() {
  const theme = localStorage.getItem('ck_theme') || 'dark';
  if (theme === 'light') document.body.classList.add('light');
})();

// ── Geração de filtro ──
function filterGen(btn, plat) {
  const gen = btn.dataset.gen;
  const activeClass = 'active-' + plat;
  document.querySelectorAll('#' + plat + '-gens .gen-btn').forEach(b => b.classList.remove(activeClass));
  btn.classList.add(activeClass);
  const cards = document.querySelectorAll('#' + plat + '-cards .news-card');
  cards.forEach(card => {
    card.style.display = (gen === 'all' || card.dataset.gen === gen) ? '' : 'none';
  });
  // Reaplica filtro de categoria se houver
  const activeCat = document.querySelector('.cat-btn.active');
  if (activeCat) filterCat(activeCat);
}

function filterGenById(gen, plat) {
  const btn = document.querySelector('#' + plat + '-gens [data-gen="' + gen + '"]');
  if (btn) filterGen(btn, plat);
}

// ── Filtro de categoria ──
function filterCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const cat = btn.textContent.trim();
  const cardsContainer = document.querySelector('.cards-grid');
  if (!cardsContainer) return;
  const plat = document.querySelector('[id$="-gens"]')?.id?.replace('-gens','');
  const activeGenBtn = plat ? document.querySelector('#' + plat + '-gens .gen-btn.active-' + plat) : null;
  const activeGen = activeGenBtn ? activeGenBtn.dataset.gen : 'all';
  cardsContainer.querySelectorAll('.news-card').forEach(card => {
    const genOk = activeGen === 'all' || card.dataset.gen === activeGen;
    const catOk = cat === 'Tudo' || cat === 'All' || card.dataset.cat === cat;
    card.style.display = (genOk && catOk) ? '' : 'none';
  });
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

  document.getElementById('site-header').innerHTML = `
    <div class="header-inner">
      <a class="logo" href="${base}index.html">Checkpoint<span> Digital</span></a>
      <nav class="main-nav">${nav}</nav>
      <div class="header-controls">
        ${langToggle}
        ${themeSwitch}
      </div>
    </div>`;

  // Re-aplica tema para sincronizar o switch visual após render
  applyTheme();
}

// ── Footer HTML compartilhado ──
// base: prefixo para os hrefs (ex: '../' quando em subpastas). Padrão: ''
function renderFooter(base) {
  base = base || '';
  document.getElementById('site-footer').innerHTML = `
    <div class="footer-inner">
      <div class="footer-logo">Checkpoint<span> Digital</span></div>
      <div class="footer-tagline">Notícias, lançamentos e análises de todas as plataformas e gerações</div>
      <div class="footer-grid">
        <div>
          <div class="footer-col-title xbox">Xbox</div>
          <ul class="footer-links">
            <li><a href="${base}xbox.html">Xbox 360</a></li>
            <li><a href="${base}xbox.html">Xbox One</a></li>
            <li><a href="${base}xbox.html">Xbox Series S/X</a></li>
            <li><a href="${base}xbox.html">Project Helix</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-col-title nin">Nintendo</div>
          <ul class="footer-links">
            <li><a href="${base}nintendo.html">NES / SNES</a></li>
            <li><a href="${base}nintendo.html">GameCube</a></li>
            <li><a href="${base}nintendo.html">Wii / Wii U</a></li>
            <li><a href="${base}nintendo.html">DS / 3DS</a></li>
            <li><a href="${base}nintendo.html">Switch</a></li>
            <li><a href="${base}nintendo.html">Switch 2</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-col-title ps">PlayStation</div>
          <ul class="footer-links">
            <li><a href="${base}playstation.html">PS1 / PS2 / PS3</a></li>
            <li><a href="${base}playstation.html">PS4</a></li>
            <li><a href="${base}playstation.html">PS5</a></li>
            <li><a href="${base}playstation.html">PSP / PS Vita</a></li>
            <li><a href="${base}playstation.html">PlayStation Portal</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-col-title steam">Steam / PC</div>
          <ul class="footer-links">
            <li><a href="${base}steam.html">Steam Deck</a></li>
            <li><a href="${base}steam.html">Windows</a></li>
            <li><a href="${base}steam.html">macOS</a></li>
            <li><a href="${base}steam.html">Linux</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Checkpoint Digital — Blog de Games. Todos os direitos reservados.</span>
        <span>Feito com paixão por games</span>
      </div>
    </div>`;
}
