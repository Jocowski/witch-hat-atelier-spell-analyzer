# docs/spells

Per-spell documentation written by the **/spell-analyzer** skill (and for community
spells designed via **/spell-creator**). One markdown file per spell, named in
`Title_Case_With_Underscores.md` to match `assets/images/spells/`.

Each file follows the template in
[.claude/skills/spell-analyzer/references/spell-doc-template.md](../../.claude/skills/spell-analyzer/references/spell-doc-template.md):
YAML frontmatter (type, origin canon/community, forbidden flag, recipe, symmetry,
source, image/json paths) followed by the full analysis — validity, composition,
deduced effect, how each part shapes it, how to draw it, usage ideas, variations,
similar spells, limitations, and a Reproduction section with the importable
`wha-spell@1` JSON.

Reproduction assets (screenshots, app JSON exports) live in
[../../assets/spells/](../../assets/spells/).
