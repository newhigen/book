// DOM 캐시와 상태를 분리해 두면 아래 함수들이 깔끔해진다.
const dom = {
    heatmap: document.getElementById('reading-heatmap'),
    pastList: document.getElementById('past-books'),
    languageToggle: document.getElementById('language-toggle')
};

const MONTHS_PER_YEAR = 12;
const state = {
    books: [],
    booksByYear: new Map(),
    heatmapBuckets: new Map(),
    language: 'ko',
    yearRefs: []
};

const MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TEXT = {
    ko: {
        heatmapTitle: '독서 히트맵',
        totalBooks: count => `총 ${count}권 읽었어요`,
        heatmapEmpty: '표시할 데이터가 없어요.',
        loadError: '데이터를 불러오지 못했어요.',
        noBooks: '표시할 책이 없어요.',
        noCurrentBooks: '올해 데이터가 없어요.',
        noPastBooks: '이전 연도 데이터가 없어요.',
        yearHeading: year => `${year}`,
        yearSummary: count => `${count}권 읽음`,
        formatMonth: month => `${month}월`,
        tooltipHeader: (year, monthLabel, count) => `${year}년 ${monthLabel} · ${count}권`,
        cellTitle: (year, monthLabel, count) => `${year}년 ${monthLabel}: ${count}권`,
        rereadBadge: count => `${count}회차`,
        yearTotal: count => `${count}`,
        legendLabels: ['1', '2', '3', '4+'],
        toggleLabel: 'English',
        toggleAriaLabel: '영어 모드로 전환',
        tooltipBullet: '•'
    },
    en: {
        heatmapTitle: 'Reading Heatmap',
        totalBooks: count => `Read ${count} books in total`,
        heatmapEmpty: 'No reading data yet.',
        loadError: 'Unable to load data.',
        noBooks: 'No books to show.',
        noCurrentBooks: 'No books for this year.',
        noPastBooks: 'No books from previous years.',
        yearHeading: year => `${year}`,
        yearSummary: count => `Read ${count} books`,
        formatMonth: month => MONTH_LABELS_EN[month - 1] || `M${month}`,
        tooltipHeader: (year, monthLabel, count) => `${monthLabel} ${year} · ${count} books`,
        cellTitle: (year, monthLabel, count) => `${monthLabel} ${year}: ${count} books`,
        rereadBadge: count => `${count}x read`,
        yearTotal: count => `${count}`,
        legendLabels: ['1', '2', '3', '4+'],
        toggleLabel: '한국어',
        toggleAriaLabel: 'Switch to Korean',
        tooltipBullet: '•'
    }
};

const t = (key, ...args) => {
    const text = TEXT[state.language][key];
    return typeof text === 'function' ? text(...args) : text;
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    initLanguageToggle();
    try {
        const csv = await fetch('books.csv').then(res => res.text());
        state.books = parseCSV(csv).sort(sortBooksDesc);
        buildDerivedData();
        renderHeatmap();
        renderBookColumns();
    } catch (error) {
        console.error(t('loadError'), error);
        dom.heatmap.textContent = t('loadError');
    }
}

function initLanguageToggle() {
    if (!dom.languageToggle) return;
    updateLanguageToggleUI();
    dom.languageToggle.addEventListener('click', () => {
        state.language = state.language === 'ko' ? 'en' : 'ko';
        updateLanguageToggleUI();
        renderHeatmap();
        updateBookColumnsLanguage();
    });
}

function updateLanguageToggleUI() {
    if (!dom.languageToggle) return;
    dom.languageToggle.textContent = t('toggleLabel');
    dom.languageToggle.setAttribute('aria-label', t('toggleAriaLabel'));
    dom.languageToggle.setAttribute('aria-pressed', state.language === 'en');
    document.documentElement.lang = state.language;
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
    state.bookCounts = new Map();
    state.latestMonth = new Map();

    state.books.forEach(book => {
        getOrCreate(state.booksByYear, book.year).push(book);
        getOrCreate(state.heatmapBuckets, monthKey(book.year, book.month)).push(book);
        const key = book.title;
        state.bookCounts.set(key, (state.bookCounts.get(key) || 0) + 1);
        const currentDate = book.year * 100 + book.month;
        if (!state.latestMonth.has(key) || state.latestMonth.get(key) < currentDate) {
            state.latestMonth.set(key, currentDate);
        }
    });

    state.booksByYear.forEach(list =>
        list.sort((a, b) => (b.month - a.month) || a.title.localeCompare(b.title))
    );
}

function renderHeatmap() {
    updateWithPreservedHeight(dom.heatmap, () => {
        dom.heatmap.innerHTML = '';
        const totalCount = state.books.length;
        dom.heatmap.appendChild(createHeatmapHeader(totalCount));

        if (totalCount === 0) {
            dom.heatmap.appendChild(createEl('p', 'heatmap-empty', t('heatmapEmpty')));
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
                    const monthLabel = t('formatMonth', month);
                    const monthBooks = getBooksForMonth(year, month);
                    const count = monthBooks.length;
                    if (count > 0) {
                        cell.classList.add(`level-${Math.min(count, 4)}`);
                        cell.addEventListener('mouseenter', () =>
                            showBookList(cell, monthBooks, year, monthLabel)
                        );
                        cell.addEventListener('mouseleave', hideBookList);
                    }
                    cell.title = t('cellTitle', year, monthLabel, count);
                }
                row.appendChild(cell);
            }

            const totalCell = createEl('div', 'year-total');
            const total = state.booksByYear.get(year)?.length ?? 0;
            if (total) totalCell.textContent = t('yearTotal', total);
            row.appendChild(totalCell);
            body.appendChild(row);
        });

        wrapper.appendChild(body);
        dom.heatmap.appendChild(wrapper);
        dom.heatmap.appendChild(createLegend());
    });
}

