// static/script.js
// SynthForge - Main frontend with i18n support
// - Data-driven translations via /static/lang/{ka,en}.json
// - Uses data-i18n attributes in the HTML
// - Preserves existing app logic (components loading, drafts, modal, dropdowns)

/* ============ i18n helpers & boot ============ */
function getCookie(name) {
    const v = `; ${document.cookie}`;
    const parts = v.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
}
function setCookie(name, value, days = 365) {
    const maxAge = 60 * 60 * 24 * days;
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

let TRANSLATIONS = {}; // loaded translations for current language
let CURRENT_LANG = 'ka';

function detectLang() {
    // priority: cookie -> html[lang] -> navigator -> default 'ka'
    const cookieLang = getCookie('sf_lang');
    if (cookieLang) return cookieLang;
    const htmlLang = document.documentElement.lang;
    if (htmlLang) return htmlLang;
    const nav = (navigator.language || navigator.userLanguage || 'ka').slice(0,2);
    return (nav === 'en' ? 'en' : 'ka');
}

function translateString(template, replacements) {
    if (!template) return '';
    let out = template;
    if (replacements && typeof replacements === 'object') {
        for (const [k,v] of Object.entries(replacements)) {
            out = out.split(`{${k}}`).join(String(v));
        }
    }
    return out;
}

function applyTranslations(translations) {
    TRANSLATIONS = translations || {};

    // translate elements with data-i18n
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        const raw = TRANSLATIONS[key] || null;
        // substitution using data-i18n-* dataset attributes
        const replacements = {};
        // collect data-i18n-* attributes like data-i18n-count => {count: value}
        Object.keys(el.dataset || {}).forEach(k => {
            if (k.startsWith('i18n') && k.length > 4) {
                // dataset key 'i18nCount' -> param 'count'
                const param = k.slice(4).replace(/^[A-Z]/, c => c.toLowerCase());
                replacements[param] = el.dataset[k];
            }
        });

        if (raw !== null) {
            // decide innerHTML vs textContent
            if (el.getAttribute('data-i18n-html') === 'true') {
                el.innerHTML = translateString(raw, replacements);
            } else if (el.hasAttribute('data-i18n-placeholder')) {
                const val = translateString(raw, replacements);
                el.setAttribute('placeholder', val);
            } else if (el.hasAttribute('data-i18n-title')) {
                const val = translateString(raw, replacements);
                el.setAttribute('title', val);
            } else {
                el.textContent = translateString(raw, replacements);
            }
        }
    });
}

function loadLanguage(lang) {
    CURRENT_LANG = lang || detectLang();
    const url = `/static/lang/${CURRENT_LANG}.json`;
    return fetch(url, {cache: 'no-store'})
        .then(r => {
            if (!r.ok) throw new Error('Language file not found: ' + url);
            return r.json();
        })
        .then(data => {
            applyTranslations(data);
            // set cookie & html lang for server-side consistency
            setCookie('sf_lang', CURRENT_LANG, 365);
            document.documentElement.lang = CURRENT_LANG;
            return data;
        });
}

/* ============ App logic (components / UI) ============ */
let components = [];
let placedItems = [];

// DOM refs (may be null on some pages)
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

// Modal refs
const modal = document.getElementById('sf-custom-modal');
const modalTitle = document.getElementById('sf-modal-title');
const modalMsg = document.getElementById('sf-modal-message');
const modalCloseBtn = document.getElementById('sf-modal-close-btn');
const modalReplaceBtn = document.getElementById('sf-modal-replace-btn');

// Load components from API
function loadComponentData() {
    return fetch('/api/components', {cache: 'no-store'})
        .then(r => {
            if (!r.ok) throw new Error('Components endpoint error: ' + r.status);
            return r.json();
        })
        .then(data => {
            // normalize to array
            let list = [];
            if (Array.isArray(data)) list = data;
            else if (data && typeof data === 'object') {
                for (const [k, arr] of Object.entries(data)) {
                    if (Array.isArray(arr)) {
                        const processed = arr.map(item => ({...item, type: item.type || k, power: parseFloat(item.power) || item.wattage || 0}));
                        list = list.concat(processed);
                    }
                }
            }
            components = list.filter(c => c && (c.name || c.id));
            return components;
        });
}

// populate dropdown
function populateDropdown(currentFilter = 'all') {
    if (!componentDropdown) return;
    while (componentDropdown.children.length > 1) componentDropdown.removeChild(componentDropdown.lastChild);
    const filtered = components.filter(c => currentFilter === 'all' || c.type === currentFilter);
    filtered.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id || c.name;
        opt.textContent = `${c.name} (${(c.type || 'unknown').toUpperCase()})`;
        componentDropdown.appendChild(opt);
    });
}

