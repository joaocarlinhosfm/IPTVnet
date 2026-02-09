/**
 * StreamLine - Core Engine
 * Versão: Android (VLC) + Windows (Web Player com Proxy)
 */

let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];
let lastScrollTop = 0;
let hlsInstance = null; // Variável para controlar o motor do player

// --- INICIALIZAÇÃO ---
window.onload = () => {
    if (allChannels.length > 0) {
        renderApp(allChannels);
    } else {
        toggleModal(true);
    }
    setupSmartHeader();
};

// --- LOGICA DO HEADER (Esconder ao fazer scroll) ---
function setupSmartHeader() {
    const header = document.querySelector('header');
    
    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const searchField = document.getElementById('search-field');

        // Não esconde se a pesquisa estiver ativa
        if (document.activeElement === searchField || searchField.value.length > 0) {
            header.classList.remove('header-hidden');
            return;
        }

        if (scrollTop > lastScrollTop && scrollTop > 70) {
            header.classList.add('header-hidden'); // Scroll para baixo
        } else {
            header.classList.remove('header-hidden'); // Scroll para cima
        }
        
        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, { passive: true });
}

// --- GESTÃO DO MODAL E LISTAS ---
function toggleModal(show) {
    const modal = document.getElementById('config-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
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
    
    // Proxy para descarregar a lista de canais (texto)
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    
    try {
        const response = await fetch(proxyUrl);
        const data = await response.json();
        if (data.contents) processM3U(data.contents);
    } catch (err) {
        alert("Erro ao carregar link. Verifica se o URL é válido.");
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
            const logo = line.match(/tvg-logo="([^"]*)"/i);
            const group = line.match(/group-title="([^"]*)"/i);
            current = { 
                name, 
                logo: logo ? logo[1] : '', 
                group: group ? group[1] : 'Gerais' 
            };
        } else if (line.toLowerCase().startsWith('http')) {
            if (current) {
                current.url = line;
                channels.push(current);
                current = null;
            }
        }
    });

    if (channels.length > 0) {
        allChannels = channels;
        localStorage.setItem('my_channels', JSON.stringify(channels));
        window.location.reload(); 
    } else {
        alert("Nenhum canal encontrado no ficheiro.");
    }
}

// --- RENDERIZAÇÃO DA INTERFACE ---
function renderApp(data) {
    const container = document.getElementById('main-content');
    if (!container) return;
    container.innerHTML = '';

    const isSearch = document.getElementById('search-field').value.length > 0;
    
    if(!isSearch) setupHero(data);
    else document.getElementById('hero-featured').style.display = 'none';

    // Agrupar canais por categoria
    const groups = data.reduce((acc, ch) => {
        const groupName = ch.group || 'Gerais';
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
            
            // --- AQUI ESTÁ A LÓGICA DE DECISÃO ---
            card.onclick = () => {
                const isAndroid = /Android/i.test(navigator.userAgent);
                if (isAndroid) {
                    // ANDROID: Abre diretamente no VLC (Melhor performance)
                    window.location.href = `intent:${ch.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
                } else {
                    // PC/WINDOWS: Abre no Player Web (Com Proxy para corrigir erro)
                    openWebPlayer(ch.url, ch.name);
                }
            };
            
            const img = ch.logo ? `<img src="${ch.logo}" onerror="this.style.display='none'">` : '<span>📺</span>';
            card.innerHTML = `${img}<div class="card-info">${ch.name}</div>`;
            carousel.appendChild(card);
        });
        row.appendChild(carousel);
        container.appendChild(row);
    });
}

// --- WEB PLAYER (WINDOWS) COM CORREÇÃO CORS ---
function openWebPlayer(url, name) {
    const modal = document.getElementById('web-player-modal');
    const video = document.getElementById('stream-video');
    const nameLabel = document.getElementById('player-channel-name');
    
    if(nameLabel) nameLabel.innerText = name;
    if(modal) modal.style.display = 'flex';

    // *** A CORREÇÃO DO ERRO ***
    // Usamos o corsproxy.io para adicionar os cabeçalhos que faltam e evitar o bloqueio do browser.
    // O encodeURIComponent garante que o link original passa corretamente pelo proxy.
    const finalUrl = "https://corsproxy.io/?" + encodeURIComponent(url);
    
    console.log("A tentar abrir via proxy:", finalUrl); // Para debug na consola

    if (Hls.isSupported()) {
        if (hlsInstance) {
            hlsInstance.destroy(); // Limpa canal anterior
        }
        
        hlsInstance = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            // Configurações para tentar recuperar de erros comuns em IPTV
            manifestLoadingTimeOut: 20000,
            manifestLoadingMaxRetry: 3
        });

        hlsInstance.loadSource(finalUrl);
        hlsInstance.attachMedia(video);
        
        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
            video.play().catch(e => console.log("Autoplay bloqueado pelo browser, clique no play."));
        });
        
        // Gestão de Erros HLS
        hlsInstance.on(Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        console.log("Erro de Rede, a tentar recuperar...");
                        hlsInstance.startLoad();
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.log("Erro de Media, a tentar recuperar...");
                        hlsInstance.recoverMediaError();
                        break;
                    default:
                        console.log("Erro Fatal, impossível reproduzir.");
                        hlsInstance.destroy();
                        break;
                }
            }
        });

    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Fallback para Safari (iOS/Mac)
        // No Safari geralmente não precisamos do proxy se o servidor tiver CORS básico, 
        // mas se falhar, podes tentar usar o finalUrl aqui também.
        video.src = finalUrl;
        video.addEventListener('loadedmetadata', () => {
            video.play();
        });
    }
}

function closeWebPlayer() {
    const modal = document.getElementById('web-player-modal');
    const video = document.getElementById('stream-video');
    
    video.pause();
    video.src = "";
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    
    modal.style.display = 'none';
}

// --- FUNÇÕES AUXILIARES ---
function setupHero(data) {
    const hero = document.getElementById('hero-featured');
    if (!hero || data.length === 0) return;
    
    const random = data[Math.floor(Math.random() * data.length)];
    document.getElementById('hero-name').innerText = random.name;
    document.getElementById('hero-play').onclick = () => {
        const isAndroid = /Android/i.test(navigator.userAgent);
        if(isAndroid) window.location.href = `intent:${random.url}#Intent;package=org.videolan.vlc;type=video/*;end`;
        else openWebPlayer(random.url, random.name);
    };
    
    // Imagem de fundo
    hero.style.backgroundImage = `url('https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?q=80&w=1920')`;
    hero.style.display = 'flex';
}

function filterChannels() {
    const query = document.getElementById('search-field').value.toLowerCase();
    const filtered = allChannels.filter(ch => ch.name.toLowerCase().includes(query));
    renderApp(filtered);
}
