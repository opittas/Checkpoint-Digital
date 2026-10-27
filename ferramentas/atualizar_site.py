#!/usr/bin/env python3
"""
Checkpoint Digital — atualiza os dados do site e publica no GitHub Pages.

Uso (no Terminal, dentro da pasta Blog):
    python3 ferramentas/atualizar_site.py              # faz tudo
    python3 ferramentas/atualizar_site.py --sem-publicar
    python3 ferramentas/atualizar_site.py --so-publicar

O que ele faz:
  1. Exporta artigos do Supabase para data/articles.json e baixa as capas para imagens/capas/
     (assim o site funciona mesmo com o Supabase pausado).
  2. Baixa da Steam a lista oficial de conquistas (PT-BR + inglês), ícones e % de jogadores
     de cada jogo em data/jogos.json  →  data/conquistas/<id>.json
  3. Publica a pasta no repositório do GitHub e liga o GitHub Pages.

Para adicionar um jogo novo: inclua-o em data/jogos.json (com "steam_appid") e rode o script.
"""

import base64
import getpass
import hashlib
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

# ── Configuração ────────────────────────────────────────────────────────────
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GH_OWNER = "opittas"
GH_REPO = "Checkpoint-Digital"
GH_BRANCH = "main"

SUPA_URL = "https://ytehtjgbxkwpfabqhojm.supabase.co"
SUPA_ANON = ("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0ZWh0amdieGt3cGZh"
             "YnFob2ptIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNDkyOTYsImV4cCI6MjA5MzgyNTI5Nn0."
             "SeToYeh4Fbbz4xUvoY2iF1ZQ5av70IJC3TCjzIEwowE")

# Ids antigos no Supabase → ids novos em data/jogos.json
SUPA_GAME_ALIAS = {"demons": "demons2"}

PUBLISH_EXT = {".html", ".css", ".js", ".json", ".jpg", ".jpeg", ".png", ".webp", ".svg", ".ico", ".txt", ".md", ".yml", ".xml"}
EXCLUDE_DIRS = {"ferramentas", "Supabase", "__pycache__", "node_modules"}
EXCLUDE_FILES = {"upload_icons.html", ".DS_Store"}

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/130.0 Safari/537.36")

try:
    import certifi
    SSL_CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    SSL_CTX = ssl.create_default_context()


# ── Utilidades ──────────────────────────────────────────────────────────────
def p(path):
    return os.path.join(ROOT, path)


def http(url, method="GET", data=None, headers=None, timeout=40):
    """Retorna (status, bytes). Não lança exceção para erros HTTP."""
    h = {"User-Agent": UA}
    h.update(headers or {})
    body = None
    if data is not None:
        body = data if isinstance(data, bytes) else json.dumps(data).encode()
        h.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as r:
            return r.status, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.read()
    except Exception as e:  # rede, DNS, timeout
        return 0, str(e).encode()


def http_json(url, **kw):
    st, b = http(url, **kw)
    try:
        return st, json.loads(b.decode() or "null")
    except Exception:
        return st, None


def save_json(path, obj, compact=False):
    os.makedirs(os.path.dirname(p(path)), exist_ok=True)
    with open(p(path), "w", encoding="utf-8") as f:
        if compact:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        else:
            json.dump(obj, f, ensure_ascii=False, indent=1)


