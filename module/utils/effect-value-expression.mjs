const CONDITIONAL_NAMES = new Set(["se", "if"]);
const ALL_NAMES = new Set(["todos", "all"]);
const ANY_NAMES = new Set(["algum", "any"]);
const NOT_NAMES = new Set(["nao", "não", "not"]);
const HAS_ITEM_NAMES = new Set(["possui", "hasitem", "has_item"]);

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

function evaluateCondition(source, context) {
    const text = String(source ?? "").trim();
    const normalized = normalizeText(text);
    if (["true", "verdadeiro", "sim"].includes(normalized)) return true;
    if (["false", "falso", "nao", "não"].includes(normalized)) return false;

    const call = parseCall(text);
    if (!call) throw new Error(`Condição não reconhecida: ${text}`);
    if (HAS_ITEM_NAMES.has(call.name)) {
        if (call.args.length !== 1) throw new Error("possui() requer exatamente um item.");
        return actorHasItem(context.actor, call.args[0]);
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
