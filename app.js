/**
 * N-STREAM - Core Engine (VLC Bypass Edition)
 */

let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];

window.onload = () => {
    if (allChannels.length === 0) {
        toggleModal(true);
        if (document.getElementById('close-btn')) document.getElementById('close-btn').style.display = 'none';
    } else {
        renderApp(allChannels);
    }
};

function toggleModal(show) {
    const modal = document.getElementById('config-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
}

// 1. CARREGAMENTO VIA URL (Com Proxy para evitar CORS)
async function loadFromUrl() {
    const url = document.getElementById('m3u-url').value.trim();
    if (!url) return;

    toggleModal(false);
    
    // AllOrigins permite-nos ler o conteúdo de qualquer URL como texto
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const content = data.contents; 

        if (content && content.includes("#EXTM3U")) {
            processM3U(content);
        } else {
            throw new Error("Conteúdo Inválido");
        }
    } catch (err) {
        alert("O servidor da lista bloqueou a leitura automática. \n\nSolução: Faz download do ficheiro .m3u no teu browser e usa o botão 'IMPORTAR FICHEIRO'.");
        toggleModal(true);
    }
}

// 2. PROCESSAMENTO DA LISTA (Aceita HTTP e HTTPS)
function processM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let current = null;

    lines.forEach(line => {
        line = line.trim();
        
        if (line.startsWith('#EXTINF')) {
            const nameMatch = line.split(',');
            const name = nameMatch.length > 1 ? nameMatch[1].trim() : "Canal";
            const logo = line.match(/tvg-logo="([^"]*)"/);
            const group = line.match(/group-title="([^"]*)"/);
            
            current = { 
                name, 
                logo: logo ? logo[1] : '', 
                group: group ? group[1] : 'Canais' 
            };
        } 
        // ACEITA QUALQUER LINK QUE COMECE COM HTTP (inclui https)
        else if (line.toLowerCase().startsWith('http')) { 
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
    } else {
        alert("Não foram encontrados links de vídeo na lista.");
        toggleModal(true);
    }
}

// 3. IMPORTAÇÃO DE FICHEIRO
function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processM3U(e.target.result);
    reader.readAsText(file);
}

// 4. RENDERIZAÇÃO
function renderApp(data, targetContainer = "content") {
    const container = document.getElementById(targetContainer);
    if (!container) return;
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
            // O segredo está aqui: enviamos o link original (seja http ou https) para o VLC
            card.onclick = () => {
                window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
            };
            
            const logo = ch.logo ? `<img src="${ch.logo}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : '';
            card.innerHTML = `${logo}<i class="fas fa-play" style="display:${ch.logo ? 'none' : 'flex'}; font-size:2rem; color:#222"></i><div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });

        row.appendChild(carousel);
        container.appendChild(row);
    });
}

function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    if (!hero) return;
    const random = data[Math.floor(Math.random() * data.length)];
    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    hero.style.display = 'flex';
}

function filterChannels() {
    const query = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(query));
    renderApp(filtered, "search-results");
}
