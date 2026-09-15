import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
    buildWorldItemFolderChoices,
    getImportFolderName,
    getUniqueWorldCompendiumName,
    slugifyWorldCompendiumName
} from "../module/utils/item-library-destination.mjs";

test("nome amigável produz identificador técnico seguro para compêndio mundial", () => {
    assert.equal(slugifyWorldCompendiumName("Perícias da Minha Campanha"), "pericias-da-minha-campanha");
    assert.equal(slugifyWorldCompendiumName("  ***  "), "biblioteca");
});

test("identificador de compêndio mundial não colide com coleção existente", () => {
    assert.equal(
        getUniqueWorldCompendiumName("Perícias", ["world.pericias", "world.pericias-2"]),
        "pericias-3"
    );
});

test("pasta automática usa o nome do arquivo sem sua extensão", () => {
    assert.equal(getImportFolderName("vantagens-marciais.adq"), "Importação - vantagens-marciais");
});

test("seletor de pastas do mundo preserva a hierarquia", () => {
    const choices = buildWorldItemFolderChoices([
        { id: "child", name: "Secundária", type: "Item", folder: "root" },
        { id: "root", name: "Bibliotecas", type: "Item", folder: null },
        { id: "actor", name: "Atores", type: "Actor", folder: null },
        { id: "packed", name: "Interna", type: "Item", pack: "gum.skills", folder: null }
    ]);

    assert.deepEqual(choices.map(choice => [choice.id, choice.label]), [
        ["root", "Bibliotecas"],
        ["child", "— Secundária"]
    ]);
});

test("interface oferece os três destinos previstos", () => {
    const source = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");

    assert.match(source, /<option value="world">Itens do mundo<\/option>/);
    assert.match(source, /value="pack:\$\{escapeImportHTML\(pack\.collection\)\}"/);
    assert.match(source, /<option value="new-pack">Criar novo compêndio mundial<\/option>/);
});

test("importação no mundo sempre atribui uma pasta aos documentos", () => {
    const source = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
    const worldImport = source.slice(
        source.indexOf("async function importToWorldItems"),
        source.indexOf("async function createWorldItemCompendium")
    );

    assert.match(worldImport, /itemData\.folder = folderId \|\| rootFolderId/);
    assert.match(worldImport, /planItemLibraryDuplicates\(incomingDocuments, existingDocuments, duplicateMode\)/);
    assert.match(worldImport, /await Item\.createDocuments\(plan\.toCreate, options\)/);
});

test("novo compêndio é criado no mundo e aceita Itens", () => {
    const source = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
    const createPack = source.slice(
        source.indexOf("async function createWorldItemCompendium"),
        source.indexOf("async function ensureWorldItemFolderPath")
    );

    assert.match(createPack, /type: "Item"/);
    assert.match(createPack, /package: "world"/);
    assert.match(createPack, /createCompendium/);
});

test("importação de biblioteca exige permissão de Mestre", () => {
    const source = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");
    const entrypoint = source.slice(source.indexOf("export async function importFromJson"), source.indexOf("input.type"));

    assert.match(entrypoint, /!game\.user\?\.isGM/);
});

test("aba Itens oferece o importador diretamente ao Mestre", () => {
    const source = readFileSync(new URL("../module/apps/item-library-directory.js", import.meta.url), "utf8");

    assert.match(source, /Hooks\.on\("renderItemDirectory", renderItemLibraryImportButton\)/);
    assert.match(source, /class="gum-item-library-import"/);
        assert.match(source, /button\.addEventListener\("click", \(\) => importFromJson\(\)\)/);
    assert.match(source, /if \(!game\.user\?\.isGM\) return/);
});

test("prévia explica duplicações e relatório apresenta todos os resultados", () => {
    const source = readFileSync(new URL("../module/apps/importers.js", import.meta.url), "utf8");

    assert.match(source, /<option value="skip">\$\{ITEM_LIBRARY_DUPLICATE_MODES\.skip\}<\/option>/);
    assert.match(source, /<option value="update">\$\{ITEM_LIBRARY_DUPLICATE_MODES\.update\}<\/option>/);
    assert.match(source, /<option value="create">\$\{ITEM_LIBRARY_DUPLICATE_MODES\.create\}<\/option>/);
    assert.match(source, /title: "Resultado da Importação"/);
    assert.match(source, /Criados:[\s\S]*Atualizados:[\s\S]*Ignorados:[\s\S]*Falharam:/);
});
