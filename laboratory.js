document.addEventListener('DOMContentLoaded', function() {
    // DOM элементы
    const elements = {
        table: document.getElementById('laboratoryTable'),
        tbody: document.getElementById('laboratoryTable').querySelector('tbody'),
        loadedCount: document.getElementById('loadedCount'),
        loadingIndicator: document.getElementById('loadingIndicator')
    };

    // Состояние приложения
    const state = {
        data: [],
        filteredData: []
    };

    // Загрузка данных из Excel
    async function loadData() {
        try {
            elements.loadingIndicator.style.display = 'flex';
            
            // Загружаем Excel файл
            const response = await fetch('https://raw.githubusercontent.com/vdorlov/for_website_1/master/For_website_erlu.xlsx');

            if (!response.ok) throw new Error('Ошибка загрузки файла');
            
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Берем первый лист
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Преобразуем в JSON
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            
            // Выводим первую строку для проверки названий столбцов
            console.log('Первая строка данных:', jsonData[0]);
            
            // Преобразуем данные в нужный формат
            state.data = jsonData
                .filter(row => row['Код'] && row['Наименование']) // Проверяем обязательные поля
                .map(row => {
                    const item = {
                        section: row['Раздел'] || '',
                        subsection1: row['Подраздел 1'] || '',
                        subsection2: row['Подраздел 2'] || '',
                        code: row['Код'] || '',
                        name: row['Наименование'] || '',
                        active: true,
                        startDate: '01.01.2024',
                        lastModified: new Date().toLocaleDateString('ru'),
                        hasTechCard: true,
                        description: row['Описание'] || `Описание для услуги ${row['Наименование']}`
                    };
                    console.log('Преобразованная строка:', item);
                    return item;
                });

            console.log('Всего загружено строк:', state.data.length);

            state.filteredData = [...state.data];
            displayData();
            
            elements.loadedCount.textContent = `${state.data.length} записей`;
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            elements.loadedCount.textContent = 'Ошибка загрузки данных';
        } finally {
            elements.loadingIndicator.style.display = 'none';
        }
    }

    // Отображение данных
    function displayData() {
        elements.tbody.innerHTML = state.data.map(item => `
            <tr class="clickable-row" data-id="${item.code}">
                <td>${item.section}</td>
                <td>${item.subsection1}</td>
                <td>${item.subsection2}</td>
                <td>${item.code}</td>
                <td>${item.name}</td>
            </tr>
        `).join('');
    }

    // Отображение карточки услуги
    function showServiceModal(service) {
        document.getElementById('serviceCode').textContent = service.code;
        document.getElementById('serviceName').textContent = service.name;
        document.getElementById('serviceActive').textContent = service.active ? 'Активна' : 'Неактивна';
        document.getElementById('serviceActive').className = `status-badge ${service.active ? 'active' : 'inactive'}`;
        document.getElementById('serviceStartDate').textContent = service.startDate;
        document.getElementById('serviceLastModified').textContent = service.lastModified;
        document.getElementById('serviceTechCard').textContent = service.hasTechCard ? 'Доступна' : 'Отсутствует';
        document.getElementById('serviceTechCard').className = `tech-status ${service.hasTechCard ? 'available' : ''}`;
        document.getElementById('serviceDescription').textContent = service.description;

        document.getElementById('serviceModal').style.display = 'flex';
    }

    // Обработчики событий
    function setupEventListeners() {
        // Клик по строке таблицы
        elements.tbody.addEventListener('click', function(e) {
            const row = e.target.closest('.clickable-row');
            if (row) {
                const code = row.dataset.id;
                const service = state.data.find(item => item.code === code);
                if (service) {
                    showServiceModal(service);
                }
            }
        });

        // Закрытие модальных окон
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', function() {
                this.closest('.modal').style.display = 'none';
            });
        });

        // Закрытие модального окна при клике вне его области
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                }
            });
        });
    }

    // Инициализация
    loadData();
    setupEventListeners();
}); 