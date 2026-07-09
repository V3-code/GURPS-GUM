const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? foundry?.applications?.ux?.TextEditor ?? TextEditor;

const TYPE_LABELS = {
  equipment: "Equipamento",
  melee_weapon: "Arma C. a C.",
  ranged_weapon: "Arma à Dist.",
  advantage: "Vantagem",
  disadvantage: "Desvantagem",
  skill: "Perícia",
  spell: "Magia",
  power: "Poder",
  condition: "Condição",
  modifier: "Modificador",
  eqp_modifier: "Mod. Equipamento",
  gm_modifier: "Modificador GM",
  effect: "Efeito",
  trigger: "Gatilho",
  template: "Modelo"
};

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
    .map(ref => `<a href="#" class="open-reference-link" data-ref="${escapeHtml(ref.label)}" title="Abrir referência">${escapeHtml(ref.label)}</a>`)
    .join(" ");
}

function renderTags(tags = []) {
  const normalized = tags.map(normalizeTag).filter(Boolean);
  if (!normalized.length) return "";
  return `
    <footer class="preview-meta" aria-label="Metadados">
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
  return `<a class="${escapeHtml(action.className || "preview-action")}" data-action="${escapeHtml(action.action || "custom")}" title="${escapeHtml(action.title || action.label || "Ação")}"><i class="${escapeHtml(icon)}"></i></a>`;
}

export class GumPreviewDialog {
  static typeLabel(type) {
    return TYPE_LABELS[type] || (type ? type.toString().toUpperCase() : "Detalhes");
  }

  static async enrichDescription(description, { secrets = true } = {}) {
    const source = hasValue(description) ? description : "<i>Sem descrição.</i>";
    return TextEditorImpl.enrichHTML(source, { secrets, async: true });
  }

  static getItemDescription(item) {
    const s = item?.system || {};
    return s.chat_description || s.description || s.notes || s.features || "<i>Sem descrição.</i>";
  }

  static buildItemTags(item, { extraTags = [] } = {}) {
    const s = item?.system || {};
    const tags = [];
    const add = (label, value) => { if (hasValue(value)) tags.push({ label, value }); };
    const addHtml = (label, html) => { if (hasValue(html)) tags.push({ label, html }); };

    switch (item?.type) {
      case "melee_weapon":
        add("Dano", `${s.damage_formula || ""} ${s.damage_type || ""}`.trim());
        add("Alcance", s.reach);
        add("Aparar", s.parry);
        add("ST", s.min_strength);
        break;
      case "ranged_weapon":
        add("Dano", `${s.damage_formula || ""} ${s.damage_type || ""}`.trim());
        add("Prec.", s.accuracy);
        add("Alcance", s.range);
        add("CdT", s.rof);
        add("Tiros", s.shots);
        add("RCO", s.rcl);
        add("ST", s.min_strength);
        break;
      case "skill":
        add("Attr.", (s.base_attribute || "--").toString().toUpperCase());
        add("Nível", `${Number(s.skill_level) > 0 ? "+" : ""}${s.skill_level || "0"}`);
        add("Grupo", s.group);
        break;
      case "spell":
        add("Classe", s.spell_class);
        add("Conj.", `${s.casting_time || "0"} / ${s.duration || 0}`);
        add("Custo", `${s.mana_cost || "0"} / ${s.mana_maint || "0"}`);
        break;
      case "power":
        add("Ativação", `${s.activation_cost || "0"} / ${s.maint_cost || "0"}`);
        add("Duração", s.duration);
        break;
      case "advantage":
      case "disadvantage":
        add("Pontos", s.points);
        add("CR", s.self_control_roll);
        break;
      case "equipment":
        add("TL", s.tech_level);
        add("LC", s.legality_class);
        break;
      case "condition":
        add("Quando", s.when);
        add("Efeitos", Array.isArray(s.effects) ? s.effects.length : null);
        break;
      case "modifier":
        add("Custo", s.cost);
        add("Nível", s.level);
        add("Efeito", s.applied_effect);
        break;
      case "eqp_modifier":
        add("Custo", s.cost_factor);
        add("Peso", s.weight_mod);
        add("TL", s.tech_level_mod || s.tech_level);
        add("Tags", s.tags);
        break;
      case "gm_modifier":
        add("Valor", s.modifier);
        add("Cap NH", s.nh_cap);
        add("Categoria", s.ui_category);
        break;
      case "effect":
        add("Tipo", s.type);
        break;
      case "trigger":
        add("Código", s.code ? "Configurado" : "Vazio");
        break;
    }

    if (["equipment", "melee_weapon", "ranged_weapon"].includes(item?.type)) {
      add("Qtd", `x${s.quantity || 1}`);
      add("Peso", s.total_weight ? `${s.total_weight} kg` : null);
      add("Custo", s.total_cost ? `$${s.total_cost}` : null);
    }

    add("REF", s.ref);
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
    title = "Detalhes",
    type = "Detalhes",
    img = "icons/svg/mystery-man.svg",
    description = "<i>Sem descrição.</i>",
    tags = [],
    actor = null,
    sourceUuid = "",
    sendToChat = false,
    width = 500,
    speaker = null
  } = {}) {
    const safeTitle = escapeHtml(title);
    const safeType = escapeHtml(type);
    const safeImg = escapeHtml(img || "icons/svg/mystery-man.svg");
    const tagHtml = renderTags(tags);
    const actions = sendToChat ? renderHeaderAction({ action: "send-to-chat", className: "send-to-chat", title: "Enviar para o Chat", icon: "fas fa-comment" }) : "";
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
            <div class="preview-description">${description}</div>
            ${tagHtml}
          </section>
        </article>
      </div>
    `;

    return new Dialog({
      title: `Detalhes: ${title}`,
      content,
      buttons: {},
      default: "",
      render: (html) => {
        html.find(".send-to-chat").on("click", async () => {
          await this.sendToChat({ title, type, img, description, tags, actor, sourceUuid, speaker });
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
            <button type="button" class="chat-show-details" aria-label="Ver detalhes do item">
              <i class="fas fa-align-left"></i>
              <span>Ver detalhes</span>
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
    ui.notifications.info("Enviado para o chat.");
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
            ui.notifications.error("Não foi possível abrir os detalhes desse item.");
          }
        });
      });
    });
  }

  static async _onOpenReferenceLink(event) {
    event.preventDefault();
    event.stopPropagation();

    const rawRef = (event.currentTarget?.dataset?.ref ?? "").toString().trim();
    if (!rawRef) return ui.notifications.warn("Preencha o campo REF antes de abrir a referência.");

    const parsedList = parseReferenceCodes(rawRef);
    if (!parsedList.length) return ui.notifications.warn("Formato de REF inválido. Use ex.: BA23 ou BA23, MA45.");

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
      return ui.notifications.warn(`Nenhum PDF com código "${parsed.code}" foi encontrado nos periódicos.`);
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
      return ui.notifications.warn("Nenhuma das referências informadas foi encontrada nos periódicos.");
    }

    const missingHtml = missing.length
      ? `<p style="opacity:.8;margin-top:.5rem"><b>Não encontradas:</b> ${missing.join(", ")}</p>`
      : "";

    new Dialog({
      title: "Múltiplas Referências",
      content: `<p>Escolha qual referência deseja abrir:</p>${missingHtml}`,
      buttons,
      default: Object.keys(buttons)[0]
    }).render(true);
  }
}