// render list
function renderList(selectedId = '') {
    if (!componentsList) return;
    // იპოვის აქტიურ ჩანართს ფილტრისთვის
    const active = document.querySelector('.tab.active');
    const activeType = active ? active.dataset.type : 'all';
    
    // გაფილტრავს კომპონენტებს აქტიური ტიპის მიხედვით
    const filtered = components.filter(c => (activeType === 'all' || c.type === activeType) && (selectedId === '' || c.id === selectedId));
    
    if (leftCount) leftCount.textContent = (TRANSLATIONS['left_count_loading'] || 'Loading...').replace('{count}','') ;
    if (leftCount) leftCount.textContent = `${filtered.length} ${(TRANSLATIONS['tabs_all'] || 'ITEMS')}`;
    if (noMatch) noMatch.style.display = filtered.length === 0 ? 'block' : 'none';
    componentsList.innerHTML = '';
    filtered.forEach(c => {
        const el = document.createElement('div');
        el.className = 'comp-card';
        el.draggable = true;
        el.dataset.id = c.id || c.name;
        el.innerHTML = `
            <div class="comp-thumb" aria-hidden="true"></div>
            <div class="comp-info">
                <strong>${c.name}</strong>
                <span>${c.desc || ''}</span>
                <div class="pill">${(c.type || 'unknown').toUpperCase()}</div>
            </div>
        `;
        el.addEventListener('dragstart', (ev) => ev.dataTransfer.setData('text/plain', c.id || c.name));
        el.addEventListener('click', () => addComponentToBuiltList(c));
        componentsList.appendChild(el);
    });
}

// add / replace
function addComponentToBuiltList(comp) {
    if (!comp) return;
    // include both common abbreviations and full names to ensure matching
    const singleTypes = ['cpu','gpu','mb','motherboard','psu','case'];
    const existing = placedItems.find(p => p.comp.type === comp.type);
    if (singleTypes.includes(comp.type) && existing) {
        showReplaceModal(existing, comp);
        return;
    }
    performAdd(comp);
}
function performAdd(comp) { placedItems.push({comp, id: Date.now()}); updateBuiltListUI(); }

// update built list
function updateBuiltListUI() {
    if (!builtListContainer) return;
    builtListContainer.innerHTML = '';
    if (!placedItems.length) {
        builtListContainer.innerHTML = `<div class="built-list-empty-state"><p>${TRANSLATIONS['empty_built_list'] || 'Drag components...'}</p></div>`;
        if (centerListCount) centerListCount.textContent = (TRANSLATIONS['components_added_count'] || '0 COMPONENTS ADDED').replace('{count}', 0);
        if (finalizeBuildBtn) finalizeBuildBtn.style.display = 'none';
        updateBottleneckAndSummary(0); return;
    }
    placedItems.forEach(item => {
        const card = document.createElement('div');
        card.className = 'built-list-item';
        card.dataset.uniqueId = item.id;
        card.innerHTML = `
            <div class="thumb" aria-hidden="true"></div>
            <div class="bi-info">
                <strong>${item.comp.name}</strong>
                <span>${(item.comp.type||'').toUpperCase()}</span>
            </div>
            <div class="built-item-actions">
                <button class="remove btn-delete" data-id="${item.id}" title="Remove component">🗑️</button>
            </div>
        `;
        const removeBtn = card.querySelector('.remove');
        removeBtn.addEventListener('click', () => { placedItems = placedItems.filter(p => p.id !== item.id); updateBuiltListUI(); });
        builtListContainer.appendChild(card);
    });
    if (finalizeBuildBtn) finalizeBuildBtn.style.display = 'block';
    updateBottleneckAndSummary(placedItems.length);
}

