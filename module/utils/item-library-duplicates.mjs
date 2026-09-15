export const ITEM_LIBRARY_DUPLICATE_MODES = Object.freeze({
    skip: "Ignorar repetidos",
    update: "Atualizar repetidos",
    create: "Criar novas cópias"
});

function normalizeIdentityPart(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLocaleLowerCase("pt-BR");
}

export function getItemLibraryIdentity(document = {}) {
    const type = normalizeIdentityPart(document.type);
    const name = normalizeIdentityPart(document.name);
    const specialization = type === "skill"
        ? normalizeIdentityPart(document.system?.specialization)
        : "";
    return `${type}\u0000${name}\u0000${specialization}`;
}

export function planItemLibraryDuplicates(incoming = [], existing = [], mode = "skip") {
    if (!Object.hasOwn(ITEM_LIBRARY_DUPLICATE_MODES, mode)) {
        throw new Error(`Modo de duplicação inválido: ${mode}.`);
    }

    if (mode === "create") {
        return { toCreate: [...incoming], toUpdate: [], ignored: [] };
    }

    const existingByIdentity = new Map();
    for (const document of existing) {
        const key = getItemLibraryIdentity(document);
        if (!key || key === "\u0000\u0000") continue;
        const matches = existingByIdentity.get(key) || [];
        matches.push(document);
        existingByIdentity.set(key, matches);
    }

    const toCreate = [];
    const toUpdate = [];
    const ignored = [];
    const handled = new Set();

    for (const document of incoming) {
        const key = getItemLibraryIdentity(document);
        const matches = existingByIdentity.get(key) || [];
        const existingDocument = matches[0] || null;

        if (handled.has(key)) {
            ignored.push(document);
            continue;
        }

        if (!existingDocument) {
            toCreate.push(document);
            handled.add(key);
            continue;
        }

        if (mode === "update") {
            toUpdate.push({ ...document, _id: existingDocument.id || existingDocument._id });
        } else {
            ignored.push(document);
        }
        handled.add(key);
    }

    return { toCreate, toUpdate, ignored };
}
