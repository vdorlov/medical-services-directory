importScripts('https://unpkg.com/xlsx/dist/xlsx.full.min.js');

// Обработка данных в отдельном потоке
self.onmessage = function(e) {
    const { type, data } = e.data;
    
    if (type === 'processData') {
        try {
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            
            // Получаем данные из Excel
            const rawData = XLSX.utils.sheet_to_json(worksheet, {
                header: ['section', 'subsection1', 'subsection2', 'eruCode', 'eruName', 
                        'nomenclatureCode', 'nomenclatureName', 'active', 'startDate', 
                        'lastModified', 'vat', 'hasTechCard', 'description'],
                range: 1
            }).filter(row => row.eruCode);

            // Обрабатываем данные батчами
            const BATCH_SIZE = 25;
            let processedCount = 0;
            
            for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
                const batch = rawData.slice(i, i + BATCH_SIZE)
                    .map(row => ({
                        section: row.section || '',
                        subsection1: row.subsection1 || '',
                        subsection2: row.subsection2 || '',
                        eruCode: row.eruCode || '',
                        eruName: row.eruName || '',
                        nomenclatureCode: row.nomenclatureCode || '',
                        nomenclatureName: row.nomenclatureName || '',
                        active: !!row.active,
                        startDate: formatExcelDate(row.startDate),
                        lastModified: formatExcelDate(row.lastModified),
                        vat: !!row.vat,
                        hasTechCard: !!row.hasTechCard,
                        description: row.description || ''
                    }));

                // Сортируем батч
                batch.sort((a, b) => {
                    let compare = a.section.localeCompare(b.section, 'ru');
                    if (compare !== 0) return compare;
                    compare = a.subsection1.localeCompare(b.subsection1, 'ru');
                    if (compare !== 0) return compare;
                    compare = a.subsection2.localeCompare(b.subsection2, 'ru');
                    if (compare !== 0) return compare;
                    return a.eruCode.localeCompare(b.eruCode, 'ru');
                });

                // Отправляем обработанный батч
                self.postMessage({
                    type: 'batch',
                    data: batch
                });

                processedCount += batch.length;
                self.postMessage({
                    type: 'progress',
                    data: Math.round((processedCount / rawData.length) * 100)
                });
            }

            self.postMessage({ type: 'complete' });
            
        } catch (error) {
            self.postMessage({
                type: 'error',
                data: error.message
            });
        }
    }
};

function formatExcelDate(excelDate) {
    if (!excelDate) return '';
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toLocaleDateString('ru-RU');
} 