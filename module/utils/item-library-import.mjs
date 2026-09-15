export const ITEM_LIBRARY_KIND_LABELS = Object.freeze({
    trait: "Vantagens e Desvantagens",
    skill: "Perícias",
    spell: "Magias",
    equipment: "Equipamentos",
    modifier: "Ampliações e Limitações",
    eqp_modifier: "Modificadores de Equipamento",
    foundry: "Itens do GUM/Foundry"
});

const EXTENSION_KIND_MAP = Object.freeze({
    adq: "trait",
    skl: "skill",
    spl: "spell",
    eqp: "equipment",
    adm: "modifier",
    eqm: "eqp_modifier"
});

const ROOT_KIND_MAP = Object.freeze({
    traits: "trait",
    skills: "skill",
    spells: "spell",
    equipment: "equipment"
});

const GCS_ID_KIND_MAP = Object.freeze({
    t: "trait",
    s: "skill",
    q: "skill",
    p: "spell",
    r: "spell",
    e: "equipment",
    m: "modifier",
    f: "eqp_modifier"
});

export function getItemLibraryExtension(fileName = "") {
    return String(fileName).split(".").pop()?.trim().toLowerCase() || "";
}

export function getItemLibraryKindLabel(kind) {
    return ITEM_LIBRARY_KIND_LABELS[kind] || String(kind || "Conteúdo desconhecido");
}

function getLeafRows(rows, collector = []) {
    for (const row of rows || []) {
        if (!row || typeof row !== "object" || Array.isArray(row)) continue;
        if (Array.isArray(row.children) && row.children.length) {
            getLeafRows(row.children, collector);
        } else {
            collector.push(row);
        }
    }
    return collector;
}

function scoreGCSRowKinds(row) {
    const scores = new Map();
    const add = (kind, amount = 1) => scores.set(kind, (scores.get(kind) || 0) + amount);
    const idKind = GCS_ID_KIND_MAP[String(row?.id || "").charAt(0).toLowerCase()];
    if (idKind) add(idKind, 5);

    if (row?.difficulty !== undefined || row?.defaults !== undefined || row?.default !== undefined) add("skill", 3);
    if (row?.spell_class !== undefined || row?.college !== undefined || row?.casting_cost !== undefined || row?.ritual_skill_name !== undefined) add("spell", 4);
    if (row?.base_weight !== undefined || row?.weight !== undefined || row?.quantity !== undefined || row?.base_value !== undefined) add("equipment", 3);
    if (row?.points_per_level !== undefined || row?.base_points !== undefined || row?.container_type !== undefined) add("trait", 2);
    if (row?.cost_adj !== undefined) add("modifier", 3);
    if (row?.weight_type !== undefined) add("eqp_modifier", 4);
    return scores;
}

export function inferGCSLibraryKind(rows = []) {
    const totals = new Map();
    for (const row of getLeafRows(rows)) {
        for (const [kind, score] of scoreGCSRowKinds(row)) {
            totals.set(kind, (totals.get(kind) || 0) + score);
        }
    }

    const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    if (!ranked.length || (ranked[1] && ranked[0][1] === ranked[1][1])) return null;
    return ranked[0][0];
}

function isFoundryItemDocument(value) {
    return Boolean(
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        typeof value.type === "string" &&
        value.system &&
        typeof value.system === "object"
    );
}

function buildGCSSection(kind, rows, sourceKey = "rows") {
    if (!Array.isArray(rows)) {
        throw new Error(`A coleção "${sourceKey}" não é uma lista válida.`);
    }
    return { kind, rows, sourceKey };
}

/**
 * Analisa somente o conteúdo da biblioteca. O destino não participa desta decisão.
 */
export function analyzeItemLibrary(data, fileName = "biblioteca.json") {
    const extension = getItemLibraryExtension(fileName);
    if (extension === "gcs") {
        throw new Error("Este arquivo parece ser uma ficha de personagem. Use o importador da aba Atores.");
    }

    if (Array.isArray(data)) {
        if (!data.length) throw new Error("A biblioteca está vazia.");
        if (data.every(isFoundryItemDocument)) {
            const hasEveryId = data.every(document => typeof document._id === "string" && document._id.trim());
            return {
                format: "foundry",
                extension,
                sections: [{ kind: "foundry", rows: data, sourceKey: "documents" }],
                kinds: ["foundry"],
                label: getItemLibraryKindLabel("foundry"),
                isCompendiumJson: hasEveryId,
                warnings: hasEveryId ? [] : ["Alguns documentos não possuem ID; eles serão criados como novos itens."]
            };
        }

        const extensionKind = EXTENSION_KIND_MAP[extension];
        const inferredKind = extensionKind || inferGCSLibraryKind(data);
        if (!inferredKind) {
            throw new Error("Não foi possível identificar o tipo dos registros desta biblioteca.");
        }
        return buildAnalysis([buildGCSSection(inferredKind, data, "rows")], extension);
    }

    if (!data || typeof data !== "object") {
        throw new Error("O arquivo não contém uma biblioteca reconhecida.");
    }

    if (Array.isArray(data.rows)) {
        const extensionKind = EXTENSION_KIND_MAP[extension];
        const inferredKind = extensionKind || inferGCSLibraryKind(data.rows);
        if (!inferredKind) {
            throw new Error("Não foi possível identificar o tipo da biblioteca GCS pela estrutura dos registros.");
        }
        return buildAnalysis([buildGCSSection(inferredKind, data.rows)], extension);
    }

    const sections = [];
    for (const [sourceKey, kind] of Object.entries(ROOT_KIND_MAP)) {
        if (Array.isArray(data[sourceKey]) && data[sourceKey].length) {
            sections.push(buildGCSSection(kind, data[sourceKey], sourceKey));
        }
    }

    if (Array.isArray(data.modifiers) && data.modifiers.length) {
        const modifierKind = extension === "eqm" ? "eqp_modifier" : "modifier";
        sections.push(buildGCSSection(modifierKind, data.modifiers, "modifiers"));
    }

    if (!sections.length) {
        throw new Error("O formato do arquivo não foi reconhecido como biblioteca de Itens do GCS ou do GUM.");
    }
    return buildAnalysis(sections, extension);
}

function buildAnalysis(sections, extension) {
    const kinds = [...new Set(sections.map(section => section.kind))];
    return {
        format: "gcs",
        extension,
        sections,
        kinds,
        label: kinds.map(getItemLibraryKindLabel).join(", "),
        isCompendiumJson: false,
        warnings: []
    };
}
