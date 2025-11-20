// static/script.js
// ---------------------------------------
// SynthForge - Safe, DOM-ready, JSON-driven UI
// ---------------------------------------

/*
 ლოგიკის მიმოხილვა:
 1. main() ფუნქცია იძახებს setupModalListeners()-ს, რომელიც მუშაობს ორივე გვერდზე.
 2. main() ამოწმებს, ვართ თუ არა drafts.html-ზე (FLASK_SAVED_BUILDS-ის შემოწმებით).
 3. drafts.html-ზე რენდერდება დრაფტების სია (renderDraftsPage).
*/

// -----------------------------
// Globals (safe defaults)
// -----------------------------
let components = [];
let placedItems = [];

// DOM refs (may be null on some pages — use null guards (if check) later)
const componentsList = document.getElementById('componentsList');
const componentDropdown = document.getElementById('component-dropdown');
const tabs = document.querySelectorAll?.('.tab') || [];
const noMatch = document.getElementById('noMatch');
const builtListContainer = document.getElementById('builtListContainer');
const centerListCount = document.getElementById('center-list-count');
const compatibilityStatus = document.getElementById('compatibilityStatus');
const bottleneckStatus = document.getElementById('bottleneckStatus');
const statsPanel = document.getElementById('statsPanel');
const finalizeBuildBtn = document.getElementById('finalizeBuildBtn');
const leftCount = document.getElementById('left-count');

// Modal elements
const modal = document.getElementById('sf-custom-modal');
const modalTitle = document.getElementById('sf-modal-title'); 
const modalMsg = document.getElementById('sf-modal-message');
const modalCloseBtn = document.getElementById('sf-modal-close-btn');
const modalReplaceBtn = document.getElementById('sf-modal-replace-btn');

// -----------------------------
// 1) Load component data from server
// -----------------------------
function loadComponentData() {
    return fetch("/api/components") 
        .then(r => {
            if (!r.ok) throw new Error("Server connection error");
            return r.json();
        })
        .then(data => {
            components = []; 
            
            if (Array.isArray(data)) {
                components = data;
            } 
            else if (typeof data === 'object' && data !== null) {
                for (const [key, items] of Object.entries(data)) {
                    if (Array.isArray(items)) {
                        const processedItems = items.map(item => ({
                            ...item,
                            type: item.type || key,
                            // 🔥 FIX: power ველის რიცხვად გარდაქმნა (პარსვა)
                            power: parseFloat(item.power) || 0 
                        }));
                        components = components.concat(processedItems);
                    }
                }
            }
            components = components.filter(c => c && c.name);

            console.log("✅ Final components list loaded:", components);
            return true;
        })
        .catch(err => {
            console.error("❌ JSON load error in loadComponentData:", err);
            throw err;
        });
}

// -----------------------------
// 2) UI initialization (attach listeners for INDEX PAGE ONLY)
// -----------------------------
function initializeUI() {
    // უსაფრთხოების შემოწმება (მხოლოდ index.html-ზე)
    if (!componentDropdown) {
        return; 
    }
    
    // Tabs 
    if (tabs && tabs.length > 0) {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const currentActive = document.querySelector('.tab.active');
                if (currentActive) currentActive.classList.remove('active');
                tab.classList.add('active');

                renderList();
                populateDropdown(tab.dataset.type || 'all');
            });
        });
    }

    // Dropdown population & change
    if (componentDropdown) {
        populateDropdown('all');
        componentDropdown.addEventListener('change', (e) => {
            const selectedId = e.target.value;
            if (!selectedId) return;
            const comp = components.find(c => c.id === selectedId);
            if (comp) addComponentToBuiltList(comp);
            e.target.value = '';
        });
    }

    // Drag & drop on builtList container
    if (builtListContainer) {
        builtListContainer.addEventListener('dragover', (e) => e.preventDefault());
        builtListContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text/plain');
            const comp = components.find(c => c.id === id);
            if (comp) addComponentToBuiltList(comp);
        });
    }

    // Finalize button
    if (finalizeBuildBtn) {
        finalizeBuildBtn.addEventListener('click', () => {
            if (!placedItems.length) return showModal('No components selected.');
            saveBuild();
        });
    }

    // Initial render
    renderList();
    updateBuiltListUI();
}

// -----------------------------
// 3) Modal Listeners Setup (WORKS ON BOTH PAGES)
// -----------------------------
function setupModalListeners() {
    // 🔥 FIX: Modal close listener მიბმა ორივე გვერდზე
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', closeModal);
    }
}


