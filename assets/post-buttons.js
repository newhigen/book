(() => {
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    container.className = 'post-buttons';

    container.innerHTML = `
      <a class="post-button" href="{{ '/' | relative_url }}" aria-label="홈으로">
        <span aria-hidden="true">🏠</span>
      </a>
      <a class="post-button" href="{{ '/reviews' | relative_url }}" aria-label="서평 목록으로">
        <span aria-hidden="true">📚</span>
      </a>
    `;

    document.body.appendChild(container);
  });
})();
