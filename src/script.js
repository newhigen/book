const dom = {
    heatmap: document.getElementById('reading-heatmap'),
    pastList: document.getElementById('past-books'),
    languageToggle: document.getElementById('language-toggle'),
    themeToggle: document.getElementById('theme-toggle')
};

const MONTHS_PER_YEAR = 12;
const MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LANGUAGE_EMOJI = { ko: '🇰🇷', en: '🇺🇸' };
const DATA_FILES = ['books.csv', 'books.csv.example'];

const TEXT = {
    ko: {
        heatmapTitle: '독서 히트맵',
        totalBooks: count => `총 ${count}권 읽었어요`,
        heatmapEmpty: '표시할 데이터가 없어요.',
        loadError: '데이터를 불러오지 못했어요.',
        noBooks: '표시할 책이 없어요.',
        yearHeading: year => `${year}`,
        yearSummary: count => `${count}권 읽음`,
        formatMonth: month => `${month}월`,
        tooltipHeader: (year, monthLabel, count) => `${year}년 ${monthLabel} · ${count}권`,
        cellTitle: (year, monthLabel, count) => `${year}년 ${monthLabel}: ${count}권`,
        rereadBadge: count => `${count}회차`,
        yearTotal: count => `${count}`,
        legendLabels: ['1', '2', '3', '4+'],
        toggleLabel: 'English',
        toggleAriaLabel: '영어로 전환',
        tooltipBullet: '•',
        relativeToday: '오늘',
        relativeDay: n => `${n}일 전`,
        relativeDays: n => `${n}일 전`,
        relativeWeek: n => `${n}주 전`,
        relativeWeeks: n => `${n}주 전`,
        relativeMonth: n => `${n}달 전`,
        relativeMonths: n => `${n}달 전`,
        relativeYear: n => `${n}년 전`,
        relativeYears: n => `${n}년 전`
    },
    en: {
        heatmapTitle: 'Reading Heatmap',
        totalBooks: count => `Read ${count} books in total`,
        heatmapEmpty: 'No reading data yet.',
        loadError: 'Unable to load data.',
        noBooks: 'No books to show.',
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
        tooltipBullet: '•',
        relativeToday: 'Today',
        relativeDay: n => `${n} day ago`,
        relativeDays: n => `${n} days ago`,
        relativeWeek: n => `${n} week ago`,
        relativeWeeks: n => `${n} weeks ago`,
        relativeMonth: n => `${n} month ago`,
        relativeMonths: n => `${n} months ago`,
        relativeYear: n => `${n} year ago`,
        relativeYears: n => `${n} years ago`
    }
};

const THEME_STORAGE_KEY = 'book-tracker-theme';
const THEME_COPY = {
    light: {
        icon: '☀️',
        aria: 'Switch to dark mode'
    },
    dark: {
        icon: '🌙',
        aria: 'Switch to light mode'
    }
};

const state = {
    books: [],
    booksByYear: new Map(),
    heatmapBuckets: new Map(),
    language: 'ko',
    theme: 'light',
    yearRefs: [],
    reviews: []
};

const normalizeText = value => (value ?? '').trim();
const getCanonicalTitle = book => normalizeText(book.title) || normalizeText(book.englishTitle);
const getLocalizedTitle = book =>
    state.language === 'ko'
        ? (normalizeText(book.title) || normalizeText(book.englishTitle))
        : (normalizeText(book.englishTitle) || normalizeText(book.title));

const t = (key, ...args) => {
    const value = TEXT[state.language][key];
    return typeof value === 'function' ? value(...args) : value;
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    initLanguageToggle();
    initThemeToggle();
    const [booksLoaded] = await Promise.all([loadBooks(), loadReviews()]);

    if (booksLoaded) {
        buildDerivedData();
        renderAll();
    } else {
        renderReviews();
    }
}