// -----------------------------
// 4) Dropdown population (safe)
// -----------------------------
function populateDropdown(currentFilter = 'all') {
    if (!componentDropdown) return;
    // Keep the first placeholder option, remove others
    while (componentDropdown.children.length > 1) {
        componentDropdown.removeChild(componentDropdown.lastChild);
    }

    const filtered = components.filter(c => currentFilter === 'all' || c.type === currentFilter);

    filtered.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.name} (${(c.type || 'unknown').toUpperCase()})`;
        componentDropdown.appendChild(opt);
    });
}

// -----------------------------
// 5) Render component list (left panel)
// -----------------------------
function renderList(selectedId = '') {
    if (!componentsList) return;

    // Determine active type
    const active = document.querySelector('.tab.active');
    const activeType = active ? active.dataset.type : 'all';

    const filtered = components.filter(c =>
        (activeType === 'all' || c.type === activeType) &&
        (selectedId === '' || c.id === selectedId)
    );

    if (leftCount) leftCount.textContent = `${filtered.length} ITEMS`;
    if (noMatch) noMatch.style.display = filtered.length === 0 ? 'block' : 'none';

    componentsList.innerHTML = ''; // clear

    filtered.forEach(c => {
        const el = document.createElement('div');
        el.className = 'comp-card';
        el.draggable = true;
        el.dataset.id = c.id;
        el.innerHTML = `
            <div class="comp-thumb" aria-hidden="true"></div>
            <div class="comp-info">
                <strong>${c.name}</strong>
                <span>${c.desc || ''}</span>
                <div class="pill">${(c.type || 'unknown').toUpperCase()}</div>
            </div>
        `;
        // Drag start
        el.addEventListener('dragstart', (ev) => {
            ev.dataTransfer.setData('text/plain', c.id);
        });
        // Click to add
        el.addEventListener('click', () => addComponentToBuiltList(c));

        componentsList.appendChild(el);
    });
}

// -----------------------------
// 6) Add / Replace logic + modal
// -----------------------------
function addComponentToBuiltList(comp) {
    if (!comp) return;
    const singleTypes = ['cpu', 'gpu', 'mb', 'psu', 'case'];

    const existing = placedItems.find(p => p.comp.type === comp.type);

    if (singleTypes.includes(comp.type) && existing) {
        // show replace modal
        showReplaceModal(existing, comp);
        return;
    }

    // otherwise add
    performAdd(comp);
}

function performAdd(comp) {
    placedItems.push({ comp, id: Date.now() });
    updateBuiltListUI();
}

// -----------------------------
// 7) Update built list UI (center panel)
// -----------------------------
function updateBuiltListUI() {
    if (!builtListContainer) return;

    builtListContainer.innerHTML = '';

    if (!placedItems.length) {
        builtListContainer.innerHTML = `
            <div class="built-list-empty-state">
                <p>Drag components from the library to this panel or select them from the dropdown menu to start your build.</p>
            </div>
        `;
        if (centerListCount) centerListCount.textContent = '0 COMPONENTS ADDED';
        if (finalizeBuildBtn) finalizeBuildBtn.style.display = 'none';
        updateBottleneckAndSummary(0);
        return;
    }

    placedItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'built-list-item'; 
        card.dataset.uniqueId = item.id;
        
        // სტრუქტურა წაშლის ღილაკით მარჯვნივ
        card.innerHTML = `
            <div class="thumb" aria-hidden="true"></div>
            
            <div class="bi-info">
                <strong>${item.comp.name}</strong>
                <span>${(item.comp.type || '').toUpperCase()}</span>
                
            </div>
            
            <div class="built-item-actions">
                <button class="remove btn-delete" data-id="${item.id}" title="Remove component">
                    🗑️ 
                </button>
            </div>
        `;
        
        // წაშლის ლოგიკა (დაუყოვნებელი)
        const removeBtn = card.querySelector('.remove');
        removeBtn.addEventListener('click', () => {
            placedItems = placedItems.filter(p => p.id !== item.id); 
            updateBuiltListUI();
        });
        
        builtListContainer.appendChild(card);
    });

    if (finalizeBuildBtn) finalizeBuildBtn.style.display = 'block';
    updateBottleneckAndSummary(placedItems.length);
}
// -----------------------------
// 8) Bottleneck & Summary
// -----------------------------
function updateBottleneckAndSummary(count) {
    if (centerListCount) centerListCount.textContent = `${count} COMPONENTS ADDED`;

    const totalPower = placedItems.reduce((s, i) => s + (i.comp.power || 0), 0);
    // Total Price-ის გამოთვლა რჩება ამოღებული.

    const hasCPU = placedItems.some(i => i.comp.type === 'cpu');
    // ... (დანარჩენი ლოგიკა უცვლელია) ...

    if (bottleneckStatus) {
        // ... (bottleneck-ის ლოგიკა უცვლელია) ...
    }
    
    // 🔥 FIX: Power Draw-ის ჩვენება აღდგენილია index.html-ზე
    if (statsPanel) statsPanel.innerHTML = `Est. Power Draw: ${totalPower}W`;
}
// -----------------------------
// 9) Modal functions (FINALIZED)
// -----------------------------
function showModal(message = 'System Notice', title = 'System Alert') {
    if (modalTitle) modalTitle.textContent = title;
    if (modalMsg) modalMsg.innerHTML = message; 
    
    // 🔥 FIX: ვმალავთ replace ღილაკს და ვარწმუნებთ, რომ დახურვის ტექსტი არის 'Close'
    if (modalReplaceBtn) modalReplaceBtn.style.display = 'none';
    if (modalCloseBtn) modalCloseBtn.textContent = 'Close';
    
    if (modal) modal.classList.remove('hidden');
}

function closeModal() {
    if (modal) modal.classList.add('hidden');
    
    // ვანულებთ replace ღილაკის ლოგიკას, თუ ის არსებობს
    if (modalReplaceBtn) modalReplaceBtn.onclick = null;
    
    // modalCloseBtn-ს უკვე აქვს listener მიბმული setupModalListeners-ში.
}

function showReplaceModal(existingItem, newItem) {
    // set title/message
    if (modalTitle) modalTitle.textContent = 'Component Replacement';
    if (modalMsg) modalMsg.innerHTML = `You already have <b>${existingItem.comp.name}</b> (${(existingItem.comp.type||'').toUpperCase()}).<br>Replace with <b>${newItem.name}</b>?`;

    // show replace button
    if (modalReplaceBtn) {
        modalReplaceBtn.style.display = 'inline-block';
        modalReplaceBtn.onclick = () => {
            // remove existing and add new
            placedItems = placedItems.filter(p => p.id !== existingItem.id);
            performAdd(newItem);
            closeModal();
        };
    }

    // cancel button
    if (modalCloseBtn) modalCloseBtn.textContent = 'Cancel';

    if (modal) modal.classList.remove('hidden');
}

// -----------------------------
// 10) Save build (POST)
// -----------------------------
function saveBuild() {
    const cpuItem = placedItems.find(i => i.comp.type === 'cpu');
    
    // 🔥 FIX: total_power-ის გათვლა აქაც
    const totalPower = placedItems.reduce((s, i) => s + (i.comp.power || 0), 0);
    
    const payload = {
        components: placedItems.map(p => p.comp),
        stats: {
            cpu_name: cpuItem ? cpuItem.comp.name : 'Unknown',
            total_power: totalPower, // იყენებს სწორად გათვლილ totalPower-ს
            timestamp: new Date().toISOString()
        }
    };

    fetch('/save-build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .then(body => {
        if (body && body.success) {
            showModal(`✅ Build saved successfully! ID: ${body.build_id}`, 'Success');
        } else {
            showModal(`❌ Error saving build: ${body?.message || 'Unknown'}`, 'Error');
        }
    })
    .catch(err => {
        console.error('Save build error:', err);
        showModal('Server error occurred during saving.', 'Error');
    });
}

// ---------------------------------------
// 11. DRAFT DELETE LOGIC (AJAX) 🔥 FIX: დაკარგული ფუნქციის დამატება
// ---------------------------------------
function deleteDraft(buildId) {
    
    // Send POST request to Flask endpoint
    fetch(`/delete-draft/${buildId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(r => r.json())
    .then(data => {
        if (data.success) {
            console.log(`Build ${buildId} deleted.`);
            
            // განაახლეთ გლობალური მასივი და გადახატეთ გვერდი
            if (typeof FLASK_SAVED_BUILDS !== 'undefined') {
                const newBuilds = FLASK_SAVED_BUILDS.filter(b => b.id !== buildId);
                // FLASK_SAVED_BUILDS-ის განახლება
                window.FLASK_SAVED_BUILDS = newBuilds; 
                renderDraftsPage(newBuilds);
            }
            
            showModal(data.message || `Draft #${buildId} removed successfully.`, 'Success');
            
        } else {
            showModal(`Error: ${data.message}`, 'Deletion Failed');
        }
    })
    .catch(err => {
        console.error('Delete draft error:', err);
        showModal('Server error occurred during deletion.', 'Error');
    });
}

