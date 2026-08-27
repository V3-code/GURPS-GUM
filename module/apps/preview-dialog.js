const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? foundry?.applications?.ux?.TextEditor ?? TextEditor;

const TYPE_LABEL_KEYS = {
  equipment: "GUM.PreviewDialog.Types.Equipment",
  melee_weapon: "GUM.PreviewDialog.Types.MeleeWeapon",
  ranged_weapon: "GUM.PreviewDialog.Types.RangedWeapon",
  advantage: "GUM.PreviewDialog.Types.Advantage",
  disadvantage: "GUM.PreviewDialog.Types.Disadvantage",
  skill: "GUM.PreviewDialog.Types.Skill",
  spell: "GUM.PreviewDialog.Types.Spell",
  power: "GUM.PreviewDialog.Types.Power",
  condition: "GUM.PreviewDialog.Types.Condition",
  modifier: "GUM.PreviewDialog.Types.Modifier",
  eqp_modifier: "GUM.PreviewDialog.Types.EquipmentModifier",
  gm_modifier: "GUM.PreviewDialog.Types.GMModifier",
  effect: "GUM.PreviewDialog.Types.Effect",
  trigger: "GUM.PreviewDialog.Types.Trigger",
  template: "GUM.PreviewDialog.Types.Template"
};

const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);
const italicized = key => `<i>${localize(key)}</i>`;

function escapeHtml(value) {
  return foundry.utils.escapeHTML((value ?? "").toString());
}

function hasValue(value) {
  return value !== null && value !== undefined && value !== "" && value.toString().trim() !== "";
}

function normalizeTag(tag) {
  if (!tag) return null;
  if (Array.isArray(tag)) return normalizeTag({ label: tag[0], value: tag[1], html: tag[2] });
  const label = tag.label ?? tag.name;
  const value = tag.value ?? tag.text;
  const html = tag.html;
  if (!hasValue(label) || (!hasValue(value) && !hasValue(html))) return null;
  return { label: label.toString(), value, html };
}

function parseReferenceCodes(rawRef) {
  const text = (rawRef ?? "").toString().trim().toUpperCase();
  if (!text) return [];

  return text
    .split(/[,;]+|\s+/)
    .map(part => part.trim())
    .filter(Boolean)
    .map((part) => {
      const normalized = part.replace(/\s+/g, "");
      const delimitedMatch = normalized.match(/^([A-Z]+\d*)[:.](\d+)$/);
      const compactMatch = normalized.match(/^([A-Z]+)(\d+)$/);
      const match = delimitedMatch || compactMatch;
      if (!match) return null;
      return { code: match[1], page: Number(match[2]), label: normalized };
    })
    .filter(Boolean);
}

function renderReferenceLinks(value) {
  const rawRef = (value ?? "").toString().trim();
  const refs = parseReferenceCodes(rawRef);
  if (!refs.length) return escapeHtml(rawRef);

  return refs
    .map(ref => `<a href="#" class="open-reference-link" data-ref="${escapeHtml(ref.label)}" title="${escapeHtml(localize("GUM.PreviewDialog.OpenReference"))}">${escapeHtml(ref.label)}</a>`)
    .join(" ");
}

function renderTags(tags = []) {
  const normalized = tags.map(normalizeTag).filter(Boolean);
  if (!normalized.length) return "";
  return `
    <footer class="preview-meta" aria-label="${escapeHtml(localize("GUM.PreviewDialog.Metadata"))}">
      ${normalized.map(tag => `
        <span class="preview-chip">
          <b>${escapeHtml(tag.label)}</b>
          <span>${tag.html ?? (tag.label.toUpperCase() === "REF" ? renderReferenceLinks(tag.value) : escapeHtml(tag.value))}</span>
        </span>
      `).join("")}
    </footer>
  `;
}

function renderHeaderAction(action) {
  if (!action) return "";
  const icon = action.icon || "fas fa-circle-info";
  return `<a class="${escapeHtml(action.className || "preview-action")}" data-action="${escapeHtml(action.action || "custom")}" title="${escapeHtml(action.title || action.label || localize("GUM.PreviewDialog.Action"))}"><i class="${escapeHtml(icon)}"></i></a>`;
}

