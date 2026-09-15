import assert from "node:assert/strict";
import test from "node:test";

import {
    getItemLibraryIdentity,
    planItemLibraryDuplicates
} from "../module/utils/item-library-duplicates.mjs";

const item = (id, name, type = "skill", specialization = "") => ({
    id,
    name,
    type,
    system: { specialization }
});

test("identidade ignora acentos e caixa, mas preserva especialização de perícia", () => {
    assert.equal(
        getItemLibraryIdentity(item("a", "História", "skill", "Roma")),
        getItemLibraryIdentity(item("b", "historia", "skill", "roma"))
    );
    assert.notEqual(
        getItemLibraryIdentity(item("a", "História", "skill", "Roma")),
        getItemLibraryIdentity(item("b", "História", "skill", "Grécia"))
    );
});

test("modo seguro ignora documento já existente", () => {
    const existing = [item("old", "Furtividade")];
    const incoming = [item(null, "Furtividade"), item(null, "Acrobacia")];
    const plan = planItemLibraryDuplicates(incoming, existing, "skip");

    assert.deepEqual(plan.toCreate.map(entry => entry.name), ["Acrobacia"]);
    assert.deepEqual(plan.ignored.map(entry => entry.name), ["Furtividade"]);
    assert.equal(plan.toUpdate.length, 0);
});

test("modo atualizar reutiliza o ID do documento existente", () => {
    const plan = planItemLibraryDuplicates(
        [item(null, "Furtividade")],
        [item("old", "Furtividade")],
        "update"
    );

    assert.equal(plan.toUpdate[0]._id, "old");
    assert.equal(plan.toCreate.length, 0);
});

test("modo criar preserva todas as entradas, inclusive nomes repetidos", () => {
    const incoming = [item(null, "Furtividade"), item(null, "Furtividade")];
    const plan = planItemLibraryDuplicates(incoming, [], "create");

    assert.equal(plan.toCreate.length, 2);
    assert.equal(plan.ignored.length, 0);
});

test("duplicações internas são ignoradas nos modos seguros", () => {
    const incoming = [item(null, "Furtividade"), item(null, "Furtividade")];
    const plan = planItemLibraryDuplicates(incoming, [], "skip");

    assert.equal(plan.toCreate.length, 1);
    assert.equal(plan.ignored.length, 1);
});
