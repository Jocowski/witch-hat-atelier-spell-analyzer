# Witch Hat Atelier — Análise do Sistema Mágico para o Simulador

> Documento-fonte da lógica do simulador. Consolida as regras de [docs/](docs/) e as traduz num modelo de dados (`data/*.json`) que o app de front-end consome para **renderizar**, **validar** e **interpretar** spells.

---

## 1. Visão geral do sistema

Magia em Witch Hat Atelier é desenhada, não falada. Toda magia é um **spell** (glyph) composto por três camadas:

| Camada | Papel | Onde fica |
|--------|-------|-----------|
| **Sigil** | Define o **elemento** (fogo, água, terra, vento, luz…) | Centro (raio 0) |
| **Signs (keystones)** | Definem a **forma** com que o elemento se manifesta | Anéis ao redor do centro |
| **Ring** | **Ativa** o spell ao fechar | Círculo externo |

**Princípio fundamental:** `efeito = elemento (sigil) × forma (signs) × ativação (ring)`.

A mesma combinação de signs muda completamente de comportamento conforme o sigil (ex.: *dispersion* + água = água transborda; *column* + água = jato de mangueira). É essa multiplicação que o simulador modela.

---

## 2. As regras (motor lógico) → [`data/rules.json`](data/rules.json)

### 2.1 Regras de validação

| id | Severidade | Regra | Falha → |
|----|-----------|-------|---------|
| `ring-closed` | **blocking** | O ring precisa estar fechado | Spell preparado mas **inativo** |
| `has-center` | **blocking** | Precisa de sigil OU sign-central | Glyph sem núcleo → inválido |
| `has-signs` | warning | ≥ 1 sign | Elemento sem forma → efeito bruto/nulo |
| `symmetry-stability` | info | Radial/bilateral = estável | Assimétrico = válido mas instável |
| `balance-direction` | info | Signs desbalanceados desviam o efeito | Lição do **Watershot** |
| `size-power` | info | Maior = mais forte; limpo = dura mais | — |

### 2.2 Mecânicas avançadas

- **Signs invertidos** — virar um sign produz o efeito oposto. Dois spells iguais e opostos se cancelam. Ex.: *Floating Expansion* (crescer) ↔ *Spell of Reduction* (encolher); *Wall Breaker* (pulverizar) ↔ *Integration* (reintegrar).
  - ⚠️ **Exceção:** a *Scalewolf Curse* **não** é revertida por inversão — exige um spell diferente (*Anti Scalewolf Curse*). Modelado via flag `reversibleByInversion`.
