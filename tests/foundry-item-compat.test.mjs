import assert from "node:assert/strict";
import test from "node:test";

import {
    installItemCompendiumExportSourceCompatibility,
    removeLegacyExportSourceShim
} from "../module/utils/foundry-item-compat.mjs";

test("removeLegacyExportSourceShim removes the non-enumerable getter without reading it", () => {
    let reads = 0;
    const data = { flags: { gum: { enabled: true } } };
    Object.defineProperty(data.flags, "exportSource", {
        configurable: true,
        get() {
            reads += 1;
            return { world: "test" };
        }
    });

    assert.equal(removeLegacyExportSourceShim(data), data);
    assert.equal(reads, 0);
    assert.equal(Object.hasOwn(data.flags, "exportSource"), false);
    assert.deepEqual(data.flags.gum, { enabled: true });
});

test("installItemCompendiumExportSourceCompatibility cleans Item exports and installs only once", () => {
    let originalCalls = 0;
    class TestItem {
        toCompendium(pack, options) {
            originalCalls += 1;
            const data = { flags: {}, pack, options };
            Object.defineProperty(data.flags, "exportSource", {
                configurable: true,
                get() {
                    throw new Error("legacy getter must not be read");
                }
            });
            return data;
        }
    }

    assert.equal(installItemCompendiumExportSourceCompatibility(TestItem), true);
    assert.equal(installItemCompendiumExportSourceCompatibility(TestItem), false);

    const item = new TestItem();
    const result = item.toCompendium("gum.test", { keepId: true });
    assert.equal(originalCalls, 1);
    assert.equal(Object.hasOwn(result.flags, "exportSource"), false);
    assert.equal(result.pack, "gum.test");
    assert.deepEqual(result.options, { keepId: true });
});
