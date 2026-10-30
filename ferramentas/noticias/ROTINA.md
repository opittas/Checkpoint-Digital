# Rotina de notícias do Checkpoint Digital

Instruções para a tarefa agendada do Claude Code que escreve as notícias do site.
Cada execução lê este arquivo e segue os passos abaixo, do começo ao fim.

A notícia vai para a tabela `articles` do Supabase (projeto `ytehtjgbxkwpfabqhojm`)
e o workflow **Publicar notícias** (`.github/workflows/publicar-noticias.yml`) gera a
página e publica.

**Onde a notícia aparece:** o site não tem mais página inicial de notícias. Cada
notícia aparece dentro da página do jogo que ela cita (`conquistas/<id>.html`) e
nos Meus Jogos de quem tem o jogo. A ligação é feita pelo campo `palavras` de
`data/jogos.json`: o título ou o resumo da notícia precisa conter um desses nomes.
Por isso toda notícia precisa ser sobre um jogo do catálogo; se o jogo ainda não
existe, ele é criado no passo 6.

## Regra de ouro

Nada de notícia falsa. Cada frase publicada precisa estar apoiada em pelo menos
uma fonte lida nesta execução. Na dúvida, corte a frase ou descarte a notícia.
Melhor não publicar nada numa rodada do que publicar algo errado.

## 1. Ver o que já saiu

Consulte o banco antes de pesquisar:

```sql
select id, platform, title, published_at, fontes
from articles
where published_at > now() - interval '10 days'
order by published_at desc;
```

Não escreva sobre um fato que já tem notícia nesse período, a não ser que haja
novidade concreta (data confirmada, preço, review, lançamento). Nesse caso a
notícia nova trata só da novidade.

## 2. Pesquisar

Procure as notícias de games das últimas 24 horas. Prioridade, nesta ordem:

1. **Fontes oficiais:** Xbox Wire, PlayStation Blog, Nintendo (site e Nintendo Today),
   notícias da Steam, blogs e comunicados das publishers e estúdios.
2. **Portais internacionais:** IGN, Eurogamer, GamesRadar+, VGC, Gematsu,
   Push Square, Pure Xbox, Nintendo Life, Windows Central.
3. **Portais brasileiros:** IGN Brasil, Adrenaline, Voxel, Central Xbox,
   Nintendo Blast, MeuPlayStation.

Dê preferência aos jogos de `data/jogos.json` (campo `palavras`) e a assuntos
que interessam a quem joga no Brasil (preço em reais, lançamento no país, dublagem).
Cada notícia precisa ter um **jogo principal**. Assunto sem jogo (resultado de
empresa, hardware, evento) só entra se citar no título um jogo do catálogo ou um
jogo que você vai criar no passo 6.

Escolha **no máximo 4 assuntos** por rodada, os de maior interesse.

## 3. Apurar cada assunto

Para cada assunto, abra e leia as páginas das fontes (não confie só no título
ou no resumo da busca). Monte, antes de escrever, uma lista de fatos assim:

```
- Fato: Final Fantasy VII Remake Intergrade entra no Game Pass em 29 de outubro.
  Fonte: https://news.xbox.com/... (Xbox Wire)
```

Regras da apuração:

- Só vira notícia o que tiver **uma fonte oficial** ou **duas fontes independentes**
  (dois portais que não estejam só repetindo um ao outro; se os dois citam a mesma
  origem, vá até a origem).
- Datas, preços, números, nomes e plataformas são copiados exatamente da fonte.
  Se as fontes divergem, diga que divergem (como na notícia do Tomb Raider sobre a
  data do Switch 2).
- Vazamento, rumor ou fala de analista entra só com a palavra **rumor**,
  **vazamento** ou **segundo o analista** no título ou na primeira frase, e com a
  origem citada.
- Se um dado não foi divulgado, o texto diz que não foi divulgado. Nunca complete
  com suposição.
- Respeite paywall e `robots.txt`: se a página não abrir, use outra fonte.

