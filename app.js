let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];

window.onload = () => {
    if (allChannels.length === 0) {
        toggleModal(true);
    } else {
        renderApp(allChannels);
    }
};

function toggleModal(show) {
    document.getElementById('config-modal').style.display = show ? 'flex' : 'none';
}

function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processM3U(e.target.result);
    reader.readAsText(file);
}

async function loadFromUrl() {
    const url = document.getElementById('m3u-url').value.trim();
    if (!url) return;
    toggleModal(false);
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (data.contents) processM3U(data.contents);
    } catch (err) {
        alert("Erro ao carregar link.");
        toggleModal(true);
    }
}

function processM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let current = null;

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF')) {
            const name = line.split(',')[1]?.trim() || "Canal";
            const logo = line.match(/tvg-logo="([^"]*)"/);
            const group = line.match(/group-title="([^"]*)"/);
            current = { name, logo: logo ? logo[1] : '', group: group ? group[1] : 'Canais' };
        } else if (line.toLowerCase().startsWith('http')) {
            if (current) {
                current.url = line;
                channels.push(current);
                current = null;
            }
        }
    });

    if (channels.length > 0) {
        localStorage.setItem('my_channels', JSON.stringify(channels));
        location.reload();
    }
}

function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';

    // Apenas mostra o Hero se não estivermos a pesquisar
    const isSearch = document.getElementById('search-field').value.length > 0;
    if(!isSearch) setupHero(data);
    else document.getElementById('hero-featured').style.display = 'none';

    const groups = data.reduce((acc, ch) => {
        const groupName = ch.group || 'Geral';
        acc[groupName] = acc[groupName] || [];
        acc[groupName].push(ch);
        return acc;
    }, {});

    Object.keys(groups).sort().forEach(group => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<div class="row-title">${group}</div>`;
        const carousel = document.createElement('div');
        carousel.className = 'carousel';

        groups[group].forEach(ch => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            const img = ch.logo ? `<img src="${ch.logo}" onerror="this.style.display='none'">` : '';
            card.innerHTML = `${img}<div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });
        row.appendChild(carousel);
        container.appendChild(row);
    });
}

function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    if (data.length === 0) return;
    const random = data[Math.floor(Math.random() * data.length)];
    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    hero.style.backgroundImage = `url('https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1920')`;
    hero.style.display = 'flex';
}

function filterChannels() {
    const query = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(query));
    renderApp(filtered);
}
let lastScrollTop = 0;
const header = document.querySelector('header');

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const searchField = document.getElementById('search-field');

    // REGRA DE SEGURANÇA: Não esconde se o utilizador estiver a escrever 
    // ou se houver texto na pesquisa.
    if (document.activeElement === searchField || searchField.value.length > 0) {
        header.classList.remove('header-hidden');
        return;
    }

    if (scrollTop > lastScrollTop && scrollTop > 70) {
        // Scroll para BAIXO - Esconde a barra
        header.classList.add('header-hidden');
    } else {
        // Scroll para CIMA - Mostra a barra
        header.classList.remove('header-hidden');
    }
    
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; // Para navegadores mobile
}, { passive: true });
}
