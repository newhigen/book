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

const normalizeText = value => (value ?? '').trim();
const isBookReview = review => Boolean(review.publication_year ?? review.publicationYear);

function formatReviewTitle(review) {
    const title = normalizeText(review.title);
    if (!title) return review.title;
    if (!isBookReview(review)) return title;
    const alreadyWrapped = title.startsWith('『') && title.endsWith('』');
    return alreadyWrapped ? title : `『${title}』`;
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
        link.textContent = formatReviewTitle(review);

        const date = document.createElement('span');
        date.className = 'review-date reviews-archive-date';

        const dateText = formatRelativeDate(review.date, 'ko');
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