export class GumPreviewDialog {
  static typeLabel(type) {
    const localizationKey = TYPE_LABEL_KEYS[type];
    return localizationKey ? localize(localizationKey) : (type ? type.toString().toUpperCase() : localize("GUM.PreviewDialog.Details"));
  }

  static async enrichDescription(description, { secrets = true } = {}) {
    const source = hasValue(description) ? description : italicized("GUM.PreviewDialog.NoDescription");
    return TextEditorImpl.enrichHTML(source, { secrets, async: true });
  }

  static getItemDescription(item) {
    const s = item?.system || {};
    return s.chat_description || s.description || s.notes || s.features || italicized("GUM.PreviewDialog.NoDescription");
  }

  static buildItemTags(item, { extraTags = [] } = {}) {
    const s = item?.system || {};
    const tags = [];
    const tagLabel = key => localize(`GUM.PreviewDialog.Tags.${key}`);
    const add = (label, value) => { if (hasValue(value)) tags.push({ label, value }); };
    const addHtml = (label, html) => { if (hasValue(html)) tags.push({ label, html }); };

    switch (item?.type) {
      case "melee_weapon":
        add(tagLabel("Damage"), `${s.damage_formula || ""} ${s.damage_type || ""}`.trim());
        add(tagLabel("Range"), s.reach);
        add(tagLabel("Parry"), s.parry);
        add(tagLabel("Strength"), s.min_strength);
        break;
      case "ranged_weapon":
        add(tagLabel("Damage"), `${s.damage_formula || ""} ${s.damage_type || ""}`.trim());
        add(tagLabel("Accuracy"), s.accuracy);
        add(tagLabel("Range"), s.range);
        add(tagLabel("RateOfFire"), s.rof);
        add(tagLabel("Shots"), s.shots);
        add(tagLabel("Recoil"), s.rcl);
        add(tagLabel("Strength"), s.min_strength);
        break;
      case "skill":
        add(tagLabel("Attribute"), (s.base_attribute || "--").toString().toUpperCase());
        add(tagLabel("Level"), `${Number(s.skill_level) > 0 ? "+" : ""}${s.skill_level || "0"}`);
        add(tagLabel("Group"), s.group);
        break;
      case "spell":
        add(tagLabel("Class"), s.spell_class);
        add(tagLabel("Casting"), `${s.casting_time || "0"} / ${s.duration || 0}`);
        add(tagLabel("Cost"), `${s.mana_cost || "0"} / ${s.mana_maint || "0"}`);
        break;
      case "power":
        add(tagLabel("Activation"), `${s.activation_cost || "0"} / ${s.maint_cost || "0"}`);
        add(tagLabel("Duration"), s.duration);
        break;
      case "advantage":
      case "disadvantage":
        add(tagLabel("Points"), s.points);
        add(tagLabel("SelfControl"), s.self_control_roll);
        break;
      case "equipment":
        add(tagLabel("TechLevel"), s.tech_level);
        add(tagLabel("LegalityClass"), s.legality_class);
        break;
      case "condition":
        add(tagLabel("When"), s.when);
        add(tagLabel("Effects"), Array.isArray(s.effects) ? s.effects.length : null);
        break;
      case "modifier":
        add(tagLabel("Cost"), s.cost);
        add(tagLabel("Level"), s.level);
        add(tagLabel("Effect"), s.applied_effect);
        break;
      case "eqp_modifier":
        add(tagLabel("Cost"), s.cost_factor);
        add(tagLabel("Weight"), s.weight_mod);
        add(tagLabel("TechLevel"), s.tech_level_mod || s.tech_level);
        add(tagLabel("Tags"), s.tags);
        break;
      case "gm_modifier":
        add(tagLabel("Value"), s.modifier);
        add(tagLabel("SkillCap"), s.nh_cap);
        add(tagLabel("Category"), s.ui_category);
        break;
      case "effect":
        add(tagLabel("Type"), s.type);
        break;
      case "trigger":
        add(tagLabel("Code"), s.code ? localize("GUM.PreviewDialog.Configured") : localize("GUM.PreviewDialog.Empty"));
        break;
    }

    if (["equipment", "melee_weapon", "ranged_weapon"].includes(item?.type)) {
      add(tagLabel("Quantity"), `x${s.quantity || 1}`);
      add(tagLabel("Weight"), s.total_weight ? `${s.total_weight} kg` : null);
      add(tagLabel("Cost"), s.total_cost ? `$${s.total_cost}` : null);
    }

    add(tagLabel("Reference"), s.ref);
    return [...tags, ...extraTags];
  }

