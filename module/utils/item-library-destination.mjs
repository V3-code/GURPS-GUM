export function slugifyWorldCompendiumName(value = "biblioteca") {
    const normalized = String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64);
    return normalized || "biblioteca";
}

export function getImportFolderName(fileName = "biblioteca") {
    const baseName = String(fileName).replace(/\.[^.]+$/, "").trim() || "Biblioteca";
    return `Importação - ${baseName}`;
}

export function getUniqueWorldCompendiumName(label, existingCollections = []) {
    const used = new Set(existingCollections.map(value => String(value).toLowerCase()));
    const base = slugifyWorldCompendiumName(label);
    let name = base;
    let suffix = 2;
    while (used.has(`world.${name}`) || used.has(name)) {
        name = `${base.slice(0, Math.max(1, 64 - String(suffix).length - 1))}-${suffix}`;
        suffix += 1;
    }
    return name;
}

export function buildWorldItemFolderChoices(folders = []) {
    const itemFolders = folders.filter(folder =>
        folder?.type === "Item" &&
        !folder.pack
    );
    const byParent = new Map();
    for (const folder of itemFolders) {
        const parentId = folder.folder?.id ?? folder.folder ?? null;
        const children = byParent.get(parentId) || [];
        children.push(folder);
        byParent.set(parentId, children);
    }

    const choices = [];
    const visited = new Set();
    const visit = (parentId = null, depth = 0) => {
        const children = (byParent.get(parentId) || [])
            .sort((a, b) => String(a.name).localeCompare(String(b.name), "pt-BR"));
        for (const folder of children) {
            if (!folder.id || visited.has(folder.id)) continue;
            visited.add(folder.id);
            choices.push({
                id: folder.id,
                name: String(folder.name || "Pasta sem nome"),
                depth,
                label: `${"— ".repeat(depth)}${folder.name || "Pasta sem nome"}`
            });
            visit(folder.id, depth + 1);
        }
    };
    visit();

    // Mantém pastas órfãs selecionáveis, caso o mundo tenha referências antigas.
    for (const folder of itemFolders) {
        if (!folder.id || visited.has(folder.id)) continue;
        choices.push({ id: folder.id, name: String(folder.name || "Pasta sem nome"), depth: 0, label: String(folder.name || "Pasta sem nome") });
    }
    return choices;
}
