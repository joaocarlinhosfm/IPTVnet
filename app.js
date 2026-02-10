// Adicionei uma pequena transição de delay para os cards parecerem mais orgânicos
function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    const isSearch = document.getElementById('search-field').value.length > 0;
    if (!isSearch) setupHero(data);
    else document.getElementById('hero-featured').style.display = 'none';

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
            
            // Lazy loading simples para as imagens
            card.innerHTML = `
                <img src="${ch.logo}" loading="lazy" onerror="this.src='https://via.placeholder.com/150/111/fff?text=TV'">
                <div class="card-info">${ch.name}</div>
            `;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

// Atualização da lógica de Hero com imagens mais "cinematográficas"
function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    const random = data[Math.floor(Math.random() * data.length)];
    const category = (random.group || "Geral").toUpperCase();

    const categoryImages = {
        "NACIONAIS": "https://images.unsplash.com/photo-1469395272481-645826f59265?q=80&w=1920",
        "DESPORTO": "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?q=80&w=1920",
        "NOTICIAS": "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1920",
        "FILMES": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1920",
        "KIDS": "https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?q=80&w=1920"
    };

    let bg = "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1920";

    for (let key in categoryImages) {
        if (category.includes(key)) { bg = categoryImages[key]; break; }
    }

    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    
    hero.style.backgroundImage = `url('${bg}')`;
    hero.style.display = 'flex';
}