function initLanguageToggle() {
    if (!dom.languageToggle) return;
    updateLanguageToggleUI();
    dom.languageToggle.addEventListener('click', () => {
        state.language = state.language === 'ko' ? 'en' : 'ko';
        updateLanguageToggleUI();
        renderAll();
    });
}

function updateLanguageToggleUI() {
    if (!dom.languageToggle) return;
    dom.languageToggle.textContent = LANGUAGE_EMOJI[state.language];
    dom.languageToggle.setAttribute('aria-label', t('toggleAriaLabel'));
    dom.languageToggle.setAttribute('aria-pressed', state.language === 'en');
    document.documentElement.lang = state.language;
}

async function loadBooks() {
    for (const file of DATA_FILES) {
        try {
            const response = await fetch(file);
            if (!response.ok) continue;
            const csv = await response.text();
            state.books = parseCSV(csv).sort(sortBooksDesc);
            return true;
        } catch {
            // try next file
        }
    }
    dom.heatmap.textContent =
        '데이터 파일을 찾지 못했어요. books.csv 또는 books.csv.example을 확인해주세요.';
    return false;
}

function parseCSV(text) {
    const [headerLine, ...rows] = text.trim().split('\n');
    const headers = headerLine.split(',');
    return rows.reduce((acc, line) => {
        if (!line.trim()) return acc;
        const cols = line.split(',');
        const entry = { title: '', englishTitle: '' };
        headers.forEach((header, index) => {
            let value = cols[index] ?? '';
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            value = value.trim();
            const headerName = header.trim().toLowerCase();
            if (headerName === 'year' || headerName === 'month') {
                entry[headerName] = parseInt(value, 10) || 0;
            } else if (headerName === 'english-title') {
                entry.englishTitle = value;
            } else if (headerName === 'title') {
                entry.title = value;
            }
        });
        if ((entry.title || entry.englishTitle) && entry.year && entry.month) acc.push(entry);
        return acc;
    }, []);
}

const sortBooksDesc = (a, b) =>
    (b.year - a.year) ||
    (b.month - a.month) ||
    getCanonicalTitle(a).localeCompare(getCanonicalTitle(b));

function buildDerivedData() {
    state.booksByYear = new Map();
    state.heatmapBuckets = new Map();
    state.bookCounts = new Map();
    state.latestMonth = new Map();

    state.books.forEach(book => {
        const key = getCanonicalTitle(book);
        if (!key) return;
        book.canonicalTitle = key;
        getOrCreate(state.booksByYear, book.year).push(book);
        getOrCreate(state.heatmapBuckets, monthKey(book.year, book.month)).push(book);
        state.bookCounts.set(key, (state.bookCounts.get(key) || 0) + 1);
        const snapshot = book.year * 100 + book.month;
        if (!state.latestMonth.has(key) || state.latestMonth.get(key) < snapshot) {
            state.latestMonth.set(key, snapshot);
        }
    });

    state.booksByYear.forEach(list =>
        list.sort(
            (a, b) =>
                (b.month - a.month) || getCanonicalTitle(a).localeCompare(getCanonicalTitle(b))
        )
    );
}

function renderAll() {
    renderHeatmap();
    renderBookColumns();
    renderReviews();
}

function renderHeatmap() {
    updateWithPreservedHeight(dom.heatmap, () => {
        dom.heatmap.innerHTML = '';
        dom.heatmap.appendChild(createHeatmapHeader(state.books.length));
        if (!state.books.length) {
            dom.heatmap.appendChild(createEl('p', 'heatmap-empty', t('heatmapEmpty')));
            return;
        }

        const years = buildYearRange();
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
                    decorateHeatmapCell(cell, year, month);
                }
                row.appendChild(cell);
            }
            const total = state.booksByYear.get(year)?.length ?? 0;
            const totalCell = createEl('div', 'year-total', total ? t('yearTotal', total) : '');
            row.appendChild(totalCell);
            body.appendChild(row);
        });

        wrapper.appendChild(body);
        dom.heatmap.appendChild(wrapper);
        dom.heatmap.appendChild(createLegend());
    });
}

