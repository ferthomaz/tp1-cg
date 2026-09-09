//valida alguns conceitos pra nao ter que colocar um monte de if em tudo
export function number(value, name, minimum = 0, exclusive = false) {
    if (!Number.isFinite(value) || (exclusive ? value <= minimum : value < minimum)) {
        throw new TypeError(`${name} must be finite and ${exclusive ? 'greater than' : 'at least'} ${minimum}.`);
    }
    return value;
}

export function identifier(value, name = 'id') {
    if (typeof value !== 'string' || value.trim() === '') {
        throw new TypeError(`${name} must be a nonempty string.`);
    }
    return value;
}

export function point(value) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) {
        throw new TypeError('Positions must contain finite x and y coordinates.');
    }
    return { x: value.x, y: value.y };
}

export function uniqueIndex(items, label) {
    const index = new Map();
    for (const item of items) {
        identifier(item.id, `${label} id`);
        if (index.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
        index.set(item.id, item);
    }
    return index;
}