  static async showItem(item, { actor = null, sendToChat = true, tags = null, description = null, speaker = null } = {}) {
    if (!item) return;
    const resolvedDescription = await this.enrichDescription(description ?? this.getItemDescription(item), { secrets: actor?.isOwner ?? true });
    const previewTags = tags ?? this.buildItemTags(item);
    return this.show({
      title: item.name,
      type: this.typeLabel(item.type),
      img: item.img,
      description: resolvedDescription,
      tags: previewTags,
      actor,
      sourceUuid: item.uuid,
      sendToChat,
      speaker
    });
  }

  static async show({
    title = null,
    type = null,
    img = "icons/svg/mystery-man.svg",
    description = null,
    tags = [],
    actor = null,
    sourceUuid = "",
    sendToChat = false,
    width = 500,
    speaker = null
  } = {}) {
    const resolvedTitle = title ?? localize("GUM.PreviewDialog.Details");
    const resolvedType = type ?? localize("GUM.PreviewDialog.Details");
    const resolvedDescription = description ?? italicized("GUM.PreviewDialog.NoDescription");
    const safeTitle = escapeHtml(resolvedTitle);
    const safeType = escapeHtml(resolvedType);
    const safeImg = escapeHtml(img || "icons/svg/mystery-man.svg");
    const tagHtml = renderTags(tags);
    const actions = sendToChat ? renderHeaderAction({ action: "send-to-chat", className: "send-to-chat", title: localize("GUM.PreviewDialog.SendToChat"), icon: "fas fa-comment" }) : "";
    const sourceAttr = sourceUuid ? ` data-source-uuid="${escapeHtml(sourceUuid)}"` : "";

    const content = `
      <div class="gurps-dialog-canvas gum-preview-canvas">
        <article class="gurps-item-preview-card gum-preview-card"${sourceAttr}>
          <header class="preview-header">
            <img src="${safeImg}" class="header-icon"/>
            <div class="header-text">
              <h3>${safeTitle}</h3>
              <span class="preview-item-type">${safeType}</span>
            </div>
            <div class="header-controls">${actions}</div>
          </header>
          <section class="preview-content">
            <div class="preview-description">${resolvedDescription}</div>
            ${tagHtml}
          </section>
        </article>
      </div>
    `;

    return new Dialog({
      title: format("GUM.PreviewDialog.DetailsTitle", { title: resolvedTitle }),
      content,
      buttons: {},
      default: "",
      render: (html) => {
        html.find(".send-to-chat").on("click", async () => {
          await this.sendToChat({ title: resolvedTitle, type: resolvedType, img, description: resolvedDescription, tags, actor, sourceUuid, speaker });
        });
        html.find(".open-reference-link").on("click", this._onOpenReferenceLink.bind(this));
      }
    }, {
      classes: ["gurps-item-preview-dialog", "gum-premium-preview-dialog"],
      width,
      height: "auto",
      resizable: true
    }).render(true);
  }

