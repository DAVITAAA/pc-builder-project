// Sample component data (Prices removed, replaced by simulated Bottleneck Score)
const components = [
    // Higher Bottleneck Score means better performance for the sake of calculation
    { id: 'c1', name: 'Aurora Ryzen 9 7950X3D', type: 'cpu', desc: '16-core multi-threaded powerhouse', bottleneck_score: 95, power: 170 }, 
    { id: 'g1', name: 'Nova RTX 4090', type: 'gpu', desc: 'Flagship GPU for extreme gaming', bottleneck_score: 100, power: 450 }, 
    { id: 'm1', name: 'Eclipse Z790 Motherboard', type: 'mb', desc: 'Premium ATX motherboard', bottleneck_score: 0, power: 50 },
    { id: 'r1', name: 'Corsair Vengeance 32GB', type: 'memory', desc: 'High-speed DDR5 memory kit', bottleneck_score: 0, power: 15 },
    { id: 's1', name: 'Galaxy NVMe 2TB', type: 'storage', desc: 'Blazing fast NVMe SSD', bottleneck_score: 0, power: 10 },
    { id: 'p1', name: 'Storm 1000W PSU', type: 'psu', desc: '80+ Gold fully modular power supply', bottleneck_score: 0, power: 0 },
];

// DOM Refs
const componentsList = document.getElementById('componentsList');
const componentDropdown = document.getElementById('component-dropdown'); 
const tabs = document.querySelectorAll('.tab');
const noMatch = document.getElementById('noMatch');
const builtListContainer = document.getElementById('builtListContainer');
const centerListCount = document.getElementById('center-list-count');
const compatibilityStatus = document.getElementById('compatibilityStatus');
const bottleneckStatus = document.getElementById('bottleneckStatus');
const statsPanel = document.querySelector('.stats-panel');
const totalPriceMeta = document.querySelector('.total-price');
const buyButton = document.getElementById('buyButton');
const leftCount = document.getElementById('left-count'); // დამატებულია
let placedItems = []; 

// Function: Populate the dropdown menu
function populateDropdown(currentFilter) {
    while (componentDropdown.children.length > 1) {
        componentDropdown.removeChild(componentDropdown.lastChild);
    }
    
    const filteredByTab = components.filter(c => currentFilter === 'all' || c.type === currentFilter);

    filteredByTab.forEach(c => {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = `${c.name} (${c.type.toUpperCase()})`;
        componentDropdown.appendChild(option);
    });
}

// Function: Render the Component Library list (left panel)
function renderList(selectedId = '') {
    componentsList.innerHTML = '';
    const activeType = document.querySelector('.tab.active').dataset.type;
    
    const filtered = components.filter(c => 
        (activeType === 'all' || c.type === activeType) &&
        (selectedId === '' || c.id === selectedId)
    );

    if (leftCount) {
        leftCount.textContent = filtered.length + ' ITEMS';
    }
    
    noMatch.style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach(c => {
        const el = document.createElement('div');
        el.className = 'comp-card';
        el.draggable = true;
        el.dataset.id = c.id;
        el.innerHTML = `
            <div class="comp-thumb" aria-hidden="true"></div>
            <div class="comp-info">
                <strong>${c.name}</strong>
                <span>${c.desc}</span>
                <div class="pill">${c.type.toUpperCase()}</div>
            </div>
        `;
        el.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData('text/plain', c.id);
            ev.dataTransfer.effectAllowed = 'copy';
            const crt = el.cloneNode(true);
            crt.style.width = '220px'; crt.style.opacity = '0.9';
            document.body.appendChild(crt);
            ev.dataTransfer.setDragImage(crt, 100, 30);
            setTimeout(() => document.body.removeChild(crt), 0);
        });
        componentsList.appendChild(el);
    });
}

// Function: Add a component to the central Built List
function addComponentToBuiltList(comp) {
    if (placedItems.some(item => item.comp.type === comp.type && (comp.type === 'cpu' || comp.type === 'gpu' || comp.type === 'mb' || comp.type === 'psu'))) {
        alert(`You already have a ${comp.type.toUpperCase()} component in your build. Please remove it first.`);
        return;
    }
    placedItems.push({ comp, id: Date.now() }); 
    updateBuiltListUI();
}

// Function: Renders and updates the Built List UI (center panel)
function updateBuiltListUI() {
    builtListContainer.innerHTML = ''; 
    
    if (placedItems.length === 0) {
        builtListContainer.innerHTML = `
            <div class="built-list-empty-state">
                <p>Drag components from the library to this panel or select them from the dropdown menu to start your build.</p>
            </div>
        `;
        centerListCount.textContent = '0 COMPONENTS ADDED';
        updateBottleneckAndSummary(0);
        return;
    }

    placedItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'built-list-item';
        card.dataset.uniqueId = item.id;
        card.innerHTML = `
            <div class="thumb" aria-hidden="true"></div>
            <div class="bi-info">
                <strong>${item.comp.name}</strong>
                <span>${item.comp.type.toUpperCase()}</span>
            </div>
            <button class="remove" title="Remove">✕</button>
        `;
        
        card.querySelector('.remove').addEventListener('click', () => {
            placedItems = placedItems.filter(p => p.id !== item.id); 
            updateBuiltListUI();
        });

        builtListContainer.appendChild(card);
    });
    
    updateBottleneckAndSummary(placedItems.length);
}

