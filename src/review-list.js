import { createEl, formatRelativeDate, initTheme } from './utils.js';

document.addEventListener('DOMContentLoaded', initReviewsList);

async function initReviewsList() {
    initTheme('theme-toggle');
    const container = document.getElementById('reviews-list');
    if (!container) return;

    const reviews = await loadReviews();
    renderList(container, reviews);
}

async function loadReviews() {
    const reviews = await fetchReviewsIndex();
    return reviews
        .filter(Boolean)
        .map(r => ({
            ...r,
            url: r.permalink || r.url
        }))
        .sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderList(container, reviews) {
    container.innerHTML = '';
    const list = document.createElement('ul');
    list.className = 'review-list reviews-archive-list';

    if (!reviews.length) {
        container.appendChild(createEl('p', 'heatmap-empty', '서평이 아직 없어요.'));
        return;
    }

    let lastDateText = '';
    reviews.forEach(review => {
        const item = document.createElement('li');
        item.className = 'review-item reviews-archive-item';

        const link = document.createElement('a');
        link.className = 'review-title';
        link.href = review.url || `review-detail.html?file=${encodeURIComponent(review.filename)}`;
        link.textContent = review.title;

        const date = document.createElement('span');
        date.className = 'review-date reviews-archive-date';

        // Determine language from document
        const lang = (document.documentElement.lang || 'ko').startsWith('en') ? 'en' : 'ko';
        const dateText = formatRelativeDate(review.date, lang);
        date.textContent = dateText === lastDateText ? '' : dateText;
        lastDateText = dateText;

        const isDetail = review.detail === true || review.detail === 'true' || review.detail === 'yes';
        item.appendChild(date);
        item.appendChild(link);
        if (!isDetail) {
            const badge = document.createElement('span');
            badge.className = 'review-short-badge';
            badge.textContent = 'Short';
            item.appendChild(badge);
        }
        list.appendChild(item);
    });

    container.appendChild(list);
}

async function fetchReviewsIndex() {
    return getReviewsData();
}

function getReviewsData() {
    return Array.isArray(window.REVIEWS) ? window.REVIEWS : [];
}
