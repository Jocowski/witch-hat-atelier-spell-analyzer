# Witch Hat Atelier — Análise do Sistema Mágico para o Simulador

> Documento-fonte da lógica do simulador. Consolida as regras das [docs/](docs/) e as traduz num modelo de dados (`data/*.json`) que o app consome para **renderizar**, **validar**, **deduzir** e **analisar** spells.

---

## 1. Visão geral

Magia em *Witch Hat Atelier* é **desenhada**, não falada. Um spell (seal/glyph) é composto por camadas:

| Camada | Papel | Onde fica |
|--------|-------|-----------|
| **Sigil** | Define a **substância/elemento** (fogo, água, terra, vento, luz, tempo, decorativo…) | Centro. Spells *mistos* podem ter **mais de um sigil**. |
| **Signs (keystones)** | Definem a **forma** com que o elemento se manifesta | Anéis ao redor do centro |
| **Ring** | **Ativa** o spell ao fechar | Círculo externo |
| **Conjuring ink (+ dyes)** | A tinta com que tudo é desenhado; **magical dyes** misturadas modificam o spell | Propriedade global do desenho |

**Princípio:** `efeito = substância(sigils) × forma(signs) × ativação(ring) × tinta(dyes)`.

A mesma combinação de signs muda de comportamento conforme o sigil (ex.: *column* + água = jato; *column* + luz = feixe de luz). É essa multiplicação que o simulador modela.

### Docs-fonte (em [docs/](docs/))

- [magic.md](docs/magic.md) — seals, sigils, signs, ring; balanço, rotação, inversão; conceitos avançados.
- [sigils.md](docs/sigils.md) — sigils por família (Fire, Water, Earth, Air, Time, Decorative, Misc).
- [signs.md](docs/signs.md) — signs e as **4 categorias** (directional / semi-directional / non-directional / asymmetric).
- [magical-dye.md](docs/magical-dye.md) — dyes que se misturam à tinta.
- [forbidden-magic.md](docs/forbidden-magic.md) — magia proibida.
- [spells.md](docs/spells.md) — catálogo de spells por categoria (referência visual).

---

## 2. Regras de validação → [`data/rules.json`](data/rules.json) + `analyze()`

| Severidade | Regra | Quando dispara |
|-----------|-------|----------------|
| **blocking** | núcleo presente | sem sigil/sign-central → **inválido** |
| **inactive** | ring fechado | ring aberto → preparado, porém **inativo** |
| warning | ring vazio = explosão | ring fechado sem nada dentro → descarga bruta |
| warning | ≥ 1 sign | sigil sem signs → forma indefinida |
| warning | estabilidade | ≥2 signs assimétricos → instável (recomenda-se ao menos simetria bilateral) |
| info | balanço/direção | signs desbalanceados desviam o efeito para o lado de signs maiores/mais numerosos |
| info | rotação/spin | signs inclinados fazem o spell girar (mais inclinação = mais giro, menos alcance) |

### Mecânicas (das docs)

- **Inversão** — virar um sign produz o efeito oposto (Wall Breaker ↔ Integration; Floating Expansion ↔ Spell of Reduction). Dois spells idênticos mas com signs invertidos se cancelam. Só signs **invertíveis** (directional / semi-directional) podem ser invertidos; **non-directional** não têm "frente" para inverter; **asymmetric** são imprevisíveis.
- **Tamanho & nitidez** — seals maiores = mais potentes; bem desenhados = mais estáveis e duradouros.
- **Spells ligados / aninhados / toggle por ring / anel duplo** — mecânicas avançadas (documentadas; ainda não totalmente modeladas no engine).

---

## 3. Sigils → [`data/sigils.json`](data/sigils.json)

29 sigils, agrupados por **família** (campo `family`, usado pela paleta e pela análise):

| Família | Sigils |
|---------|--------|
| **fire** | Fire, Unburning Flames, Light |
| **water** | Water |
| **earth** | Earth |
| **air** | Wind, Aeriforms, Wind Underfoot, Whorling Winds |
| **time** | Repetition, Stop |
| **decorative** | Bird A/B, Dragon, Flower, Horse, Owlcat, Owlcat Head, Scalewolf, Torchstag, Liongoat, Valance Leech |
| **misc** | Crystal, Smoke, **Guidance** (glyph "G"), **Calling** (glyph "C") |
| **special** (oculto da paleta) | `vision_sigil`, `billowing_sigil`, `unknown_sigil` — mantidos em dados, fora da paleta |

- **Multi-sigil:** o 1º sigil é o `core`; sigils extras entram como `components` com `role:"sigil"`. A dedução cita a substância de todos.
- **Sign-as-sigil:** *vision*, *billowing*, *repetition* podem ocupar o centro.
- **Guidance/Calling** não têm arte → renderizados como **texto** ("G"/"C") via campo `text`.

---

## 4. Signs → [`data/signs.json`](data/signs.json)