// bottleneck & stats (განახლებული ლოგიკა)
function updateBottleneckAndSummary(count) {
    if (centerListCount) centerListCount.textContent = translateString(TRANSLATIONS['components_added_count'] || '{count} COMPONENTS ADDED', {count});
    
    // [დენის მოხმარების ზუსტი გამომთვლელი]
    const BASE_CONSUMPTION_W = 50; // საბაზისო მოხმარება (დედაპლატი, RAM, SSD/HDD, ფანები)
    const componentsPower = placedItems.reduce((s,i)=> s + (i.comp.power || i.comp.wattage || 0), 0);
    const totalPower = componentsPower + BASE_CONSUMPTION_W;

    const hasCPU = placedItems.some(i=>i.comp.type==='cpu');
    const hasGPU = placedItems.some(i=>i.comp.type==='gpu');
    
    if (compatibilityStatus) compatibilityStatus.innerHTML = (hasCPU && hasGPU ? '<span style="color:green">✅ All core components present</span>' : '<span style="color:orange">⚠ Missing core components</span>');
    
    if (bottleneckStatus) {
        const cpu = placedItems.find(i=>i.comp.type==='cpu');
        const gpu = placedItems.find(i=>i.comp.type==='gpu');
        
        // [ზუსტი Bottleneck კალკულატორი]
        if (cpu && gpu) {
            const cpuScore = parseFloat(cpu.comp.score || cpu.comp.performance_score || cpu.comp.bottleneck_score || 50);
            const gpuScore = parseFloat(gpu.comp.score || gpu.comp.performance_score || gpu.comp.bottleneck_score || 50);

            const ratio = gpuScore / cpuScore;
            let bottleneckPercent = 0;
            let bottleneckComponent = '';

            // 5% ბუფერი ბალანსისთვის
            if (ratio > 1.05) { // GPU უფრო ძლიერია: CPU bottleneck
                bottleneckPercent = Math.abs(1 - (1 / ratio)) * 100; 
                bottleneckComponent = 'CPU';
            } else if (ratio < 0.95) { // CPU უფრო ძლიერია: GPU bottleneck
                bottleneckPercent = Math.abs(1 - ratio) * 100;
                bottleneckComponent = 'GPU';
            }
            
            if (bottleneckPercent > 0) {
                bottleneckStatus.textContent = `${bottleneckPercent.toFixed(1)}% ${bottleneckComponent} bottleneck`;
                bottleneckStatus.style.color = bottleneckPercent > 15 ? 'red' : (bottleneckPercent > 5 ? 'orange' : 'green');
            } else {
                bottleneckStatus.textContent = TRANSLATIONS['bottleneck_balanced'] || '✅ Perfectly balanced';
                bottleneckStatus.style.color = 'green';
            }

        } else {
            bottleneckStatus.textContent = TRANSLATIONS['bottleneck_select'] || 'Select a CPU and GPU to analyze.';
            bottleneckStatus.style.color = '#999';
        }
    }
    
    // [დენის მოხმარების ჩვენება - ფასის მოშორება]
    const powerOnlyKey = TRANSLATIONS['stats_power_only'] || 'Est. Power Draw: {power}W';
    if (statsPanel) {
        statsPanel.textContent = translateString(powerOnlyKey, {power: totalPower.toFixed(0)});
    }
}

// modal functions
function showModal(message = '', title = '') {
    if (modalTitle) modalTitle.textContent = title || (TRANSLATIONS['system_alert'] || 'System Alert');
    if (modalMsg) modalMsg.innerHTML = message || '';
    if (modalReplaceBtn) modalReplaceBtn.style.display = 'none';
    if (modalCloseBtn) modalCloseBtn.textContent = TRANSLATIONS['modal_close'] || 'Close';
    if (modal) modal.classList.remove('hidden');
}
function closeModal() { if (modal) modal.classList.add('hidden'); if (modalReplaceBtn) modalReplaceBtn.onclick = null; }
function showReplaceModal(existingItem, newItem) {
    if (modalTitle) modalTitle.textContent = TRANSLATIONS['modal_replace'] || 'Replace';
    if (modalMsg) modalMsg.innerHTML = translateString(TRANSLATIONS['modal_replace_question'] || 'Replace?', {existing: existingItem.comp.name, type: existingItem.comp.type, newname: newItem.name});
    if (modalReplaceBtn) {
        modalReplaceBtn.style.display = 'inline-block';
        modalReplaceBtn.onclick = () => { placedItems = placedItems.filter(p=>p.id !== existingItem.id); performAdd(newItem); closeModal(); };
    }
    if (modalCloseBtn) modalCloseBtn.textContent = TRANSLATIONS['modal_cancel'] || 'Cancel';
    if (modal) modal.classList.remove('hidden');
}

