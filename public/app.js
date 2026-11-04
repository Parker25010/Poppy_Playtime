function renderGames() {
  const chapterGrid = document.querySelector("#chapter-grid");
  chapterGrid.innerHTML = window.playtimeGames.map((game) => `
    <article class="chapter-card">
      <a class="chapter-image-link" href="${game.route}" aria-label="Read about ${game.title}">
        <img class="chapter-screenshot" src="${game.image}" alt="${game.alt}" loading="lazy" />
        <img class="chapter-keyart" src="${game.keyart}" alt="Official ${game.title} cover art" loading="lazy" />
        <span class="chapter-number">${game.number}</span>
      </a>
      <div class="chapter-details">
        <p class="chapter-code">OFFICIAL GAME TITLE</p>
        <h3>${game.title}</h3>
        <p class="chapter-note">${game.summary}</p>
        <a class="chapter-link" href="${game.route}">Explore game <span aria-hidden="true">→</span></a>
      </div>
    </article>
  `).join("");
}

renderGames();