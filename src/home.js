import {
    createEl,
    formatRelativeDate,
    initTheme
} from './utils.js';

const dom = {
    heatmap: document.getElementById('reading-heatmap'),
    pastList: document.getElementById('past-books'),
    languageToggle: document.getElementById('language-toggle'),
    themeToggle: document.getElementById('theme-toggle'),
    blogDesktop: document.getElementById('blog-link-desktop'),
    blogMobile: document.getElementById('blog-link-mobile')
};

const MONTHS_PER_YEAR = 12;
const DATA_FILES = ['books.csv', 'books.csv.example'];
const REVIEW_TITLE_ALIASES = {
    '이동진 독서법': '독서법',
    '책 잘 읽는 방법': '독서법',
    '진작 이렇게 책을 읽었더라면': '독서법'
};
const FLAG_EMOJI = { ko: '🇰🇷', en: '🇺🇸' };
const BLOG_URL = 'https://newhigen.github.io/';

const COPY = {
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
    toggleAriaLabel: '제목 언어 전환',
    tooltipBullet: '•',
    reviewsTitle: '최근 후기',
    noReviews: '아직 작성된 서평이 없어요.',
    reviewsListAria: '후기 목록 페이지로 이동',
    summaryLabel: '결산'
};

const state = {
    books: [],
    booksByYear: new Map(),
    heatmapBuckets: new Map(),
    titleLanguage: 'ko',
    yearRefs: [],
    collapsedYears: new Map(),
    reviews: [],
    reviewLookup: new Map(),
    summariesByYear: new Map()
};

const normalizeText = value => (value ?? '').trim();
const getCanonicalTitle = book => normalizeText(book.title) || normalizeText(book.englishTitle);
const getLocalizedTitle = book =>
    state.titleLanguage === 'ko'
        ? (normalizeText(book.title) || normalizeText(book.englishTitle))
        : (normalizeText(book.englishTitle) || normalizeText(book.title));

const t = (key, ...args) => {
    const value = COPY[key];
    return typeof value === 'function' ? value(...args) : value;
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    initLanguageToggle();
    initTheme('theme-toggle');
    const [booksLoaded] = await Promise.all([loadBooks(), loadReviews()]);

    if (booksLoaded) {
        buildDerivedData();
        renderAll();
    } else {
        renderReviews();
        renderBlogLinks();
    }
}

function initLanguageToggle() {
    if (!dom.languageToggle) return;
    updateLanguageToggleUI();
    dom.languageToggle.addEventListener('click', () => {
        state.titleLanguage = state.titleLanguage === 'ko' ? 'en' : 'ko';
        updateLanguageToggleUI();
        renderAll();
    });
}

