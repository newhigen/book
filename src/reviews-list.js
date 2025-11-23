document.addEventListener('DOMContentLoaded', initReviewsList);

async function initReviewsList() {
    const container = document.getElementById('reviews-list');
    if (!container) return;

    const reviews = await loadReviews();
    renderList(container, reviews);
}

async function loadReviews() {
    const files = await discoverReviewFiles();
    if (!files.length) return [];
    const metadata = await Promise.all(files.map(fetchReviewMetadata));
    return metadata.filter(Boolean).sort((a, b) => new Date(b.date) - new Date(a.date));
}

async function discoverReviewFiles() {
    try {
        const response = await fetch('reviews/');
        if (!response.ok) return [];
        const html = await response.text();
        return extractMarkdownLinks(html);
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
        // ignore
    }

    if (!files.length) {
        const regex = /href="([^"]+\.md)"/gi;
        let match;
        while ((match = regex.exec(html))) {
            files.push(match[1].split('/').pop());
        }
    }

    return Array.from(new Set(files));
}

async function fetchReviewMetadata(filename) {
    if (!filename) return null;
    try {
        const response = await fetch(`reviews/${encodeURIComponent(filename)}`);
        if (!response.ok) return null;
        const text = await response.text();
        const frontmatter = parseFrontMatter(text);
        const title = frontmatter.title || deriveTitleFromFilename(filename);
        const date = frontmatter.date || deriveDateFromFilename(filename);
        const permalink = frontmatter.permalink || derivePermalinkFromFilename(filename);
        if (!title || !date || !permalink) return null;
        return {
            title,
            date,
            url: `review.html?file=${encodeURIComponent(filename)}`
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

function deriveTitleFromFilename(filename) {
    const base = filename.replace(/\.md$/i, '');
    const match = base.match(/^\d{4}-\d{2}-\d{2}[-_](.+)$/);
    if (match) return match[1];
    return base.split('_').slice(1).join('_') || base;
}

function deriveDateFromFilename(filename) {
    const base = filename.replace(/\.md$/i, '').replace(/_/g, '-');
    const match = base.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const compact = base.match(/^(\d{8})/);
    if (compact) return compact[1];
    const token = filename.split(/[_-]/)[0] || '';
    return token.replace(/[^0-9-]/g, '');
}

function derivePermalinkFromFilename(filename) {
    const base = filename.replace(/\.md$/i, '');
    const match = base.match(/^\d{4}-\d{2}-\d{2}[-_](.+)$/);
    if (match) return match[1];
    return base.split('_').slice(1).join('_') || base;
}

function renderList(container, reviews) {
    container.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'review-list reviews-archive-list';

    if (!reviews.length) {
        container.appendChild(createText('p', 'heatmap-empty', '서평이 아직 없어요.'));
        return;
    }

    reviews.forEach(review => {
        const item = document.createElement('li');
        item.className = 'review-item reviews-archive-item';

        const link = document.createElement('a');
        link.className = 'review-title';
        link.href = review.url;
        link.textContent = review.title;

        const date = document.createElement('span');
        date.className = 'review-date reviews-archive-date';
        date.textContent = formatRelativeDate(review.date);

        item.appendChild(link);
        item.appendChild(date);
        list.appendChild(item);
    });

    container.appendChild(list);
}

function createText(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = text;
    return el;
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
    if (diffDays <= 0) return '오늘';
    if (diffDays < 7) return relative(diffDays, 'day');
    const weeks = Math.floor(diffDays / 7);
    if (weeks < 4) return relative(weeks, 'week');
    const months = Math.floor(diffDays / 30);
    if (months < 12) return relative(months, 'month');
    const years = Math.floor(diffDays / 365);
    return relative(years, 'year');
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

const TEXT = {
    ko: {
        today: '오늘',
        day: n => `${n}일 전`,
        week: n => `${n}주 전`,
        month: n => `${n}달 전`,
        year: n => `${n}년 전`
    },
    en: {
        today: 'Today',
        day: n => `${n} days ago`,
        week: n => `${n} weeks ago`,
        month: n => `${n} months ago`,
        year: n => `${n} years ago`
    }
};

function relative(n, unit) {
    const lang = (document.documentElement.lang || 'ko').startsWith('en') ? 'en' : 'ko';
    const copy = TEXT[lang];
    return copy[unit](n);
}
