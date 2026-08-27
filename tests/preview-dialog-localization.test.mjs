import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const languages = {
  en: JSON.parse(await readFile(new URL("../lang/en.json", import.meta.url), "utf8")),
  "pt-BR": JSON.parse(await readFile(new URL("../lang/pt-BR.json", import.meta.url), "utf8"))
};

const lookup = (source, key) => key.split(".").reduce((current, part) => current?.[part], source);
const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
let activeLanguage = "en";
const createdMessages = [];
const infos = [];
const warnings = [];

globalThis.foundry = {
  applications: { ux: { TextEditor: { implementation: { enrichHTML: async source => source } } } },
  utils: { escapeHTML }
};
globalThis.TextEditor = foundry.applications.ux.TextEditor.implementation;
globalThis.game = {
  i18n: {
    localize: key => lookup(languages[activeLanguage], key) ?? key,
    format: (key, data = {}) => String(lookup(languages[activeLanguage], key) ?? key)
      .replace(/\{([^}]+)\}/g, (_match, name) => data[name] ?? `{${name}}`)
  },
  user: { id: "user" },
  journal: []
};
globalThis.ui = {
  notifications: {
    info: message => infos.push(message),
    warn: message => warnings.push(message),
    error: () => {}
  }
};
globalThis.ChatMessage = {
  create: async data => createdMessages.push(data),
  getSpeaker: ({ actor } = {}) => ({ actor: actor?.id ?? null })
};
globalThis.CONST = { CHAT_MESSAGE_STYLES: { OTHER: 0 } };

const { GumPreviewDialog } = await import("../module/apps/preview-dialog.js");

test("tipos e tags são localizados sem alterar valores mecânicos", () => {
  activeLanguage = "en";
  assert.equal(GumPreviewDialog.typeLabel("skill"), "Skill");
  assert.equal(GumPreviewDialog.typeLabel("unknown_type"), "UNKNOWN_TYPE");
  assert.equal(GumPreviewDialog.typeLabel(null), "Details");

  const tags = GumPreviewDialog.buildItemTags({
    type: "ranged_weapon",
    system: {
      damage_formula: "2d6+1", damage_type: "pi", accuracy: 4, range: "100/500", rof: "3", shots: "10+1",
      rcl: 2, min_strength: 9, quantity: 2, total_weight: 6, total_cost: 1200, ref: "B279"
    }
  });
  const byLabel = Object.fromEntries(tags.map(tag => [tag.label, tag.value]));
  assert.equal(byLabel.Damage, "2d6+1 pi");
  assert.equal(byLabel["Acc."], 4);
  assert.equal(byLabel.Range, "100/500");
  assert.equal(byLabel.RoF, "3");
  assert.equal(byLabel.Shots, "10+1");
  assert.equal(byLabel.Rcl, 2);
  assert.equal(byLabel.ST, 9);
  assert.equal(byLabel.Qty, "x2");
  assert.equal(byLabel.Weight, "6 kg");
  assert.equal(byLabel.Cost, "$1200");
  assert.equal(byLabel.REF, "B279");

  activeLanguage = "pt-BR";
  assert.equal(GumPreviewDialog.typeLabel("skill"), "Perícia");
  const triggerTags = GumPreviewDialog.buildItemTags({ type: "trigger", system: { code: "return true;" } });
  assert.deepEqual(triggerTags, [{ label: "Código", value: "Configurado" }]);
});

test("descrição vazia e card de chat usam o idioma ativo", async () => {
  activeLanguage = "en";
  assert.equal(await GumPreviewDialog.enrichDescription(""), "<i>No description.</i>");
  assert.equal(GumPreviewDialog.getItemDescription({ system: {} }), "<i>No description.</i>");

  createdMessages.length = 0;
  infos.length = 0;
  await GumPreviewDialog.sendToChat({
    title: "Broadsword",
    type: "Equipment",
    img: "icons/sword.webp",
    description: "<p>Sharp.</p>",
    tags: [{ label: "REF", value: "B271" }],
    sourceUuid: "Item.test"
  });

  assert.equal(createdMessages.length, 1);
  assert.match(createdMessages[0].content, /aria-label="View item details"/);
  assert.match(createdMessages[0].content, /<span>View details<\/span>/);
  const payload = createdMessages[0].content.match(/data-preview-payload="([^"]+)"/)[1];
  assert.deepEqual(JSON.parse(decodeURIComponent(payload)), {
    title: "Broadsword",
    type: "Equipment",
    img: "icons/sword.webp",
    description: "<p>Sharp.</p>",
    tags: [{ label: "REF", value: "B271" }],
    sourceUuid: "Item.test"
  });
  assert.deepEqual(infos, ["Sent to chat."]);
});

test("avisos de referência acompanham o idioma sem alterar os códigos", async () => {
  warnings.length = 0;
  activeLanguage = "pt-BR";
  await GumPreviewDialog._onOpenReferenceLink({
    preventDefault() {},
    stopPropagation() {},
    currentTarget: { dataset: { ref: "inválida" } }
  });
  assert.equal(warnings.at(-1), "Formato de REF inválido. Use, por exemplo: BA23 ou BA23, MA45.");

  activeLanguage = "en";
  await GumPreviewDialog._openSingleReference({ code: "BA", page: 23 });
  assert.equal(warnings.at(-1), 'No PDF with code "BA" was found in the journals.');
});
