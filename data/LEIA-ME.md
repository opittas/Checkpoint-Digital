# Dados do Checkpoint Digital

O site não tem conteúdo fixo no HTML: as páginas são modelos que leem estes JSON e montam tudo no navegador.
Cada arquivo equivale a uma futura tabela de banco (Supabase/Firebase). Para migrar, basta trocar a leitura do arquivo por uma consulta, mantendo os mesmos campos.

| Arquivo | O que guarda | Quem edita | Equivale a |
|---|---|---|---|
| `site.json` | Plataformas, gerações, categorias e textos do rodapé | Você, à mão | tabelas `plataformas`, `geracoes`, `categorias` |
| `articles.json` | Notícias do blog | Exportado do Supabase pelo script | tabela `articles` (já existe) |
| `jogos.json` | Catálogo da área de conquistas | Você, à mão | tabela `games` |
| `conquistas/<id>.json` | Lista oficial de conquistas de cada jogo | Gerado pelo script (Steam) | tabela `achievements` |
| `conquistas/index.json` | Totais do jogo base e das DLCs | Gerado pelo script | view/consulta agregada |
| `guias/<id>.json` | Roteiro de platina, avisos, dicas, DLC/online por conquista | Você, à mão | tabela `guias` + colunas extras em `achievements` |

Dados de cada pessoa (progresso, Meus Jogos, contas vinculadas) já ficam no Supabase, nas tabelas `progresso`, `biblioteca`, `perfis` e `contas_vinculadas`, com cópia no navegador.

## Formatos

### site.json
```json
{
  "plataformas": [{ "id": "xbox", "nome": "Xbox", "emoji": "🟢", "pagina": "xbox.html",
                    "todas": { "pt": "Todas as gerações", "en": "All generations" },
                    "geracoes": [{ "id": "xboxone", "nome": "Xbox One" }] }],
  "categorias":  [{ "id": "Reviews", "en": "Reviews", "badge": "badge-review" }],
  "rodape":      { "slogan": { "pt": "…", "en": "…" }, "direitos": {…}, "assinatura": {…} }
}
```
O campo `gen` de cada notícia deve ser um dos `id` de `geracoes`; `category`, um dos `id` de `categorias`.

### articles.json
`id, platform (xbox|ps|nin|steam), gen, category, title, title_en, excerpt, excerpt_en, body, body_en (HTML), image_url, published_at (ISO), read_time, author, featured`

### jogos.json
`id, title, developer, year, steam_appid (ou null), platforms[], labels{plataforma: texto}, difficulty (1–10), hours, playthroughs, online, dlc_note, mode (conquistas|checklist|sem-conquistas), image, generos[], palavras[] (para achar notícias do jogo)`

### conquistas/&lt;id&gt;.json
```json
{ "id": "deadcells", "appid": 588650, "fonte": "Steam", "atualizado": "2026-10-25",
  "grupos": [{ "nome": "", "dlc": 0 }],
  "conquistas": [{ "k": "API_NAME", "g": 0, "n": "Nome PT", "d": "Descrição PT", "n_en": "…", "d_en": "…",
                   "h": 0, "i": "ícone (URL)", "p": 12.5, "qtd": 900 }] }
```
`h` = secreta, `p` = % de jogadores na Steam, `qtd` = só em checklists com contador.

### guias/&lt;id&gt;.json
```json
{ "resumo": "…", "roadmap": [{ "titulo": "…", "texto": "…" }], "avisos": ["…"],
  "conquistas": { "API_NAME": { "missavel": true, "dlc": "Nome da DLC", "online": true, "dica": "…" } } }
```
Uma conquista com `dlc` sai do 100% do jogo base e vai para a aba daquela DLC.

## Como adicionar um jogo
1. Inclua o jogo em `jogos.json` (com `steam_appid`, se tiver).
2. Rode `Atualizar site.command` — ele baixa a lista oficial da Steam e publica.
3. Opcional: crie `guias/<id>.json` com roteiro, perdíveis e DLCs.