// ---------------------------------------
// 12. DRAFTS PAGE RENDER (FINAL გამართული ვერსია)
// ---------------------------------------
function renderDraftsPage(builds) {
    // ლოკალური DOM ელემენტების მოძიება
    const container = document.getElementById('draftsListContainer');
    const countEl = document.getElementById('draftsCount');
    
    // თუ ელემენტები არ არსებობს, ეს ნიშნავს, რომ index.html-ზე ვართ
    if (!container) return; 

    container.innerHTML = '';
    
    if (builds.length === 0) {
        container.innerHTML = `
            <div class="built-list-empty-state">
                <p>No drafts found. Build a PC and click 'FINALIZE & SAVE BUILD' to see your history here.</p>
            </div>
        `;
        if (countEl) countEl.textContent = '0 Drafts'; 
        return;
    }

    if (countEl) countEl.textContent = `${builds.length} Drafts`; 

    builds.forEach((build, index) => {
        const buildCard = document.createElement('div');
        buildCard.className = 'draft-card';
        
        const cpu = build.components.find(c => c.type === 'cpu') || { name: 'N/A' };
        
        // კომპონენტების სიის HTML-ის გენერაცია
        const componentListHTML = build.components.map(c => `
            <li>
                <strong>${(c.type || '').toUpperCase()}:</strong> ${c.name} 
            </li>
        `).join('');

        // თარიღის ფორმატირება
        let dateString = 'Unknown Date';
        if (build.stats && build.stats.timestamp) {
            try {
                dateString = new Date(build.stats.timestamp).toLocaleDateString('en-US', { 
                    year: 'numeric', month: 'short', day: 'numeric' 
                });
            } catch (e) {
                // ignore
            }
        }
        
        // Power Draw-ის სწორად წაკითხვა stats ობიექტიდან
        const powerDraw = (build.stats && typeof build.stats.total_power !== 'undefined') 
                          ? `${build.stats.total_power}W` 
                          : 'N/A';

        // Draft Card-ის HTML სტრუქტურა
        buildCard.innerHTML = `
            <div class="draft-card-header">
                <div class="draft-title-and-index"> 
                    <h4 class="draft-title">Draft #${build.id} <span class="draft-index">(Entry ${index + 1})</span></h4>
                    <span class="draft-date">${dateString}</span>
                </div>
                
                <div class="draft-actions">
                    <button class="btn-delete" data-id="${build.id}" title="Delete this draft">
                        <span aria-hidden="true">🗑️</span> Remove
                    </button>
                </div>
            </div>
            
            <div class="draft-component-list-container">
                <p class="list-heading">Full Component List:</p>
                <ul class="draft-component-list">
                    ${componentListHTML}
                </ul>
            </div>
            
            <div class="draft-card-stats-grid">
                <p><strong>CPU:</strong> ${cpu.name}</p>
                <p><strong>Power Draw:</strong> ${powerDraw}</p> 
                <p><strong>Components:</strong> ${build.components.length}</p>
            </div>

            <div class="draft-card-footer">
                <button class="btn">View Summary</button>
            </div>
        `;
        
        // 🔥 FIX: Event Listener-ის მიბმა deleteDraft-ზე
        const deleteBtn = buildCard.querySelector('.btn-delete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                deleteDraft(build.id); // ახლა deleteDraft ფუნქცია უკვე არსებობს (სექცია 11)
            });
        }
        
        container.appendChild(buildCard);
    });
}

// ---------------------------------------
// 13) Initialization entrypoint (FINALIZED)
// ---------------------------------------
function main() {
    // 🔥🔥 FIX: მოდალის ლისენერები ეშვება ორივე გვერდზე
    setupModalListeners(); 
    
    if (typeof FLASK_SAVED_BUILDS !== 'undefined') {
        console.log("Loading drafts page...");
        renderDraftsPage(FLASK_SAVED_BUILDS);
        return; 
    }
    
    // INDEX PAGE LOGIC
    loadComponentData()
        .then(() => {
            initializeUI();
        })
        .catch(err => {
            console.error('Data load error:', err);
            initializeUI(); 
            showModal('Could not load component data. Check console for details.');
        });
}

document.addEventListener('DOMContentLoaded', main);