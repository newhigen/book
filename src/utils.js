export function parseFrontMatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
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

export function deriveTitleFromFilename(filename) {
    const base = filename.replace(/\.md$/i, '');
    const match = base.match(/^\d{4}-\d{2}-\d{2}[-_](.+)$/);
    if (match) return match[1];
    return base.split('_').slice(1).join('_') || base;
}

export function deriveDateFromFilename(filename) {
    const base = filename.replace(/\.md$/i, '').replace(/_/g, '-');
    const match = base.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const compact = base.match(/^(\d{8})/);
    if (compact) return compact[1];
    const token = filename.split(/[_-]/)[0] || '';
    return token.replace(/[^0-9-]/g, '');
}

export function derivePermalinkFromFilename(filename) {
    const base = filename.replace(/\.md$/i, '');
    const match = base.match(/^\d{4}-\d{2}-\d{2}[-_](.+)$/);
    if (match) return match[1];
    return base.split('_').slice(1).join('_') || base;
}

export function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function formatDate(raw) {
    if (!raw) return '';
    const stripZero = value => {
        const num = parseInt(value, 10);
        return Number.isFinite(num) ? String(num) : value;
    };
    const dayName = date => ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];

    const buildDateString = (y, m, d) => {
        const year = stripZero(y);
        const month = stripZero(m);
        const day = stripZero(d);
        const dateObj = new Date(`${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
        const weekday = Number.isNaN(dateObj.getTime()) ? '' : ` (${dayName(dateObj)})`;
        return `${year}년 ${month}월 ${day}일${weekday}`;
    };

    const parts = raw.split(/[-./]/).filter(Boolean);
    if (parts.length === 3) {
        const [y, m, d] = parts;
        return buildDateString(y, m, d);
    }
    if (raw.length === 8) {
        const y = raw.slice(0, 4);
        const m = raw.slice(4, 6);
        const d = raw.slice(6, 8);
        return buildDateString(y, m, d);
    }
    return raw;
}

export function parseDate(value) {
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

const RELATIVE_TEXT = {
    ko: {
        today: '오늘',
        day: n => `${n}일 전`,
        week: n => `${n}주 전`,
        month: n => `${n}달 전`,
        year: n => `${n}년 전`
    },
    en: {
        today: 'Today',
        day: n => `${n} day${n === 1 ? '' : 's'}`,
        week: n => `${n} week${n === 1 ? '' : 's'}`,
        month: n => `${n} month${n === 1 ? '' : 's'}`,
        year: n => `${n} year${n === 1 ? '' : 's'}`
    }
};

export function formatRelativeDate(value, lang = 'ko') {
    if (!value) return '';
    const parsed = parseDate(value);
    if (!parsed) return value;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    const diffMs = startOfToday - target;
    const diffDays = Math.floor(diffMs / 86400000);

    const copy = RELATIVE_TEXT[lang] || RELATIVE_TEXT.ko;

    if (diffDays <= 0) return copy.today;
    if (diffDays < 7) return copy.day(diffDays);

    const weeks = Math.floor(diffDays / 7);
    if (weeks < 4) return copy.week(weeks);

    const months = Math.floor(diffDays / 30);
    if (months < 12) return copy.month(months);

    const years = Math.floor(diffDays / 365);
    return copy.year(years);
}

/* Theme Logic */
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

let currentTheme = 'light';

export function initTheme(toggleBtnId) {
    const toggleBtn = document.getElementById(toggleBtnId);
    if (!toggleBtn) return;

    const stored = safeStorageGet(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
        currentTheme = stored;
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        currentTheme = 'dark';
    }

    applyTheme(toggleBtn);

    toggleBtn.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        applyTheme(toggleBtn);
    });
}

export function toggleTheme(toggleBtnId) {
    const toggleBtn = document.getElementById(toggleBtnId);
    if (!toggleBtn) return;
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(toggleBtn);
}

export function applyTheme(toggleBtn) {
    document.body.classList.toggle('dark-mode', currentTheme === 'dark');
    safeStorageSet(THEME_STORAGE_KEY, currentTheme);
    updateThemeUI(toggleBtn);
}

export function updateThemeUI(toggleBtn) {
    if (!toggleBtn) return;
    const copy = currentTheme === 'dark' ? THEME_COPY.dark : THEME_COPY.light;
    toggleBtn.textContent = copy.icon;
    toggleBtn.setAttribute('aria-label', copy.aria);
    toggleBtn.setAttribute('aria-pressed', currentTheme === 'dark');
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

export function extractMarkdownLinks(html) {
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

    return Array.from(new Set(files));
}

export function createEl(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined && text !== null) el.textContent = text;
    return el;
}
