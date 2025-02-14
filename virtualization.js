export class VirtualScroller {
    constructor(container, options) {
        this.container = container;
        this.options = {
            itemHeight: options.itemHeight || 50,
            amount: options.amount || 10,
            buffer: options.buffer || 5,
            ...options
        };

        this.totalItems = 0;
        this.startIndex = 0;
        this.visibleItems = [];
        this.scrollTop = 0;

        this.init();
    }

    init() {
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        
        // Создаем контейнер для элементов
        this.content = document.createElement('div');
        this.content.style.position = 'absolute';
        this.content.style.top = '0';
        this.content.style.left = '0';
        this.content.style.width = '100%';
        
        this.container.appendChild(this.content);

        this.container.addEventListener('scroll', this.onScroll.bind(this));
    }

    setItems(totalItems) {
        this.totalItems = totalItems;
        this.content.style.height = `${totalItems * this.options.itemHeight}px`;
        this.render();
    }

    onScroll() {
        this.scrollTop = this.container.scrollTop;
        this.render();
    }

    render() {
        const startIndex = Math.floor(this.scrollTop / this.options.itemHeight);
        if (startIndex === this.startIndex) return;

        this.startIndex = startIndex;
        const endIndex = Math.min(
            startIndex + this.options.amount + this.options.buffer,
            this.totalItems
        );

        // Запрашиваем новые данные через callback
        if (this.options.onUpdate) {
            this.options.onUpdate(startIndex, endIndex);
        }
    }

    updateContent(items) {
        this.content.innerHTML = '';
        items.forEach((item, index) => {
            const element = this.options.renderItem(item);
            element.style.position = 'absolute';
            element.style.top = `${(this.startIndex + index) * this.options.itemHeight}px`;
            this.content.appendChild(element);
        });
    }
} 