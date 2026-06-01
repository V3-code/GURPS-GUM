// GUM/scripts/apps/condition-sheet.js

import { EffectBuilder } from "./effect-builder.js";
import { TriggerBrowser } from "../../module/apps/trigger-browser.js";

const { ItemSheet } = foundry.appv1.sheets;
const TextEditorImpl = foundry?.applications?.ux?.TextEditor?.implementation ?? foundry?.applications?.ux?.TextEditor ?? TextEditor;

export class ConditionSheet extends ItemSheet {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["gum", "sheet", "item", "condition-sheet", "theme-dark"],
            width: 500,
            height: 600,
            resizable: true,
            template: "systems/gum/templates/items/condition-sheet.hbs",
            tabs: [{
                navSelector: ".sheet-tabs",
                contentSelector: ".sheet-body-content",
                initial: "description"
            }],
            scrollY: [".sheet-body-content"]
        });
    }

    /**
     * ✅ [VERSÃO 2.0] Prepara os dados para a ficha.
     * Agora carrega os dados completos dos efeitos linkados por UUID.
     */
   async getData(options) {
        const context = await super.getData(options);
        context.system = this.item.system;
        context.system.bindingMode = context.system.bindingMode || "conditional";
        if (context.system.triggerOnTurnStartWhileActive === undefined) {
            context.system.triggerOnTurnStartWhileActive = false;
        }
        context.system.statusBinding = context.system.statusBinding || {};
        context.system.statusBinding.statusId = context.system.statusBinding.statusId || "";
        context.system.statusBinding.stackMode = context.system.statusBinding.stackMode || "refresh";
        if (context.system.statusBinding.stackLimit === undefined || context.system.statusBinding.stackLimit === null) {
            context.system.statusBinding.stackLimit = 1;
        }
        if (context.system.statusBinding.removeOnStatusOff === undefined) {
            context.system.statusBinding.removeOnStatusOff = true;
        }
        if (context.system.statusBinding.enabled === undefined) {
            context.system.statusBinding.enabled = true;
        }
        context.statusEffects = (CONFIG.statusEffects || [])
            .map((status) => ({ id: status.id, label: status.name }))
            .sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" }));
        context.enrichedDescription = await TextEditorImpl.enrichHTML(this.item.system.description, { async: true });
        context.enrichedChatDescription = await TextEditorImpl.enrichHTML(this.item.system.chat_description || "", { async: true });
        context.owner = this.item.isOwner;
        context.editable = this.options.editable;
        
        const effectLinks = this.item.system.effects || [];
        const preparedEffects = [];

        // Para cada link na lista de efeitos, carregamos o item completo.
        for (const [index, link] of effectLinks.entries()) {
            if (link.uuid) {
                const effectItem = await fromUuid(link.uuid);
                if (effectItem) {
                    const actions = Array.isArray(effectItem.system?.actions) ? effectItem.system.actions : [];
                    const effectType = actions.length > 1 ? "múltiplas ações" : (actions[0]?.type || effectItem.system.type || "indefinido");
                    preparedEffects.push({
                        name: effectItem.name,
                        img: effectItem.img,
                        type: effectType,
                        chat_description: effectItem.system.chat_description,
                        summary: this._getEffectSummary(effectItem), // Gera o resumo␊
                        index: index, // O índice original para a função de deletar␊
                        uuid: link.uuid // O UUID para a função de visualizar␊
                    });
                } else {
                    // Adiciona um placeholder se o link estiver quebrado␊
                    preparedEffects.push({ name: "Link Quebrado", img: "icons/svg/hazard.svg", summary: "UUID não encontrado", index: index, uuid: link.uuid, type: "desconhecido" });
                }
            }
        }
        
        context.preparedEffects = preparedEffects;
        return context;
    }

    /**
     * ✅ [NOVO] Gera um resumo textual para um Item Efeito.
     */
    _getEffectSummary(effectItem) {
        const sys = effectItem.system;
        switch (sys.type) {
            case 'attribute': return `Modificador: ${sys.path || ''} ${sys.operation || ''} ${sys.value || ''}`;
            case 'resource_change': return `Recurso: ${sys.category} (${sys.value || '0'})`;
            case 'status':
                const status = CONFIG.statusEffects.find(s => s.id === sys.statusId);
                return `Status: ${status ? status.name : sys.statusId}`;
            case 'chat': return `Mensagem no Chat`;
            case 'macro': return `Executa Macro: ${sys.value}`;
            case 'flag': return `Define Flag: ${sys.key}`;
            default: return "Efeito desconhecido";
        }
    }

    /**
     * ✅ [VERSÃO 2.0] Listeners limpos e aprimorados.
     */
    activateListeners(html) {
        super.activateListeners(html);
        html.on('click', '.open-reference-link', this._onOpenReferenceLink.bind(this));
        if (!this.isEditable) return;

        html.find('select[name="system.bindingMode"]').on('change', async (ev) => {
            const nextMode = ev.currentTarget.value;
            if (nextMode === "conditional") {
                await this.item.update({
                    "system.statusBinding.statusId": "",
                    "system.statusBinding.enabled": false
                });
            } else if (nextMode === "status-link") {
                await this.item.update({
                    "system.statusBinding.enabled": true
                });
            }
        });

        // --- ABA DE EFEITOS ---

        // Adicionar um novo efeito (linkado)
         html.find('.add-effect').on('click', (ev) => {
            ev.preventDefault();
            new EffectBuilder(this.item).render();
        });

        // Deletar um link de efeito
        html.find('.delete-effect').on('click', (ev) => {
            ev.preventDefault();
            const effectIndex = $(ev.currentTarget).closest('.effect-entry').data('effectIndex');
            const effects = foundry.utils.deepClone(this.item.system.effects || []);
            if (Number.isInteger(effectIndex)) {
                effects.splice(effectIndex, 1);
            }
            this.item.update({ "system.effects": effects });
        });
        
        // Visualizar a ficha do Item Efeito original
        html.find('.view-effect').on('click', async (ev) => {
            ev.preventDefault();
            const effectUuid = $(ev.currentTarget).closest('.effect-entry').data('effectUuid');
            const effectItem = await fromUuid(effectUuid);
            if (effectItem) {
                effectItem.sheet.render(true);
            }
        });

        // --- ABA DE ATIVAÇÃO ---

        // Assistente de Gatilho 'when'
        html.find('.saved-triggers-btn').on('click', (ev) => {
            const textarea = this.element.find('textarea[name="system.when"]')[0];
            new TriggerBrowser(textarea).render(true);
        });

               // --- ABA DE DETALHES ---
        
        html.find('.toggle-editor').on('click', this._toggleEditor.bind(this));
        html.find('.save-description').on('click', this._saveDescription.bind(this));
        html.find('.cancel-description').on('click', this._cancelDescription.bind(this));
    }

    _toggleEditor(event) {
        event.preventDefault();
        const field = event.currentTarget.dataset.field;
        const container = $(event.currentTarget).closest('.description-section');
        container.find('.description-view').toggle();
        container.find('.description-editor').toggle();
        if (field) {
            const editor = container.find(`.editor[data-edit="${field}"]`);
            if (editor.length) editor.trigger('focus');
        }
    }

  async _saveDescription(event) {
        event.preventDefault();
        const field = event.currentTarget.dataset.field;
        const container = $(event.currentTarget).closest('.description-section');
        const content = await this._getEditorContent(field, container);
        if (!field || content === null || content === undefined) return;
        await this.item.update({ [field]: content });
        const enriched = await TextEditorImpl.enrichHTML(content, { async: true });
        container.find('.description-view').html(enriched);
        container.find('.description-view').show();
        container.find('.description-editor').hide();
    }

    _cancelDescription(event) {
        event.preventDefault();
        const container = $(event.currentTarget).closest('.description-section');
        container.find('.description-view').show();
        container.find('.description-editor').hide();
    }

    _getEditorInstance(field) {
        const editor = this.editors?.[field];
        if (!editor) return null;
        return editor.editor ?? editor.instance ?? editor;
    }

    async _getEditorContent(field, container) {
        if (!field) return null;
        const instance = this._getEditorInstance(field);
        if (instance?.getHTML) {
            const html = instance.getHTML();
            return html?.then ? await html : html;
        }
        if (instance?.getContent) {
            const content = instance.getContent();
            return content?.then ? await content : content;
        }
        if (instance?.view?.dom?.innerHTML) return instance.view.dom.innerHTML;
        if (TextEditorImpl?.getContent) {
            const element = container.find(`[name="${field}"]`).get(0)
                ?? container.find(`.editor[data-edit="${field}"]`).get(0);
            if (element) return TextEditorImpl.getContent(element);
        }
        const namedInput = container.find(`[name="${field}"]`);
        if (namedInput.length) return namedInput.val();
        const editorElement = container.find(`.editor[data-edit="${field}"]`);
        if (editorElement.length) return editorElement.val() ?? editorElement.html();
        return "";
     }

    async _onOpenReferenceLink(event) {
        event.preventDefault();
        event.stopPropagation();

        const trigger = event.currentTarget;
        const container = trigger.closest('.form-group') ?? this.form;
        const refInput =
            container?.querySelector('input[name="system.ref"]') ??
            this.form?.querySelector('input[name="system.ref"]');

        const rawRef = (refInput?.value ?? this.item.system?.ref ?? '').toString().trim();

        if (!rawRef) {
            return ui.notifications.warn("Preencha o campo REF antes de abrir a referência.");
        }

        const parsedList = this._parseReferenceCodes(rawRef);

        if (!parsedList.length) {
            return ui.notifications.warn("Formato de REF inválido. Use ex.: BA23 ou BA23, MA45.");
        }

        if (parsedList.length === 1) {
            return this._openSingleReference(parsedList[0]);
        }

        return this._promptMultipleReferences(parsedList);
    }

    _parseReferenceCodes(rawRef) {
        const text = (rawRef ?? "").toString().trim().toUpperCase();
        if (!text) return [];

        const parts = text.split(/[,;]+|\s+/).map(s => s.trim()).filter(Boolean);

        const out = [];
        for (const part of parts) {
            const match = part.replace(/\s+/g, "").match(/^([A-Z]+)(\d+)$/);
            if (!match) continue;
            out.push({ code: match[1], page: Number(match[2]) });
        }
        return out;
    }

    _findPdfPageByCode(code) {
        const journals = game.journal ? Array.from(game.journal) : [];

        for (const journal of journals) {
            const pages = journal?.pages ? Array.from(journal.pages) : [];
            for (const page of pages) {
                if (page?.type !== 'pdf') continue;

                const pageCode = (page.getFlag('gum', 'pdfCode') ?? '').toString().trim().toUpperCase();
                if (!pageCode || pageCode !== code) continue;

                return {
                    journal,
                    page,
                    pageOffset: Number(page.getFlag('gum', 'pageOffset') ?? 0)
                };
            }
        }

        return null;
    }

    _findPdfViewerIframesBySource(sourcePath) {
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
                const u = new URL(candidate, window.location.origin);
                const file = u.searchParams.get("file");
                if (!file) return false;
                const decoded = decodeURIComponent(file);
                return decoded.includes(want) || (wantName && decoded.includes(wantName));
            } catch (_e) {
                return false;
            }
        };

        return iframes.filter((f) => {
            const src = f.getAttribute("src") || "";
            const dataSrc = f.getAttribute("data-src") || f.getAttribute("data-url") || f.dataset?.src || f.dataset?.url || "";
            const cand = src || dataSrc;
            if (!cand) return false;

            const looksLikePdfViewer = /pdfjs|viewer\.html/i.test(cand);
            if (!looksLikePdfViewer) return false;

            return matches(cand);
        });
    }

    _setPageOnPdfViewerIframe(iframe, page) {
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
            // sandbox/cross-origin ou viewer ainda não carregado.
        }

        const attr = "src";
        const current = iframe.getAttribute(attr) || "";
        const dataSrc = iframe.getAttribute("data-src") || iframe.getAttribute("data-url") || iframe.dataset?.src || iframe.dataset?.url || "";
        const candidate = current || dataSrc;
        if (!candidate) return false;

        const updated = (() => {
            const [base, rawHash = ""] = candidate.split("#");
            const params = new URLSearchParams(rawHash);
            params.set("page", String(target));
            return `${base}#${params.toString()}`;
        })();

        if (dataSrc) {
            iframe.setAttribute("data-src", updated);
            iframe.setAttribute("data-url", updated);
            iframe.dataset.src = updated;
            iframe.dataset.url = updated;
        }
        iframe.setAttribute("src", updated);

        return true;
    }

    async _openSingleReference(parsed) {
        const match = this._findPdfPageByCode(parsed.code);
        if (!match) {
            return ui.notifications.warn(`Nenhum PDF com código "${parsed.code}" foi encontrado nos periódicos.`);
        }

        const pageNumber = Math.max(1, parsed.page + (Number(match.pageOffset) || 0));
        await this._openPdfReferencePage(match.page, pageNumber);
    }

    _promptMultipleReferences(parsedList) {
        const buttons = {};
        const missing = [];

        for (const parsed of parsedList) {
            const match = this._findPdfPageByCode(parsed.code);
            if (!match) {
                missing.push(`${parsed.code}${parsed.page}`);
                continue;
            }

            const pageNumber = Math.max(1, parsed.page + (Number(match.pageOffset) || 0));
            const key = `${parsed.code}${parsed.page}`;

            buttons[key] = {
                label: `${parsed.code}${parsed.page}`,
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

    async _openPdfReferencePage(pdfPage, targetPage) {
        const journal = pdfPage?.parent;
        if (!journal) return;

        const page = Math.max(1, Number(targetPage) || 1);
        const sourcePath = (pdfPage.src ?? pdfPage.system?.src ?? "").toString();

        await journal.sheet.render(true, { pageId: pdfPage.id, mode: "view" });

        const tryPosition = () => {
            const frames = this._findPdfViewerIframesBySource(sourcePath);
            const fallback = frames.length ? frames : Array.from(document.querySelectorAll('iframe[src*="pdfjs" i], iframe[src*="viewer.html" i]'));
            if (!fallback.length) return false;

            let ok = false;
            for (const f of fallback) ok = this._setPageOnPdfViewerIframe(f, page) || ok;
            return ok;
        };

        const delays = [0, 80, 180, 350, 600, 900, 1300, 1800, 2500];
        for (const d of delays) {
            await new Promise(r => setTimeout(r, d));
            if (tryPosition()) return;
        }

        const frames = this._findPdfViewerIframesBySource(sourcePath);
        for (const f of frames) {
            f.addEventListener("load", () => {
                try { this._setPageOnPdfViewerIframe(f, page); } catch (_e) {}
            }, { once: true });
        }

        ui.notifications.warn("Não foi possível posicionar o PDF na página solicitada automaticamente.");
    }
}