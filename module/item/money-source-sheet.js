const { ItemSheet } = foundry.appv1.sheets;
const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? foundry?.applications?.ux?.TextEditor ?? TextEditor;

/** A focused inventory sheet for money, without exposing the equipment sheet's combat fields. */
export class MoneySourceSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["gum", "sheet", "item", "money-source-sheet", "theme-dark"],
      width: 480,
      height: 560,
      template: "systems/gum/templates/items/money-source-sheet.hbs",
      submitOnChange: true,
      tabs: [{
        navSelector: ".sheet-tabs",
        contentSelector: ".sheet-body-content",
        initial: "details"
      }],
      scrollY: [".sheet-body-content"]
    });
  }

  async getData(options) {
    const context = await super.getData(options);
    const system = foundry.utils.deepClone(this.item._source?.system || this.item.system || {});
    const physical = system.mode !== "abstract";
    const quantity = Math.max(0, Number(system.quantity) || 0);
    const unitValue = Math.max(0, Number(system.unit_value) || 0);
    context.system = system;
    context.isPhysical = physical;
    context.availableValue = physical ? quantity * unitValue : Math.max(0, Number(system.balance) || 0);
    context.totalWeight = physical ? quantity * Math.max(0, Number(system.weight) || 0) : 0;
    context.enrichedDescription = await TextEditorImpl.enrichHTML(system.description || "", { async: true });
    context.enrichedChatDescription = await TextEditorImpl.enrichHTML(system.chat_description || "", { async: true });
    context.owner = context.owner ?? this.item.isOwner;
    context.editable = this.options.editable ?? this.isEditable;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.on("click", ".toggle-editor", event => {
      event.preventDefault();
      const section = $(event.currentTarget).closest(".description-section");
      section.find(".description-view, .toggle-editor").hide();
      section.find(".description-editor").show();
      const field = event.currentTarget.dataset.field;
      const editor = this.editors?.[field]?.editor ?? this.editors?.[field]?.instance ?? this.editors?.[field];
      if (editor?.focus) setTimeout(() => editor.focus(), 0);
      else if (editor?.view?.focus) setTimeout(() => editor.view.focus(), 0);
    });

    html.on("click", ".cancel-description", event => {
      event.preventDefault();
      const section = $(event.currentTarget).closest(".description-section");
      section.find(".description-editor").hide();
      section.find(".description-view, .toggle-editor").show();
    });

    html.on("click", ".expand-description", event => {
      event.preventDefault();
      const button = $(event.currentTarget);
      const editorWrapper = button.closest(".description-editor");
      const expanded = !editorWrapper.hasClass("expanded");
      editorWrapper.toggleClass("expanded", expanded);
      button.attr("data-expanded", String(expanded));
      const label = expanded ? "GUM.MoneySource.CollapseEditor" : "GUM.Equipment.Description.Expand";
      button.html(`<i class="fas fa-${expanded ? "compress" : "expand"}"></i> ${game.i18n.localize(label)}`);
    });

    html.on("click", ".save-description", async event => {
      event.preventDefault();
      const field = event.currentTarget.dataset.field;
      if (!["system.description", "system.chat_description"].includes(field)) return;
      const section = $(event.currentTarget).closest(".description-section");
      const content = await this._getEditorContent(field, section);
      if (content === null || content === undefined) return;
      await this.item.update({ [field]: content });
      section.find(".description-view").html(await TextEditorImpl.enrichHTML(content, { async: true })).show();
      section.find(".description-editor").hide();
      section.find(".toggle-editor").show();
    });
  }

  async _getEditorContent(field, section) {
    const entry = this.editors?.[field];
    const editor = entry?.editor ?? entry?.instance ?? entry;
    if (editor?.getHTML) return await editor.getHTML();
    if (editor?.getContent) return await editor.getContent();
    if (editor?.view?.dom) return editor.view.dom.innerHTML;
    const input = section.find(`[name="${field}"]`).get(0) ?? section.find(`.editor[data-edit="${field}"]`).get(0);
    if (!input) return null;
    if (TextEditorImpl?.getContent) return await TextEditorImpl.getContent(input);
    return input.value ?? input.innerHTML ?? null;
  }
}
