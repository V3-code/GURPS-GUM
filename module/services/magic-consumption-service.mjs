import {
  applyMagicConsumptionDeductions,
  buildMagicConsumptionDeductions,
  collectMagicConsumptionSources,
  normalizeMagicConsumptionGroups,
  resolveMagicConsumptionOptions,
  validateMagicConsumptionChoices
} from "../utils/magic-consumption.mjs";

const escapeHtml = value => foundry.utils.escapeHTML(String(value ?? ""));
const localize = key => game.i18n.localize(key);
const format = (key, data) => game.i18n.format(key, data);

function triggerLabel(trigger) {
  return localize({
    attempt: "GUM.MagicConsumption.TriggerAttempt",
    success: "GUM.MagicConsumption.TriggerSuccess",
    failure: "GUM.MagicConsumption.TriggerFailure"
  }[trigger] || "GUM.MagicConsumption.TriggerAttempt");
}

function sourceTypeLabel(type) {
  return localize({
    hp: "GUM.MagicConsumption.SourceHP",
    fp: "GUM.MagicConsumption.SourceFP",
    spell_reserve: "GUM.MagicConsumption.SourceSpellReserve",
    power_reserve: "GUM.MagicConsumption.SourcePowerReserve",
    combat_tracker: "GUM.MagicConsumption.SourceCombatTracker",
    item_quantity: "GUM.MagicConsumption.SourceItemQuantity"
  }[type] || "GUM.MagicConsumption.SourceFP");
}

function validationMessage(validation, groups, sources) {
  const error = validation.errors[0];
  const group = groups.find(entry => entry.id === error?.groupId);
  const source = sources.find(entry => entry.key === error?.sourceKey);
  if (error?.code === "missing_sources") return format("GUM.MagicConsumption.ErrorMissingSources", { group: group?.name || localize("GUM.MagicConsumption.DefaultGroup") });
  if (error?.code === "invalid_source") return format("GUM.MagicConsumption.ErrorInvalidSource", { group: group?.name || localize("GUM.MagicConsumption.DefaultGroup") });
  if (error?.code === "invalid_amount") return format("GUM.MagicConsumption.ErrorInvalidAmount", { group: group?.name || localize("GUM.MagicConsumption.DefaultGroup") });
  if (error?.code === "whole_amount_required") return format("GUM.MagicConsumption.ErrorWholeAmount", { source: source?.name || "" });
  if (error?.code === "insufficient") return format("GUM.MagicConsumption.ErrorInsufficient", { source: source?.name || "", required: error.required, available: error.available });
  return localize("GUM.MagicConsumption.ErrorInvalid");
}

function defaultChoices(groups, sources) {
  return Object.fromEntries(groups.map(group => [group.id, {
    sourceKey: resolveMagicConsumptionOptions(group, sources)[0]?.key || "",
    amount: group.amount
  }]));
}

