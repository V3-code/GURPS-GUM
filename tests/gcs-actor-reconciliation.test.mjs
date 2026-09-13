import test from "node:test";
import assert from "node:assert/strict";
import { buildGCSActorReconciliation } from "../module/utils/gcs-actor-reconciliation.mjs";

const item = (id, name, points, gcsId = id) => ({
  _id: id,
  name,
  type: "skill",
  system: { points },
  flags: { gum: { hybridImport: { gcsId, importedAt: "ontem" } } }
});

test("reconcilia itens do GCS pelo identificador estável", () => {
  const existing = [item("foundry-a", "Furtividade", 1, "gcs-a"), item("foundry-b", "Removida", 2, "gcs-b")];
  const incoming = [item("outro-id", "Furtividade", 2, "gcs-a"), item("gcs-c", "Nova", 1, "gcs-c")];
  const plan = buildGCSActorReconciliation(existing, incoming);

  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0].existing._id, "foundry-a");
  assert.deepEqual(plan.additions.map(entry => entry.name), ["Nova"]);
  assert.deepEqual(plan.removals.map(entry => entry.name), ["Removida"]);
});

test("não remove itens manuais e ignora metadados voláteis ao comparar", () => {
  const imported = item("foundry-a", "Furtividade", 1, "gcs-a");
  const incoming = item("outro-id", "Furtividade", 1, "gcs-a");
  incoming.flags.gum.hybridImport.importedAt = "hoje";
  const manual = { _id: "manual", name: "Anotação", type: "skill", system: {} };
  const plan = buildGCSActorReconciliation([imported, manual], [incoming]);

  assert.equal(plan.unchanged.length, 1);
  assert.equal(plan.updates.length, 0);
  assert.equal(plan.removals.length, 0);
});

test("usa tipo, nome e especialização como fallback apenas para itens já importados", () => {
  const legacy = item("legacy", "Armas de Fogo", 1, null);
  legacy.system.specialization = "Pistola";
  const incoming = item("incoming", "Armas de Fogo", 2, null);
  incoming.system.specialization = "Pistola";

  const plan = buildGCSActorReconciliation([legacy], [incoming]);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.additions.length, 0);
});