document.addEventListener('DOMContentLoaded', initReviewPage);

async function initReviewPage() {
    const params = new URLSearchParams(window.location.search);
    const filename = params.get('file');
    if (!filename) {
        showError('파일을 찾을 수 없어요.');
        return;
    }

    const text = await fetchMarkdown(filename);
    if (!text) return;

    const { frontmatter, body } = splitFrontMatter(text);
    const metadata = parseFrontMatter(frontmatter);
    renderHeader(metadata, filename);
    renderContent(body);
}

async function fetchMarkdown(filename) {
    try {
        const response = await fetch(`reviews/${encodeURIComponent(filename)}`);
        if (!response.ok) {
            showError('리뷰를 불러오지 못했어요.');
            return null;
        }
        return await response.text();
    } catch {
        showError('리뷰를 불러오지 못했어요.');
        return null;
    }
}

function splitFrontMatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---\n?/);
    if (!match) return { frontmatter: '', body: text };
    return {
        frontmatter: match[1],
        body: text.slice(match[0].length)
    };
}

function parseFrontMatter(block) {
    if (!block) return {};
    return block.split('\n').reduce((acc, line) => {
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

function renderHeader(meta, filename) {
    const title = meta.title || deriveTitleFromFilename(filename);
    const rawDate = meta.date || deriveDateFromFilename(filename);
    const formattedDate = formatDate(rawDate);
    document.title = title;
    setText('review-title', title);
    setText('review-date', formattedDate);
    const metaParts = [];
    if (meta.author) metaParts.push(meta.author);
    const publicationYear = meta.publication_year || meta.publicationYear;
    if (publicationYear) metaParts.push(publicationYear);
    if (metaParts.length) setText('review-meta', metaParts.join(' · '));
}

function deriveTitleFromFilename(filename) {
    return filename.replace(/\.md$/i, '').split('_').slice(1).join('_') || filename;
}

function deriveDateFromFilename(filename) {
    const token = filename.split('_')[0] || '';
    return token.replace(/[^0-9-]/g, '');
}

function formatDate(raw) {
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

function renderContent(markdown) {
    const container = document.getElementById('review-content');
    container.innerHTML = markdownToHtml(markdown);
}

function markdownToHtml(markdown) {
    const lines = markdown.split('\n');
    const html = [];
    let inCode = false;
    let codeLines = [];
    let listBuffer = [];

    const flushCode = () => {
        if (!inCode) return;
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        inCode = false;
        codeLines = [];
    };

    const flushList = () => {
        if (!listBuffer.length) return;
        const items = listBuffer.map(item => `<li>${item}</li>`).join('');
        html.push(`<ul>${items}</ul>`);
        listBuffer = [];
    };

    lines.forEach(rawLine => {
        const line = rawLine.replace(/\r$/, '');

        if (/^```/.test(line)) {
            if (inCode) {
                flushCode();
            } else {
                inCode = true;
            }
            return;
        }

        if (inCode) {
            codeLines.push(line);
            return;
        }

        const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
        if (headingMatch) {
            flushList();
            const level = headingMatch[1].length;
            html.push(`<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`);
            return;
        }

        const listMatch = line.match(/^[-*+]\s+(.*)$/);
        if (listMatch) {
            listBuffer.push(inlineMarkdown(listMatch[1]));
            return;
        } else {
            flushList();
        }

        if (!line.trim()) {
            return;
        }

        if (/^>/.test(line)) {
            html.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ''))}</blockquote>`);
            return;
        }

        html.push(`<p>${inlineMarkdown(line)}</p>`);
    });

    flushList();
    flushCode();
    return html.join('\n');
}

function inlineMarkdown(text) {
    let result = text;

    // Custom escaping: /< -> <, /> -> > (Keeping this as per original request, but images don't need it now)
    result = result.replace(/\/&lt;/g, '<').replace(/\/&gt;/g, '>');

    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/_(.+?)_/g, '<em>$1</em>');
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    return result;
}

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el && value) el.textContent = value;
}

function showError(message) {
    const el = document.getElementById('review-error');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}
