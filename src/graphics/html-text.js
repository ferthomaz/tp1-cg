export class HtmlText {
    constructor(canvas) {
        this.nodes = [];
        this.used = 0;
        const document = canvas.ownerDocument;
        if (!document || !canvas.parentElement) return;
        this.layer = document.createElement('div');
        this.layer.className = 'game-text-layer';
        this.layer.setAttribute('aria-hidden', 'true');
        canvas.parentElement.append(this.layer);
    }

    clear() {
        for (const node of this.nodes) node.hidden = true;
        this.used = 0;
    }

    draw({ text, x, y, scale, color, align, maxWidth }) {
        if (!this.layer) return;
        let node = this.nodes[this.used++];
        if (!node) {
            node = this.layer.ownerDocument.createElement('span');
            this.nodes.push(node);
            this.layer.append(node);
        }
        node.hidden = false;
        node.textContent = text;
        Object.assign(node.style, {
            left: `${x}px`, top: `${y}px`, fontSize: `${12 * scale}px`,
            color: `rgba(${color.slice(0, 3).map(value => Math.round(value * 255)).join(',')},${color[3]})`,
            transform: align === 'center' ? 'translateX(-50%)' : align === 'right' ? 'translateX(-100%)' : '',
            maxWidth: maxWidth === undefined ? '' : `${maxWidth}px`,
        });
    }

    cover(rect) {
        if (!this.layer) return;
        const origin = this.layer.getBoundingClientRect();
        const scaleX = origin.width / this.layer.offsetWidth;
        const scaleY = origin.height / this.layer.offsetHeight;
        if (!scaleX || !scaleY) return;
        for (const node of this.nodes) {
            if (node.hidden) continue;
            const bounds = node.getBoundingClientRect();
            const x = (bounds.left - origin.left) / scaleX, y = (bounds.top - origin.top) / scaleY;
            if (x < rect.x + rect.width && x + bounds.width / scaleX > rect.x
                && y < rect.y + rect.height && y + bounds.height / scaleY > rect.y) node.hidden = true;
        }
    }

    dispose() { this.layer?.remove(); this.nodes = []; }
}