function updateLanguageToggleUI() {
    if (!dom.languageToggle) return;
    dom.languageToggle.innerHTML = '';
    const label = createEl('span', 'language-label', '제목');
    const flag = createEl('span', 'language-flag', FLAG_EMOJI[state.titleLanguage]);
    dom.languageToggle.appendChild(label);
    dom.languageToggle.appendChild(flag);
    dom.languageToggle.setAttribute(
        'aria-label',
        `${t('toggleAriaLabel')} (${state.titleLanguage === 'en' ? '영어' : '한글'})`
    );
    dom.languageToggle.setAttribute('aria-pressed', state.titleLanguage === 'en');
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
    renderBlogLinks();
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
    const currentYear = new Date().getFullYear();
    updateWithPreservedHeight(dom.pastList, () => {
        dom.pastList.innerHTML = '';
        years.forEach(year => {
            if (!state.collapsedYears.has(year)) {
                state.collapsedYears.set(year, year !== currentYear);
            }
            const isCollapsed = state.collapsedYears.get(year);
            const { fragment, refs } = createYearSection(year, isCollapsed);
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
            applyYearHeadingContent(refs.heading, refs.year);
            if (refs.summaryText) {
                refs.summaryText.textContent = t('yearSummary', books.length);
            }
            applyYearCollapsedState(refs.year, refs, state.collapsedYears.get(refs.year));
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

function applyYearHeadingContent(headingEl, year) {
    headingEl.textContent = t('yearHeading', year);
    const summaryLink = createYearSummaryLink(year);
    if (summaryLink) {
        headingEl.appendChild(document.createTextNode(' '));
        headingEl.appendChild(summaryLink);
    }
}

function createYearSummaryLink(year) {
    const summaryReview = state.summariesByYear.get(year);
    if (!summaryReview) return null;
    const link = createEl('a', 'year-summary-link', t('summaryLabel'));
    link.href =
        summaryReview.url || `review-detail.html?file=${encodeURIComponent(summaryReview.filename)}`;
    link.setAttribute('aria-label', `${year} ${t('summaryLabel')}`);
    return link;
}

function createYearSection(year, isCollapsed = false) {
    const fragment = document.createDocumentFragment();
    const books = state.booksByYear.get(year) || [];
    const heading = createEl('h2');
    applyYearHeadingContent(heading, year);
    fragment.appendChild(heading);

    const listId = `year-${year}-books`;
    const summaryButton = createEl('button', 'year-summary');
    summaryButton.type = 'button';
    summaryButton.setAttribute('aria-controls', listId);
    const summaryText = createEl('span', 'year-summary-text', t('yearSummary', books.length));
    const toggleIcon = createEl('span', 'year-toggle-icon');
    summaryButton.appendChild(summaryText);
    summaryButton.appendChild(toggleIcon);
    fragment.appendChild(summaryButton);

    const list = createEl('ul');
    list.id = listId;
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
        const review = findReviewForBook(book);
        const titleContainer = createEl('span', 'book-title');

        const titleText = review
            ? createEl('a', 'book-title-text review-link has-review', displayTitle)
            : createEl('span', 'book-title-text', displayTitle);

        if (review) {
            titleText.href = review.url || `review-detail.html?file=${encodeURIComponent(review.filename)}`;
            titleText.target = '_self';
            titleText.rel = 'noopener';
        }
        titleContainer.appendChild(titleText);
        const canonical = book.canonicalTitle || getCanonicalTitle(book);
        const count = state.bookCounts.get(canonical) || 0;
        const snapshot = book.year * 100 + book.month;
        if (count > 1 && state.latestMonth.get(canonical) === snapshot) {
            const badge = createEl('span', 'reread-badge', t('rereadBadge', count));
            titleContainer.appendChild(badge);
            badgeSpans.push({ el: badge, count });
        }
        item.appendChild(titleContainer);
        list.appendChild(item);
    });

    fragment.appendChild(list);
    const refs = {
        year,
        heading,
        summaryButton,
        summaryText,
        toggleIcon,
        list,
        monthSpans,
        badgeSpans
    };

    summaryButton.addEventListener('click', () => {
        const nextCollapsed = !state.collapsedYears.get(year);
        applyYearCollapsedState(year, refs, nextCollapsed);
    });

    applyYearCollapsedState(year, refs, isCollapsed);

    return { fragment, refs };
}

function applyYearCollapsedState(year, refs, collapsed) {
    const isCollapsed = Boolean(collapsed);
    state.collapsedYears.set(year, isCollapsed);
    if (refs.list) refs.list.hidden = isCollapsed;
    if (refs.summaryButton) {
        refs.summaryButton.setAttribute('aria-expanded', (!isCollapsed).toString());
        refs.summaryButton.classList.toggle('is-collapsed', isCollapsed);
    }
    if (refs.toggleIcon) refs.toggleIcon.textContent = isCollapsed ? '▸' : '▾';
    updateYearToggleLabel(refs, isCollapsed);
}

function updateYearToggleLabel(refs, collapsed) {
    if (!refs?.summaryButton || !refs.summaryText) return;
    const summaryText = refs.summaryText.textContent || '';
    const action = collapsed ? '펼치기' : '접기';
    refs.summaryButton.setAttribute('aria-label', `${refs.year}년 ${summaryText} 목록 ${action}`);
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
    const hint = createEl('span', 'heatmap-hint', '커서를 올려보세요 ✨');
    header.appendChild(hint);
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

/* Review Logic */

async function loadReviews() {
    const reviews = getReviewsData();
    state.reviews = reviews
        .filter(Boolean)
        .map(r => ({
            ...r,
            url: r.permalink || r.url
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    buildReviewLookup(state.reviews);
    buildSummaryLookup(state.reviews);
    return state.reviews.length > 0;
}

function findReviewForBook(book) {
    const candidates = [
        normalizeText(book.title),
        normalizeText(book.englishTitle),
        getCanonicalTitle(book)
    ]
        .map(v => v.toLowerCase())
        .filter(Boolean);
    for (const key of candidates) {
        if (state.reviewLookup.has(key)) return state.reviewLookup.get(key);
    }
    return null;
}

function buildReviewLookup(reviews) {
    state.reviewLookup = new Map();
    const titleToReview = new Map();
    reviews.forEach(review => {
        const normalizedTitle = normalizeText(review.title).toLowerCase();
        if (normalizedTitle) {
            state.reviewLookup.set(normalizedTitle, review);
            titleToReview.set(normalizedTitle, review);
        }
    });
    Object.entries(REVIEW_TITLE_ALIASES).forEach(([aliasTitle, targetTitle]) => {
        const normalizedAlias = normalizeText(aliasTitle).toLowerCase();
        const normalizedTarget = normalizeText(targetTitle).toLowerCase();
        if (!normalizedAlias || !normalizedTarget) return;
        if (titleToReview.has(normalizedAlias)) return;
        const targetReview = titleToReview.get(normalizedTarget);
        if (targetReview) state.reviewLookup.set(normalizedAlias, targetReview);
    });
}

function buildSummaryLookup(reviews) {
    state.summariesByYear = new Map();
    reviews.forEach(review => {
        const year = getSummaryYear(review);
        if (!year) return;
        if (!state.summariesByYear.has(year)) state.summariesByYear.set(year, review);
    });
}

function renderReviews() {
    const container = document.getElementById('recent-reviews');
    if (!container) return;

    updateWithPreservedHeight(container, () => {
        container.innerHTML = '';
        const header = createEl('div', 'reviews-header');
        const headingLink = createEl('a', 'reviews-title-link', t('reviewsTitle'));
        headingLink.href = 'reviews/';
        const heading = createEl('h2');
        heading.appendChild(headingLink);
        header.appendChild(heading);
        container.appendChild(header);

        const reviewsToShow = (state.reviews || []).slice(0, 5);

        if (!reviewsToShow.length) {
            container.appendChild(createEl('p', 'heatmap-empty', t('noReviews')));
            return;
        }

        const list = createEl('ul', 'review-list recent-review-list');
        let lastDateText = '';
        reviewsToShow.forEach(review => {
            const item = createEl('li', 'review-item recent-review-item');

            const dateText = formatRelativeDate(review.date, 'ko');
            const dateSpan = createEl('span', 'review-date', dateText === lastDateText ? '' : dateText);
            item.appendChild(dateSpan);
            lastDateText = dateText;

            const link = createEl('a', 'review-title', getLocalizedReviewTitle(review));
            link.href = review.url || `review-detail.html?file=${encodeURIComponent(review.filename)}`;
            item.appendChild(link);

            const isDetail = review.detail === true || review.detail === 'true' || review.detail === 'yes';
            if (!isDetail) {
                const badge = createEl('span', 'review-short-badge', 'Short');
                item.appendChild(badge);
            }
            list.appendChild(item);
        });
        container.appendChild(list);
    });
}

async function fetchReviewsIndex() {
    return getReviewsData();
}

function getReviewsData() {
    return Array.isArray(window.REVIEWS) ? window.REVIEWS : [];
}

function getSummaryYear(review) {
    const value = review.summary_year ?? review.summaryYear;
    const year = parseInt(value, 10);
    return Number.isFinite(year) ? year : null;
}

function isSummaryReview(review) {
    return Boolean(getSummaryYear(review));
}

function isBookReview(review) {
    const publicationYear = review.publication_year ?? review.publicationYear;
    return Boolean(publicationYear);
}

function getLocalizedReviewTitle(review) {
    const baseTitle = review.title;
    if (!isBookReview(review)) return baseTitle;

    const trimmedTitle = normalizeText(baseTitle);
    if (!trimmedTitle) return baseTitle;

    const alreadyWrapped = trimmedTitle.startsWith('『') && trimmedTitle.endsWith('』');
    return alreadyWrapped ? trimmedTitle : `『${trimmedTitle}』`;
}

function renderBlogLinks() {
    renderSingleBlogLink(dom.blogDesktop, 'desktop');
    renderSingleBlogLink(dom.blogMobile, 'mobile');
}

function renderSingleBlogLink(container, variant) {
    if (!container) return;
    updateWithPreservedHeight(container, () => {
        container.innerHTML = '';
        const wrapper = createEl('div', `blog-link-container ${variant === 'mobile' ? 'blog-link-mobile' : 'blog-link-desktop'}`);
        const blogLink = createEl('a', 'blog-link-button', '블로그');
        blogLink.href = BLOG_URL;
        blogLink.target = '_blank';
        blogLink.rel = 'noopener noreferrer';
        wrapper.appendChild(blogLink);
        container.appendChild(wrapper);
    });
}
