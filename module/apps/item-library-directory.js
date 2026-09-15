import { importFromJson } from "./importers.js";

export function renderItemLibraryImportButton(_app, html) {
    if (!game.user?.isGM) return;

    const root = html?.[0] || html;
    const actions = root?.querySelector?.(".directory-header .header-actions");
    if (!actions || actions.querySelector(".gum-item-library-import")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "gum-item-library-import";
    button.innerHTML = '<i class="fas fa-file-import"></i> Importar Biblioteca';
    button.addEventListener("click", () => importFromJson());
    actions.append(button);
}

Hooks.on("renderItemDirectory", renderItemLibraryImportButton);
