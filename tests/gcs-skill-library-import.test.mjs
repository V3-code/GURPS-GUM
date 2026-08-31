import test from "node:test";
import assert from "node:assert/strict";

const emptyPredefined = () => Object.fromEntries(
  Array.from({ length: 6 }, (_, index) => [`slot${index + 1}`, { name: "", specialization: "", modifier: 0 }])
);

globalThis.foundry = {
  utils: {
    deepClone: structuredClone
  }
};
globalThis.Hooks = { on() {} };

globalThis.game = {
  model: {
    Item: {
      skill: {
        predefined: emptyPredefined(),
        points: 0,
        skill_level: 0
      }
    }
  },
  system: {
    documentTypes: {
      Item: {
        // Metadados de tipo não são o modelo expandido e não contêm predefined.
        skill: { template: ["skill"] }
      }
    },
    template: null
  }
};

const { parseGCSLibrarySkill } = await import("../module/apps/importers.js");

test("a importação da biblioteca GCS preserva os pré-definidos da perícia", () => {
  const item = parseGCSLibrarySkill({
    name: "Furtividade",
    difficulty: "dx/a",
    defaults: [
      { type: "dx", modifier: -5 },
      { type: "skill", name: "Camuflagem", specialization: "Urbana", modifier: -2 }
    ]
  });

  assert.deepEqual(item.system.predefined.slot1, {
    name: "DX",
    specialization: "",
    modifier: -5
  });
  assert.deepEqual(item.system.predefined.slot2, {
    name: "Camuflagem",
    specialization: "Urbana",
    modifier: -2
  });
});

test("os pré-definidos são inicializados mesmo quando o modelo não os fornece", () => {
  game.model.Item.skill = { points: 0, skill_level: 0 };

  const item = parseGCSLibrarySkill({
    name: "Escalada",
    difficulty: "dx/a",
    defaults: [{ type: "st", modifier: -5 }]
  });

  assert.deepEqual(item.system.predefined.slot1, {
    name: "ST",
    specialization: "",
    modifier: -5
  });
  assert.equal(Object.keys(item.system.predefined).length, 6);
});