let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];
let lastScrollTop = 0;

window.onload = () => {
    if (allChannels.length > 0) {
        renderApp(allChannels);
    } else {
        toggleModal(true); // Se não houver canais, abre o modal
    }
    setupSmartHeader();
};

function setupSmartHeader() {
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        const st = window.pageYOffset || document.documentElement.scrollTop;
        if (st > lastScrollTop && st > 80) header.classList.add('header-hidden');
        else header.classList.remove('header-hidden');
        lastScrollTop = st <= 0 ? 0 : st;
    }, { passive: true });
}

function toggleModal(show) {
    const modal = document.getElementById('config-modal');
    modal.style.display = show ? 'flex' : 'none';
}

// --- FUNÇÃO DE CARREGAMENTO CORRIGIDA ---
async function loadFromUrl() {
    const urlInput = document.getElementById('m3u-url');
    const url = urlInput.value.trim();
    if (!url) return alert("Por favor, insere um URL.");

    console.log("A carregar lista de:", url);
    
    // Usamos o allorigins para evitar erros de CORS ao ler o ficheiro de texto
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    try {
        const res = await fetch(proxy);
        if (!res.ok) throw new Error("Erro na rede");
        const data = await res.json();
        if (data.contents) {
            processM3U(data.contents);
        } else {
            throw new Error("Conteúdo vazio");
        }
    } catch (e) {
        alert("Erro ao carregar a lista. Verifica o link.");
        console.error(e);
    }
}

function loadFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processM3U(ev.target.result);
    reader.readAsText(file);
}

function processM3U(text) {
    const channels = [];
    const lines = text.split(/\r?\n/);
    let current = null;

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF')) {
            const name = line.split(',')[1] || "Canal";
            const logo = line.match(/tvg-logo="([^"]*)"/i);
            const group = line.match(/group-title="([^"]*)"/i);
            current = { 
                name, 
                logo: logo?.[1] || '', 
                group: group?.[1] || 'Geral' 
            };
        } else if (line.startsWith('http')) {
            if (current) {
                current.url = line;
                channels.push(current);
                current = null;
            }
        }
    });

    if (channels.length > 0) {
        localStorage.setItem('my_channels', JSON.stringify(channels));
        allChannels = channels;
        toggleModal(false);
        renderApp(channels);
        location.reload(); // Recarrega para aplicar o Hero
    } else {
        alert("Não foram encontrados canais válidos nesse ficheiro.");
    }
}

function renderApp(data) {
    const container = document.getElementById('main-content');
    container.innerHTML = '';
    
    const isSearch = document.getElementById('search-field').value.length > 0;
    if (!isSearch) setupHero(data);

    const groups = data.reduce((acc, ch) => {
        acc[ch.group] = acc[ch.group] || [];
        acc[ch.group].push(ch);
        return acc;
    }, {});

    Object.keys(groups).sort().forEach(group => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `<div class="row-title">${group}</div><div class="carousel"></div>`;
        const carousel = row.querySelector('.carousel');

        groups[group].forEach(ch => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            card.innerHTML = `
                <img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/150/111/fff?text=TV'">
                <div class="card-info">${ch.name}</div>
            `;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    if (!data.length) return;
    
    const random = data[Math.floor(Math.random() * data.length)];
    const heroName = document.getElementById('hero-name');
    const heroPlay = document.getElementById('hero-play');

    heroName.innerText = random.name;
    heroPlay.onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    
    hero.style.backgroundImage = `url('https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1920')`;
    hero.style.display = 'flex';
}

function filterChannels() {
    const q = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(c => c.name.toLowerCase().includes(q));
    renderApp(filtered);
}
