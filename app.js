let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];
let lastScrollTop = 0;

window.onload = () => {
    if (allChannels.length > 0) {
        renderApp(allChannels);
    } else {
        toggleModal(true);
    }
    setupSmartHeader();
};

// --- SMART HEADER ---
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

// --- IMPORTAÇÃO DE LISTA (CORRIGIDA) ---
async function loadFromUrl() {
    const urlInput = document.getElementById('m3u-url');
    const url = urlInput.value.trim();
    if (!url) return alert("Por favor, insere um URL.");

    // Proxy para evitar erros de CORS
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
        location.reload(); 
    } else {
        alert("Não foram encontrados canais válidos.");
    }
}

// --- RENDERIZAÇÃO (Com animações Premium) ---
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
            
            // Lazy loading e placeholder
            card.innerHTML = `
                <img src="${ch.logo}" loading="lazy" onerror="this.src='https://via.placeholder.com/150/111/fff?text=TV'">
                <div class="card-info">${ch.name}</div>
            `;
            carousel.appendChild(card);
        });
        container.appendChild(row);
    });
}

// --- HERO DINÂMICO (Com as tuas imagens restauradas) ---
function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    if (!hero || data.length === 0) return;

    const random = data[Math.floor(Math.random() * data.length)];
    const category = (random.group || "Geral").toUpperCase();

    // As tuas imagens personalizadas
    const categoryImages = {   
        "NACIONAIS": "https://i.ibb.co/KxmGp1D4/Gemini-Generated-Image-sza1f6sza1f6sza1.png",
        "DESPORTO": "https://i.ibb.co/FbQ2bRPQ/Gemini-Generated-Image-plg7uplg7uplg7up.png",
        "NOTICIAS": "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1920",
        "FILMES": "https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=1920",
        "KIDS": "https://images.unsplash.com/photo-1485546246426-74dc88dec4d9?q=80&w=1920"
    };

    let bg = "https://images.unsplash.com/photo-1626814026160-2237a95fc5a0?q=80&w=1920"; // Imagem padrão

    for (let key in categoryImages) {
        if (category.includes(key)) { 
            bg = categoryImages[key]; 
            break; 
        }
    }

    // Preencher dados do Hero
    const heroName = document.getElementById('hero-name');
    const heroPlay = document.getElementById('hero-play');

    if(heroName) heroName.innerText = random.name;
    
    if(heroPlay) {
        heroPlay.onclick = () => {
            window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
        };
    }
    
    hero.style.backgroundImage = `url('${bg}')`;
    hero.style.display = 'flex';
}

function filterChannels() {
    const q = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(c => c.name.toLowerCase().includes(q));
    renderApp(filtered);
}