38 signs. Os 35 documentados são classificados em 4 categorias (campo `family`); 3 ficam ocultos (`bird`, `animal_signs`, `unknown_sign`).

| Categoria | Comportamento (signs.md) | Exemplos |
|-----------|--------------------------|----------|
| **directional** (8) | manifestam o efeito numa direção; simetria bilateral, sem radial; ângulo/tamanho controlam a direção | column, dispersion, levitation, pull, **region** (ex-"direction"), collection, sights_set, gather |
| **semi-directional** (13) | invertíveis, sem direção própria; tamanho = força | crush, convergence, weave, enlarge, radial, rain, **puppet**, strengthen, entwine, aeriforms_defined, glaives, bind, link |
| **non-directional** (12) | simetria radial, sem frente → **não invertíveis** | float, **billow**, repetition, diamond, window, crosshair, bolt, eye, vision, bend, cool, orb |
| **asymmetric** (2) | sem simetria, imprevisíveis | sign_of_wind, purify |

> Renomeações para casar com a doc: `direction`→**Region**, `billowing`→**Billow**, `dancing_puppet`→**Puppet** (ids preservados).

Cada sign tem: `svgPath`, `effect`, `effectTags`, `invertible`, `canBeCenter`, `surrounds` e um **operador** correspondente em `grammar.json` (a dedução depende disso — teste de cobertura).

---

## 5. Magical dyes → [`data/dyes.json`](data/dyes.json)

Substâncias misturadas à *conjuring ink*. A composição carrega `dyes: [id]`, e a análise lista os efeitos:

| Dye | Efeito |
|-----|--------|
| Azuremoon Flower | aumenta a **duração** |
| Blood | aumenta muito a **potência** |
| Blushing Bride Scales | torna o seal **invisível** |
| Golden Blaze Wyrm Scales | faz a tinta **brilhar no escuro** |
| Roaming Scallop Shells | torna o seal **à prova d'água** |

---

## 6. Modelo de dados e arte

```
data/
├── rules.json    → regras de validação, mecânicas, modelo polar, pesos do matcher (threshold 0.7)
├── sigils.json   → 29 sigils (family, element, svgPath/text, render)
├── signs.json    → 38 signs (family/categoria, semântica, svgPath, render)
├── dyes.json     → magical dyes (kind, color, effect)
├── grammar.json  → gramática de dedução (elements, operators, interactions, stability, power)
└── spells.json   → catálogo (recipes) — atualmente VAZIO, a ser repovoado
```

### Arte vetorizada (SVG)

Sigils e signs são **auto-vetorizados** das imagens em `assets/images/{sigils,signs}/` via **potrace**:

- `npm run vectorize:sigils` → [tools/vectorize-sigils.cjs](tools/vectorize-sigils.cjs)
- `npm run vectorize:signs` → [tools/vectorize-signs.cjs](tools/vectorize-signs.cjs)

Os paths são centralizados (translate `-50` + recenter por bounding box quando necessário) no viewBox `-50 -50 100 100` e marcados com `render:"fill"` (desenhados preenchidos, `fill-rule:evenodd`, tingidos via `currentColor`). Sigils sem arte usam stroke ou `text`. `assets/` também guarda as imagens usadas pelas docs.

### Objeto de composição (contrato UI ↔ engine)

```json
{
  "name": "Watershot Seal",
  "ring": { "closed": true, "doubled": false },
  "core": { "id": "c1", "type": "water", "x": 0, "y": 0, "rotation": 0, "scale": 1, "inverted": false },
  "components": [
    { "id": "c2", "type": "column", "role": "sign",  "x": 0, "y": -150, "rotation": 0, "scale": 1, "inverted": false },
    { "id": "c3", "type": "fire",   "role": "sigil", "x": 80, "y": 0,   "rotation": 0, "scale": 1, "inverted": false }
  ],
  "linkCount": 0,
  "dyes": ["blood"]
}
```

Coordenadas: **px cartesianas centradas na origem** na UI; o engine converte para **polar** (`toPolar(x,y) = atan2(x,-y)`, 0° = norte, horário). `computeDirectionalBias` usa a mesma forma `atan2(vx,-vy)` (caso contrário o desvio sai espelhado — foi um bug real). O mesmo formato é usado por **Export/Import (JSON)**.

---

## 7. Pipeline de análise → `analyze(composition)`

`analyze()` retorna **seções estruturadas** (consumidas por [ResultPanel.jsx](src/components/ResultPanel.jsx), que mostra tudo num só painel):

```
ENTRADA: composition

1. VALIDADE        regras blocking/inactive/warning/info (seção 2)
2. GEOMETRIA       computeSymmetry · computeDirectionalBias · computePower · tilt
3. SIGILS          lista cada sigil (nome, família, elemento, descrição, core/extra)
4. SIGNS           agrupa por tipo+inversão (nome, categoria, efeito, count, invertível)
5. EFEITO          deduceWith(grammar, …) → frase + breakdown + notes/warnings
6. SIMILAR SPELLS  buildSignature → matchSpell(spells.json) → match/nearest
                   (catálogo vazio ⇒ "nada a comparar")
7. DYES            resolve composition.dyes → nome + efeito
8. OUTROS          estabilidade, simetria, balanço, potência(+label), flags
                   (invertidos, inclinados→spin, decorativo), contagens, ring
```

