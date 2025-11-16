// DOM 캐시와 상태를 분리해 두면 아래 함수들이 깔끔해진다.
const dom = {
    heatmap: document.getElementById('reading-heatmap'),
    currentList: document.getElementById('current-books'),
    pastList: document.getElementById('past-books')
};

const MONTHS_PER_YEAR = 12;
const state = {
    books: [],
    booksByYear: new Map(),
    heatmapBuckets: new Map()
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        const csv = await fetch('books.csv').then(res => res.text());
        state.books = parseCSV(csv).sort(sortBooksDesc);
        buildDerivedData();
        renderHeatmap();
        renderBookColumns();
    } catch (error) {
        console.error('CSV를 불러오는 중 문제가 발생했습니다.', error);
        dom.heatmap.textContent = '데이터를 불러오지 못했어요.';
    }
}

function parseCSV(text) {
    const [headerLine, ...rows] = text.trim().split('\n');
    const headers = headerLine.split(',');
    return rows.reduce((acc, line) => {
        if (!line.trim()) return acc;
        const cols = line.split(',');
        const entry = {};
        headers.forEach((header, index) => {
            let value = cols[index] ?? '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            if (header === 'year' || header === 'month') {
                entry[header] = parseInt(value, 10) || 0;
            } else {
                entry[header] = value.trim();
            }
        });
        if (entry.title && entry.year && entry.month) acc.push(entry);
        return acc;
    }, []);
}

const sortBooksDesc = (a, b) =>
    (b.year - a.year) || (b.month - a.month) || a.title.localeCompare(b.title);

function buildDerivedData() {
    state.booksByYear = new Map();
    state.heatmapBuckets = new Map();

    state.books.forEach(book => {
        getOrCreate(state.booksByYear, book.year).push(book);
        getOrCreate(state.heatmapBuckets, monthKey(book.year, book.month)).push(book);
    });

    state.booksByYear.forEach(list =>
        list.sort((a, b) => (b.month - a.month) || a.title.localeCompare(b.title))
    );
}

function renderHeatmap() {
    dom.heatmap.innerHTML = '';
    const totalCount = state.books.length;
    dom.heatmap.appendChild(createHeatmapHeader(totalCount));

    if (totalCount === 0) {
        dom.heatmap.appendChild(createEl('p', 'heatmap-empty', '표시할 데이터가 없어요.'));
        return;
    }

    const yearsWithData = Array.from(state.booksByYear.keys()).sort((a, b) => a - b);
    const currentYear = new Date().getFullYear();
    const minYear = Math.min(...yearsWithData, currentYear);
    const years = [];
    for (let year = currentYear; year >= minYear; year--) years.push(year);

    const wrapper = createEl('div', 'heatmap-grid');
    const body = createEl('div', 'heatmap-body');
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;

    years.forEach(year => {
        const row = createEl('div', 'heatmap-row');
        row.appendChild(createEl('div', 'year-label', year));

        for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
            const cell = createEl('div', 'heatmap-cell');
            const isFuture = year > nowYear || (year === nowYear && month > nowMonth);
            if (isFuture) {
                cell.style.visibility = 'hidden';
            } else {
                const monthBooks = getBooksForMonth(year, month);
                const count = monthBooks.length;
                if (count > 0) {
                    cell.classList.add(`level-${Math.min(count, 4)}`);
                    cell.addEventListener('mouseenter', () =>
                        showBookList(cell, monthBooks, year, formatMonth(month))
                    );
                    cell.addEventListener('mouseleave', hideBookList);
                }
                cell.title = `${year}년 ${month}월: ${count}권`;
            }
            row.appendChild(cell);
        }

        const totalCell = createEl('div', 'year-total');
        const total = state.booksByYear.get(year)?.length ?? 0;
        if (total) totalCell.textContent = `${total}권`;
        row.appendChild(totalCell);
        body.appendChild(row);
    });

    wrapper.appendChild(body);
    dom.heatmap.appendChild(wrapper);
    dom.heatmap.appendChild(createLegend());
}

function renderBookColumns() {
    dom.currentList.innerHTML = '';
    dom.pastList.innerHTML = '';
    if (state.books.length === 0) {
        dom.currentList.textContent = '표시할 책이 없어요.';
        dom.pastList.textContent = '';
        return;
    }

    const currentYear = new Date().getFullYear();

    Array.from(state.booksByYear.keys())
        .sort((a, b) => b - a)
        .forEach(year => {
            const target = year === currentYear ? dom.currentList : dom.pastList;
            target.appendChild(createYearSection(year, year === currentYear));
        });

    if (!dom.currentList.childElementCount) {
        dom.currentList.textContent = '올해 데이터가 없어요.';
    }

    if (!dom.pastList.childElementCount) {
        dom.pastList.textContent = '이전 연도 데이터가 없어요.';
    }
}

function createYearSection(year, isCurrentYear) {
    const fragment = document.createDocumentFragment();
    fragment.appendChild(createEl('h2', null, isCurrentYear ? `${year} (올해)` : year));

    const list = createEl('ul');
    (state.booksByYear.get(year) || []).forEach(book => {
        const item = createEl('li');
        item.appendChild(createEl('span', 'month', formatMonth(book.month)));
        item.appendChild(createEl('span', null, book.title));
        list.appendChild(item);
    });

    fragment.appendChild(list);
    return fragment;
}

function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function getBooksForMonth(year, month) {
    return state.heatmapBuckets.get(monthKey(year, month)) || [];
}

function createLegend() {
    const legendContainer = createEl('div', 'heatmap-legend-wrapper');
    const legend = createEl('div', 'heatmap-legend');
    const items = [
        { label: '1권', level: 1 },
        { label: '2권', level: 2 },
        { label: '3권', level: 3 },
        { label: '4권 이상', level: 4 }
    ];

    items.forEach(item => {
        const wrapper = createEl('span', 'heatmap-legend-item');
        wrapper.appendChild(createEl('span', `heatmap-legend-square level-${item.level}`));
        wrapper.appendChild(createEl('span', null, item.label));
        legend.appendChild(wrapper);
    });

    legendContainer.appendChild(legend);
    return legendContainer;
}

function showBookList(cell, books, year, monthLabel) {
    hideBookList();
    if (!books.length) return;

    const tooltip = document.createElement('div');
    tooltip.className = 'book-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">${year}년 ${monthLabel} · ${books.length}권</div>
        <div class="tooltip-content">
            ${books.map(book => `<div class="tooltip-book">• ${book.title}</div>`).join('')}
        </div>
    `;

    const rect = cell.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    const tooltipWidth = 240;
    const tooltipHeight = Math.min(books.length * 18 + 60, 220);

    if (left + tooltipWidth > window.innerWidth) left = window.innerWidth - tooltipWidth - 12;
    if (top + tooltipHeight > window.innerHeight) top = rect.top - tooltipHeight - 6;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    document.body.appendChild(tooltip);
}

function hideBookList() {
    document.querySelector('.book-tooltip')?.remove();
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
}

function getOrCreate(map, key) {
    if (!map.has(key)) map.set(key, []);
    return map.get(key);
}

const formatMonth = month => `${month}월`;
const formatTotal = count => `총 ${count}권 읽었어요`;

function createHeatmapHeader(totalCount) {
    const header = createEl('div', 'heatmap-header');
    header.appendChild(createEl('h2', 'heatmap-title', '독서 히트맵'));
    header.appendChild(createEl('p', 'heatmap-summary', formatTotal(totalCount)));
    return header;
}