// Function: Bottleneck Calculation and Summary Update
function updateBottleneckAndSummary(count) {
    centerListCount.textContent = count + ' COMPONENTS ADDED';
    
    const totalPower = placedItems.reduce((sum, item) => sum + (item.comp.power || 0), 0);
    
    // 1. Compatibility Check 
    const hasCPU = placedItems.some(item => item.comp.type === 'cpu');
    const hasGPU = placedItems.some(item => item.comp.type === 'gpu');
    const hasMB = placedItems.some(item => item.comp.type === 'mb');
    const hasPSU = placedItems.some(item => item.comp.type === 'psu');
    
    let compatibilityMessage = '';
    if (hasCPU && hasGPU && hasMB && hasPSU) {
        compatibilityMessage = '✅ Compatibility Check: **All Core Components Present and Compatible.**';
        compatibilityStatus.classList.remove('compat-warning');
    } else {
        compatibilityMessage = '⚠️ Compatibility Check: Missing core components (MB, CPU, GPU, or PSU).';
        compatibilityStatus.classList.add('compat-warning');
    }
    compatibilityStatus.innerHTML = compatibilityMessage;

    // 2. Bottleneck Analysis (Simulated based on bottleneck_score)
    const cpu = placedItems.find(item => item.comp.type === 'cpu');
    const gpu = placedItems.find(item => item.comp.type === 'gpu');
    
    if (bottleneckStatus) { // დაცვა null-ისგან
        if (cpu && gpu) {
            const cpuScore = cpu.comp.bottleneck_score;
            const gpuScore = gpu.comp.bottleneck_score;
            const scoreDiff = Math.abs(cpuScore - gpuScore);
            
            let bottleneckPercent = (scoreDiff / Math.max(cpuScore, gpuScore)) * 100 * 0.8;
            bottleneckPercent = Math.min(30, Math.max(2, bottleneckPercent)); 

            let statusClass = 'low';
            let statusText = `${bottleneckPercent.toFixed(1)}% CPU/GPU Bottleneck. **Excellent Balance.**`;

            if (bottleneckPercent > 20) {
                statusClass = 'high';
                const bottleneckedComponent = cpuScore < gpuScore ? 'CPU' : 'GPU';
                statusText = `${bottleneckPercent.toFixed(1)}% Bottleneck. **The ${bottleneckedComponent} is likely limiting performance.**`;
            } else if (bottleneckPercent > 10) {
                statusClass = 'medium';
                statusText = `${bottleneckPercent.toFixed(1)}% CPU/GPU Bottleneck. **Good Balance.**`;
            }

            bottleneckStatus.className = `bottleneck-status ${statusClass}`;
            bottleneckStatus.innerHTML = statusText;

        } else {
            bottleneckStatus.className = 'bottleneck-status';
            bottleneckStatus.innerHTML = 'Select a CPU and GPU to analyze.';
        }
    }


    // 3. Summary/Stats Update (Power Draw)
    if (totalPriceMeta) {
        totalPriceMeta.textContent = `BUILD STATUS`;
    }
    if (statsPanel) {
        statsPanel.innerHTML = `Est. Power Draw: ${totalPower.toFixed(0)}W`;
    }
    
    // Buy button text changed
    if (buyButton) {
        buyButton.textContent = `Finalize Build`;
    }
}


// --- EVENT LISTENERS ---
tabs.forEach(t => t.addEventListener('click', (e) => {
    tabs.forEach(x => x.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    const newFilter = e.currentTarget.dataset.type;
    populateDropdown(newFilter); 
    componentDropdown.value = '';
    
    renderList();
}));

if (componentDropdown) {
    componentDropdown.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (selectedId) {
            const comp = components.find(x => x.id === selectedId);
            if (comp) {
                addComponentToBuiltList(comp);
                e.target.value = ''; 
                renderList(); 
            }
        }
    });
}


if (builtListContainer) {
    builtListContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.currentTarget.style.border = '1px dashed var(--muted)';
        e.dataTransfer.dropEffect = 'copy';
    });

    builtListContainer.addEventListener('dragleave', (e) => {
        e.currentTarget.style.border = 'none';
    });

    builtListContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        e.currentTarget.style.border = 'none';
        const id = e.dataTransfer.getData('text/plain');
        const comp = components.find(x => x.id === id);
        if (comp) {
            addComponentToBuiltList(comp);
            componentDropdown.value = '';
            renderList();
        }
    });
}

if (componentsList) {
    componentsList.addEventListener('dblclick', (e) => {
        const card = e.target.closest('.comp-card');
        if(card) {
            const comp = components.find(x => x.id === card.dataset.id);
            if(comp) addComponentToBuiltList(comp);
        }
    });
}


populateDropdown('all');
renderList();
updateBuiltListUI();




const themeSelector = document.getElementById('themeSelector');
const body = document.body;


function applyTheme(themeName) {
    body.classList.remove('theme-minimal', 'theme-darkstar');
    if (themeName !== 'cyberpunk') {
        body.classList.add(`theme-${themeName}`);
    }
    
    // 3. Grid/Animation მართვა
    if (themeName === 'cyberpunk') {
        body.style.backgroundImage = ''; 
        body.style.animation = '';
    } else {
        body.style.backgroundImage = 'none';
        body.style.animation = 'none';
    }
    localStorage.setItem('selectedTheme', themeName);
}

if (themeSelector) {
    themeSelector.addEventListener('change', (e) => {
        applyTheme(e.target.value);
    });
}


document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('selectedTheme') || 'cyberpunk';
    if (themeSelector) {
        themeSelector.value = savedTheme;
    }
    
    applyTheme(savedTheme); 
});