function buildYearRange() {
    const yearsWithData = Array.from(state.booksByYear.keys()).sort((a, b) => a - b);
    const currentYear = new Date().getFullYear();
    const minYear = Math.min(...yearsWithData, currentYear);
    const years = [];
    for (let year = currentYear; year >= minYear; year--) years.push(year);
    return years;
}

function decorateHeatmapCell(cell, year, month) {
    const monthLabel = t('formatMonth', month);
    const monthBooks = getBooksForMonth(year, month);
    const count = monthBooks.length;
    if (count) {
        cell.classList.add(`level-${Math.min(count, 4)}`);
        cell.addEventListener('mouseenter', () =>
            showBookList(cell, monthBooks, year, monthLabel)
        );
        cell.addEventListener('mouseleave', hideBookList);
    }
    cell.title = t('cellTitle', year, monthLabel, count);
}

function renderBookColumns() {
    state.yearRefs = [];
    if (!state.books.length) {
        updateWithPreservedHeight(dom.pastList, () => {
            dom.pastList.textContent = t('noBooks');
        });
        return;
    }

    const years = Array.from(state.booksByYear.keys()).sort((a, b) => b - a);
    updateWithPreservedHeight(dom.pastList, () => {
        dom.pastList.innerHTML = '';
        years.forEach(year => {
            const { fragment, refs } = createYearSection(year);
            dom.pastList.appendChild(fragment);
            state.yearRefs.push(refs);
        });
    });
}

function updateBookColumnsLanguage() {
    if (!state.yearRefs.length) {
        renderBookColumns();
        return;
    }

    updateWithPreservedHeight(dom.pastList, () => {
        state.yearRefs.forEach(refs => {
            const books = state.booksByYear.get(refs.year) || [];
            refs.heading.textContent = t('yearHeading', refs.year);
            refs.summary.textContent = t('yearSummary', books.length);
            let lastMonth = null;
            books.forEach((book, index) => {
                const span = refs.monthSpans[index];
                if (!span) return;
                if (lastMonth === book.month) {
                    span.textContent = '';
                } else {
                    span.textContent = t('formatMonth', book.month);
                    lastMonth = book.month;
                }
            });
            refs.badgeSpans.forEach(badge => {
                badge.el.textContent = t('rereadBadge', badge.count);
            });
        });
    });
}

