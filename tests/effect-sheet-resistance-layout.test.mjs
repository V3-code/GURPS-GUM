import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const template = fs.readFileSync(new URL("../templates/items/effect-sheet.hbs", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles/item-sheet.css", import.meta.url), "utf8");

test("configuração apresenta duração antes da barreira de resistência", () => {
  const duration = template.indexOf("DURAÇÃO E EXPIRAÇÃO");
  const resistance = template.indexOf("BARREIRA DE RESISTÊNCIA");

  assert.ok(duration >= 0, "seção de duração ausente");
  assert.ok(resistance > duration, "a barreira deve vir depois da duração");
});

test("finalidades encerram as opções da barreira", () => {
  const resistance = template.indexOf("BARREIRA DE RESISTÊNCIA");
  const branches = template.indexOf('class="resistance-branches"', resistance);
  const automaticTest = template.indexOf('name="system.resistanceRoll.skipPromptCard"', resistance);
  const purposes = template.indexOf("Finalidades do teste", resistance);
  const sectionEnd = template.indexOf("</section>", purposes);

  assert.ok(branches > resistance);
  assert.ok(purposes > branches);
  assert.ok(purposes > automaticTest);
  assert.ok(sectionEnd > purposes);
});

test("resultados condicionais usam cards sem bordas", () => {
  assert.match(template, /<article class="resistance-branch"/);
  assert.match(styles, /\.resistance-branch \{[\s\S]*?border: 0;[\s\S]*?background:/);
  assert.match(styles, /\.resistance-branch-condition \{[\s\S]*?grid-template-columns:/);
});

test("finalidades da barreira usam seletor compacto e lista abaixo", () => {
  assert.match(template, /class="resistance-purpose-heading"[\s\S]*?Finalidades do teste[\s\S]*?Adicionar finalidade[\s\S]*?<\/div>/);
  assert.match(template, /class="open-purpose-picker resistance-purpose-add"[\s\S]*?>[\s\S]*?Adicionar finalidade<\/button>/);
  assert.match(template, /class="resistance-purpose-list[\s\S]*?{{#each resistancePurposeLabels/);
  assert.match(styles, /\.resistance-purpose-control \{[\s\S]*?flex-direction: column;/);
  assert.match(styles, /\.resistance-purpose-heading \{[\s\S]*?justify-content: space-between;/);
  assert.match(styles, /\.resistance-purpose-list \{[\s\S]*?flex-wrap: wrap;/);
});