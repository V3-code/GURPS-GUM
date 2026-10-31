import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const template = fs.readFileSync(new URL("../templates/items/effect-sheet.hbs", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles/item-sheet.css", import.meta.url), "utf8");

test("valor do modificador de rolagem ocupa uma linha própria", () => {
    const primaryGrid = template.slice(
        template.indexOf('class="effect-premium-grid effect-premium-grid-entry-primary"'),
        template.indexOf('class="effect-premium-grid effect-premium-grid-entry-settings"')
    );

    const descriptionIndex = primaryGrid.indexOf("roll_modifier_entries.{{entry.index}}.label");
    const capIndex = primaryGrid.indexOf("roll_modifier_entries.{{entry.index}}.cap");
    const valueIndex = primaryGrid.indexOf("effect-roll-modifier-value-field");
    assert.ok(descriptionIndex >= 0);
    assert.ok(capIndex > descriptionIndex);
    assert.ok(valueIndex > capIndex);
    assert.match(primaryGrid, /effect-roll-modifier-value-input/);
    for (const helper of ["naopossui", "possuiAlgum", "possuiTodos", "equipado", "condicaoAtiva", "status", "nivel", "quantidade", "atributo"]) {
        assert.match(primaryGrid, new RegExp(`<code>${helper}</code>`));
    }
});

test("campo de valor atravessa a grade e recebe mais espaço horizontal", () => {
    assert.match(styles, /\.effect-premium-grid-entry-primary \{[\s\S]*?grid-template-columns: minmax\(280px, 1fr\) minmax\(110px, 0\.28fr\)/);
    assert.match(styles, /\.effect-roll-modifier-value-field \{[\s\S]*?grid-column: 1 \/ -1;/);
    assert.match(styles, /\.effect-roll-modifier-value-input \{[\s\S]*?min-height: 38px;[\s\S]*?ui-monospace/);
});

test("campos de expressão do efeito são redimensionáveis manualmente", () => {
    assert.match(template, /textarea[\s\S]*?effect-roll-modifier-value-input[\s\S]*?roll_modifier_entries\.\{\{entry\.index\}\}\.value/);
    for (const field of [
        "combat_attack_value",
        "combat_parry_value",
        "combat_block_value",
        "roll_modifier"
    ]) {
        assert.match(template, new RegExp(`textarea[^>]*effect-resizable-code-input[^>]*name="system\\.actions\\.\\{\\{action\\.index\\}\\}\\.${field}"`));
    }
    assert.match(template, /textarea[^>]*effect-resizable-code-input[^>]*name="system\.resistanceRoll\.modifier"/);
    assert.match(styles, /\.effect-resizable-code-input \{[\s\S]*?resize: vertical;/);
});
