document.addEventListener('DOMContentLoaded', async function() {
    const ITEMS_PER_PAGE = 100;
    let currentPage = 1;
    let allData = [];
    let originalData = [];
    
    // Проверяем наличие элементов перед инициализацией
    const table = document.getElementById('nomenclatureTable');
    if (!table) {
        console.error('Таблица не найдена');
        return;
    }

    // Основные элементы DOM
    const elements = {
        table: table,
        tbody: table.querySelector('tbody'),
        pagination: document.getElementById('pagination'),
        loadedCount: document.getElementById('loadedCount'),
        structureBtn: document.querySelector('.structure-btn'),
        structureContent: document.querySelector('.structure-content'),
        structureSearch: document.getElementById('structureSearch'),
        structureTree: document.getElementById('nomenclatureStructureTree'),
        loadingIndicator: document.getElementById('loadingIndicator')
    };

    // Проверяем обязательные элементы
    if (!elements.tbody || !elements.pagination || !elements.loadedCount) {
        console.error('Не найдены обязательные элементы страницы');
        return;
    }

    let filters = {
        razdel: ['А', 'B'],
        type: '',
        class: '',
        code: '',
        name: ''
    };

    // Добавляем функцию нормализации раздела
    function normalizeRazdel(razdel) {
        if (!razdel) return '';
        const normalized = razdel.toUpperCase();
        if (normalized === 'А' || normalized === 'A') return 'А';
        if (normalized === 'В' || normalized === 'B' || normalized === 'Б') return 'B';
        return razdel;
    }

    // Добавляем функцию подсчета элементов
    function calculateCount(obj) {
        if (typeof obj === 'number') return obj;
        return Object.values(obj).reduce((sum, value) => 
            sum + (typeof value === 'number' ? value : calculateCount(value)), 0);
    }

    // Обновим функцию фильтрации
    function applyFilters() {
        allData = originalData.filter(item => {
            // Проверка раздела
            const normalizedRazdel = normalizeRazdel(item['Раздел']);
            if (!filters.razdel.includes(normalizedRazdel)) {
                return false;
            }
            
            // Проверка типа услуги
            if (filters.type && !item['Тип услуги'].toLowerCase().includes(filters.type.toLowerCase())) {
                return false;
            }
            
            // Проверка класса услуги
            if (filters.class && !item['Класс услуги'].toLowerCase().includes(filters.class.toLowerCase())) {
                return false;
            }
            
            // Проверка кода
            if (filters.code && !item['Код'].toLowerCase().includes(filters.code.toLowerCase())) {
                return false;
            }
            
            // Проверка наименования
            if (filters.name && !item['Наименование'].toLowerCase().includes(filters.name.toLowerCase())) {
                return false;
            }
            
            return true;
        });

        elements.loadedCount.textContent = allData.length;
        displayPage(1);
        setupPagination();
    }

    // Обновим функцию создания HTML для элемента дерева
    function createTreeItemHTML(text, data, count, level = 0, parentPath = '') {
        const isLeaf = typeof data === 'number';
        const hasChildren = !isLeaf && Object.keys(data).length > 0;
        
        // Получаем только последнюю часть пути для отображения
        const displayText = text.includes('/') ? text.split('/').pop() : text;
        
        // Определяем тип элемента и его значение для фильтрации
        let filterData = null;
        if (level === 0) {
            filterData = { razdel: text };
            parentPath = text;
        } else if (level === 1) {
            filterData = { 
                razdel: parentPath,
                type: text 
            };
        } else if (level === 2) {
            filterData = { 
                razdel: parentPath.split('/')[0],
                type: parentPath.split('/')[1],
                class: text 
            };
        }

        // Добавляем кнопку раскрытия для типа услуги
        const expandButton = level === 1 ? `
            <button class="expand-type" title="Показать/скрыть классы">
                <span class="expand-icon">▼</span>
            </button>
        ` : '';
        
        return `
            <div class="tree-item" style="margin-left: ${level * 20}px">
                <div class="tree-toggle ${hasChildren ? 'has-children' : ''} ${filterData ? 'clickable' : ''}" 
                     data-level="${level}"
                     data-filter='${filterData ? JSON.stringify(filterData) : ''}'>
                    <span class="tree-text">${displayText}</span>
                    ${expandButton}
                    <span class="tree-item-count">(${count})</span>
                </div>
                ${hasChildren ? `
                    <div class="tree-content ${level === 1 ? 'collapsed' : ''}">
                        ${Object.entries(data).map(([key, value]) => 
                            createTreeItemHTML(key, value, calculateCount(value), level + 1, parentPath)
                        ).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    // Обновим обработчик клика
    function handleTreeItemClick(e) {
        const toggle = e.currentTarget;
        const filterData = toggle.dataset.filter ? JSON.parse(toggle.dataset.filter) : null;
        
        // Если клик был по кнопке раскрытия
        if (e.target.closest('.expand-type')) {
            e.stopPropagation(); // Предотвращаем всплытие события
            const button = e.target.closest('.expand-type');
            const treeItem = toggle.closest('.tree-item');
            const content = treeItem.querySelector('.tree-content');
            
            button.classList.toggle('active');
            content.classList.toggle('collapsed');
            return;
        }
        
        // Остальная логика обработки клика...
        if (filterData) {
            // Применяем фильтры
            filters.razdel = [filterData.razdel];
            filters.type = filterData.type || '';
            filters.class = filterData.class || '';
            filters.code = '';
            filters.name = '';
            
            // Обновляем UI
            document.querySelectorAll('input[name="razdel"]').forEach(cb => {
                cb.checked = filters.razdel.includes(cb.value);
            });
            document.querySelector('[data-column="type"]').value = filters.type;
            document.querySelector('[data-column="class"]').value = filters.class;
            document.querySelector('[data-column="code"]').value = '';
            document.querySelector('[data-column="name"]').value = '';
            
            applyFilters();
            elements.structureBtn.classList.remove('active');
            elements.structureContent.classList.remove('visible');
        }
    }

    // Функция загрузки данных
    async function loadData() {
        elements.loadingIndicator.style.display = 'block';
        elements.loadedCount.textContent = 'Загрузка данных...';
        
        try {
            const response = await fetch('https://raw.githubusercontent.com/vdorlov/for_website_1/master/For_website_804.xlsx');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const buffer = await response.arrayBuffer();
            const workbook = XLSX.read(new Uint8Array(buffer), { 
                type: 'array',
                cellDates: false,
                cellNF: false,
                cellText: false
            });
            
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const rawData = XLSX.utils.sheet_to_json(worksheet);

            // Проверяем данные
            if (!Array.isArray(rawData) || rawData.length === 0) {
                throw new Error('Данные не получены или пусты');
            }

            // Фильтруем пустые строки
            allData = rawData.filter(row => row['Код']);
            originalData = [...allData];
            
            // Обновляем UI
            elements.loadedCount.textContent = `Загружено ${allData.length} записей`;
            displayPage(1);
            setupPagination();
            buildStructure();

        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            elements.loadedCount.textContent = `Ошибка загрузки: ${error.message}`;
            elements.tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 20px;">Ошибка загрузки данных. Пожалуйста, обновите страницу.</td></tr>`;
        } finally {
            elements.loadingIndicator.style.display = 'none';
        }
    }

    // Функция отображения страницы
    function displayPage(page) {
        const start = (page - 1) * ITEMS_PER_PAGE;
        const end = start + ITEMS_PER_PAGE;
        const pageData = allData.slice(start, end);

        // Создаем строки таблицы оптимизированным способом
        const rows = pageData.map(item => `
            <tr>
                <td>${normalizeRazdel(item['Раздел']) || ''}</td>
                <td>${item['Тип услуги'] || ''}</td>
                <td>${item['Класс услуги'] || ''}</td>
                <td>${item['Код'] || ''}</td>
                <td>${item['Наименование'] || ''}</td>
            </tr>
        `).join('');

        // Обновляем содержимое таблицы одной операцией
        elements.tbody.innerHTML = rows;
        
        currentPage = page;
        setupPagination();
    }

    // Функция построения структуры из данных таблицы
    function buildStructure() {
        const structure = {};
        
        // Собираем данные из таблицы
        allData.forEach(item => {
            const razdel = normalizeRazdel(item['Раздел']);
            const type = item['Тип услуги'];
            const serviceClass = item['Класс услуги'];
            
            if (!structure[razdel]) {
                structure[razdel] = {};
            }
            if (!structure[razdel][type]) {
                structure[razdel][type] = {};
            }
            if (!structure[razdel][type][serviceClass]) {
                structure[razdel][type][serviceClass] = 0;
            }
            structure[razdel][type][serviceClass]++;
        });

        // Создаем HTML для структуры
        const treeHtml = Object.entries(structure)
            .sort(([a], [b]) => a.localeCompare(b, 'ru'))
            .map(([razdel, types]) => {
                const typeHtml = Object.entries(types)
                    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
                    .map(([type, classes]) => {
                        const classHtml = Object.entries(classes)
                            .sort(([a], [b]) => a.localeCompare(b, 'ru'))
                            .map(([className, count]) => `
                                <div class="tree-item" data-path="${razdel}/${type}/${className}">
                                    <div class="tree-toggle clickable">
                                        <span class="tree-text" data-filter='{"razdel":"${razdel}","type":"${type}","class":"${className}"}'>${className}</span>
                                        <span class="tree-item-count">${count}</span>
                                    </div>
                                </div>
                            `).join('');

                        return `
                            <div class="tree-item" data-path="${razdel}/${type}">
                                <div class="tree-toggle has-children">
                                    <span class="expand-button">▶</span>
                                    <span class="tree-text" data-filter='{"razdel":"${razdel}","type":"${type}"}'>${type}</span>
                                    <span class="tree-item-count">${calculateCount(classes)}</span>
                                </div>
                                <div class="tree-content collapsed">
                                    ${classHtml}
                                </div>
                            </div>
                        `;
                    }).join('');

                return `
                    <div class="tree-item" data-path="${razdel}">
                        <div class="tree-toggle has-children">
                            <span class="expand-button">▶</span>
                            <span class="tree-text" data-filter='{"razdel":"${razdel}"}'>${razdel}</span>
                            <span class="tree-item-count">${calculateCount(types)}</span>
                        </div>
                        <div class="tree-content collapsed">
                            ${typeHtml}
                        </div>
                    </div>
                `;
            }).join('');

        elements.structureTree.innerHTML = treeHtml;

        // Добавляем обработчики событий
        elements.structureTree.addEventListener('click', function(e) {
            const treeText = e.target.closest('.tree-text');
            if (treeText) {
                const filterData = JSON.parse(treeText.dataset.filter);
                
                // Очищаем все фильтры
                filters = {
                    razdel: ['А', 'B'],
                    type: '',
                    class: '',
                    code: '',
                    name: ''
                };

                // Применяем новые фильтры
                if (filterData.razdel) {
                    filters.razdel = [filterData.razdel];
                }
                if (filterData.type) {
                    filters.type = filterData.type;
                }
                if (filterData.class) {
                    filters.class = filterData.class;
                }

                // Обновляем UI фильтров
                document.querySelectorAll('input[name="razdel"]').forEach(cb => {
                    cb.checked = filters.razdel.includes(cb.value);
                });
                document.querySelector('[data-column="type"]').value = filters.type;
                document.querySelector('[data-column="class"]').value = filters.class;
                document.querySelector('[data-column="code"]').value = '';
                document.querySelector('[data-column="name"]').value = '';

                applyFilters();
                
                // Закрываем структуру после выбора
                elements.structureContent.classList.remove('visible');
            }

            // Обработка раскрытия/скрытия
            const expandButton = e.target.closest('.expand-button');
            if (expandButton) {
                const content = expandButton.closest('.tree-toggle').nextElementSibling;
                const isHidden = content.classList.contains('collapsed');
                content.classList.toggle('collapsed');
                expandButton.textContent = isHidden ? '▼' : '▶';
                e.stopPropagation();
            }
        });
    }

    // Обработчики событий
    elements.structureBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        this.classList.toggle('active');
        elements.structureContent.classList.toggle('visible');
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.structure-dropdown')) {
            elements.structureBtn.classList.remove('active');
            elements.structureContent.classList.remove('visible');
        }
    });

    elements.structureSearch.addEventListener('input', function() {
        const searchText = this.value.toLowerCase();
        elements.structureTree.querySelectorAll('.tree-item').forEach(item => {
            const text = item.textContent.toLowerCase();
            item.style.display = text.includes(searchText) ? '' : 'none';
        });
    });

    // Добавим обработчики для фильтров
    document.querySelectorAll('input[name="razdel"]').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            filters.razdel = Array.from(document.querySelectorAll('input[name="razdel"]:checked'))
                .map(cb => cb.value);
            applyFilters();
        });
    });

    document.querySelectorAll('.column-filter').forEach(input => {
        input.addEventListener('input', function() {
            const column = this.dataset.column;
            filters[column] = this.value;
            applyFilters();
        });
    });

    // Обновим обработчик сброса фильтров
    document.getElementById('resetAllFilters').addEventListener('click', function() {
        filters = {
            razdel: ['А', 'B'],
            type: '',
            class: '',
            code: '',
            name: ''
        };
        
        document.querySelectorAll('input[name="razdel"]').forEach(cb => {
            cb.checked = filters.razdel.includes(cb.value);
        });
        document.querySelectorAll('.column-filter').forEach(input => {
            input.value = '';
        });
        
        applyFilters();
    });

    // Функция настройки пагинации
    function setupPagination() {
        const pageCount = Math.ceil(allData.length / ITEMS_PER_PAGE);
        elements.pagination.innerHTML = '';
        
        // Не показываем пагинацию, если страница всего одна
        if (pageCount <= 1) return;

        const fragment = document.createDocumentFragment();
        const maxVisiblePages = 7;
        let startPage, endPage;

        if (pageCount <= maxVisiblePages) {
            startPage = 1;
            endPage = pageCount;
        } else {
            if (currentPage <= Math.ceil(maxVisiblePages / 2)) {
                startPage = 1;
                endPage = maxVisiblePages - 1;
            } else if (currentPage >= pageCount - Math.floor(maxVisiblePages / 2)) {
                startPage = pageCount - (maxVisiblePages - 2);
                endPage = pageCount;
            } else {
                startPage = currentPage - Math.floor((maxVisiblePages - 2) / 2);
                endPage = currentPage + Math.floor((maxVisiblePages - 2) / 2);
            }
        }

        // Добавляем кнопку "Предыдущая"
        if (currentPage > 1) {
            const prevButton = document.createElement('button');
            prevButton.textContent = '←';
            prevButton.onclick = () => displayPage(currentPage - 1);
            fragment.appendChild(prevButton);
        }

        // Добавляем номера страниц
        for (let i = startPage; i <= endPage; i++) {
            const button = document.createElement('button');
            button.textContent = i;
            button.onclick = () => displayPage(i);
            if (i === currentPage) {
                button.disabled = true;
                button.classList.add('current');
            }
            fragment.appendChild(button);
        }

        // Добавляем кнопку "Следующая"
        if (currentPage < pageCount) {
            const nextButton = document.createElement('button');
            nextButton.textContent = '→';
            nextButton.onclick = () => displayPage(currentPage + 1);
            fragment.appendChild(nextButton);
        }

        elements.pagination.appendChild(fragment);
    }

    // Добавляем обработчик изменения размера окна
    window.addEventListener('resize', debounce(() => {
        displayPage(currentPage);
    }, 150));

    // Вспомогательная функция debounce
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

    // Запускаем загрузку данных
    loadData().catch(error => {
        console.error('Ошибка при инициализации:', error);
        elements.loadedCount.textContent = 'Произошла ошибка при загрузке';
    });

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
}); 