  static async sendToChat({ title, type, img, description, tags = [], actor = null, sourceUuid = "", speaker = null }) {
    const safeTitle = escapeHtml(title);
    const safeType = escapeHtml(type);
    const safeImg = escapeHtml(img || "icons/svg/mystery-man.svg");
    const payload = encodeURIComponent(JSON.stringify({ title, type, img, description, tags, sourceUuid }));
    const content = `
      <div class="gurps-item-preview-card chat-card gum-preview-chat-card" data-preview-payload="${payload}">
        <header class="preview-header">
          <img src="${safeImg}" class="header-icon"/>
          <div class="header-text">
            <h3>${safeTitle}</h3>
            <span class="preview-item-type">${safeType}</span>
          </div>
        </header>
        <div class="preview-content">
          <div class="chat-description-actions">
            <button type="button" class="chat-show-details" aria-label="${escapeHtml(localize("GUM.PreviewDialog.ViewItemDetails"))}">
              <i class="fas fa-align-left"></i>
              <span>${escapeHtml(localize("GUM.PreviewDialog.ViewDetails"))}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    await ChatMessage.create({
      user: game.user.id,
      speaker: speaker ?? (actor ? ChatMessage.getSpeaker({ actor }) : ChatMessage.getSpeaker()),
      content,
      style: CONST.CHAT_MESSAGE_STYLES.OTHER
    });
    ui.notifications.info(localize("GUM.PreviewDialog.SentToChat"));
  }

  static registerChatDetailsHandler() {
     Hooks.on("renderChatMessageHTML", (_message, html) => {
      html.querySelectorAll(".chat-show-details").forEach((button) => {
        button.addEventListener("click", async (event) => {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          const card = event.currentTarget.closest(".gum-preview-chat-card, .gurps-item-preview-card");
          const rawPayload = card?.dataset?.previewPayload;
          if (!rawPayload) return;
          try {
            const data = JSON.parse(decodeURIComponent(rawPayload));
            await this.show({ ...data, sendToChat: false });
          } catch (err) {
            console.error("GUM | Falha ao abrir detalhes do chat", err);
            ui.notifications.error(localize("GUM.PreviewDialog.OpenDetailsFailure"));
          }
        });
      });
    });
  }

  static async _onOpenReferenceLink(event) {
    event.preventDefault();
    event.stopPropagation();

    const rawRef = (event.currentTarget?.dataset?.ref ?? "").toString().trim();
    if (!rawRef) return ui.notifications.warn(localize("GUM.PreviewDialog.FillReference"));

    const parsedList = parseReferenceCodes(rawRef);
    if (!parsedList.length) return ui.notifications.warn(localize("GUM.PreviewDialog.InvalidReference"));

    if (parsedList.length === 1) return this._openSingleReference(parsedList[0]);
    return this._promptMultipleReferences(parsedList);
  }

  static _findPdfPageByCode(code) {
    const journals = game.journal ? Array.from(game.journal) : [];

    for (const journal of journals) {
      const pages = journal?.pages ? Array.from(journal.pages) : [];
      for (const page of pages) {
        if (page?.type !== "pdf") continue;

        const pageCode = (page.getFlag("gum", "pdfCode") ?? "").toString().trim().toUpperCase();
        if (!pageCode || pageCode !== code) continue;

        return {
          journal,
          page,
          pageOffset: Number(page.getFlag("gum", "pageOffset") ?? 0)
        };
      }
    }

    return null;
  }

  static _findPdfViewerIframesBySource(sourcePath) {
    const iframes = Array.from(document.querySelectorAll("iframe"));
    if (!iframes.length) return [];

    const want = (sourcePath || "").toString();
    const wantName = want.split("/").pop();

    const matches = (candidate) => {
      if (!candidate) return false;
      if (!want) return true;
      if (candidate.includes(want)) return true;
      if (wantName && (candidate.includes(wantName) || candidate.includes(encodeURIComponent(wantName)))) return true;

      try {
        const url = new URL(candidate, window.location.origin);
        const file = url.searchParams.get("file");
        if (!file) return false;
        const decoded = decodeURIComponent(file);
        return decoded.includes(want) || (wantName && decoded.includes(wantName));
      } catch (_e) {
        return false;
      }
    };

    return iframes.filter((frame) => {
      const src = frame.getAttribute("src") || "";
      const dataSrc = frame.getAttribute("data-src") || frame.getAttribute("data-url") || frame.dataset?.src || frame.dataset?.url || "";
      const candidate = src || dataSrc;
      if (!candidate || !/pdfjs|viewer\.html/i.test(candidate)) return false;
      return matches(candidate);
    });
  }

  static _setPageOnPdfViewerIframe(iframe, page) {
    if (!(iframe instanceof HTMLIFrameElement)) return false;
    const target = Math.max(1, Number(page) || 1);

    try {
      const app = iframe.contentWindow?.PDFViewerApplication;
      if (app?.pdfViewer) {
        app.pdfViewer.currentPageNumber = target;
        app.page = target;
        return true;
      }
    } catch (_e) {
      // Iframes may be sandboxed or not fully loaded yet.
    }

    const current = iframe.getAttribute("src") || "";
    const dataSrc = iframe.getAttribute("data-src") || iframe.getAttribute("data-url") || iframe.dataset?.src || iframe.dataset?.url || "";
    const candidate = current || dataSrc;
    if (!candidate) return false;

    const [base, rawHash = ""] = candidate.split("#");
    const params = new URLSearchParams(rawHash);
    params.set("page", String(target));
    const updated = `${base}#${params.toString()}`;

    if (dataSrc) {
      iframe.setAttribute("data-src", updated);
      iframe.setAttribute("data-url", updated);
      iframe.dataset.src = updated;
      iframe.dataset.url = updated;
    }
    iframe.setAttribute("src", updated);

    return true;
  }

