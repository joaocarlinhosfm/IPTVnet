/**
 * N-STREAM - Core Engine
 */

let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];

window.onload = () => {
    if (allChannels.length === 0) {
        toggleModal(true);
        document.getElementById('close-btn').style.display = 'none';
    } else {
        renderApp(allChannels);
    }
};

// Efeito de Header no Scroll
window.onscroll = () => {
    const header = document.getElementById('main-header');
    header.classList.toggle('scrolled', window.scrollY > 50);
};

function toggleModal(show) {
    document.getElementById('config-modal').style.display = show ? 'flex' : 'none';
}

function toggleSearch(show) {
    const overlay = document.getElementById('search-overlay');
    overlay.style.display = show ? 'flex' : 'none';
    if(show) document.getElementById('search-field').focus();
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
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    try {
        const response = await fetch(proxy);
        const text = await response.text();
        if (text.includes("#EXTM3U")) processM3U(text);
        else throw new Error();
    } catch (err) {
        alert("Erro ao carregar link. Use a importação de ficheiro.");
        toggleModal(true);
    }
}

function processM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let current = {};

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF')) {
            const name = line.split(',')[1]?.trim() || "Canal";
            const logo = line.match(/tvg-logo="([^"]*)"/);
            const group = line.match(/group-title="([^"]*)"/);
            current = { name, logo: logo ? logo[1] : '', group: group ? group[1] : 'Premium' };
        } else if (line.startsWith('http')) {
            current.url = line;
            channels.push(current);
            current = {};
        }
    });

    if (channels.length > 0) {
        localStorage.setItem('my_channels', JSON.stringify(channels));
        location.reload();
    }
}

function renderApp(data, targetContainer = "content") {
    const container = document.getElementById(targetContainer);
    container.innerHTML = '';

    if(targetContainer === "content") setupHero(data);

    const groups = data.reduce((acc, ch) => {
        const groupName = ch.group || 'Geral';
        acc[groupName] = acc[groupName] || [];
        acc[groupName].push(ch);
        return acc;
    }, {});

    Object.keys(groups).sort().forEach((group, idx) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.style.animationDelay = `${idx * 0.1}s`;
        row.innerHTML = `<div class="row-title">${group}</div>`;
        
        const carousel = document.createElement('div');
        carousel.className = 'carousel';

        groups[group].forEach(ch => {
            const card = document.createElement('div');
            card.className = 'card';
            card.onclick = () => window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            
            const content = ch.logo ? 
                `<img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/160x230/111/444?text=TV'">` : 
                `<i class="fas fa-play" style="font-size:2rem;color:#222"></i>`;
            
            card.innerHTML = `${content}<div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });

        row.appendChild(carousel);
        container.appendChild(row);
    });
}

function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    const random = data[Math.floor(Math.random() * data.length)];
    
    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    
    // Imagem de background genérica ou o logo se for de alta qualidade
    hero.style.backgroundImage = `url('https://images.unsplash.com/photo-1616469829581-73993eb86b02?auto=format&fit=crop&w=1920&q=80')`;
    hero.style.display = 'flex';
}

function filterChannels() {
    const query = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(query));
    renderApp(filtered, "search-results");
}
