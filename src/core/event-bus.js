// Domain events carry plain data; views can subscribe without owning game state.
export class EventBus {
    #listeners = new Map();

    on(type, listener) {
        if (typeof listener !== 'function') throw new TypeError('Listener must be a function.');
        if (!this.#listeners.has(type)) this.#listeners.set(type, new Set());
        this.#listeners.get(type).add(listener);
        return () => {
            const listeners = this.#listeners.get(type);
            listeners?.delete(listener);
            if (listeners?.size === 0) this.#listeners.delete(type);
        };
    }

    emit(type, payload) {
        for (const listener of [...(this.#listeners.get(type) ?? [])]) listener(payload);
    }
}
