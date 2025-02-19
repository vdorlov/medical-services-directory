class DatabaseService {
    constructor() {
        this.dbName = 'medicalDB';
        this.dbVersion = 1;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Создаем хранилища для таблиц
                if (!db.objectStoreNames.contains('nomenclature')) {
                    db.createObjectStore('nomenclature', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('registry')) {
                    db.createObjectStore('registry', { keyPath: 'id', autoIncrement: true });
                }
            };
        });
    }

    async addData(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // Добавляем данные пачками по 1000 записей
            const chunks = this.chunkArray(data, 1000);
            let completed = 0;

            chunks.forEach(chunk => {
                chunk.forEach(item => {
                    store.add(item);
                });
            });

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    async getData(storeName, offset, limit, filters = {}) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(storeName, 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => {
                let data = request.result;
                
                // Применяем фильтры
                if (Object.keys(filters).length > 0) {
                    data = this.filterData(data, filters);
                }

                // Применяем пагинацию
                const paginatedData = data.slice(offset, offset + limit);
                resolve({
                    data: paginatedData,
                    total: data.length
                });
            };

            request.onerror = () => reject(request.error);
        });
    }

    filterData(data, filters) {
        return data.filter(item => {
            return Object.entries(filters).every(([key, value]) => {
                if (!value) return true;
                return item[key].toLowerCase().includes(value.toLowerCase());
            });
        });
    }

    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
}

export const dbService = new DatabaseService(); 