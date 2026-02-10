function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    const searchField = document.getElementById('search-field');
    const isSearch = searchField && searchField.value.length > 0;
    const hero = document.getElementById('hero-featured');

    if (isSearch) {
        if (hero) hero.style.display = 'none';
        // Adiciona o título de resultados como na imagem
        container.innerHTML = `<div class="search-results-header">RESULTADOS PARA "${searchField.value.toUpperCase()}"</div>`;
    } else {
        if (hero) {
            hero.style.display = 'flex';
            setupHero(allChannels); //
        }
    }

    // Lógica de grupos original
    const groups = data.reduce((acc, ch) => {
        acc[ch.group] = acc[ch.group] || [];
        acc[ch.group].push(ch);
        return acc;
    }, {});

    Object.keys(groups).sort().forEach((group, index) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.style.animationDelay = `${index * 0.1}s`; // Stagger effect
        row.innerHTML = `<div class="row-title">${group}</div><div class="carousel"></div>`;
        const carousel = row.querySelector('.carousel');

        groups[group].forEach(ch => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            
            card.innerHTML = `
                <img src="${ch.logo}" loading="lazy" onerror="this.src='https://via.placeholder.com/150/111/fff?text=TV'">
                <div class="card-info">${ch.name}</div>
            `;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}
