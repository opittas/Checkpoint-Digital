// ── Supabase config ──
const SUPA_URL = 'https://ytehtjgbxkwpfabqhojm.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWh0amdieGt3cGZhYnFob2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDkyOTYsImV4cCI6MjA5MzgyNTI5Nn0.SeToYeh4Fbbz4xUvoY2iF1ZQ5av70IJC3TCjzIEwowE';

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
    const catOk = cat === 'Tudo' || cat === 'Tudo' || card.dataset.cat === cat;
    card.style.display = (genOk && catOk) ? '' : 'none';
  });
}

// ── Header HTML compartilhado ──
function renderHeader(activePage) {
  const pages = [
    { id: 'home',  label: 'Home',          href: 'index.html',        cls: 'active-home' },
    { id: 'xbox',  label: 'Xbox',          href: 'xbox.html',         cls: 'active-xbox' },
    { id: 'ps',    label: 'PlayStation',   href: 'playstation.html',  cls: 'active-ps' },
    { id: 'nin',   label: 'Nintendo',      href: 'nintendo.html',     cls: 'active-nin' },
    { id: 'steam', label: 'Steam',         href: 'steam.html',        cls: 'active-steam' },
    { id: 'ach',   label: '🏆 Conquistas', href: 'conquistas.html',   cls: 'active-ach' },
  ];
  const nav = pages.map(p =>
    `<a class="nav-btn${p.id === activePage ? ' ' + p.cls : ''}" href="${p.href}">${p.label}</a>`
  ).join('');
  document.getElementById('site-header').innerHTML = `
    <div class="header-inner">
      <a class="logo" href="index.html">Checkpoint<span> Digital</span></a>
      <nav class="main-nav">${nav}</nav>
    </div>`;
}

// ── Footer HTML compartilhado ──
function renderFooter() {
  document.getElementById('site-footer').innerHTML = `
    <div class="footer-inner">
      <div class="footer-logo">Checkpoint<span> Digital</span></div>
      <div class="footer-tagline">Notícias, lançamentos e análises de todas as plataformas e gerações</div>
      <div class="footer-grid">
        <div>
          <div class="footer-col-title xbox">Xbox</div>
          <ul class="footer-links">
            <li><a href="xbox.html">Xbox 360</a></li>
            <li><a href="xbox.html">Xbox One</a></li>
            <li><a href="xbox.html">Xbox Series S/X</a></li>
            <li><a href="xbox.html">Project Helix</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-col-title nin">Nintendo</div>
          <ul class="footer-links">
            <li><a href="nintendo.html">NES / SNES</a></li>
            <li><a href="nintendo.html">GameCube</a></li>
            <li><a href="nintendo.html">Wii / Wii U</a></li>
            <li><a href="nintendo.html">DS / 3DS</a></li>
            <li><a href="nintendo.html">Switch</a></li>
            <li><a href="nintendo.html">Switch 2</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-col-title ps">PlayStation</div>
          <ul class="footer-links">
            <li><a href="playstation.html">PS1 / PS2 / PS3</a></li>
            <li><a href="playstation.html">PS4</a></li>
            <li><a href="playstation.html">PS5</a></li>
            <li><a href="playstation.html">PSP / PS Vita</a></li>
            <li><a href="playstation.html">PlayStation Portal</a></li>
          </ul>
        </div>
        <div>
          <div class="footer-col-title steam">Steam / PC</div>
          <ul class="footer-links">
            <li><a href="steam.html">Steam Deck</a></li>
            <li><a href="steam.html">Windows</a></li>
            <li><a href="steam.html">macOS</a></li>
            <li><a href="steam.html">Linux</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <span>© 2026 Checkpoint Digital — Blog de Games. Todos os direitos reservados.</span>
        <span>Feito com paixão por games</span>
      </div>
    </div>`;
}
