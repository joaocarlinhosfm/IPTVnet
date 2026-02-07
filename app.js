/**
 * N-STREAM - Core Engine (HTTPS Optimized)
 */

let allChannels = JSON.parse(localStorage.getItem('my_channels')) || [];

window.onload = () => {
    if (allChannels.length === 0) {
        toggleModal(true);
        const closeBtn = document.getElementById('close-btn');
        if (closeBtn) closeBtn.style.display = 'none';
    } else {
        renderApp(allChannels);
    }
};

// Controle de UI do Modal
function toggleModal(show) {
    const modal = document.getElementById('config-modal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
}

/**
 * 1. CARREGAMENTO VIA URL
 * Agora com validação estrita de HTTPS e tratamento de erro detalhado.
 */
async function loadFromUrl() {
    const urlField = document.getElementById('m3u-url');
    const url = urlField.value.trim();

    // 1. Verifica se é HTTPS
    if (!url.startsWith('https://')) {
        alert("Erro de Segurança: Apenas links HTTPS são permitidos para garantir a compatibilidade com o GitHub Pages.");
        return;
    }

    toggleModal(false);
    console.log("A tentar carregar lista HTTPS via Proxy...");

    // Usamos o AllOrigins, que é mais estável para links HTTPS complexos
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;

    try {
        const response = await fetch(proxyUrl);
        if (!response.ok) throw new Error("Falha na rede");
        
        const data = await response.json();
        const content = data.contents; // O AllOrigins encapsula o texto em .contents

        if (content && content.includes("#EXTM3U")) {
            processM3U(content);
        } else {
            throw new Error("O ficheiro não parece ser uma lista M3U válida ou o servidor bloqueou o acesso.");
        }
    } catch (err) {
        console.error("Erro no carregamento:", err);
        alert("Não foi possível ler a lista. Motivo: O servidor da lista bloqueia pedidos externos (CORS). Use a opção 'IMPORTAR FICHEIRO' para contornar isto.");
        toggleModal(true);
    }
}

/**
 * 2. PROCESSAMENTO DA LISTA
 * Filtra automaticamente apenas canais que usem HTTPS.
 */
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
        } else if (line.startsWith('https://')) { 
            // IGNRORA HTTP: Só aceita links de stream que comecem por https://
            if (current) {
                current.url = line;
                channels.push(current);
                current = null;
            }
        } else if (line.startsWith('http://')) {
            // Ignora explicitamente links inseguros para evitar erro de Mixed Content
            current = null;
        }
    });

    if (channels.length > 0) {
        localStorage.setItem('my_channels', JSON.stringify(channels));
        console.log(`${channels.length} canais HTTPS importados com sucesso.`);
        location.reload();
    } else {
        alert("A lista foi lida, mas não continha nenhum link HTTPS válido.");
        toggleModal(true);
    }
}

/**
 * 3. IMPORTAÇÃO DE FICHEIRO (Bypass total de CORS)
 */
function loadFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processM3U(e.target.result);
    reader.readAsText(file);
}

// Restantes funções de renderização (renderApp, setupHero, filterChannels) 
// mantêm-se como na versão anterior.