## 4. Escrever

Escreva a partir da **lista de fatos**, não do texto das fontes. Com outras
palavras, mas sem mudar o sentido de nada.

- No máximo uma citação curta entre aspas por notícia, sempre com quem disse.
- Nunca copie parágrafos ou frases inteiras de um portal.
- Leia 2 ou 3 notícias recentes em `data/articles.json` antes de escrever, para
  acertar o tom.

### Estilo do site

- **title:** longo e informativo, com o fato principal e o detalhe que chama atenção.
  Traz o nome do jogo principal escrito como em `title` ou `palavras` de `data/jogos.json`
  (é isso que coloca a notícia na página do jogo).
  Ex.: "Game Pass: Final Fantasy VII Remake Lidera Fim de Outubro, e LEGO Star Wars e Deep Rock Galactic Saem do Catálogo".
- **excerpt:** uma ou duas frases que dizem por que a notícia importa.
- **body:** HTML simples. Primeiro parágrafo `<p>` com o fato principal; depois
  2 a 4 blocos com intertítulo `<h3>`; listas `<ul><li>` para datas, itens e
  edições; nomes, números e datas importantes em `<strong>`. Sem `<h1>`, `<h2>`,
  imagens, scripts ou estilos. Cerca de 300 a 450 palavras.
- **title_en, excerpt_en, body_en:** a mesma notícia em inglês, mesma estrutura.
- **read_time:** "2 min", "3 min" ou "4 min", conforme o tamanho.
- **author:** "Checkpoint Digital".

### Campos

- **id:** `<plataforma>-<assunto-curto>` em minúsculas, sem acento, com hífens.
  Ex.: `ps-gta6-preorder-maio-18-lancamento`. Confira se o id ainda não existe.
- **platform:** `xbox`, `ps`, `nin` ou `steam`. Jogo em várias plataformas: uma
  notícia por plataforma relevante (no máximo 3), cada uma com seu id e com o
  texto ajustado à plataforma, como já é feito no site (`ps-doom-…`, `xbox-doom-…`).
- **gen:** um dos ids de `geracoes` em `data/site.json` (ex.: `ps5`, `series-x`,
  `switch2`, `windows`).
- **category:** um dos ids de `categorias` em `data/site.json`
  (`Lançamentos`, `Previstos`, `Reviews`, `Notícias`, `Retrô`, `Guias`).
- **fontes:** lista `[{"nome": "Xbox Wire", "url": "https://..."}]` com **todas**
  as páginas usadas, só links `https://` que você abriu.
- **image_url:** só imagem de divulgação oficial: capa da loja (Steam, PlayStation
  Store, Nintendo eShop, Microsoft Store), imagem do post oficial ou do press kit.
  Nunca foto, montagem ou thumbnail feita por portal. Se não achar, use a capa
  da Steam pelo `steam_appid` de `data/jogos.json`
  (`https://cdn.cloudflare.steamstatic.com/steam/apps/<appid>/header.jpg`).
- **featured:** `false`.
- **published_at:** não envie (o banco usa a hora atual).

## 5. Verificar antes de gravar

Releia o texto final em PT e EN, frase por frase, contra a lista de fatos:

- Cada frase tem fato que a apoia? Se não, corte.
- Algum número, data, preço ou plataforma diferente da fonte? Corrija.
- Alguma frase afirma mais do que a fonte (rumor virou certeza, "pode" virou "vai")? Corrija.
- Algum trecho ficou parecido demais com o texto de um portal? Reescreva.
- O EN diz exatamente o mesmo que o PT?

Se depois disso a notícia ficou fraca ou sem base, descarte.

## 6. Criar o jogo, se ele ainda não existir

Antes de gravar, confira se o jogo principal de cada notícia já está em
`data/jogos.json` (compare com `title` e `palavras`, sem acento e sem maiúsculas).
Se não estiver, crie o jogo **seguindo o padrão dos outros**, acrescentando um item
ao fim da lista:

```json
{
  "id": "phantom-blade-zero",
  "title": "Phantom Blade Zero",
  "developer": "S-Game",
  "year": 2026,
  "steam_appid": 4115450,
  "platforms": ["ps", "steam"],
  "labels": { "ps": "", "steam": "" },
  "difficulty": null,
  "hours": null,
  "playthroughs": null,
  "online": false,
  "mode": "conquistas",
  "image": "imagens/jogos/phantom-blade-zero.jpg",
  "generos": ["Ação", "RPG"],
  "palavras": ["phantom blade zero"]
}
```

Regras:

- **id:** nome do jogo em minúsculas, sem acento, com hífens. Confira que não existe.
- **title:** o nome oficial do jogo (em inglês, como na loja). **developer** e **year**
  saem das fontes ou da página oficial; ano de lançamento (previsto, se ainda não saiu).
- **steam_appid:** o número da página oficial do jogo na Steam
  (`store.steampowered.com/app/<número>`), só se você abriu essa página. Se não achar,
  use `null`: o workflow procura o jogo na Steam pelo nome exato.
- **platforms:** só as plataformas confirmadas pelas fontes (`xbox`, `ps`, `nin`, `steam`).
- **mode:** `conquistas` se o jogo sai em Xbox, PlayStation ou PC; `sem-conquistas` se
  sai só em consoles Nintendo (eles não têm conquistas oficiais).
- **difficulty**, **hours**, **playthroughs:** `null` (são preenchidos quando alguém
  escrever o guia). **online:** `true` só se o jogo for principalmente online.
- **generos:** um a três, usando os nomes que já aparecem no catálogo (Ação, Aventura,
  RPG, Indie, Simulação, Tiro, Mundo aberto, Corrida, Luta, Estratégia...).
- **palavras:** os nomes que aparecem nas notícias, em minúsculas (ex.: `"gta 6"`,
  `"gta vi"`, `"grand theft auto vi"`). Nada genérico demais: `"call of duty"` pegaria
  todos os jogos da série; prefira `"modern warfare 4"`.
- **image:** sempre `imagens/jogos/<id>.jpg`. Não envie a imagem: o workflow baixa a capa
  da Steam ou, se o jogo não estiver na Steam, copia a capa da notícia.
- Nunca invente lista de conquistas, guia ou dado que as fontes não trazem. A lista
  oficial é baixada da Steam pelo workflow quando ela existir; até lá a página do jogo
  mostra as notícias e avisa que a lista ainda não saiu.

Grave o `data/jogos.json` atualizado direto no branch `main` de
`opittas/Checkpoint-Digital`, num commit que mexe **só nesse arquivo**, com a mensagem
`Catálogo: adiciona <nome do jogo>`. Mantenha o formato do arquivo (JSON com 2 espaços
de recuo, mesma ordem de campos). Leia o arquivo de novo logo antes de gravar, para
não apagar um jogo adicionado por outra pessoa.

## 7. Gravar e publicar

Grave cada notícia com `insert` na tabela `articles` (uma por vez, usando
`$$...$$` ou escapando aspas simples no HTML). Depois confira com um `select`
que ela entrou com `fontes` preenchidas.

Se pelo menos uma notícia foi gravada, dispare o workflow **Publicar notícias**
(`publicar-noticias.yml`, branch `main`) no repositório
`opittas/Checkpoint-Digital` para ela ir ao ar na hora.

O workflow gera a página da notícia e, para cada jogo novo, baixa a capa e a lista
oficial de conquistas da Steam e cria a página do jogo.

Não altere nem apague notícias que já existem. Fora o `data/jogos.json` (passo 6),
não mude arquivos do repositório.

## 8. Resumo

Termine com um resumo curto em português: quais notícias foram publicadas
(título e id), em qual jogo cada uma aparece, quais jogos foram criados, quais
assuntos foram descartados e por quê. Se nada foi publicado, diga isso.