  static async _openPdfReferencePage(page, targetPage) {
    const journal = page?.parent;
    if (!journal) return false;

    const target = Math.max(1, Number(targetPage) || 1);
    const sourcePath = (page.src ?? page.system?.src ?? "").toString();

    await journal.sheet.render(true, { pageId: page.id, mode: "view" });

    const tryPosition = () => {
      const frames = this._findPdfViewerIframesBySource(sourcePath);
      const fallback = frames.length
        ? frames
        : Array.from(document.querySelectorAll('iframe[src*="pdfjs" i], iframe[src*="viewer.html" i]'));
      if (!fallback.length) return false;

      let ok = false;
      for (const frame of fallback) ok = this._setPageOnPdfViewerIframe(frame, target) || ok;
      return ok;
    };

    const delays = [0, 80, 180, 350, 600, 900, 1300, 1800, 2500];
    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      if (tryPosition()) return true;
    }

    const frames = this._findPdfViewerIframesBySource(sourcePath);
    for (const frame of frames) {
      frame.addEventListener("load", () => {
        try { this._setPageOnPdfViewerIframe(frame, target); } catch (_e) {}
      }, { once: true });
    }

    return false;
  }

  static async _openSingleReference(parsed) {
    const match = this._findPdfPageByCode(parsed.code);
    if (!match) {
      return ui.notifications.warn(format("GUM.PreviewDialog.PdfNotFound", { code: parsed.code }));
    }

    const pageNumber = Math.max(1, parsed.page + (Number(match.pageOffset) || 0));
    await this._openPdfReferencePage(match.page, pageNumber);
  }

  static _promptMultipleReferences(parsedList) {
    const buttons = {};
    const missing = [];

    for (const parsed of parsedList) {
      const match = this._findPdfPageByCode(parsed.code);
      const key = parsed.label || `${parsed.code}${parsed.page}`;
      if (!match) {
        missing.push(key);
        continue;
      }

      const pageNumber = Math.max(1, parsed.page + (Number(match.pageOffset) || 0));
      buttons[key] = {
        label: key,
        callback: () => this._openPdfReferencePage(match.page, pageNumber)
      };
    }

    if (!Object.keys(buttons).length) {
      return ui.notifications.warn(localize("GUM.PreviewDialog.ReferencesNotFound"));
    }

    const missingHtml = missing.length
      ? `<p style="opacity:.8;margin-top:.5rem"><b>${escapeHtml(localize("GUM.PreviewDialog.MissingReferences"))}:</b> ${missing.map(escapeHtml).join(", ")}</p>`
      : "";

    new Dialog({
      title: localize("GUM.PreviewDialog.MultipleReferences"),
      content: `<p>${escapeHtml(localize("GUM.PreviewDialog.ChooseReference"))}</p>${missingHtml}`,
      buttons,
      default: Object.keys(buttons)[0]
    }).render(true);
  }
}