O resultado tem a forma `{ name, valid, active, status, issues[], sigils[], signs[], deduction, similar, dyes[], analysis }`.

---

## 8. Gramática composicional (dedução) → [`data/grammar.json`](data/grammar.json)

Além de reconhecer spells do catálogo, o app **deduz** o efeito de qualquer composição — inclusive inédita.

```
efeito = substância(sigil)
         transformada por operadores(signs)
         direcionada por orientação/balanço
         escopada por target · escalada por potência
         estabilizada por simetria · negada por inversão
```

Cada sign é um **operador** com um `kind`:

| kind | papel | exemplos |
|------|-------|----------|
| `form` | molda o canal de saída | column→feixe, dispersion→vaza, bolt→projéteis, rain→chuva, orb→esfera |
| `transmute` | muda o estado da substância | weave→fita, billowing→nuvem, crush→pó, enlarge→cresce/encolhe |
| `motion` | adiciona movimento | levitation, float, dancing_puppet |
| `direction` | mira/atrai | region, pull (invertido=empurra; angulado=vórtice) |
| `target` | escopo | window=próprio, diamond=vizinhos, crosshair=área, sights_set=alvo |
| `power` | intensidade | convergence=foca/endurece, radial=atenua |
| `support` | habilita outro operador | collection/gather alimenta billowing |
| `special` | efeitos compostos | vision+eye+bend=ocultar; repetition; purify; link; bind; cool; glaives |

**Pipeline:** substância (todos os sigils) → cláusula primária (`transmute` > `form` > bruto) → direção (balanço ou `defaultDirection`) → motion/target/power/special → interações (notes/warnings) → estabilidade/potência.

`deduceWith(grammar, sigilMap, signMap, composition)` é **puro** (dados injetados) e testado isoladamente.

---

## 9. Funcionalidades do app

- **Compor por arrasto/clique:** paleta de sigils (por família) e signs (por categoria), com **busca por nome** e **seções recolhíveis**.
- **Múltiplos sigils** no mesmo seal; "↦ to center" promove um sigil/sign-central a core.
- **Conjuring ink:** painel para misturar dyes.
- **Nome do spell:** vai no JSON exportado e numa faixa no topo da imagem copiada.
- **Export (JSON)** / **Import (JSON)** (formato `wha-spell@1`) e **Copy image** (SVG→PNG no clipboard).

---

## 10. Arquitetura e restrição pura vs. JSON

```
src/
├── engine/
│   ├── data.js       → importa os JSON (Vite) e indexa (SIGILS, SIGNS, DYES, maps)
│   ├── geometry.js   → polar/simetria/balanço/potência  (PURO, sem JSON)
│   ├── deduce.js     → deduceWith(...)                    (PURO, sem JSON)
│   └── analyze.js    → liga o JSON e orquestra as seções da análise
├── components/       → Palette · GlyphCanvas · InkPanel · ResultPanel
└── App.jsx           → estado da composição + toolbar (ring, export/import, copy image, clear)
```

> **Restrição crítica:** os testes rodam em Node puro, onde `import x from './x.json'` falha. Por isso `geometry.js` e `deduce.js` **não importam JSON** — recebem os dados por parâmetro. `data.js`/`analyze.js` fazem o binding (estilo Vite). **Não** adicione import de JSON a `geometry.js`/`deduce.js`.

### Testes (`npm test`, 25)

geometria · integridade de dados (svgPath não-vazio, refs de spell válidas) · dedução, incluindo **cobertura**: todo sign tem operador em `grammar.json`, todo elemento de sigil tem entrada em `grammar.json`.

---

## 11. Estado e limitações

- **`spells.json` está vazio** (catálogo a ser repovoado com spells válidos). Enquanto isso, a seção "Similar spells" informa que não há nada a comparar e a dedução por partes continua respondendo.
- Formas SVG vêm das imagens (fan-wiki), não do mangá oficial; são fiéis o suficiente para render/análise.
- Detecção de **spin** é qualitativa (presença de signs inclinados), não um cálculo de direção fina.
- Matching usa o sigil **primário**; spells multi-sigil ainda não somam no score (a dedução, sim, contempla todos).

---

*Fontes: [docs/magic.md](docs/magic.md), [docs/sigils.md](docs/sigils.md), [docs/signs.md](docs/signs.md), [docs/magical-dye.md](docs/magical-dye.md), [docs/forbidden-magic.md](docs/forbidden-magic.md), [docs/spells.md](docs/spells.md) e as imagens em `assets/images/`.*
