// ══════════════════════════════════════════════════════════
// PÁGINA DE PLATAFORMA (xbox.html, playstation.html, nintendo.html, steam.html)
// Tudo vem de data/site.json (gerações e categorias) e data/articles.json.
// Cada página só precisa de <body data-plat="xbox"> e deste script.
// Filtros na URL: ?gen=ps5&cat=Reviews
// ══════════════════════════════════════════════════════════
(function () {
  const PLAT = document.body.dataset.plat;
  const qs = new URLSearchParams(location.search);
  const F = { gen: qs.get('gen') || 'all', cat: qs.get('cat') || 'all' };
  let site, artigos = [];

  renderHeader(PLAT);
  renderFooter();

  function urlComFiltros() {
    const u = new URL(location.href);
    F.gen === 'all' ? u.searchParams.delete('gen') : u.searchParams.set('gen', F.gen);
    F.cat === 'all' ? u.searchParams.delete('cat') : u.searchParams.set('cat', F.cat);
    history.replaceState(null, '', u);
  }

  function renderFiltros() {
    const p = site.porId[PLAT];
    document.getElementById('plat-name').textContent = p.nome;
    document.title = `${p.nome} — Checkpoint Digital`;
    const gens = [{ id: 'all', nome: p.todas[getLang()] }].concat(p.geracoes);
    document.getElementById('gens').innerHTML = gens.map(g => {
      const n = g.id === 'all' ? artigos.length : artigos.filter(a => a.gen === g.id).length;
      return `<button class="gen-btn${F.gen === g.id ? ' active-' + PLAT : ''}" data-gen="${escHTML(g.id)}">${escHTML(g.nome)}${n ? ` <span class="gen-n">${n}</span>` : ''}</button>`;
    }).join('');
    const cats = [{ id: 'all' }].concat(site.categorias.filter(c => artigos.some(a => a.category === c.id)));
    document.getElementById('cats').innerHTML = cats.map(c =>
      `<button class="cat-btn${F.cat === c.id ? ' active' : ''}" data-cat="${escHTML(c.id)}">${c.id === 'all' ? L('Tudo', 'All') : escHTML(catLabel(site, c.id))}</button>`
    ).join('');
  }

  function renderCards() {
    const lista = artigos.filter(a => (F.gen === 'all' || a.gen === F.gen) && (F.cat === 'all' || a.category === F.cat));
    document.getElementById('cards').innerHTML = lista.length
      ? lista.map(a => newsCardHTML(a, site, { tag: 'geracao' })).join('')
      : `<div class="cards-loading">${L('Nenhuma notícia encontrada com esses filtros.', 'No news found for these filters.')}</div>`;
  }

  document.addEventListener('click', e => {
    const g = e.target.closest('[data-gen]');
    if (g && g.classList.contains('gen-btn')) { F.gen = g.dataset.gen; urlComFiltros(); renderFiltros(); renderCards(); return; }
    const c = e.target.closest('.cat-btn');
    if (c) { F.cat = c.dataset.cat; urlComFiltros(); renderFiltros(); renderCards(); }
  });

  Promise.all([
    loadSite(),
    dbFetch(`articles?platform=eq.${PLAT}&order=published_at.desc`).then(r => r.json()),
  ]).then(([s, arts]) => {
    site = s;
    artigos = Array.isArray(arts) ? arts : [];
    renderFiltros();
    renderCards();
  }).catch(() => {
    document.getElementById('cards').innerHTML =
      `<div class="cards-loading" style="color:#dc2626">⚠️ ${L('Erro ao carregar notícias.', 'Could not load news.')}</div>`;
  });
})();
