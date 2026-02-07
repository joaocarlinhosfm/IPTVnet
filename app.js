/**
 * N-STREAM - Lógica de Importação e Renderização
 */

let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];

// Inicialização ao carregar a página
window.onload = () => {
    if (allChannels.length === 0) {
        toggleModal(true);
        document.getElementById('close-btn').style.display = 'none';
    } else {
        renderApp(allChannels);
    }
};

function toggleModal(show) {
    document.getElementById('config-modal').style.display = show ? 'flex' : 'none';
}

// 1. IMPORTAÇÃO VIA FICHEIRO LOCAL
function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => processM3U(e.target.result);
    reader.readAsText(file);
}

// 2. IMPORTAÇÃO VIA URL (LINK)
async function loadFromUrl() {
    const url = document.getElementById('m3u-url').value.trim();
    if (!url) return alert("Insira um link válido.");

    toggleModal(false);
    // Usamos o corsproxy.io para tentar contornar bloqueios de segurança do navegador
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxy);
        const text = await response.text();
        if (text.includes("#EXTM3U")) {
            processM3U(text);
        } else {
            throw new Error("Não é um M3U válido");
        }
    } catch (err) {
        alert("Erro: O servidor bloqueou o acesso direto ao link. Tente carregar o ficheiro .m3u manualmente.");
        toggleModal(true);
    }
}

// 3. PROCESSAMENTO DO TEXTO M3U
function processM3U(text) {
    const lines = text.split(/\r?\n/);
    const channels = [];
    let current = {};

    lines.forEach(line => {
        line = line.trim();
        if (line.startsWith('#EXTINF')) {
            const name = line.split(',')[1]?.trim() || "Canal sem nome";
            const logo = line.match(/tvg-logo="([^"]*)"/);
            const group = line.match(/group-title="([^"]*)"/);
            current = { 
                name, 
                logo: logo ? logo[1] : '', 
                group: group ? group[1] : 'Canais Gerais' 
            };
        } else if (line.startsWith('http')) {
            current.url = line;
            channels.push(current);
            current = {};
        }
    });

    if (channels.length > 0) {
        allChannels = channels;
        localStorage.setItem('my_channels', JSON.stringify(allChannels));
        location.reload(); // Recarrega para aplicar tudo limpo
    } else {
        alert("Nenhum canal encontrado na lista.");
    }
}

// 4. RENDERIZAÇÃO DA INTERFACE
function renderApp(data) {
    const container = document.getElementById('content');
    container.innerHTML = '';

    // Configura o Banner de Destaque (Hero)
    setupHero(data);

    // Agrupa canais por categorias
    const groups = data.reduce((acc, ch) => {
        const groupName = ch.group || 'Gerais';
        acc[groupName] = acc[groupName] || [];
        acc[groupName].push(ch);
        return acc;
    }, {});

    // Cria as linhas (rows) de canais
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
            
            const img = ch.logo ? `<img src="${ch.logo}" onerror="this.src='https://via.placeholder.com/150x220/111/fff?text=TV'">` : `<i class="fas fa-tv" style="font-size:2rem;color:#333"></i>`;
            
            card.innerHTML = `${img}<div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });

        row.appendChild(carousel);
        container.appendChild(row);
    });
}

// 5. CONFIGURAÇÃO DO CANAL EM DESTAQUE
function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    const random = data[Math.floor(Math.random() * data.length)];
    
    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
    };
    hero.style.display = 'flex';
}

// 6. FILTRO DE PESQUISA
function filterChannels() {
    const query = document.getElementById('search').value.toLowerCase();
    const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(query));
    
    const hero = document.getElementById('hero-featured');
    hero.style.display = query ? 'none' : 'flex';
    
    renderApp(filtered);
}
