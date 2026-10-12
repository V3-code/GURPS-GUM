import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStatusCatalog,
  findConfiguredStatus,
  resolveStatusCatalogEntry
} from "../module/utils/status-catalog.mjs";

const configuredStatuses = [
  { id: "stunned", name: "Atordoado", img: "icons/stunned.svg" },
  { id: "blessed", label: "Bênção", icon: "icons/blessed.svg" }
];

test("status catalog reflects the current configured names and icons", () => {
  assert.deepEqual(buildStatusCatalog(configuredStatuses), [
    { id: "stunned", label: "Atordoado", img: "icons/stunned.svg" },
    { id: "blessed", label: "Bênção", img: "icons/blessed.svg" }
  ]);
});

test("status catalog localizes configured keys before presenting their technical ids", () => {
  const catalog = buildStatusCatalog(
    [{ id: "bleeding", name: "GUM.Statuses.bleeding", img: "icons/bleeding.svg" }],
    { localize: key => key === "GUM.Statuses.bleeding" ? "Sangrando" : key }
  );
  assert.deepEqual(catalog, [{ id: "bleeding", label: "Sangrando", img: "icons/bleeding.svg" }]);
});

test("status search resolves configured labels without case or accent sensitivity", () => {
  assert.equal(resolveStatusCatalogEntry("atordoado", configuredStatuses)?.id, "stunned");
  assert.equal(resolveStatusCatalogEntry("BENCAO", configuredStatuses)?.id, "blessed");
  assert.equal(resolveStatusCatalogEntry("stunned", configuredStatuses)?.label, "Atordoado");
});

test("status lookup rejects references that are no longer configured", () => {
  assert.equal(findConfiguredStatus("blessed", configuredStatuses)?.label, "Bênção");
  assert.equal(findConfiguredStatus("removed", configuredStatuses), null);
  assert.equal(resolveStatusCatalogEntry("Removido", configuredStatuses), null);
});