function renderBookColumns() {
    state.yearRefs = [];

    if (state.books.length === 0) {
        updateWithPreservedHeight(dom.pastList, () => {
            dom.pastList.textContent = t('noBooks');
        });
        return;
    }

    const currentYear = new Date().getFullYear();
    const years = Array.from(state.booksByYear.keys()).sort((a, b) => b - a);

    updateWithPreservedHeight(dom.pastList, () => {
        dom.pastList.innerHTML = '';
        years.forEach(year => {
            const { fragment, refs } = createYearSection(year, year === currentYear);
            dom.pastList.appendChild(fragment);
            state.yearRefs.push(refs);
        });
        if (!dom.pastList.childElementCount) {
            dom.pastList.textContent = t('noBooks');
        }
    });
}

function updateBookColumnsLanguage() {
    if (state.books.length === 0) {
        dom.pastList.textContent = t('noBooks');
        return;
    }

    if (!state.yearRefs.length) {
        renderBookColumns();
        return;
    }

    updateWithPreservedHeight(dom.pastList, () => {
        state.yearRefs.forEach(refs => {
            const books = state.booksByYear.get(refs.year) || [];
            refs.heading.textContent = t('yearHeading', refs.year, refs.isCurrentYear);
            refs.summary.textContent = t('yearSummary', books.length);
            let lastMonth = null;
            books.forEach((book, index) => {
                const monthSpan = refs.monthSpans[index];
                if (!monthSpan) return;
                if (lastMonth === book.month) {
                    monthSpan.textContent = '';
                } else {
                    monthSpan.textContent = t('formatMonth', book.month);
                    lastMonth = book.month;
                }
            });
            refs.badgeSpans.forEach(badge => {
                badge.el.textContent = t('rereadBadge', badge.count);
            });
        });
    });
}

function createYearSection(year, isCurrentYear) {
    const fragment = document.createDocumentFragment();
    const books = state.booksByYear.get(year) || [];
    const heading = createEl('h2', null, t('yearHeading', year, isCurrentYear));
    fragment.appendChild(heading);

    const summary = createEl('p', 'year-summary', t('yearSummary', books.length));
    fragment.appendChild(summary);

    const list = createEl('ul');
    const monthSpans = [];
    const badgeSpans = [];
    let lastMonth = null;

    books.forEach(book => {
        const item = createEl('li');
        const monthSpan = createEl('span', 'month');
        if (lastMonth === book.month) {
            monthSpan.textContent = '';
        } else {
            monthSpan.textContent = t('formatMonth', book.month);
            lastMonth = book.month;
        }
        monthSpans.push(monthSpan);
        item.appendChild(monthSpan);

        const titleSpan = createEl('span', 'book-title', book.title);
        const count = state.bookCounts.get(book.title);
        const currentDate = book.year * 100 + book.month;
        if (count > 1 && state.latestMonth.get(book.title) === currentDate) {
            const badge = createEl('span', 'reread-badge', t('rereadBadge', count));
            titleSpan.appendChild(badge);
            badgeSpans.push({ el: badge, count });
        }
        item.appendChild(titleSpan);
        list.appendChild(item);
    });

    fragment.appendChild(list);
    return {
        fragment,
        refs: {
            year,
            isCurrentYear,
            heading,
            summary,
            monthSpans,
            badgeSpans
        }
    };
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
    const labels = t('legendLabels');

    labels.forEach((label, index) => {
        const wrapper = createEl('span', 'heatmap-legend-item');
        wrapper.appendChild(createEl('span', `heatmap-legend-square level-${index + 1}`));
        wrapper.appendChild(createEl('span', null, label));
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
    const headerText = t('tooltipHeader', year, monthLabel, books.length);
    const bullet = t('tooltipBullet');
    tooltip.innerHTML = `
        <div class="tooltip-header">${headerText}</div>
        <div class="tooltip-content">
            ${books.map(book => `<div class="tooltip-book">${bullet} ${book.title}</div>`).join('')}
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

function updateWithPreservedHeight(element, updater) {
    if (!element || typeof updater !== 'function') return;
    const previousMinHeight = element.style.minHeight;
    const currentHeight = element.offsetHeight;
    if (currentHeight) element.style.minHeight = `${currentHeight}px`;
    updater();
    const schedule = window.requestAnimationFrame || (cb => setTimeout(cb, 16));
    schedule(() => {
        if (previousMinHeight) {
            element.style.minHeight = previousMinHeight;
        } else {
            element.style.removeProperty('min-height');
        }
    });
}

function createHeatmapHeader(totalCount) {
    const header = createEl('div', 'heatmap-header');
    header.appendChild(createEl('h2', 'heatmap-title', t('heatmapTitle')));
    header.appendChild(createEl('p', 'heatmap-summary', t('totalBooks', totalCount)));
    return header;
}
