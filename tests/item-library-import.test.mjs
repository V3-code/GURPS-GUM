import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    analyzeItemLibrary,
    getItemLibraryKindLabel,
    inferGCSLibraryKind
} from "../module/utils/item-library-import.mjs";

test("a extensão da biblioteca identifica o conteúdo sem consultar o destino", () => {
    const examples = {
        adq: "trait",
        skl: "skill",
        spl: "spell",
        eqp: "equipment",
        adm: "modifier",
        eqm: "eqp_modifier"
    };

    for (const [extension, kind] of Object.entries(examples)) {
        const result = analyzeItemLibrary({ rows: [{ name: "Exemplo" }] }, `biblioteca.${extension}`);
        assert.deepEqual(result.kinds, [kind]);
    }
});

test("JSON exportado pelo GUM é reconhecido pela estrutura documental", () => {
    const result = analyzeItemLibrary([
        { _id: "skill-1", name: "Furtividade", type: "skill", system: {} },
        { _id: "advantage-1", name: "Reflexos", type: "advantage", system: {} }
    ], "campanha.json");

    assert.equal(result.format, "foundry");
    assert.equal(result.isCompendiumJson, true);
    assert.equal(result.sections[0].rows.length, 2);
});

test("JSON documental sem IDs continua importável como novos itens", () => {
    const result = analyzeItemLibrary([
        { name: "Furtividade", type: "skill", system: {} }
    ], "campanha.json");

    assert.equal(result.isCompendiumJson, false);
    assert.equal(result.warnings.length, 1);
});

test("coleções nomeadas podem reunir tipos diferentes no mesmo arquivo", () => {
    const result = analyzeItemLibrary({
        skills: [{ name: "Furtividade", difficulty: "dx/a" }],
        spells: [{ name: "Luz", spell_class: "regular" }],
        equipment: []
    }, "biblioteca.json");

    assert.deepEqual(result.kinds, ["skill", "spell"]);
    assert.match(result.label, /Perícias/);
    assert.match(result.label, /Magias/);
});

test("biblioteca JSON com rows pode ser identificada por sua estrutura", () => {
    assert.equal(inferGCSLibraryKind([{ name: "Luz", spell_class: "regular" }]), "spell");
    assert.equal(analyzeItemLibrary({ rows: [{ name: "Luz", spell_class: "regular" }] }, "luz.json").kinds[0], "spell");
});

test("arquivo de personagem permanece no fluxo de Atores", () => {
    assert.throws(
        () => analyzeItemLibrary({ traits: [] }, "personagem.gcs"),
        /aba Atores/
    );
});

test("conteúdo ambíguo é recusado em vez de depender do nome do compêndio", () => {
    assert.throws(
        () => analyzeItemLibrary({ rows: [{ name: "Sem pistas" }] }, "biblioteca.json"),
        /identificar o tipo/
    );
    assert.equal(getItemLibraryKindLabel("trait"), "Vantagens e Desvantagens");
});

test("o importador não escolhe mais o tradutor pelo nome técnico do compêndio", () => {
    const source = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
    const importFlow = source.slice(
        source.indexOf("function prepareItemLibraryDocuments"),
        source.indexOf("function escapeImportHTML")
    );

    assert.doesNotMatch(importFlow, /packNameToType|pack\.metadata\.name/);
    assert.match(importFlow, /itemKind === "skill"/);
    assert.match(importFlow, /itemKind === "trait"/);
    assert.match(importFlow, /itemKind === "equipment"/);
});

test("sincronização de JSON não limita o tipo pelo nome do compêndio", () => {
    const source = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
    const synchronization = source.slice(source.indexOf("async function synchronizeCompendiumJson"));

    assert.doesNotMatch(synchronization, /expectedMappedType|allowedTypes/);
    assert.match(synchronization, /documento\(s\) sem um tipo de Item válido/);
});