function createYearSection(year) {
    const fragment = document.createDocumentFragment();
    const books = state.booksByYear.get(year) || [];
    const heading = createEl('h2', null, t('yearHeading', year));
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

        const displayTitle = getLocalizedTitle(book);
        const titleSpan = createEl('span', 'book-title', displayTitle);
        const canonical = book.canonicalTitle || getCanonicalTitle(book);
        const count = state.bookCounts.get(canonical) || 0;
        const snapshot = book.year * 100 + book.month;
        if (count > 1 && state.latestMonth.get(canonical) === snapshot) {
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
            heading,
            summary,
            monthSpans,
            badgeSpans
        }
    };
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
            ${books
            .map(book => `<div class="tooltip-book">${bullet} ${getLocalizedTitle(book)}</div>`)
            .join('')}
        </div>
    `;

    positionTooltip(tooltip, cell, books.length);
    document.body.appendChild(tooltip);
}

function hideBookList() {
    document.querySelector('.book-tooltip')?.remove();
}

function positionTooltip(tooltip, cell, bookCount) {
    const rect = cell.getBoundingClientRect();
    let left = rect.left;
    let top = rect.bottom + 6;
    const tooltipWidth = 240;
    const tooltipHeight = Math.min(bookCount * 18 + 60, 220);

    if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 12;
    }
    if (top + tooltipHeight > window.innerHeight) {
        top = rect.top - tooltipHeight - 6;
    }

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
}

function createHeatmapHeader(totalCount) {
    const header = createEl('div', 'heatmap-header');
    header.appendChild(createEl('h2', 'heatmap-title', t('heatmapTitle')));
    header.appendChild(createEl('p', 'heatmap-summary', t('totalBooks', totalCount)));
    return header;
}

function createLegend() {
    const legendContainer = createEl('div', 'heatmap-legend-wrapper');
    const legend = createEl('div', 'heatmap-legend');
    t('legendLabels').forEach((label, index) => {
        const wrapper = createEl('span', 'heatmap-legend-item');
        wrapper.appendChild(createEl('span', `heatmap-legend-square level-${index + 1}`));
        wrapper.appendChild(createEl('span', null, label));
        legend.appendChild(wrapper);
    });
    legendContainer.appendChild(legend);
    return legendContainer;
}

function getBooksForMonth(year, month) {
    return state.heatmapBuckets.get(monthKey(year, month)) || [];
}

function monthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

function getOrCreate(map, key) {
    if (!map.has(key)) map.set(key, []);
    return map.get(key);
}

function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
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
function initThemeToggle() {
    if (!dom.themeToggle) return;
    const stored = safeStorageGet(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') state.theme = stored;
    applyTheme();
    dom.themeToggle.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
    });
}

function applyTheme() {
    document.body.classList.toggle('dark-mode', state.theme === 'dark');
    safeStorageSet(THEME_STORAGE_KEY, state.theme);
    updateThemeToggleUI();
}

function updateThemeToggleUI() {
    if (!dom.themeToggle) return;
    const copy = state.theme === 'dark' ? THEME_COPY.dark : THEME_COPY.light;
    dom.themeToggle.textContent = copy.icon;
    dom.themeToggle.setAttribute('aria-label', copy.aria);
    dom.themeToggle.setAttribute('aria-pressed', state.theme === 'dark');
}

function safeStorageGet(key) {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch {
        // ignore failures
    }
}

function formatRelativeDate(value) {
    if (!value) return '';
    const parsed = parseDate(value);
    if (!parsed) return value;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const diffMs = startOfToday - target;
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays <= 0) return t('relativeToday');
    if (diffDays < 7) {
        return diffDays === 1 ? t('relativeDay', 1) : t('relativeDays', diffDays);
    }

    const weeks = Math.floor(diffDays / 7);
    if (weeks < 4) {
        return weeks === 1 ? t('relativeWeek', 1) : t('relativeWeeks', weeks);
    }

    const months = Math.floor(diffDays / 30);
    if (months < 12) {
        return months === 1 ? t('relativeMonth', 1) : t('relativeMonths', months);
    }

    const years = Math.floor(diffDays / 365);
    return years === 1 ? t('relativeYear', 1) : t('relativeYears', years);
}

function parseDate(value) {
    const cleaned = String(value).trim();
    const isoCandidate = cleaned.replace(/\./g, '-').replace(/\//g, '-');
    const direct = new Date(isoCandidate);
    if (!Number.isNaN(direct.getTime())) return direct;

    if (/^\d{8}$/.test(cleaned)) {
        const y = cleaned.slice(0, 4);
        const m = cleaned.slice(4, 6);
        const d = cleaned.slice(6, 8);
        const alt = new Date(`${y}-${m}-${d}`);
        if (!Number.isNaN(alt.getTime())) return alt;
    }
    return null;
}

/* Review Logic */

async function loadReviews() {
    const files = await discoverReviewFiles();
    if (!files.length) {
        state.reviews = [];
        return false;
    }

    const metadata = await Promise.all(files.map(fetchReviewMetadata));
    state.reviews = metadata
        .filter(Boolean)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    return true;
}

async function discoverReviewFiles() {
    try {
        const response = await fetch('reviews/');
        if (!response.ok) return [];
        const html = await response.text();
        const files = extractMarkdownLinks(html);
        return Array.from(new Set(files));
    } catch {
        return [];
    }
}

function extractMarkdownLinks(html) {
    const files = [];
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        doc.querySelectorAll('a[href]').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (/\.md$/i.test(href)) files.push(href.split('/').pop());
        });
    } catch {
        // ignore DOM parse issues
    }

    if (!files.length) {
        const regex = /href="([^"]+\.md)"/gi;
        let match;
        while ((match = regex.exec(html))) {
            files.push(match[1].split('/').pop());
        }
    }

    return files;
}

async function fetchReviewMetadata(filename) {
    if (!filename) return null;
    try {
        const response = await fetch(`reviews/${encodeURIComponent(filename)}`);
        if (!response.ok) return null;
        const text = await response.text();
        const frontmatter = parseFrontMatter(text);
        const permalink = frontmatter.permalink || derivePermalinkFromFilename(filename);
        const date = frontmatter.date || deriveDateFromFilename(filename);
        const title = frontmatter.title || '';
        if (!title || !permalink || !date) return null;
        return {
            title,
            author: frontmatter.author || '',
            date,
            permalink,
            url: `review.html?file=${encodeURIComponent(filename)}`,
            publicationYear: frontmatter.publication_year ?? frontmatter.publicationYear
        };
    } catch {
        return null;
    }
}

function parseFrontMatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return {};
    return match[1].split('\n').reduce((acc, line) => {
        const separatorIndex = line.indexOf(':');
        if (separatorIndex === -1) return acc;
        const key = line.slice(0, separatorIndex).trim();
        if (!key) return acc;
        const rawValue = line.slice(separatorIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, '');
        acc[key] = value;
        return acc;
    }, {});
}

function derivePermalinkFromFilename(filename) {
    return filename.replace(/\.md$/i, '').split('_').slice(1).join('_') || filename.replace(/\.md$/i, '');
}

function deriveDateFromFilename(filename) {
    const token = filename.split('_')[0] || '';
    return token.replace(/[^0-9-]/g, '');
}

function renderReviews() {
    const container = document.getElementById('recent-reviews');
    if (!container) return;

    updateWithPreservedHeight(container, () => {
        container.innerHTML = '';
        const header = createEl('div', 'reviews-header');
        const headingLink = createEl('a', 'reviews-title-link', t('reviewsTitle'));
        headingLink.href = 'reviews.html';
        const heading = createEl('h2');
        heading.appendChild(headingLink);
        header.appendChild(heading);

        const listButton = createEl('a', 'reviews-button', '→');
        listButton.href = 'reviews.html';
        listButton.setAttribute('aria-label', t('reviewsListAria'));
        header.appendChild(listButton);
        container.appendChild(header);

        const reviewsToShow = (state.reviews || []).slice(0, 3);

        if (!reviewsToShow.length) {
            container.appendChild(createEl('p', 'heatmap-empty', t('noReviews')));
            return;
        }

        const list = createEl('ul', 'review-list');
        reviewsToShow.forEach(review => {
            const item = createEl('li', 'review-item');

            const link = createEl('a', 'review-title', review.title);
            link.href = review.url || `reviews/${review.permalink}.md`;
            item.appendChild(link);

            const dateSpan = createEl('span', 'review-date', formatRelativeDate(review.date));
            item.appendChild(dateSpan);
            list.appendChild(item);
        });
        container.appendChild(list);
    });
}

// Update TEXT object with review strings
Object.assign(TEXT.ko, {
    reviewsTitle: '최근 서평',
    noReviews: '아직 작성된 서평이 없어요.',
    reviewsListAria: '서평 목록 페이지로 이동'
});

Object.assign(TEXT.en, {
    reviewsTitle: 'Recent Reviews',
    noReviews: 'No reviews yet.',
    reviewsListAria: 'Go to reviews list page'
});
