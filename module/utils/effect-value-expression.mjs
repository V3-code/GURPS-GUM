const CONDITIONAL_NAMES = new Set(["se", "if"]);
const ALL_NAMES = new Set(["todos", "all"]);
const ANY_NAMES = new Set(["algum", "any"]);
const NOT_NAMES = new Set(["nao", "não", "not"]);
const HAS_ITEM_NAMES = new Set(["possui", "hasitem", "has_item"]);
const HAS_NO_ITEM_NAMES = new Set(["naopossui", "doesnothave", "does_not_have"]);
const HAS_ANY_ITEM_NAMES = new Set(["possuialgum", "hasanyitem", "has_any_item"]);
const HAS_ALL_ITEMS_NAMES = new Set(["possuitodos", "hasallitems", "has_all_items"]);
const ITEM_LEVEL_NAMES = new Set(["nivel", "itemlevel", "item_level"]);
const ITEM_QUANTITY_NAMES = new Set(["quantidade", "quantity"]);
const ITEM_EQUIPPED_NAMES = new Set(["equipado", "equipped"]);
const ACTIVE_CONDITION_NAMES = new Set(["condicaoativa", "activecondition", "active_condition"]);
const STATUS_NAMES = new Set(["status", "temstatus", "hasstatus", "has_status"]);
const ATTRIBUTE_NAMES = new Set(["atributo", "attribute"]);

const normalizeText = (value) => String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

