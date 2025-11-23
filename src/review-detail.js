import { initTheme } from './utils.js';

document.addEventListener('DOMContentLoaded', initReviewPage);

async function initReviewPage() {
    initTheme('theme-toggle');
    const params = new URLSearchParams(window.location.search);
    const filename = params.get('file');
    const slug = params.get('slug');

    const reviews = getReviewsData();
    const target = findReview(reviews, { filename, slug });

    if (target && target.permalink) {
        window.location.replace(target.permalink);
        return;
    }

    showError('리뷰를 찾을 수 없어요.');
}

function findReview(reviews, { filename, slug }) {
    if (!Array.isArray(reviews)) return null;
    const normalizedSlug = (slug || '').toLowerCase();
    const normalizedFile = (filename || '').toLowerCase();
    return (
        reviews.find(r => (r.filename || '').toLowerCase() === normalizedFile) ||
        reviews.find(r => (r.slug || '').toLowerCase() === normalizedSlug) ||
        reviews.find(r => (r.permalink || '').toLowerCase().includes(normalizedSlug))
    );
}

async function fetchReviewsIndex() {
    return getReviewsData();
}

function showError(message) {
    const el = document.getElementById('review-error');
    if (el) {
        el.textContent = message;
        el.style.display = 'block';
    }
}

function getReviewsData() {
    return Array.isArray(window.REVIEWS) ? window.REVIEWS : [];
}
