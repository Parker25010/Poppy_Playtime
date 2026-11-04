const page = document.querySelector("#game-page");
const game = window.playtimeGames.find((item) => item.id === page.dataset.gameId);

if (game) {
  const index = window.playtimeGames.indexOf(game);
  const previous = window.playtimeGames[index - 1];
  const next = window.playtimeGames[index + 1];
  document.title = `${game.title} | Playtime Co.`;
  document.querySelector("#game-breadcrumb-title").textContent = game.title;
  document.querySelector("#game-content").innerHTML = `
    <section class="game-detail-grid" aria-labelledby="game-title">
      <div class="game-detail-copy">
        <p class="eyebrow">Poppy Playtime / Game ${game.number}</p>
        <h1 class="game-title" id="game-title">${game.title}</h1>
        <p class="game-summary">${game.summary}</p>
        <div class="game-actions">
          <a class="button button-red" href="${game.steam}" target="_blank" rel="noopener noreferrer">Official Steam page <span aria-hidden="true">↗</span></a>
          <a class="underlined-link" href="/platforms.html">Other platforms <span aria-hidden="true">→</span></a>
        </div>
        <p class="game-note">Official title and artwork from Mob Entertainment's storefront listings. Platform availability varies by game and region.</p>
      </div>
      <figure class="game-cover">
        <img src="${game.keyart}" alt="Official ${game.title} cover art" fetchpriority="high" />
        <figcaption>OFFICIAL KEY ART / MOB ENTERTAINMENT</figcaption>
      </figure>
    </section>
    <figure class="game-screenshot">
      <img src="${game.image}" alt="${game.alt}" loading="lazy" />
      <figcaption>${game.title} / Official game screenshot</figcaption>
    </figure>
    <nav class="game-pagination" aria-label="Browse games">
      <a href="${previous ? previous.route : "/#games"}"><span class="pagination-label">${previous ? "PREVIOUS GAME" : "ALL GAMES"}</span><strong>${previous ? previous.title : "Poppy Playtime games"}</strong></a>
      <a class="pagination-next" href="${next ? next.route : "/#games"}"><span class="pagination-label">${next ? "NEXT GAME" : "ALL GAMES"}</span><strong>${next ? next.title : "Poppy Playtime games"}</strong></a>
    </nav>
  `;
}