function parseCall(source) {
    const text = String(source ?? "").trim();
    const match = text.match(/^([A-Za-zÀ-ÿ_][A-Za-z0-9À-ÿ_]*)\s*\(/u);
    if (!match) return null;

    const openIndex = text.indexOf("(", match[0].length - 1);
    let depth = 0;
    let quote = null;
    let escaped = false;
    let closeIndex = -1;

    for (let index = openIndex; index < text.length; index += 1) {
        const character = text[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '"' || character === "'") {
            quote = character;
            continue;
        }
        if (character === "(") depth += 1;
        if (character === ")") {
            depth -= 1;
            if (depth === 0) {
                closeIndex = index;
                break;
            }
        }
    }

    if (closeIndex < 0 || text.slice(closeIndex + 1).trim()) return null;
    return {
        name: normalizeText(match[1]),
        args: splitArguments(text.slice(openIndex + 1, closeIndex))
    };
}

function splitArguments(source) {
    const entries = [];
    let current = "";
    const bracketStack = [];
    let quote = null;
    let escaped = false;
    const closingBracket = { "(": ")", "[": "]", "{": "}" };

    for (const character of String(source ?? "")) {
        if (quote) {
            current += character;
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '"' || character === "'") {
            quote = character;
            current += character;
            continue;
        }
        if (character in closingBracket) {
            bracketStack.push(closingBracket[character]);
        } else if ([")", "]", "}"].includes(character)) {
            if (bracketStack.at(-1) === character) bracketStack.pop();
        }
        if (character === "," && bracketStack.length === 0) {
            entries.push(current.trim());
            current = "";
        } else {
            current += character;
        }
    }
    if (current.trim() || entries.length) entries.push(current.trim());
    return entries;
}

function unquote(value) {
    const text = String(value ?? "").trim();
    if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
        return text.slice(1, -1).replace(/\\([\\"'])/g, "$1");
    }
    return text;
}

function actorItems(actor) {
    if (Array.isArray(actor?.items)) return actor.items;
    if (Array.isArray(actor?.items?.contents)) return actor.items.contents;
    return actor?.items ? Array.from(actor.items) : [];
}

function itemReferences(item) {
    return [
        item?.id,
        item?._id,
        item?.uuid,
        item?.name,
        item?.flags?.core?.sourceId,
        item?.flags?.gum?.sourceId
    ].filter(Boolean).map(normalizeText);
}

export function actorHasItem(actor, reference) {
    const wanted = normalizeText(unquote(reference));
    if (!wanted) return false;
    return actorItems(actor).some((item) => itemReferences(item).includes(wanted));
}

function findActorItems(actor, reference) {
    const wanted = normalizeText(unquote(reference));
    if (!wanted) return [];
    return actorItems(actor).filter((item) => itemReferences(item).includes(wanted));
}

function findActorItem(actor, reference) {
    return findActorItems(actor, reference)[0] ?? null;
}

function actorHasStatus(actor, reference) {
    const wanted = normalizeText(unquote(reference));
    if (!wanted) return false;
    return Array.from(actor?.appliedEffects ?? actor?.effects ?? []).some((effect) => {
        if (effect?.disabled || effect?.isSuppressed) return false;
        const statuses = Array.from(effect?.statuses ?? []).map(normalizeText);
        return statuses.includes(wanted) || normalizeText(effect?.name) === wanted;
    });
}

function resolveOperand(source, context) {
    const text = String(source ?? "").trim();
    if (/^[+-]?\d+(?:\.\d+)?$/.test(text)) return Number(text);
    const call = parseCall(text);
    if (!call || call.args.length !== 1) throw new Error(`Valor de comparação não reconhecido: ${text}`);
    const item = findActorItem(context.actor, call.args[0]);
    if (ITEM_LEVEL_NAMES.has(call.name)) return Number(item?.system?.level) || 0;
    if (ITEM_QUANTITY_NAMES.has(call.name)) return Number(item?.system?.quantity) || 0;
    if (ATTRIBUTE_NAMES.has(call.name)) {
        const key = normalizeText(unquote(call.args[0]));
        const attributes = context.actor?.system?.attributes ?? {};
        const attributeKey = Object.keys(attributes).find((candidate) => normalizeText(candidate) === key);
        const attribute = attributeKey ? attributes[attributeKey] : null;
        return Number(attribute?.override ?? attribute?.final ?? attribute?.final_computed ?? attribute?.value) || 0;
    }
    throw new Error(`Função numérica não reconhecida: ${call.name}().`);
}

function findTopLevelComparison(source) {
    const text = String(source ?? "");
    const bracketStack = [];
    const closingBracket = { "(": ")", "[": "]", "{": "}" };
    let quote = null;
    let escaped = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = null;
            continue;
        }
        if (character === '"' || character === "'") {
            quote = character;
            continue;
        }
        if (character in closingBracket) bracketStack.push(closingBracket[character]);
        else if (bracketStack.at(-1) === character) bracketStack.pop();
        if (bracketStack.length) continue;
        const operator = [">=", "<=", "!=", "==", ">", "<", "="].find((candidate) => text.startsWith(candidate, index));
        if (operator) return { left: text.slice(0, index), operator, right: text.slice(index + operator.length) };
    }
    return null;
}

function evaluateCondition(source, context) {
    const text = String(source ?? "").trim();
    const normalized = normalizeText(text);
    if (["true", "verdadeiro", "sim"].includes(normalized)) return true;
    if (["false", "falso", "nao", "não"].includes(normalized)) return false;

    const comparison = findTopLevelComparison(text);
    if (comparison) {
        const left = resolveOperand(comparison.left, context);
        const right = resolveOperand(comparison.right, context);
        if (comparison.operator === ">=") return left >= right;
        if (comparison.operator === "<=") return left <= right;
        if (comparison.operator === ">") return left > right;
        if (comparison.operator === "<") return left < right;
        if (comparison.operator === "!=") return left !== right;
        return left === right;
    }

    const call = parseCall(text);
    if (!call) throw new Error(`Condição não reconhecida: ${text}`);
    if (HAS_ITEM_NAMES.has(call.name)) {
        if (call.args.length !== 1) throw new Error("possui() requer exatamente um item.");
        return actorHasItem(context.actor, call.args[0]);
    }
    if (HAS_NO_ITEM_NAMES.has(call.name)) {
        if (call.args.length !== 1) throw new Error("naopossui() requer exatamente um item.");
        return !actorHasItem(context.actor, call.args[0]);
    }
    if (HAS_ANY_ITEM_NAMES.has(call.name)) {
        if (!call.args.length) throw new Error("possuiAlgum() requer ao menos um item.");
        return call.args.some((entry) => actorHasItem(context.actor, entry));
    }
    if (HAS_ALL_ITEMS_NAMES.has(call.name)) {
        if (!call.args.length) throw new Error("possuiTodos() requer ao menos um item.");
        return call.args.every((entry) => actorHasItem(context.actor, entry));
    }
    if (ITEM_EQUIPPED_NAMES.has(call.name)) {
        if (call.args.length !== 1) throw new Error("equipado() requer exatamente um item.");
        return findActorItems(context.actor, call.args[0]).some((item) =>
            item?.system?.equipped === true || item?.system?.location === "equipped"
        );
    }
    if (ACTIVE_CONDITION_NAMES.has(call.name)) {
        if (call.args.length !== 1) throw new Error("condicaoAtiva() requer exatamente uma condição.");
        const item = findActorItem(context.actor, call.args[0]);
        return item?.type === "condition"
            && item?.flags?.gum?.wasActive === true
            && item?.flags?.gum?.manual_override !== true;
    }
    if (STATUS_NAMES.has(call.name)) {
        if (call.args.length !== 1) throw new Error("status() requer exatamente um status.");
        return actorHasStatus(context.actor, call.args[0]);
    }
    if (ALL_NAMES.has(call.name)) {
        if (!call.args.length) throw new Error("todos() requer ao menos uma condição.");
        return call.args.every((entry) => evaluateCondition(entry, context));
    }
    if (ANY_NAMES.has(call.name)) {
        if (!call.args.length) throw new Error("algum() requer ao menos uma condição.");
        return call.args.some((entry) => evaluateCondition(entry, context));
    }
    if (NOT_NAMES.has(call.name)) {
        if (call.args.length !== 1) throw new Error("nao() requer exatamente uma condição.");
        return !evaluateCondition(call.args[0], context);
    }
    throw new Error(`Função condicional não reconhecida: ${call.name}().`);
}

export function hasConditionalValueExpression(value) {
    if (typeof value !== "string") return false;
    const call = parseCall(value);
    return Boolean(call && CONDITIONAL_NAMES.has(call.name));
}

/**
 * Resolve somente a estrutura condicional e devolve o ramo escolhido sem
 * interpretar sua fórmula. Assim, dados e referências continuam a cargo do
 * avaliador apropriado para cada fase (aplicação, rolagem ou ação instantânea).
 */
export function resolveConditionalValue(value, context = {}) {
    if (!hasConditionalValueExpression(value)) return value;
    const call = parseCall(value);
    if (call.args.length !== 3) throw new Error("se() requer condição, valor verdadeiro e valor falso.");
    const selected = evaluateCondition(call.args[0], context) ? call.args[1] : call.args[2];
    return hasConditionalValueExpression(selected)
        ? resolveConditionalValue(selected, context)
        : unquote(selected);
}