- **Spells ligados** — conectados por linha, somam efeitos; se idênticos, multiplicam potência. Vários pequenos ligados > um grande.
- **Toggle por ring** — spell em duas metades (objetos separados); ativa ao tocar (*Sylph Shoes*, *Glowstone Path*).
- **Glyphs aninhados** — spell dentro de spell; efeitos combinam (*Serpent's Bed of Sand* = billowing-collection + wall-breaker + repetition-seal).
- **Anel duplo** — segundo ring envolvendo o spell, com outro spell preenchendo o espaço entre os anéis.

### 2.3 Modelo de coordenadas

Toda composição usa **coordenadas polares** relativas ao centro:

```
radius: 0 (centro/sigil) ────────────► 1 (ring externo)
angle:  0° = norte, sentido horário
```

Cada componente colocado carrega: `{ type, role, ring, angle, radius, rotation, scale, inverted }`.
A **rotação** e o **balanço** (scale/count por direção) influenciam a direção do efeito.

> **Convenção de ângulo (implementação):** a UI guarda posições em coordenadas cartesianas em px centradas na origem; o engine converte para polar com `toPolar(x,y) = atan2(x, -y)` (0° = norte, horário). Qualquer cálculo de ângulo resultante (ex.: o vetor de `computeDirectionalBias`) **deve** usar a mesma forma `atan2(vx, -vy)` — caso contrário o desvio direcional sai espelhado (foi um bug real, corrigido).

---

## 3. Sigils (elementos) → [`data/sigils.json`](data/sigils.json)

| id | Nome | Categoria | Elemento | Forma canônica |
|----|------|-----------|----------|----------------|
| `fire` | Fire | principal | fogo | chama/árvore para cima |
| `water` | Water | principal | água | "S"/onda dupla |
| `earth` | Earth | principal | terra | barra + triângulo invertido (·▽·) |
| `wind` | Wind | principal | ar | "S" alongado de fluxo |
| `light` | Light | principal | luz | asterisco de 8 raios + losango |
| `wind_underfoot` | Wind Underfoot | variante | ar | espiral dupla (∞) |
| `aeriforms` | Aeriforms | variante | ar | vento que sustenta o ar |
| `whorling_wind` | Whorling Wind | variante | ar | vento com redemoinho |
| `crystal` | Crystal | menor | cristal | cristal facetado |
| `repetition_sigil` | Repetition | sign-as-sigil | tempo | espiral + linha |
| `vision_sigil` | Vision | sign-as-sigil | luz | asterisco 8 pontas |
| `billowing_sigil` | Billowing | sign-as-sigil | transmutação | flor de 4 pétalas |
| `unknown_sigil` | Unknown/Forbidden | desconhecido | — | marca neutra |

> **Sign-as-sigil:** *vision*, *repetition* e *billowing* podem ocupar o centro como núcleo, apesar de tecnicamente serem signs.

---

## 4. Signs (keystones) → [`data/signs.json`](data/signs.json)

Cada sign tem: forma SVG, efeito, `effectTags`, `invertible`, `canBeCenter`, `surrounds`, sinergias e o que afeta sua direção.

| id | Glyph | Efeito (resumo) | Inv.? | Centro? | Circunda? |
|----|-------|-----------------|:-----:|:-------:|:---------:|
| `column` | ⊤ | Coluna/feixe para cima; desbalanço desvia | ✓ | | |
| `dispersion` | ⊥◡ | Vaza/dispersa em todos os lados | ✓ | | |
| `levitation` | ↑̲ | Levita; direção pelo apontamento | ✓ | | |
| `pull` | ⇓ | Atrai mesmo-elemento; angulado = vórtice | ✓ | | |
| `crush` | ∧∧ | Pulveriza (terra); invertido reintegra | ✓ | | |
| `float` | ≀≀≀ | Faz o objeto flutuar | | | |
| `direction` | ∧ | Controla direção do efeito | ✓ | | |
| `convergence` | ▽ | Foca/compacta/enrijece | ✓ | | |
| `diamond` | ◇ | Afeta objetos **próximos** | | | |
| `window` | ⊞ | Afeta o **próprio** objeto | | ✓ | |
| `collection` | ✕ | Coleta material ao redor | ✓ | | ✓ |
| `crosshair` | + | Área de efeito / dissipa aspecto | | | |
| `radial` | ∩ | Atenua potência (fogo→calor) | | | |
| `bolt` | ◆ | Manifesta projéteis | | | |
| `billowing` | ✿ | Converte em nuvem | | ✓ | |
| `eye` | 👁 | Sombra/absorve luz | | | |
| `bend` | ⌐ | Sombra/curva luz | | | |
| `repetition` | 🌀 | Rebobina ao estado anterior | ✓ | ✓ | |
| `vision` | ✳ | Manipula luz/invisibilidade | | ✓ | |
| `weave` | ∪ | Transforma sólido em fita | | | ✓ |
| `enlarge` | [ ] | Cresce/encolhe | ✓ | ✓ | |
| `rain` | ▦↕ | Gera magia como chuva | | | ✓ |
| `bird` | 🜲 | Projeção voadora de pássaro | | | ✓ |
| `dancing_puppet` | ✺ | Faz objetos dartearem (vento) | | | ✓ |
| `animal_signs` | 🐾 | Decorativo, sem efeito | | | |
| `unknown_sign` | ? | Placeholder não-identificado | | | |

> **Convenção de orientação:** `inward` = lado apontado para o centro; `outward` = para fora. A maioria dos signs direcionais (direction, pull, levitation) tem o efeito controlado pela rotação relativa ao centro.

---

## 5. Catálogo de spells → [`data/spells.json`](data/spells.json)

55 spells catalogados como "receitas" (`composition: { core, signs[], symmetry }`). `confidence` indica quão bem o glyph é conhecido na fonte (`high`/`medium`/`low`/`theoretical`/`unknown`).

### Por categoria

- **Fire (3):** Pyreball Seal, Snugstone Spell, Phantasmal Fireball
- **Water (7):** Watershot, Water Bolt, Rising Platform, Rising Wave, Rainbringer, Water Horse, Water Pen
- **Earth (6):** Wall Breaker, Integration, Boulder Stretch Rope, Sand Bridge, Sand Cage, Serpent's Bed of Sand
- **Wind (7):** Skysoaring, Sylph Shoes, Grasping Wind, Wind Wall, Flying Puppet, Pegasus Carriage, Make Air
- **Light (4):** Light Beam, Floatglow Lamp, Bird of Light Beacon, Light Tracer
- **Mixed (4):** Rainflinger, Floating Drops, Beast Repellent, Cloak Spell
- **Niche (12):** Billowing Collection, Crystal Shard, Crystal Ribbon, Floating Expansion, Spell of Reduction, Gathering Shadows, Repetition Seal, Reverse Time, Mirror, Windowway, Capture Pennant, Sealchair, Inverted Scalewolf
- **Unknown (4):** Memory Erasure, Tracking, Beldaruit's Smoke Sculpture, Spike
- **Forbidden (6):** Forbidden Flames, Scalewolf Curse, Anti Scalewolf, Illusory Labyrinth, Petrification, Twin Bottle's

### Pares invertidos (mostram a mecânica de inversão)

| Normal | Invertido | Diferença |
|--------|-----------|-----------|
| Wall Breaker Seal | Integration | crush normal ↔ crush invertido |
| Floating Expansion | Spell of Reduction | enlarge p/ fora + window ↔ enlarge p/ dentro + diamond |

### Exemplos canônicos de composição (validados visualmente)

- **Watershot** = `water` + 4× `column` (radial) → jato p/ cima. *Column mais longo = desvio.*
- **Wall Breaker** = `earth` + 2× `column` (lados) + 2× `crush` (topo/base), bilateral → pulveriza.
- **Grasping Wind** = `wind` + 6× `pull` (inward, radial) → suga; angulado = vórtice.
- **Sylph Shoes** = `wind_underfoot` + 6× `convergence` + 6× `levitation` (alternados, radial), **split/toggle**.
- **Serpent's Bed of Sand** = **nested**: billowing-collection ⊂ wall-breakers ⊂ repetition-seal.

---

## 6. Modelo de dados (contrato app ↔ JSON)

```
data/
├── rules.json   → regras de validação, mecânicas, modelo de coordenadas, pesos do matcher
├── sigils.json  → núcleos elementais + SVG + variantes
├── signs.json   → keystones + SVG + semântica (effectTags, invertible, canBeCenter…)
└── spells.json  → receitas para o matcher (core + signs[] + symmetry + effect)
```

Todos os SVG usam `viewBox="-50 -50 100 100"`, `stroke="currentColor"`, traço em orientação canônica → renderizáveis diretamente e rotacionáveis/escaláveis pela posição polar.

### Objeto de composição (o que o app monta)

```json
{
  "ring": { "closed": true, "doubled": false },
  "core": { "type": "water", "role": "sigil" },
  "components": [
    { "type": "column", "role": "sign", "ring": 1, "angle": 0,   "rotation": 0,   "scale": 1, "inverted": false },
    { "type": "column", "role": "sign", "ring": 1, "angle": 90,  "rotation": 90,  "scale": 1, "inverted": false },
    { "type": "column", "role": "sign", "ring": 1, "angle": 180, "rotation": 180, "scale": 1, "inverted": false },
    { "type": "column", "role": "sign", "ring": 1, "angle": 270, "rotation": 270, "scale": 1, "inverted": false }
  ]
}
```

---

## 7. Algoritmo de reconhecimento e interpretação

```
ENTRADA: composition (núcleo + componentes + ring)

1. VALIDAÇÃO (rules.json, regras blocking primeiro)
   ├─ ring fechado?              não → "preparado, inativo"
   ├─ núcleo presente?           não → "inválido: sem núcleo"
   └─ ≥1 sign?                   não → warning

2. ANÁLISE GEOMÉTRICA
   ├─ computeSymmetry()         → radial | bilateral | asymmetric
   ├─ computeDirectionalBias()  → vetor de direção do efeito (por scale/count/rotation)
   └─ computePower()            → f(overallScale, neatness, linkCount)

3. ASSINATURA (recipe)
   signature = { core, multiset(signs por tipo+contagem+inversão), symmetry }

4. MATCHING (rules.json.matching)
   para cada spell em spells.json:
     score = 0.4·sigilMatch + 0.4·signSetMatch + 0.1·symmetryMatch + 0.1·placementMatch
   melhor = argmax(score)

5. RESULTADO
   ├─ score ≥ 0.7 → "Spell reconhecido: <nome>" + efeito + avisos
   └─ score < 0.7 → "Spell desconhecido" + efeito DERIVADO da combinação
                     (sigil.element × signs.effectTags × direção/potência)
```

### Interpretação livre (sem match)

Quando nenhum spell bate, o efeito é **gerado** combinando:
`elemento do sigil` + `effectTags dos signs` + `direção/potência calculadas`.
Ex.: `fire` + `bolt` + `direction(front)` → "projéteis de fogo disparados para frente" (mesmo que esse spell não exista no catálogo).

---

## 8. Estratégia de entrada do desenho (decisão de produto)

Há dois caminhos para o usuário "desenhar" — o app pode oferecer ambos:

| Modo | Como funciona | Reconhecimento | Esforço |
|------|---------------|----------------|---------|
| **A — Compor (arrastar formas)** | Paleta de sigils/signs; usuário arrasta para a tela, posiciona/rotaciona/escala; fecha o ring | **Determinístico** — componentes já são conhecidos; matcher roda direto sobre a composição | Baixo, confiável |
| **B — Desenhar à mão** | Canvas livre + caneta | Requer reconhecimento de formas (template-matching tipo `$1 recognizer`, ou ML) → mapeia traços para signs, depois roda o matcher | Alto, sujeito a erro |

**Recomendação:** começar pelo **Modo A** (composição por arrasto) — entrega o simulador completo de validação/interpretação com confiabilidade total — e adicionar o **Modo B** depois como camada de reconhecimento sobre a mesma `composition`. Os dois convergem para o mesmo objeto de composição, então o motor lógico é compartilhado.

---

## 9. Arquitetura de aplicação proposta

```
witch-hat-simulator/
├── data/                      # JSONs (fonte da verdade) — já criados
├── src/
│   ├── engine/                # lógica pura, sem UI (testável)
│   │   ├── loadData.ts        # carrega/normaliza os JSON
│   │   ├── validate.ts        # regras blocking/warning/info
│   │   ├── geometry.ts        # symmetry, directionalBias, power
│   │   ├── signature.ts       # composition → recipe
│   │   ├── matcher.ts         # recipe × spells.json → score
│   │   └── interpret.ts       # efeito derivado quando sem match
│   ├── components/
│   │   ├── GlyphCanvas        # tela polar (SVG) com ring + anéis-guia
│   │   ├── Palette            # paleta de sigils/signs (arrasto)
│   │   ├── ComponentNode      # símbolo posicionável (drag/rotate/scale)
│   │   └── ResultPanel        # válido? nome + efeito + avisos
│   └── App
└── (Vite + React ou Vue)
```

- **Render:** SVG (os `svgPath` dos JSON) sobre uma malha polar. Leve, escalável, sem assets.
- **Engine isolado** da UI → testável e reaproveitável caso o Modo B (desenho livre) entre depois.
- **Sem backend** necessário: tudo roda no cliente a partir dos JSON.

---

## 10. Lacunas e decisões em aberto

- Vários glyphs têm `confidence: low/unknown` (forbidden/unknown) — o catálogo os inclui como placeholders; o matcher deve rebaixar o score deles.
- Formas SVG são **estilizações consistentes**, não cópias exatas do mangá (suficientes para render e matching).
- Sigils elementais aparecem só dentro de spells completos na fonte; as formas centrais foram inferidas das imagens analisadas.
- **A definir com o usuário:** framework (React vs Vue), e se o Modo B (desenho à mão) entra na v1.

---

## 11. Gramática composicional (motor de dedução) → [`data/grammar.json`](data/grammar.json)

Além de *reconhecer* spells do catálogo, o app **deduz** o efeito de qualquer composição a partir das peças — inclusive combinações inéditas. Isso é o que aparece no painel quando o **ring é fechado** (spell ativo). Quando o ring está **aberto**, o painel mostra a *comparação* com spells do catálogo (analysis).

### 11.1 Princípio

```
efeito = substância(sigil)
         transformada por operadores(signs)
         direcionada por orientação/balanço
         escopada por target
         escalada por potência
         estabilizada por simetria
         negada por inversão
```

O **sigil dá a substância** (`flame`, `water`, `earth/stone/sand`, `air`, `light`, `crystal`, `time`, …). Cada **sign é um operador** com um `kind`:

| kind | papel | exemplos |
|------|-------|----------|
| `form` | molda o canal de saída | column→feixe, dispersion→vazamento, bolt→projéteis, rain→chuva, bird→pássaro |
| `transmute` | muda o estado da substância | weave→fita, billowing→nuvem, crush→pó, enlarge→cresce/encolhe |
| `motion` | adiciona movimento | levitation, float, dancing_puppet |
| `direction` | mira/atrai | direction, pull (invertido=empurra; angulado=vórtice) |
| `target` | define o escopo | window=próprio objeto, diamond=vizinhos, crosshair=área |
| `power` | ajusta intensidade | convergence=foca/endurece, radial=atenua |
| `support` | habilita outro operador | collection alimenta billowing |
| `special` | efeitos compostos | vision+eye+bend=ocultar; repetition=reverter |

### 11.2 Pipeline de montagem

1. **Substância** vem do `core` (`grammar.elements[element]`).
2. **Cláusula primária:** `transmute` tem prioridade sobre `form`; sem nenhum, usa o comportamento bruto do elemento.
3. **Direção:** balanço posicional (`computeDirectionalBias`, ≥2 signs) → desvio; senão, `defaultDirection` de column/levitation (cima) ou dispersion (fora).
4. **Motion → target → power → special** anexados como cláusulas.
5. **Interações** (`grammar.interactions`) viram *notes* (sinergias) ou *warnings* (dependências faltando).
6. **Estabilidade** ← simetria; **potência** ← radial/convergence/tamanho.

### 11.3 Por que os spells canônicos são assim (base da gramática)

| Spell | Decomposição | Lição codificada |
|-------|--------------|------------------|
| Watershot vs Light Beam | água+column / luz+column | FORM é independente do elemento (mesmo "beam") |
| Water Bolt | água+bolt+direction | operadores **compõem** (fragmenta + mira) |
| Wall Breaker vs Integration | terra+column+crush / crush **invertido** | INVERSÃO nega o operador (pulveriza↔reintegra) |
| Floating Expansion vs Reduction | window+enlarge / diamond+enlarge invertido | TARGET + INVERSÃO mudam o resultado |
| Snugstone | fogo+radial | POTÊNCIA: radial rebaixa fogo→calor |
| Grasping Wind | vento+pull(inward) | DIREÇÃO por orientação (vórtice se angulado) |
| Billowing Collection | billowing+collection | DEPENDÊNCIA: collection alimenta billowing |
| Gathering Shadows | vision+eye+bend | SINERGIA composta (ocultação) |

### 11.4 Exemplos de dedução (saída real do motor)

- `water + 4×column` → *"The water is projected as a tight column or beam, directed upward."*
- `fire + bolt + direction` (inédito) → *"The flame fragments into fast-flying bolts."* + nota: *Direction aims the bolts…*
- `fire + dispersion + radial` (inédito) → *"The flame leaks out and spreads on every side… tempered to a gentler intensity."* + nota radial→calor.
- `earth + enlarge + window` (inédito) → *"The earth/stone/sand grows far beyond its normal size. It affects only the object it is drawn on."*

### 11.5 Limitações atuais da dedução

- Direção fina de `direction` signs (todos-para-dentro→cima, pares opostos→só entre eles) é aproximada por balanço posicional; refinar lendo `rotation` de cada sign.
- A cláusula primária escolhe **um** transmute/form dominante; spells com múltiplos forms (raros) só listam o dominante no resumo (mas o *breakdown* lista todos).
- Sigils/ signs `unknown` produzem texto genérico (esperado).

---

## 12. Estado de implementação (v0.1)

- **App:** React + Vite, composição por arrasto. Ring **aberto por padrão**.
  - Ring **aberto** → painel "Analysis" (comparação com catálogo + nearest).
  - Ring **fechado** (ativo+válido) → painel "Effect" (dedução por partes + confirmação de match).
- **Engine** (`src/engine/`): `data` (carrega JSON) · `geometry` (polar/simetria/balanço/potência, **puro**) · `deduce` (`deduceWith` **puro** + binding em `analyze`) · `analyze` (validate→signature→match→deduce).
- **Testes** (`npm test`, 25): geometria, integridade de dados, e dedução (incl. cobertura: todo sign tem operador, todo elemento tem entrada).

---

*Fontes: [docs/magic.md](docs/magic.md), [docs/signs.md](docs/signs.md), [docs/sigils.md](docs/sigils.md), [docs/ring.md](docs/ring.md), [docs/advanced-magic.md](docs/advanced-magic.md), [docs/spells.md](docs/spells.md) e as imagens em `docs/**/images/`.*