// save build
function saveBuild() {
    if (!placedItems.length) return showModal(TRANSLATIONS['no_components_selected'] || 'No components selected.');
    const cpuItem = placedItems.find(i=>i.comp.type==='cpu');
    const totalPower = placedItems.reduce((s,i)=> s + (i.comp.power || i.comp.wattage || 0), 0);
    const payload = { components: placedItems.map(p=>p.comp), stats: { cpu_name: cpuItem?cpuItem.comp.name:'Unknown', total_power: totalPower, timestamp: new Date().toISOString() } };
    fetch('/save-build', { method:'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
        .then(r=>r.json())
        .then(body=>{
            if (body && body.success) showModal(translateString(TRANSLATIONS['build_saved_success']||'Build saved', {id: body.build_id}), TRANSLATIONS['system_alert']||'Success');
            else showModal(translateString(TRANSLATIONS['build_saved_error']||'Error', {msg: body?.message||'Unknown'}), TRANSLATIONS['system_alert']||'Error');
        })
        .catch(err=>{ console.error('Save build error:', err); showModal(TRANSLATIONS['server_error']||'Server error'); });
}

// delete draft
function deleteDraft(buildId) {
    fetch(`/delete-draft/${buildId}`, { method:'POST', headers:{'Content-Type':'application/json'} })
    .then(r=>r.json())
    .then(data=>{
        if (data.success) {
            showModal(data.message || TRANSLATIONS['delete_success'] || 'Deleted', TRANSLATIONS['system_alert']||'Success');
            if (typeof FLASK_SAVED_BUILDS !== 'undefined') {
                const newBuilds = FLASK_SAVED_BUILDS.filter(b => b.id !== buildId);
                window.FLASK_SAVED_BUILDS = newBuilds;
                renderDraftsPage(newBuilds);
            }
        } else {
            showModal(data.message || TRANSLATIONS['delete_failed'] || 'Error', TRANSLATIONS['system_alert']||'Error');
        }
    })
    .catch(err=>{ console.error('Delete error', err); showModal(TRANSLATIONS['server_error']||'Server error'); });
}

// render drafts
function renderDraftsPage(builds) {
    const container = document.getElementById('draftsListContainer');
    const countEl = document.getElementById('draftsCount');
    if (!container) return;
    container.innerHTML = '';
    if (!builds || builds.length === 0) {
        container.innerHTML = `<div class="built-list-empty-state"><p>${TRANSLATIONS['drafts_empty']||'No drafts'}</p></div>`;
        if (countEl) countEl.textContent = translateString(TRANSLATIONS['drafts_count']||'{count} Drafts',{count:0});
        return;
    }
    if (countEl) countEl.textContent = translateString(TRANSLATIONS['drafts_count']||'{count} Drafts',{count: builds.length});
    builds.forEach((build, index)=>{
        const buildCard = document.createElement('div'); buildCard.className='draft-card';
        const cpu = (build.components||[]).find(c=>c.type==='cpu')||{name:'N/A'};
        const componentListHTML = (build.components||[]).map(c=>`<li><strong>${(c.type||'').toUpperCase()}:</strong> ${c.name}</li>`).join('');
        let dateString = 'Unknown Date';
        if (build.stats && build.stats.timestamp) {
            try { dateString = new Date(build.stats.timestamp).toLocaleDateString(document.documentElement.lang||'en-US',{year:'numeric',month:'short',day:'numeric'}); } catch(e){}
        }
        const powerDraw = (build.stats && typeof build.stats.total_power !== 'undefined') ? `${build.stats.total_power}W` : 'N/A';
        buildCard.innerHTML = `
            <div class="draft-card-header">
                <div class="draft-title-and-index"> 
                    <h4 class="draft-title">${translateString(TRANSLATIONS['draft_card_title']||'Draft #{id} (Entry {index})',{id:build.id,index:index+1})}</h4>
                    <span class="draft-date">${translateString(TRANSLATIONS['draft_saved_date']||'Saved: {date}',{date:dateString})}</span>
                </div>
                <div class="draft-actions">
                    <button class="btn-delete" data-id="${build.id}" title="${TRANSLATIONS['remove_btn_aria']||'Remove'}">🗑️ ${TRANSLATIONS['draft_remove']||'Remove'}</button>
                </div>
            </div>
            <div class="draft-component-list-container">
                <p class="list-heading">${TRANSLATIONS['draft_full_component_list_heading']||'Full Component List:'}</p>
                <ul class="draft-component-list">${componentListHTML}</ul>
            </div>
            <div class="draft-card-stats-grid">
                <p><strong>${TRANSLATIONS['tabs_cpu']||'CPU'}:</strong> ${cpu.name}</p>
                <p><strong>${TRANSLATIONS['power_draw_label']||'Power Draw'}:</strong> ${powerDraw}</p>
                <p><strong>${TRANSLATIONS['components_label']||'Components'}:</strong> ${ (build.components||[]).length }</p>
            </div>
            <div class="draft-card-footer">
                <button class="btn">${TRANSLATIONS['draft_view_summary']||'View Summary'}</button>
            </div>
        `;
        const deleteBtn = buildCard.querySelector('.btn-delete');
        if (deleteBtn) deleteBtn.addEventListener('click', ()=> deleteDraft(build.id));
        container.appendChild(buildCard);
    });
}

// dropdowns (theme & language)
function setupDropdowns() {
    const themeBtn = document.getElementById('themeDropdownBtn');
    const themeContent = document.getElementById('themeDropdownContent');
    const langBtn = document.getElementById('languageDropdownBtn');
    const langContent = document.getElementById('languageDropdownContent');

    if (themeBtn) themeBtn.addEventListener('click', e=>{ e.stopPropagation(); themeContent?.classList.toggle('show'); langContent?.classList.remove('show'); });
    themeContent?.querySelectorAll('.dropdown-item')?.forEach(item=>{
        item.addEventListener('click', e=>{ e.preventDefault(); const theme = item.dataset.theme; document.body.className = theme === 'default' ? '' : `theme-${theme}`; themeContent.querySelector('.dropdown-item.active')?.classList.remove('active'); item.classList.add('active'); localStorage.setItem('sf-theme', theme); themeContent.classList.remove('show'); });
    });

    if (langBtn) langBtn.addEventListener('click', e=>{ e.stopPropagation(); langContent?.classList.toggle('show'); themeContent?.classList.remove('show'); });
    langContent?.querySelectorAll('.dropdown-item')?.forEach(item=>{
        item.addEventListener('click', e=>{ e.preventDefault(); const newLang = item.dataset.lang; const currentLang = document.documentElement.lang || CURRENT_LANG; setCookie('sf_lang', newLang, 365); document.documentElement.lang = newLang; langContent.querySelector('.dropdown-item.active')?.classList.remove('active'); item.classList.add('active'); if (newLang !== currentLang) { window.location.reload(); } langContent.classList.remove('show'); });
    });

    // load saved theme
    const savedTheme = localStorage.getItem('sf-theme');
    if (savedTheme && savedTheme !== 'default') {
        document.body.className = `theme-${savedTheme}`;
        const active = themeContent?.querySelector(`[data-theme="${savedTheme}"]`);
        if (active) { themeContent.querySelector('.dropdown-item.active')?.classList.remove('active'); active.classList.add('active'); }
    }

    // set active language button based on cookie/html
    const lang = detectLang();
    const activeLangItem = langContent?.querySelector(`[data-lang="${lang}"]`);
    if (activeLangItem) { langContent.querySelector('.dropdown-item.active')?.classList.remove('active'); activeLangItem.classList.add('active'); }

    // close on outside click
    document.addEventListener('click', (e)=>{ if (!document.getElementById('themeDropdownContainer')?.contains(e.target)) themeContent?.classList.remove('show'); if (!document.getElementById('languageDropdownContainer')?.contains(e.target)) langContent?.classList.remove('show'); });
}

function setupModalListeners() { if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal); window.addEventListener('click', (ev)=>{ if (ev.target === modal) closeModal(); }); }

// main init
function main() {
    const lang = detectLang();
    loadLanguage(lang).then(()=>{
        setupDropdowns();
        setupModalListeners();

        if (typeof FLASK_SAVED_BUILDS !== 'undefined') {
            renderDraftsPage(FLASK_SAVED_BUILDS);
            return;
        }

        loadComponentData().then(()=>{
            populateDropdown('all');
            renderList();
            updateBuiltListUI();
            
            // [გამოსწორება] FINALIZE ღილაკის Event Listener-ის დამატება
            if (finalizeBuildBtn) {
                finalizeBuildBtn.addEventListener('click', saveBuild);
            }
            
            // [ჩანართების ლოგიკა]
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderList();
                    populateDropdown(tab.dataset.type || 'all');
                });
            });

        }).catch(err=>{
            console.error('Data load error', err);
            populateDropdown('all'); renderList(); updateBuiltListUI(); showModal(TRANSLATIONS['could_not_load_components']||'Could not load components');
        });
    }).catch(err=>{
        console.error('Language load error', err);
        // fallback: continue without translations
        setupDropdowns(); setupModalListeners(); loadComponentData().then(()=>{ populateDropdown('all'); renderList(); updateBuiltListUI(); 
            // fallback-ის დროსაც უნდა დავამატოთ ჩანართების და ღილაკის ლისენერები
            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    renderList();
                    populateDropdown(tab.dataset.type || 'all');
                });
            });
            if (finalizeBuildBtn) {
                finalizeBuildBtn.addEventListener('click', saveBuild);
            }
        }).catch(()=>{ populateDropdown('all'); renderList(); updateBuiltListUI(); showModal('Could not load components'); });
    });
}

document.addEventListener('DOMContentLoaded', main);