def load_json(path, default=None):
    try:
        with open(p(path), encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def download(url, dest):
    """Baixa url → dest (relativo à raiz). Retorna True se ok."""
    st, b = http(url, timeout=30)
    if st == 200 and len(b) > 2000:
        os.makedirs(os.path.dirname(p(dest)), exist_ok=True)
        with open(p(dest), "wb") as f:
            f.write(b)
        return True
    return False


def ok(msg):
    print(f"   ✅ {msg}")


def warn(msg):
    print(f"   ⚠️  {msg}")


# ── 1. Supabase → arquivos locais ───────────────────────────────────────────
def exportar_supabase():
    print("\n📦 1/3  Exportando dados do Supabase…")
    headers = {"apikey": SUPA_ANON, "Authorization": f"Bearer {SUPA_ANON}"}

    st, arts = http_json(f"{SUPA_URL}/rest/v1/articles?select=*&order=published_at.desc", headers=headers)
    if st != 200 or not isinstance(arts, list):
        warn(f"Supabase indisponível ({st}). Mantendo data/articles.json atual.")
        return {}

    for a in arts:
        url = a.get("image_url") or ""
        if url.startswith("http"):
            ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
            ext = ext if ext in (".jpg", ".jpeg", ".png", ".webp") else ".jpg"
            name = re.sub(r"[^a-z0-9\-]", "", str(a["id"]).lower()) + ext
            dest = f"imagens/capas/{name}"
            if os.path.exists(p(dest)) or download(url, dest):
                a["image_url"] = dest
            else:
                warn(f"capa não baixada: {a['id']}")
    save_json("data/articles.json", arts)
    ok(f"{len(arts)} artigos salvos em data/articles.json")

    st, games = http_json(f"{SUPA_URL}/rest/v1/games?select=*", headers=headers)
    st2, legacy = http_json(f"{SUPA_URL}/rest/v1/achievements?select=*&order=sort_order.asc", headers=headers)
    if st2 == 200 and isinstance(legacy, list):
        save_json("ferramentas/backup_supabase_achievements.json", legacy)
        ok(f"backup de {len(legacy)} conquistas antigas em ferramentas/")
    return {g["id"]: g for g in (games or [])} if st == 200 and isinstance(games, list) else {}


# ── 2. Steam → data/conquistas ──────────────────────────────────────────────
def _steam_schema(appid, lang, accept):
    url = f"https://steamcommunity.com/stats/{appid}/achievements/?l={lang}"
    st, b = http(url, headers={"Accept-Language": accept, "Accept": "text/html"})
    if st != 200:
        return None
    html = b.decode("utf-8", "replace")
    m = re.search(r'"queryData":("(?:[^"\\]|\\.)*")', html)
    if m:
        queries = json.loads(json.loads(m.group(1))).get("queries", [])
        for q in queries:
            if q.get("queryKey", [None])[0] == "achievements":
                return q["state"]["data"]
    return _steam_schema_antigo(html)


def _steam_schema_antigo(html):
    """Plano B: layout antigo da página (sem api_name — usa o ícone como chave)."""
    import html as htmlmod
    rows = re.findall(r'<div class="achieveRow[^"]*">(.*?)<div style="clear: both;"></div>', html, re.S)
    if not rows:
        return None
    achs = []
    for r in rows:
        img = re.search(r'<img src="([^"]+)"', r)
        name = re.search(r"<h3>(.*?)</h3>", r, re.S)
        desc = re.search(r"<h5>(.*?)</h5>", r, re.S)
        pct = re.search(r'achievePercent">([\d.,]+)%', r)
        if not (img and name):
            continue
        icon = img.group(1).split("?")[0]
        achs.append({
            "api_name": os.path.basename(icon).split(".")[0],
            "name": htmlmod.unescape(name.group(1).strip()),
            "description": htmlmod.unescape(desc.group(1).strip()) if desc else "",
            "hidden": not (desc and desc.group(1).strip()),
            "icon_achieved": icon,
            "_pct": float(pct.group(1).replace(",", ".")) if pct else None,
        })
    return {"groups": [{"name": "", "dlcappid": 0, "achievements": achs}]} if achs else None


def _steam_percent(appid):
    st, d = http_json(
        f"https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?gameid={appid}")
    if st != 200 or not d:
        return {}
    return {a["name"]: round(float(a["percent"]), 1) for a in d["achievementpercentages"]["achievements"]}


def _steam_header(appid):
    st, d = http_json(f"https://store.steampowered.com/api/appdetails?appids={appid}&filters=basic")
    try:
        return d[str(appid)]["data"]["header_image"]
    except Exception:
        return f"https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/{appid}/header.jpg"


def atualizar_conquistas(supa_games):
    print("\n🏆 2/3  Atualizando conquistas da Steam…")
    jogos = load_json("data/jogos.json", [])
    index = load_json("data/conquistas/index.json", {}) or {}
    agora = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for j in jogos:
        gid, appid = j["id"], j.get("steam_appid")
        print(f" • {j['title']}")

        # Capa
        img = j.get("image") or f"imagens/jogos/{gid}.jpg"
        if not os.path.exists(p(img)):
            src = _steam_header(appid) if appid else None
            sg = supa_games.get(SUPA_GAME_ALIAS.get(gid, gid)) or {}
            fontes = [u for u in (src, sg.get("image_url")) if u]
            if any(download(u, img) for u in fontes):
                ok("capa baixada")
            else:
                warn("capa não encontrada")

        if not appid:
            existente = load_json(f"data/conquistas/{gid}.json")
            index[gid] = {"total": len((existente or {}).get("conquistas", [])), "atualizado": agora}
            continue

        pt = _steam_schema(appid, "brazilian", "pt-BR,pt;q=0.9")
        en = _steam_schema(appid, "english", "en-US,en;q=0.9")
        if not pt and not en:
            warn("não consegui ler a lista da Steam (mantendo a anterior)")
            continue
        pt = pt or en
        en = en or pt
        en_map = {a["api_name"]: a for g in en["groups"] for a in g["achievements"]}
        perc = _steam_percent(appid)

        grupos, lista = [], []
        for gi, g in enumerate(pt["groups"]):
            grupos.append({"nome": g.get("name") or "", "dlc": g.get("dlcappid") or 0})
            for a in g["achievements"]:
                if a.get("archived"):
                    continue
                e = en_map.get(a["api_name"], {})
                lista.append({
                    "k": a["api_name"], "g": gi,
                    "n": a.get("name", ""), "d": a.get("description", ""),
                    "n_en": e.get("name", a.get("name", "")), "d_en": e.get("description", a.get("description", "")),
                    "h": 1 if a.get("hidden") else 0,
                    "i": a.get("icon_achieved"), "i0": a.get("icon_unachieved"),
                    "p": perc.get(a["api_name"], a.get("_pct")),
                })
        save_json(f"data/conquistas/{gid}.json",
                  {"id": gid, "appid": appid, "fonte": "Steam", "atualizado": agora,
                   "grupos": grupos, "conquistas": lista}, compact=True)
        index[gid] = {"total": len(lista), "atualizado": agora}
        ok(f"{len(lista)} conquistas")
        time.sleep(0.8)  # educado com a Steam

    save_json("data/conquistas/index.json", index)
    gerar_indice()



def aplicar_traducoes():
    """data/traducoes/<id>.json: nomes/descrições em PT-BR para jogos sem tradução oficial na Steam."""
    for j in load_json("data/jogos.json", []):
        tr = load_json(f"data/traducoes/{j['id']}.json")
        d = load_json(f"data/conquistas/{j['id']}.json")
        if not tr or not d:
            continue
        mudou = False
        for a in d.get("conquistas", []):
            t = tr.get(a["k"]) or {}
            for campo in ("n", "d"):
                if t.get(campo) and a.get(campo) != t[campo]:
                    a[campo] = t[campo]
                    mudou = True
        if mudou:
            save_json(f"data/conquistas/{j['id']}.json", d, compact=True)


def gerar_indice():
    """data/conquistas/index.json: total do jogo base e lista de conquistas de cada DLC."""
    aplicar_traducoes()
    index = {}
    for j in load_json("data/jogos.json", []):
        d = load_json(f"data/conquistas/{j['id']}.json")
        if d is None:
            continue
        guia = (load_json(f"data/guias/{j['id']}.json") or {}).get("conquistas", {})
        grupos = d.get("grupos", [])
        dlcs = {}
        for a in d.get("conquistas", []):
            g = grupos[a.get("g", 0)] if a.get("g", 0) < len(grupos) else {}
            nome = (guia.get(a["k"]) or {}).get("dlc") or (g.get("nome") if g.get("dlc") else "")
            if nome:
                nome = nome.replace(f"{j['title']}: ", "")
                dlcs.setdefault(nome, []).append(a["k"])
        total = len(d.get("conquistas", []))
        index[j["id"]] = {"total": total, "base": total - sum(len(v) for v in dlcs.values()),
                          "dlcs": dlcs, "atualizado": d.get("atualizado")}
    save_json("data/conquistas/index.json", index)
    return index


# ── 2b. Páginas fixas para Google e redes sociais ───────────────────────────
# Cada notícia vira noticias/<id>.html e cada jogo vira conquistas/<id>.html,
# já com título, descrição e imagem de prévia (WhatsApp, Discord, X, Google).
# As páginas continuam interativas: o JavaScript carrega por cima, como antes.
SITE_URL = f"https://{GH_OWNER}.github.io/{GH_REPO}/"
import html as _html


def _esc(v):
    return _html.escape(str(v or ""), quote=True)


def _texto(html_str, n=None):
    t = re.sub(r"<[^>]+>", " ", html_str or "")
    t = re.sub(r"\s+", " ", _html.unescape(t)).strip()
    if n and len(t) > n:
        t = t[: n - 1].rsplit(" ", 1)[0] + "…"
    return t


def _abs(url):
    if not url:
        return SITE_URL + "imagens/og-padrao.jpg"
    return url if url.startswith("http") else SITE_URL + url.lstrip("/")


def _bloco_seo(titulo, desc, url, imagem, tipo="website", extra="", robots="index,follow"):
    return f"""<!--SEO-->
<meta name="description" content="{_esc(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{url}">
<meta property="og:site_name" content="Checkpoint Digital">
<meta property="og:locale" content="pt_BR">
<meta property="og:type" content="{tipo}">
<meta property="og:title" content="{_esc(titulo)}">
<meta property="og:description" content="{_esc(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{_esc(imagem)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{_esc(titulo)}">
<meta name="twitter:description" content="{_esc(desc)}">
<meta name="twitter:image" content="{_esc(imagem)}">
{extra}<!--/SEO-->"""


def _aplicar_seo(html_doc, titulo, bloco):
    html_doc = re.sub(r"\n?<!--SEO-->.*?<!--/SEO-->", "", html_doc, flags=re.S)
    html_doc = re.sub(r"<title>.*?</title>", lambda _m: f"<title>{_esc(titulo)}</title>", html_doc, count=1, flags=re.S)
    return html_doc.replace("</title>", "</title>\n" + bloco, 1)


def gerar_paginas():
    print("\n🔎 Gerando páginas para Google e redes sociais…")
    hoje = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    urls = []   # (url, lastmod)
    site = load_json("data/site.json", {})
    plats = {x["id"]: x for x in site.get("plataformas", [])}

    # Páginas modelo (home, plataformas, conquistas…)
    fixas = {
        "index.html": ("Checkpoint Digital — Notícias, reviews e guias de conquistas",
                       "Notícias de Xbox, PlayStation, Nintendo e PC, reviews e guias de conquistas com checklist de progresso."),
        "conquistas.html": ("Guias de Conquistas e Troféus — Checkpoint Digital",
                            "Listas oficiais de conquistas com % de jogadores, roteiros para platinar e checklist salvo na sua conta."),
        "meus-jogos.html": ("Meus Jogos — Checkpoint Digital", "Sua coleção de jogos com progresso de conquistas e notícias de cada jogo."),
        "conta.html": ("Minha conta — Checkpoint Digital", "Entre para salvar suas conquistas e ver o progresso em qualquer aparelho."),
        "privacidade.html": ("Política de Privacidade — Checkpoint Digital", "Quais dados o Checkpoint Digital usa, por quê e como você controla isso."),
        "termos.html": ("Termos de Uso — Checkpoint Digital", "Termos de uso do Checkpoint Digital."),
    }
    for pt in plats.values():
        fixas[pt["pagina"]] = (f"{pt['nome']} — Notícias e reviews · Checkpoint Digital",
                               f"Notícias, lançamentos e reviews de {pt['nome']}: " + ", ".join(g["nome"] for g in pt["geracoes"]) + ".")
    for arq, (tit, desc) in fixas.items():
        if not os.path.exists(p(arq)):
            continue
        privado = arq in ("conta.html", "meus-jogos.html")
        doc = open(p(arq), encoding="utf-8").read()
        doc = _aplicar_seo(doc, tit, _bloco_seo(tit, desc, SITE_URL + ("" if arq == "index.html" else arq),
                                                 _abs(None), robots="noindex,follow" if privado else "index,follow"))
        open(p(arq), "w", encoding="utf-8").write(doc)
        if not privado:
            urls.append((SITE_URL + ("" if arq == "index.html" else arq), hoje))

    # Notícias
    modelo = open(p("artigo.html"), encoding="utf-8").read()
    os.makedirs(p("noticias"), exist_ok=True)
    feitos = set()
    for a in load_json("data/articles.json", []):
        aid = re.sub(r"[^a-z0-9\-]", "", str(a.get("id", "")).lower())
        if not aid:
            continue
        pl = plats.get(a.get("platform"), {})
        fontes = [x for x in (a.get("fontes") or []) if isinstance(x, dict) and str(x.get("url", "")).startswith("http")]
        titulo = f"{a.get('title', '')} — Checkpoint Digital"
        desc = a.get("excerpt") or _texto(a.get("body"), 160)
        url = f"{SITE_URL}noticias/{aid}.html"
        img = _abs(a.get("image_url"))
        data = a.get("published_at") or ""
        ld = {"@context": "https://schema.org", "@type": "NewsArticle", "headline": a.get("title", "")[:110],
              "description": desc, "image": [img], "datePublished": data, "dateModified": data,
              "author": {"@type": "Organization", "name": a.get("author") or "Checkpoint Digital"},
              "publisher": {"@type": "Organization", "name": "Checkpoint Digital"},
              "mainEntityOfPage": url, "inLanguage": "pt-BR",
              "citation": [x["url"] for x in fontes]}
        extra = (f'<meta property="article:published_time" content="{_esc(data)}">\n'
                 f'<meta property="article:section" content="{_esc(pl.get("nome", ""))}">\n'
                 f'<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>\n')
        doc = _aplicar_seo(modelo, titulo, _bloco_seo(titulo, desc, url, img, "article", extra))
        doc = doc.replace("<meta charset=\"UTF-8\">", "<meta charset=\"UTF-8\">\n<base href=\"../\">", 1)
        pre = (f'<article class="article-hero"><div class="article-hero-inner">'
               f'<h1 class="article-title">{_esc(a.get("title"))}</h1>'
               f'<p style="color:var(--text3)">{_esc(pl.get("nome", ""))} · {_esc(data[:10])}</p></div></article>'
               f'<div class="article-body-wrap"><div class="article-body">{a.get("body") or ""}</div>'
               + (f'<aside class="article-sources"><div class="article-sources-title">Fontes</div><ul>'
                  + "".join(f'<li><a href="{_esc(x.get("url"))}" target="_blank" rel="noopener nofollow">{_esc(x.get("nome"))}</a></li>'
                            for x in fontes) + '</ul></aside>' if fontes else '')
               + '</div>')
        doc = re.sub(r"<!--PRE-->\s*<div class=\"art-loading\">.*?</div>\s*</div>", "<!--PRE-->" + pre.replace("\\", "\\\\") + "</div>",
                     doc, count=1, flags=re.S) if "<!--PRE-->" in doc else doc
        doc = doc.replace('<footer id="site-footer"></footer>',
                          f'<footer id="site-footer"></footer>\n<script>window.ARTIGO_ID = {json.dumps(a["id"])};</script>', 1)
        open(p(f"noticias/{aid}.html"), "w", encoding="utf-8").write(doc)
        feitos.add(f"{aid}.html")
        urls.append((url, data[:10] or hoje))
    for velho in os.listdir(p("noticias")):          # notícia removida do banco
        if velho.endswith(".html") and velho not in feitos:
            os.remove(p(f"noticias/{velho}"))

    # Jogos (guias de conquistas)
    modelo = open(p("conquistas/jogo.html"), encoding="utf-8").read()
    index = load_json("data/conquistas/index.json", {})
    for j in load_json("data/jogos.json", []):
        gid = j["id"]
        if gid in ("jogo",):
            continue
        guia = load_json(f"data/guias/{gid}.json") or {}
        dados = load_json(f"data/conquistas/{gid}.json") or {}
        base = (index.get(gid) or {}).get("base") or len(dados.get("conquistas", []))
        dlcs = (index.get(gid) or {}).get("dlcs") or {}
        if j.get("mode") == "sem-conquistas":
            desc = f"{j['title']} não tem sistema de conquistas oficial. Veja detalhes e notícias do jogo."
        else:
            desc = (f"Todas as {base} conquistas de {j['title']}"
                    + (f" (+{sum(len(v) for v in dlcs.values())} de DLC)" if dlcs else "")
                    + " com % de jogadores, roteiro de platina, perdíveis e checklist de progresso.")
        titulo = f"{j['title']} — Guia de Conquistas e Troféus · Checkpoint Digital"
        url = f"{SITE_URL}conquistas/{gid}.html"
        doc = _aplicar_seo(modelo, titulo, _bloco_seo(titulo, desc, url, _abs(j.get("image"))))
        nomes = "".join(f"<li>{_esc(a.get('n'))}</li>" for a in dados.get("conquistas", [])[:200])
        pre = (f'<main class="ck-wrap" style="padding:40px 24px"><h1>{_esc(j["title"])} — Conquistas</h1>'
               f'<p>{_esc(guia.get("resumo") or desc)}</p><ul>{nomes}</ul></main>')
        doc = re.sub(r'<div id="app">.*?</div>\s*</div>\s*</div>', lambda _m: f'<div id="app">{pre}</div>', doc, count=1, flags=re.S)
        doc = doc.replace('<footer id="site-footer"></footer>',
                          f'<footer id="site-footer"></footer>\n<script>window.JOGO_ID = {json.dumps(gid)};</script>', 1)
        open(p(f"conquistas/{gid}.html"), "w", encoding="utf-8").write(doc)
        urls.append((url, (index.get(gid) or {}).get("atualizado") or hoje))

    # Endereço antigo do Elden Ring continua funcionando
    open(p("conquistas/elden-ring.html"), "w", encoding="utf-8").write(
        '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Redirecionando…</title>'
        '<meta http-equiv="refresh" content="0; url=eldenring.html"><link rel="canonical" href="eldenring.html">'
        "<script>location.replace('eldenring.html'+location.search);</script></head>"
        '<body><a href="eldenring.html">Abrir guia de conquistas</a></body></html>')

    # Mapa do site e robots
    linhas = "".join(f"  <url><loc>{_esc(u)}</loc><lastmod>{d}</lastmod></url>\n" for u, d in urls)
    open(p("sitemap.xml"), "w", encoding="utf-8").write(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n{linhas}</urlset>\n')
    open(p("robots.txt"), "w", encoding="utf-8").write(
        f"User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}sitemap.xml\n")
    ok(f"{len(urls)} páginas no mapa do site ({len(feitos)} notícias)")

# ── 3. Publicação no GitHub ─────────────────────────────────────────────────
TOKEN_FILE = p("ferramentas/.github_token")


def _token():
    t = os.environ.get("GITHUB_TOKEN")
    if t:
        return t.strip()
    if os.path.exists(TOKEN_FILE):
        return open(TOKEN_FILE).read().strip()
    legacy = next((x for x in (p("ferramentas/legado/setup_github.py"), p("setup_github.py")) if os.path.exists(x)), None)
    if legacy:
        m = re.search(r'TOKEN\s*=\s*"([^"]+)"', open(legacy, encoding="utf-8").read())
        if m:
            return m.group(1)
    return None


def _pedir_token():
    print("\n   Preciso de um token do GitHub com permissão de escrita no repositório.")
    print("   Crie em: https://github.com/settings/tokens/new  (marque o escopo 'repo')")
    t = getpass.getpass("   Cole o token aqui (não aparece na tela): ").strip()
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    with open(TOKEN_FILE, "w") as f:
        f.write(t)
    os.chmod(TOKEN_FILE, 0o600)
    return t


def _gh(method, path, token, data=None):
    return http_json(f"https://api.github.com{path}", method=method, data=data, headers={
        "Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"})


INCLUIR_SEMPRE = ["ferramentas/atualizar_site.py"]


def _arquivos_do_site():
    files = [x for x in INCLUIR_SEMPRE if os.path.exists(p(x))]
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        dirnames[:] = [d for d in dirnames if (not d.startswith(".") or d == ".github") and d not in EXCLUDE_DIRS]
        for fn in filenames:
            if fn.startswith(".") and fn != ".nojekyll":
                continue
            if fn in EXCLUDE_FILES:
                continue
            ext = os.path.splitext(fn)[1].lower()
            if fn != ".nojekyll" and ext not in PUBLISH_EXT:
                continue
            rel = os.path.normpath(os.path.join(rel_dir, fn)).replace(os.sep, "/")
            files.append(rel)
    return sorted(files)


def _git_sha(content):
    return hashlib.sha1(b"blob %d\0" % len(content) + content).hexdigest()


def carimbar_versoes():
    """Adiciona ?v=<hash> aos .js/.css do site nas páginas, para o navegador não usar versões antigas do cache."""
    assets = {}
    for nome in ("shared.js", "shared.css", "auth.js", "conquistas-app.js", "conquistas-app.css", "plataforma.js"):
        if os.path.exists(p(nome)):
            assets[nome] = hashlib.sha1(open(p(nome), "rb").read()).hexdigest()[:8]
    padrao = re.compile(r'((?:\.\./)?(' + "|".join(re.escape(a) for a in assets) + r'))(\?v=[0-9a-f]+)?"')
    for rel in _arquivos_do_site():
        if not rel.endswith(".html"):
            continue
        txt = open(p(rel), encoding="utf-8").read()
        novo = padrao.sub(lambda m: f'{m.group(1)}?v={assets[m.group(2)]}"', txt)
        if novo != txt:
            open(p(rel), "w", encoding="utf-8").write(novo)


def publicar():
    print("\n🚀 3/3  Publicando no GitHub…")
    gerar_indice()
    gerar_paginas()
    carimbar_versoes()
    token = _token()
    st, user = (0, None) if not token else _gh("GET", "/user", token)
    if st != 200:
        token = _pedir_token()
        st, user = _gh("GET", "/user", token)
        if st != 200:
            print("   ❌ Token inválido. Rode o script de novo com um token válido.")
            sys.exit(1)
    ok(f"conectado como {user['login']}")

    open(p(".nojekyll"), "a").close()
    repo = f"/repos/{GH_OWNER}/{GH_REPO}"

    st, ref = _gh("GET", f"{repo}/git/ref/heads/{GH_BRANCH}", token)
    parent = ref["object"]["sha"] if st == 200 else None
    existentes = {}
    if parent:
        _, commit = _gh("GET", f"{repo}/git/commits/{parent}", token)
        _, tree = _gh("GET", f"{repo}/git/trees/{commit['tree']['sha']}?recursive=1", token)
        existentes = {t["path"]: t["sha"] for t in (tree or {}).get("tree", []) if t["type"] == "blob"}

    entries, enviados = [], 0
    for rel in _arquivos_do_site():
        if rel.startswith(".github/") and rel in existentes:
            with open(p(rel), "rb") as f:
                if _git_sha(f.read()) == existentes[rel]:
                    entries.append({"path": rel, "mode": "100644", "type": "blob", "sha": existentes[rel]})
                    continue
        with open(p(rel), "rb") as f:
            content = f.read()
        sha = _git_sha(content)
        if existentes.get(rel) != sha:
            st, blob = _gh("POST", f"{repo}/git/blobs", token,
                           {"content": base64.b64encode(content).decode(), "encoding": "base64"})
            if st != 201:
                print(f"   ❌ falha ao enviar {rel}: {st} {blob}")
                sys.exit(1)
            sha = blob["sha"]
            enviados += 1
        entries.append({"path": rel, "mode": "100644", "type": "blob", "sha": sha})

    def enviar_commit(itens):
        st, tree = _gh("POST", f"{repo}/git/trees", token, {"tree": itens})
        if st != 201:
            return st, tree
        msg = f"Atualização do site — {datetime.now().strftime('%d/%m/%Y %H:%M')}"
        st, commit = _gh("POST", f"{repo}/git/commits", token,
                         {"message": msg, "tree": tree["sha"], "parents": [parent] if parent else []})
        if parent:
            return _gh("PATCH", f"{repo}/git/refs/heads/{GH_BRANCH}", token, {"sha": commit["sha"], "force": False})
        return _gh("POST", f"{repo}/git/refs", token, {"ref": f"refs/heads/{GH_BRANCH}", "sha": commit["sha"]})

    removidos = len(set(existentes) - {e["path"] for e in entries})
    if enviados == 0 and removidos == 0:
        ok("nada mudou desde a última publicação")
    else:
        st, resp = enviar_commit(entries)
        tem_workflow = any(e["path"].startswith(".github/") for e in entries)
        if st not in (200, 201) and tem_workflow:
            warn("seu token não tem permissão 'workflow' — publicando sem a rotina automática (.github).")
            warn("para ativá-la, crie um token com os escopos 'repo' e 'workflow' e rode de novo.")
            # mantém no repositório a versão do .github que já está lá (criada pelo site do GitHub)
            entries = [e for e in entries if not e["path"].startswith(".github/")]
            entries += [{"path": pth, "mode": "100644", "type": "blob", "sha": sha}
                        for pth, sha in existentes.items() if pth.startswith(".github/")]
            st, resp = enviar_commit(entries)
        if st not in (200, 201):
            print(f"   ❌ não consegui atualizar a branch ({st}): {resp}")
            sys.exit(1)
        ok(f"commit enviado: {enviados} arquivo(s) novo(s)/alterado(s), {removidos} removido(s)")

    # GitHub Pages
    alvo = {"branch": GH_BRANCH, "path": "/"}
    st, pages = _gh("GET", f"{repo}/pages", token)
    if st == 404:
        st, pages = _gh("POST", f"{repo}/pages", token, {"source": alvo})
        ok("GitHub Pages ativado") if st in (201, 204) else warn(f"não consegui ativar o Pages ({st}): {pages}")
    elif st == 200 and (pages.get("source") != alvo or pages.get("build_type") != "legacy"):
        st, _ = _gh("PUT", f"{repo}/pages", token, {"build_type": "legacy", "source": alvo})
        ok("configuração do Pages corrigida (branch main, pasta raiz)") if st in (200, 204) else warn(f"Pages: {st}")
    _gh("POST", f"{repo}/pages/builds", token)

    print("   ⏳ aguardando o GitHub Pages publicar…")
    for _ in range(40):
        time.sleep(6)
        st, b = _gh("GET", f"{repo}/pages/builds/latest", token)
        status = (b or {}).get("status")
        if status == "built":
            break
        if status == "errored":
            warn(f"build com erro: {(b or {}).get('error')}")
            break
    st, pages = _gh("GET", f"{repo}/pages", token)
    url = (pages or {}).get("html_url") or f"https://{GH_OWNER}.github.io/{GH_REPO}/"
    print(f"\n🌐 Site no ar: {url}")
    print(f"   Conquistas: {url}conquistas.html")


# ── Main ────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    args = set(sys.argv[1:])
    print("Checkpoint Digital — atualização do site")
    # Sempre começa pelo banco: assim uma publicação feita do Mac nunca apaga
    # notícias que a rotina automática já publicou.
    games = exportar_supabase()
    if "--so-gerar" in args:          # rotina do GitHub: só gera páginas (sem Steam, sem API)
        gerar_indice()
        gerar_paginas()
        carimbar_versoes()
        print("\n✅ Páginas geradas.")
        sys.exit(0)
    if "--so-publicar" not in args:
        atualizar_conquistas(games)
    if "--sem-publicar" not in args:
        publicar()
    print("\n✅ Concluído!")