async function promptMagicConsumption(item, groups, sources) {
  const isPower = item?.type === "power";
  const iconClass = isPower ? "fa-bolt" : "fa-hat-wizard";
  const iconVariant = isPower ? "power" : "magic";
  const rows = groups.map(group => {
    const options = resolveMagicConsumptionOptions(group, sources);
    const optionHtml = options.map(source => `<option value="${escapeHtml(source.key)}">${escapeHtml(source.name)} — ${escapeHtml(sourceTypeLabel(source.type))} (${escapeHtml(source.current)})</option>`).join("");
    return `<section class="gum-record-editor__section gum-magic-consumption-dialog__group form-group--full" data-consumption-group="${escapeHtml(group.id)}">
      <header class="gum-magic-consumption-dialog__group-header"><strong>${escapeHtml(group.name || localize("GUM.MagicConsumption.DefaultGroup"))}</strong><span><i class="fas fa-flag-checkered" aria-hidden="true"></i> ${escapeHtml(triggerLabel(group.trigger))}</span></header>
      <div class="form-group gum-magic-consumption-dialog__source"><label for="magic-source-${escapeHtml(group.id)}">${escapeHtml(localize("GUM.MagicConsumption.PaymentSource"))}</label><select id="magic-source-${escapeHtml(group.id)}" name="source.${escapeHtml(group.id)}">${optionHtml}</select></div>
      <div class="form-group gum-magic-consumption-dialog__amount"><label for="magic-amount-${escapeHtml(group.id)}">${escapeHtml(localize("GUM.MagicConsumption.Amount"))}</label><div class="gum-magic-consumption-stepper">
        <button type="button" class="gum-magic-consumption-step" data-direction="decrease" title="${escapeHtml(localize("GUM.MagicConsumption.DecreaseAmount"))}" aria-label="${escapeHtml(localize("GUM.MagicConsumption.DecreaseAmount"))}" ${group.variableAmount ? "" : "disabled"}><i class="fas fa-minus" aria-hidden="true"></i></button>
        <input id="magic-amount-${escapeHtml(group.id)}" type="number" min="0" step="any" name="amount.${escapeHtml(group.id)}" value="${escapeHtml(group.amount)}" ${group.variableAmount ? "" : "readonly"}>
        <button type="button" class="gum-magic-consumption-step" data-direction="increase" title="${escapeHtml(localize("GUM.MagicConsumption.IncreaseAmount"))}" aria-label="${escapeHtml(localize("GUM.MagicConsumption.IncreaseAmount"))}" ${group.variableAmount ? "" : "disabled"}><i class="fas fa-plus" aria-hidden="true"></i></button>
      </div></div>
    </section>`;
  }).join("");

  return new Promise(resolve => new Dialog({
    title: format("GUM.MagicConsumption.DialogTitle", { name: item.name }),
    content: `<form class="gum-popup-form gum-record-editor gum-magic-consumption-dialog" autocomplete="off">
      <header class="gum-record-editor__intro form-group--full">
        <span class="gum-record-editor__icon gum-record-editor__icon--${iconVariant}"><i class="fas ${iconClass}" aria-hidden="true"></i></span>
        <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(localize("GUM.MagicConsumption.DialogHint"))}</small></span>
      </header>
      <p class="gum-record-editor__section-label form-group--full"><i class="fas fa-coins" aria-hidden="true"></i>${escapeHtml(localize("GUM.MagicConsumption.Title"))}</p>
      ${rows}
    </form>`,
    buttons: {
      use: {
        icon: '<i class="fas fa-wand-magic-sparkles"></i>',
        label: localize("GUM.MagicConsumption.Use"),
        callback: html => {
          const choices = {};
          for (const group of groups) choices[group.id] = {
            sourceKey: String(html.find(`[name="source.${group.id}"]`).val() || ""),
            amount: html.find(`[name="amount.${group.id}"]`).val()
          };
          resolve(choices);
        }
      },
      cancel: { label: localize("GUM.MagicConsumption.Cancel"), callback: () => resolve(null) }
    },
    default: "use",
    render: html => {
      const normalizeAmountInput = input => {
        const raw = String(input.val() ?? "").trim();
        if (!raw) return;
        const amount = Number(raw.replace(",", "."));
        if (Number.isFinite(amount)) input.val(String(Number(amount.toFixed(6))));
      };

      html.find(".gum-magic-consumption-step").on("click", event => {
        event.preventDefault();
        const button = event.currentTarget;
        if (button.disabled) return;
        const input = $(button).closest(".gum-magic-consumption-stepper").find('input[type="number"]');
        const current = Number(input.val());
        const direction = button.dataset.direction === "decrease" ? -1 : 1;
        const next = Math.max(0, (Number.isFinite(current) ? current : 0) + direction);
        input.val(String(Number(next.toFixed(6)))).trigger("input");
      });
      html.find('.gum-magic-consumption-stepper input[type="number"]').on("change blur", event => {
        normalizeAmountInput($(event.currentTarget));
      });
    },
    close: () => resolve(null)
  }, { classes: ["dialog", "gum", "gum-sheet-edit-dialog", "gum-record-edit-dialog", "gum-resource-edit-dialog", "gum-magic-consumption-dialog-window"], width: 520, height: "auto" }).render(true));
}

export async function prepareMagicConsumptionSession(item, actor) {
  const groups = normalizeMagicConsumptionGroups(item?.system?.consumptionGroups);
  if (!groups.length) return { enabled: false, groups: [], choices: {} };
  const sources = collectMagicConsumptionSources(actor);
  const unresolved = groups.find(group => !resolveMagicConsumptionOptions(group, sources).length);
  if (unresolved) {
    ui.notifications.warn(format("GUM.MagicConsumption.ErrorMissingSources", { group: unresolved.name || localize("GUM.MagicConsumption.DefaultGroup") }));
    return null;
  }

  const needsPrompt = groups.some(group => group.confirm || group.variableAmount || resolveMagicConsumptionOptions(group, sources).length > 1);
  const requestedChoices = needsPrompt ? await promptMagicConsumption(item, groups, sources) : defaultChoices(groups, sources);
  if (!requestedChoices) return null;
  const validation = validateMagicConsumptionChoices(groups, sources, requestedChoices);
  if (!validation.valid) {
    ui.notifications.warn(validationMessage(validation, groups, sources));
    return null;
  }
  return { enabled: true, groups, choices: validation.choices };
}

export async function applyMagicConsumptionTrigger(session, actor, trigger) {
  if (!session?.enabled) return [];
  const deductions = buildMagicConsumptionDeductions(session.groups, session.choices, trigger);
  if (!deductions.length) return [];
  try {
    const result = await applyMagicConsumptionDeductions(actor, deductions);
    return result.consumed;
  } catch (error) {
    const message = error?.message === "insufficient"
      ? localize("GUM.MagicConsumption.ErrorBalanceChanged")
      : localize("GUM.MagicConsumption.ErrorApply");
    ui.notifications.error(message);
    throw error;
  }
}
