document.addEventListener('DOMContentLoaded', function() {
    // Уменьшаем размер батча и страницы для более быстрой начальной загрузки
    const ITEMS_PER_PAGE = 20;
    const BATCH_SIZE = 50;
    const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/vdorlov/for_website_1/master/For_website_eru.xlsx';
    
    // Добавляем кэширование данных в localStorage
    const CACHE_KEY = 'eruDataCache';
    const CACHE_TIMESTAMP_KEY = 'eruDataTimestamp';
    const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 часа

    // Оптимизируем состояние
    const state = {
        allData: [],
        filteredData: [],
        currentPage: 1,
        loading: false,
        initialized: false,
        filters: {
            section: '',
            subsection1: '',
            subsection2: '',
            eruCode: '',
            eruName: ''
        },
        dataIndexes: new Map() // Добавляем индексы для быстрого поиска
    };

    // Кэшируем DOM элементы
    const elements = {
        table: document.getElementById('eruTable'),
        tbody: document.getElementById('eruTable').querySelector('tbody'),
        loadingIndicator: document.getElementById('loadingIndicator'),
        loadedCount: document.getElementById('loadedCount'),
        pagination: document.getElementById('pagination'),
        filterInputs: document.querySelectorAll('.column-filter'),
        structureTree: document.getElementById('structureTree')
    };

    // Оптимизируем константы
    const DATE_OPTIONS = { day: '2-digit', month: '2-digit', year: 'numeric' };

    // Кэшируем форматтер дат
    const dateFormatter = new Intl.DateTimeFormat('ru-RU', DATE_OPTIONS);

    // Оптимизированная функция загрузки данных
    async function loadData() {
        try {
            state.loading = true;
            elements.loadingIndicator.style.display = 'block';
            elements.loadedCount.textContent = 'Загрузка данных...';

            const response = await fetch(GITHUB_RAW_URL);
            const buffer = await response.arrayBuffer();
            
            // Оптимизируем настройки парсинга Excel
            const workbook = XLSX.read(new Uint8Array(buffer), { 
                type: 'array',
                cellDates: false, // Отключаем автоматическое преобразование дат
                cellNF: false,
                cellText: false
            });
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(worksheet, {
                header: ['section', 'subsection1', 'subsection2', 'eruCode', 'eruName', 
                        'nomenclatureCode', 'nomenclatureName', 'active', 'startDate', 
                        'lastModified', 'vat', 'hasTechCard', 'description'],
                range: 1,
                raw: true
            }).filter(row => row.eruCode);

            // Обрабатываем данные большими батчами
            for (let i = 0; i < rawData.length; i += BATCH_SIZE) {
                const batch = rawData.slice(i, i + BATCH_SIZE);
                
                // Оптимизированная обработка батча
                const processedBatch = new Array(batch.length);
                for (let j = 0; j < batch.length; j++) {
                    const row = batch[j];
                    processedBatch[j] = {
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
                    };
                }

                state.allData.push(...processedBatch);
                
                // Обновляем прогресс
                const progress = Math.round((i + BATCH_SIZE) / rawData.length * 100);
                elements.loadedCount.textContent = `Обработано ${Math.min(100, progress)}%`;

                // Отображаем первую страницу сразу после обработки первого батча
                if (i === 0) {
                    state.filteredData = state.allData;
                    requestAnimationFrame(() => displayPage(1));
                }

                // Даем браузеру время на отрисовку только после каждого четвертого батча
                if (i % (BATCH_SIZE * 4) === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            }

            // Сортируем все данные один раз в конце
            state.allData.sort((a, b) => a.section.localeCompare(b.section, 'ru'));
            state.filteredData = state.allData;
            
            elements.loadedCount.textContent = `Загружено ${state.allData.length} записей`;
            displayPage(1);
            state.initialized = true;

            // После успешной загрузки данных
            buildStructure();

        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            elements.loadedCount.textContent = 'Ошибка загрузки данных';
        } finally {
            state.loading = false;
            elements.loadingIndicator.style.display = 'none';
        }
    }

    // Оптимизированная функция форматирования даты
    function formatExcelDate(excelDate) {
        if (!excelDate) return '';
        
        try {
            if (typeof excelDate === 'number') {
                // Оптимизированный расчет даты из Excel
                const date = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
                return date.getTime() ? dateFormatter.format(date) : '';
            }
            return '';
        } catch {
            return '';
        }
    }

    // Оптимизированное слияние отсортированных массивов
    function mergeSort(left, right) {
        const result = new Array(left.length + right.length);
        let i = 0, j = 0, k = 0;
        
        while (i < left.length && j < right.length) {
            result[k++] = compareRows(left[i], right[j]) <= 0 ? left[i++] : right[j++];
        }
        
        while (i < left.length) result[k++] = left[i++];
        while (j < right.length) result[k++] = right[j++];
        
        return result;
    }

    // Оптимизированное отображение страницы
    function displayPage(page) {
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        
        // Используем DocumentFragment для оптимизации DOM-операций
        const fragment = document.createDocumentFragment();
        const pageData = state.filteredData.slice(start, end);

        for (let i = 0; i < pageData.length; i++) {
            const item = pageData[i];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.section}</td>
                <td>${item.subsection1}</td>
                <td>${item.subsection2}</td>
                <td>${item.eruCode}</td>
                <td>${item.eruName}</td>
            `;
            fragment.appendChild(tr);
        }

        elements.tbody.innerHTML = '';
        elements.tbody.appendChild(fragment);

        state.currentPage = page;
        updatePagination();
    }

    // Оптимизированная пагинация
    function updatePagination() {
        const pageCount = Math.ceil(state.filteredData.length / ITEMS_PER_PAGE);
        
        // Не показываем пагинацию, если страница всего одна
        if (pageCount <= 1) {
            elements.pagination.innerHTML = '';
            return;
        }

        const fragment = document.createDocumentFragment();
        const maxVisiblePages = 7;
        let startPage, endPage;

        if (pageCount <= maxVisiblePages) {
            // Показываем все страницы
            startPage = 1;
            endPage = pageCount;
        } else {
            // Вычисляем диапазон видимых страниц
            if (state.currentPage <= Math.ceil(maxVisiblePages / 2)) {
                startPage = 1;
                endPage = maxVisiblePages - 1;
            } else if (state.currentPage >= pageCount - Math.floor(maxVisiblePages / 2)) {
                startPage = pageCount - (maxVisiblePages - 2);
                endPage = pageCount;
            } else {
                startPage = state.currentPage - Math.floor((maxVisiblePages - 2) / 2);
                endPage = state.currentPage + Math.floor((maxVisiblePages - 2) / 2);
            }
        }

        // Добавляем кнопку "Предыдущая"
        if (state.currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '←';
            prevButton.onclick = () => displayPage(state.currentPage - 1);
            fragment.appendChild(prevButton);
        }

        // Добавляем номера страниц
        for (let i = startPage; i <= endPage; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.onclick = () => displayPage(i);
            if (i === state.currentPage) {
                button.disabled = true;
                button.classList.add('current');
            }
            fragment.appendChild(button);
        }

        // Добавляем кнопку "Следующая"
        if (state.currentPage < pageCount) {
            const nextButton = document.createElement('button');
            nextButton.textContent = '→';
            nextButton.onclick = () => displayPage(state.currentPage + 1);
            fragment.appendChild(nextButton);
        }

        elements.pagination.innerHTML = '';
        elements.pagination.appendChild(fragment);
    }

    // Добавляем обработчик изменения размера окна
    window.addEventListener('resize', debounce(() => {
        if (state.initialized) {
            displayPage(state.currentPage);
        }
    }, 150));

    // Обновляем функцию применения фильтров
    function applyFilters() {
        const activeFilters = Object.entries(state.filters)
            .filter(([_, value]) => value.trim() !== '');

        if (activeFilters.length === 0) {
            state.filteredData = [...state.allData];
        } else {
            state.filteredData = state.allData.filter(item => {
                return activeFilters.every(([key, value]) => {
                    const itemValue = String(item[key] || '').toLowerCase();
                    return itemValue.includes(value.toLowerCase().trim());
                });
            });
        }

        state.currentPage = 1;
        displayPage(1);
        updatePagination();
        elements.loadedCount.textContent = state.filteredData.length;
    }

    // Обновляем обработчики событий для фильтров
    function setupFilterEventListeners() {
        // Мгновенная фильтрация при вводе
        elements.filterInputs.forEach(input => {
            input.addEventListener('input', function() {
                state.filters[this.dataset.column] = this.value;
                applyFilters();
            });
        });

        // Сброс всех фильтров
        document.getElementById('resetAllFilters').addEventListener('click', function() {
            elements.filterInputs.forEach(input => {
                input.value = '';
                state.filters[input.dataset.column] = '';
            });
            applyFilters();
        });
    }

    // Вспомогательные функции
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Запуск загрузки данных
    loadData();

    // Обработчик клика по строке таблицы
    document.querySelector('#eruTable tbody').addEventListener('click', (e) => {
        const row = e.target.closest('tr');
        if (!row) return;
        showServiceCard(row);
    });

    // Обновляем функцию рендеринга строк
    function renderVisibleRows(startIndex) {
        const visibleRowsCount = Math.ceil(elements.table.parentElement.clientHeight / 40);
        const endIndex = Math.min(startIndex + visibleRowsCount + 5, state.filteredData.length);
        
        elements.tbody.innerHTML = state.filteredData
            .slice(startIndex, endIndex)
            .map(item => `
                <tr>
                    <td>${item.section}</td>
                    <td>${item.subsection1}</td>
                    <td>${item.subsection2}</td>
                    <td>${item.eruCode}</td>
                    <td>${item.eruName}</td>
                </tr>
            `).join('');
    }

    // Обновляем функцию отображения карточки услуги
    function showServiceCard(row) {
        // Находим данные услуги в state.allData по коду ЕРУ
        const eruCode = row.cells[3].textContent;
        const serviceData = state.allData.find(item => item.eruCode === eruCode);

        if (!serviceData) {
            console.error('Данные услуги не найдены');
            return;
        }

        // Заполняем данные в модальном окне
        document.getElementById('serviceEruCode').textContent = serviceData.eruCode;
        document.getElementById('serviceEruName').textContent = serviceData.eruName;
        
        // Добавляем информацию из номенклатуры в начало карточки
        document.getElementById('serviceNomenclatureCode').textContent = serviceData.nomenclatureCode;
        document.getElementById('serviceNomenclatureName').textContent = serviceData.nomenclatureName;
        
        // Обновляем статус активности
        const activeStatus = document.getElementById('serviceActive');
        activeStatus.textContent = serviceData.active ? 'Действующая' : 'Архивированная';
        activeStatus.className = `status-badge ${serviceData.active ? 'active' : 'inactive'}`;
        
        document.getElementById('serviceStartDate').textContent = serviceData.startDate;
        document.getElementById('serviceLastModified').textContent = serviceData.lastModified;
        
        // Обновляем НДС
        document.getElementById('serviceVAT').textContent = serviceData.vat ? '20%' : 'Нет';
        
        // Обновляем технологическую карту
        const techCard = document.getElementById('serviceTechCard');
        techCard.textContent = serviceData.hasTechCard ? 'Есть' : 'Нет';
        techCard.className = `tech-status ${serviceData.hasTechCard ? 'available' : ''}`;
        if (serviceData.hasTechCard) {
            techCard.title = 'Нажмите для просмотра карты';
        }

        // Отображаем толкователь услуги
        document.getElementById('serviceDescription').textContent = serviceData.description;

        // Показываем модальное окно
        document.getElementById('serviceModal').style.display = 'flex';
    }

    // Обработчик для кнопки истории изменений
    document.getElementById('showChangesBtn').addEventListener('click', () => {
        document.getElementById('serviceModal').style.display = 'none';
        showChangesHistory();
    });

    // Функция отображения истории изменений
    function showChangesHistory() {
        const changes = [
            {
                date: '15.03.2024',
                field: 'Наименование',
                oldValue: 'Старое название услуги',
                newValue: 'Новое название услуги'
            }
            // Получать с сервера
        ];

        const changesList = document.getElementById('changesList');
        changesList.innerHTML = changes.map(change => `
            <div class="change-item">
                <div class="change-date">${change.date}</div>
                <div class="change-details">
                    <div class="change-field">${change.field}</div>
                    <div class="change-values">
                        <span>${change.oldValue}</span>
                        <span class="change-arrow">→</span>
                        <span>${change.newValue}</span>
                    </div>
                </div>
            </div>
        `).join('');

        document.getElementById('changesModal').style.display = 'flex';
    }

    // Закрытие модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').style.display = 'none';
        });
    });

    // Закрытие модального окна при клике вне его области
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Функция построения структуры из данных таблицы ЕРУ
    function buildStructure() {
        const structure = {};
        
        // Собираем данные из таблицы ЕРУ
        state.allData.forEach(item => {
            const section = item.section || '';
            const subsection1 = item.subsection1 || '';
            const subsection2 = item.subsection2 || '';
            
            if (!structure[section]) {
                structure[section] = {};
            }
            if (!structure[section][subsection1]) {
                structure[section][subsection1] = {};
            }
            if (!structure[section][subsection1][subsection2]) {
                structure[section][subsection1][subsection2] = 0;
            }
            structure[section][subsection1][subsection2]++;
        });

        // Создаем HTML для структуры
        const treeHtml = Object.entries(structure)
            .sort(([a], [b]) => a.localeCompare(b, 'ru'))
            .map(([section, subsections1]) => {
                const subsection1Html = Object.entries(subsections1)
                    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
                    .map(([subsection1, subsections2]) => {
                        const subsection2Html = Object.entries(subsections2)
                            .sort(([a], [b]) => a.localeCompare(b, 'ru'))
                            .map(([subsection2, count]) => `
                                <div class="tree-item subsection2">
                                    <div class="tree-toggle clickable">
                                        <span class="tree-text" data-filter='{"section":"${section}","subsection1":"${subsection1}","subsection2":"${subsection2}"}'>${subsection2}</span>
                                        <span class="count">${count}</span>
                                    </div>
                                </div>
                            `).join('');

                        return `
                            <div class="tree-item subsection1">
                                <div class="tree-toggle has-children">
                                    <span class="expand-button">▶</span>
                                    <span class="tree-text" data-filter='{"section":"${section}","subsection1":"${subsection1}"}'>${subsection1}</span>
                                    <span class="count">${calculateCount(subsections2)}</span>
                                </div>
                                <div class="tree-content collapsed">
                                    ${subsection2Html}
                                </div>
                            </div>
                        `;
                    }).join('');

                return `
                    <div class="tree-item section">
                        <div class="tree-toggle has-children">
                            <span class="expand-button">▶</span>
                            <span class="tree-text" data-filter='{"section":"${section}"}'>${section}</span>
                            <span class="count">${calculateCount(subsections1)}</span>
                        </div>
                        <div class="tree-content collapsed">
                            ${subsection1Html}
                        </div>
                    </div>
                `;
            }).join('');

        elements.structureTree.innerHTML = treeHtml;
        setupStructureEvents();
    }

    // Обработчики событий для структуры
    function setupStructureEvents() {
        // Обработчик кнопки структуры
        const structureBtn = document.querySelector('.structure-btn');
        const structureContent = document.querySelector('.structure-content');
        const arrow = structureBtn.querySelector('.arrow');

        structureBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            structureContent.classList.toggle('visible');
            arrow.textContent = structureContent.classList.contains('visible') ? '▲' : '▼';
        });

        // Закрытие структуры при клике вне её области
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.structure-container')) {
                structureContent.classList.remove('visible');
                arrow.textContent = '▼';
            }
        });

        // Обработчик кликов по элементам структуры
        elements.structureTree.addEventListener('click', function(e) {
            const treeText = e.target.closest('.tree-text');
            if (treeText) {
                const filterData = JSON.parse(treeText.dataset.filter);
                
                // Очищаем все фильтры
                elements.filterInputs.forEach(input => {
                    input.value = '';
                    state.filters[input.dataset.column] = '';
                });

                // Применяем фильтры
                Object.entries(filterData).forEach(([key, value]) => {
                    state.filters[key] = value;
                    const input = Array.from(elements.filterInputs)
                        .find(input => input.dataset.column === key);
                    if (input) {
                        input.value = value;
                    }
                });

                applyFilters();
                
                // Закрываем структуру после выбора
                structureContent.classList.remove('visible');
                arrow.textContent = '▼';
            }

            // Обработка раскрытия/скрытия
            const expandButton = e.target.closest('.expand-button');
            if (expandButton) {
                const treeToggle = expandButton.closest('.tree-toggle');
                const content = treeToggle.nextElementSibling;
                const isCollapsed = content.classList.contains('collapsed');
                
                content.classList.toggle('collapsed');
                treeToggle.classList.toggle('expanded');
                expandButton.textContent = isCollapsed ? '▼' : '▶';
                
                e.stopPropagation();
            }
        });

        // Поиск по структуре
        document.getElementById('structureSearch').addEventListener('input', debounce(function(e) {
            const searchText = e.target.value.toLowerCase();
            document.querySelectorAll('.tree-item').forEach(item => {
                const text = item.querySelector('.tree-text').textContent.toLowerCase();
                const shouldShow = text.includes(searchText);
                item.style.display = shouldShow ? '' : 'none';
                
                if (shouldShow) {
                    let parent = item.parentElement.closest('.tree-item');
                    while (parent) {
                        parent.style.display = '';
                        parent.querySelector('.tree-content').classList.remove('collapsed');
                        parent.querySelector('.tree-toggle').classList.add('expanded');
                        parent = parent.parentElement.closest('.tree-item');
                    }
                }
            });
        }, 300));
    }

    // Вспомогательная функция подсчета элементов
    function calculateCount(obj) {
        if (typeof obj === 'number') return obj;
        return Object.values(obj).reduce((sum, value) => 
            sum + (typeof value === 'number' ? value : calculateCount(value)), 0);
    }

    // Обновляем инициализацию
    function init() {
        state.filteredData = [...state.allData];
        displayPage(1);
        buildStructure();
        setupFilterEventListeners();
        setupEventListeners();
    }

    init();
}); 