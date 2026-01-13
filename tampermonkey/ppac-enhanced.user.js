// ==UserScript==
// @name         PPAC Known Issues Enhanced
// @namespace    https://niiranen.info/
// @version      2.2
// @description  Better UI for Power Platform Admin Center Known Issues
// @author       Jukka Niiranen
// @match        https://admin.powerplatform.microsoft.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    let isKnownIssuesPage = false;
    let capturedIssues = [];
    let enhancedUI = null;
    let watchedIssues = JSON.parse(localStorage.getItem('ppac-watched') || '[]');
    let panelPosition = localStorage.getItem('ppac-panel-position') || 'right';

    // Intercept fetch
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        return originalFetch.apply(this, arguments).then(response => {
            if (url && url.indexOf('knownissue/search') > -1) {
                response.clone().json().then(data => {
                    if (Array.isArray(data) && data.length > 0) {
                        console.log('[PPAC Enhanced] Captured', data.length, 'issues');
                        capturedIssues = data;
                        if (enhancedUI) enhancedUI.updateData(data);
                    }
                }).catch(e => {});
            }
            return response;
        });
    };

    // Intercept XHR
    const origXHROpen = XMLHttpRequest.prototype.open;
    const origXHRSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url) {
        this._ppacUrl = url;
        return origXHROpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function() {
        const xhr = this;
        if (xhr._ppacUrl && xhr._ppacUrl.indexOf('knownissue/search') > -1) {
            xhr.addEventListener('load', function() {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (Array.isArray(data) && data.length > 0) {
                        capturedIssues = data;
                        if (enhancedUI) enhancedUI.updateData(data);
                    }
                } catch (e) {}
            });
        }
        return origXHRSend.apply(this, arguments);
    };

    // Navigation detection
    function checkAndInject() {
        if (location.href.indexOf('knownIssues') > -1 && !isKnownIssuesPage) {
            isKnownIssuesPage = true;
            setTimeout(injectEnhancedUI, 1500);
        } else if (location.href.indexOf('knownIssues') === -1) {
            isKnownIssuesPage = false;
            if (enhancedUI) { enhancedUI.destroy(); enhancedUI = null; }
        }
    }

    const pushState = history.pushState;
    history.pushState = function() {
        pushState.apply(history, arguments);
        setTimeout(checkAndInject, 100);
    };
    window.addEventListener('popstate', () => setTimeout(checkAndInject, 100));
    window.addEventListener('load', () => setTimeout(checkAndInject, 500));

    function injectEnhancedUI() {
        if (document.getElementById('ppac-enhanced-root')) return;
        console.log('[PPAC Enhanced] Injecting UI v2.2');

        const root = document.createElement('div');
        root.id = 'ppac-enhanced-root';

        const styles = document.createElement('style');
        styles.id = 'ppac-enhanced-styles';
        styles.textContent = `
            #ppac-enhanced-root {
                position: fixed;
                bottom: 20px;
                z-index: 999999;
                font-family: 'Segoe UI', sans-serif;
            }
            #ppac-enhanced-root.pos-right { right: 20px; }
            #ppac-enhanced-root.pos-left { left: 20px; }

            #ppac-toggle-btn {
                background: linear-gradient(135deg, #0078d4, #106ebe);
                color: white; border: none; padding: 10px 16px; border-radius: 8px;
                cursor: pointer; font-size: 13px; font-weight: 600;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                display: flex; align-items: center; gap: 6px;
            }
            #ppac-toggle-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.25); }
            #ppac-toggle-btn.has-new { animation: pulse 2s infinite; }
            @keyframes pulse { 0%, 100% { box-shadow: 0 4px 12px rgba(0,0,0,0.2); } 50% { box-shadow: 0 4px 20px rgba(0,120,212,0.5); } }

            #ppac-panel {
                display: none;
                position: fixed;
                top: 0;
                width: 520px;
                height: 100vh;
                background: #fff;
                box-shadow: 0 0 20px rgba(0,0,0,0.15);
                flex-direction: column;
                z-index: 999998;
            }
            #ppac-panel.open { display: flex; }
            #ppac-panel.pos-right { right: 0; box-shadow: -4px 0 20px rgba(0,0,0,0.15); }
            #ppac-panel.pos-left { left: 0; box-shadow: 4px 0 20px rgba(0,0,0,0.15); }

            #ppac-panel-header {
                background: #0078d4; color: white; padding: 10px 14px;
                display: flex; justify-content: space-between; align-items: center;
            }
            #ppac-panel-header h2 { margin: 0; font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
            .ppac-header-btns { display: flex; gap: 2px; }
            .ppac-header-btn {
                background: rgba(255,255,255,0.15); border: none; color: white;
                width: 26px; height: 26px; border-radius: 4px; cursor: pointer;
                font-size: 14px; display: flex; align-items: center; justify-content: center;
            }
            .ppac-header-btn:hover { background: rgba(255,255,255,0.25); }
            .ppac-header-btn.active { background: rgba(255,255,255,0.3); }

            #ppac-hint-bar {
                background: #fff4ce; padding: 6px 12px; font-size: 11px; color: #6a5700;
                border-bottom: 1px solid #ffe69c; display: flex; align-items: center; gap: 6px;
            }
            #ppac-hint-bar button {
                background: #0078d4; color: white; border: none; padding: 3px 8px;
                border-radius: 3px; font-size: 10px; cursor: pointer;
            }

            #ppac-stats-bar {
                background: #f8f8f8; padding: 6px 12px; border-bottom: 1px solid #e1e1e1;
                display: flex; gap: 12px; font-size: 11px; color: #605e5c; flex-wrap: wrap;
            }
            .ppac-stat { display: flex; align-items: center; gap: 3px; }
            .ppac-stat-val { font-weight: 600; color: #323130; }

            #ppac-toolbar {
                padding: 8px 10px; border-bottom: 1px solid #e1e1e1;
                display: flex; gap: 5px; flex-wrap: wrap; align-items: center; background: #fafafa;
            }
            #ppac-search {
                flex: 1; min-width: 100px; padding: 6px 8px;
                border: 1px solid #e1e1e1; border-radius: 4px; font-size: 12px;
            }
            #ppac-toolbar select {
                padding: 5px 4px; border: 1px solid #e1e1e1; border-radius: 4px;
                font-size: 11px; background: white;
            }
            #ppac-toolbar button {
                padding: 5px 8px; border: 1px solid #e1e1e1; border-radius: 4px;
                font-size: 11px; background: white; cursor: pointer;
            }
            #ppac-toolbar button:hover { background: #f0f0f0; }
            #ppac-filter-count { font-size: 10px; color: #605e5c; margin-left: auto; }

            #ppac-list { flex: 1; overflow-y: auto; padding: 8px 10px; }

            .ppac-issue {
                background: #fff; border: 1px solid #e1e1e1; border-radius: 5px;
                padding: 8px 10px; margin-bottom: 5px; cursor: pointer; transition: all 0.15s;
            }
            .ppac-issue:hover { border-color: #0078d4; box-shadow: 0 2px 6px rgba(0,120,212,0.1); }
            .ppac-issue.selected { border-color: #0078d4; background: #f0f7ff; }
            .ppac-issue.watched { border-left: 3px solid #ffb900; }

            .ppac-issue-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; margin-bottom: 4px; }
            .ppac-issue-title { font-weight: 600; font-size: 12px; color: #323130; line-height: 1.3; flex: 1; }

            .ppac-badges { display: flex; gap: 3px; flex-shrink: 0; }
            .ppac-badge { font-size: 9px; padding: 2px 5px; border-radius: 8px; font-weight: 600; white-space: nowrap; }
            .ppac-badge-active { background: #dff6dd; color: #107c10; }
            .ppac-badge-resolved { background: #e8daef; color: #8764b8; }
            .ppac-badge-new { background: #fff4ce; color: #8a6900; }
            .ppac-badge-updated { background: #e6f2ff; color: #0078d4; }

            .ppac-issue-meta { display: flex; gap: 8px; font-size: 10px; color: #605e5c; flex-wrap: wrap; align-items: center; }
            .ppac-issue-product { background: #f0f0f0; padding: 1px 4px; border-radius: 2px; }
            .ppac-no-solution { color: #c19c00; }
            .ppac-watch-btn { background: none; border: none; cursor: pointer; font-size: 12px; padding: 0; opacity: 0.4; }
            .ppac-watch-btn:hover, .ppac-watch-btn.watched { opacity: 1; }

            #ppac-detail {
                display: none; position: fixed; top: 0; width: 420px; height: 100vh;
                background: #fff; box-shadow: 0 0 16px rgba(0,0,0,0.1); z-index: 999997; flex-direction: column;
            }
            #ppac-detail.open { display: flex; }
            #ppac-detail.pos-right { right: 520px; box-shadow: -4px 0 16px rgba(0,0,0,0.1); }
            #ppac-detail.pos-left { left: 520px; box-shadow: 4px 0 16px rgba(0,0,0,0.1); }

            #ppac-detail-header { padding: 12px 14px; border-bottom: 1px solid #e1e1e1; background: #fafafa; }
            #ppac-detail-close { float: right; background: none; border: none; font-size: 20px; cursor: pointer; color: #605e5c; }
            #ppac-detail-title { font-size: 13px; font-weight: 600; margin-bottom: 8px; padding-right: 28px; color: #323130; line-height: 1.4; }
            #ppac-detail-meta { display: flex; flex-wrap: wrap; gap: 6px; font-size: 11px; align-items: center; }
            .ppac-meta-item { display: flex; gap: 3px; }
            .ppac-meta-item label { color: #605e5c; }

            #ppac-detail-actions { display: flex; gap: 5px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #e1e1e1; flex-wrap: wrap; }
            #ppac-detail-actions button {
                padding: 5px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;
                display: flex; align-items: center; gap: 4px;
            }
            .ppac-btn-primary { background: #0078d4; color: white; border: none; }
            .ppac-btn-primary:hover { background: #106ebe; }
            .ppac-btn-secondary { background: white; border: 1px solid #e1e1e1; color: #323130; }
            .ppac-btn-secondary:hover { background: #f5f5f5; }

            #ppac-detail-body { flex: 1; overflow-y: auto; padding: 12px; }
            .ppac-section { margin-bottom: 12px; }
            .ppac-section h3 { font-size: 10px; color: #605e5c; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; font-weight: 600; }
            .ppac-section-content { font-size: 12px; line-height: 1.5; color: #323130; }
            .ppac-section-content p { margin-bottom: 6px; }

            .ppac-empty { text-align: center; padding: 30px 16px; color: #605e5c; font-size: 12px; }
            .ppac-toast {
                position: fixed; bottom: 80px; background: #323130; color: white;
                padding: 8px 14px; border-radius: 6px; font-size: 12px; z-index: 1000000;
                animation: fadeInOut 2s ease-in-out;
            }
            .ppac-toast.pos-right { right: 30px; }
            .ppac-toast.pos-left { left: 30px; }
            @keyframes fadeInOut { 0% { opacity: 0; } 15% { opacity: 1; } 85% { opacity: 1; } 100% { opacity: 0; } }
        `;
        document.head.appendChild(styles);

        root.innerHTML = `
            <button id="ppac-toggle-btn">⚡ Enhanced <span id="ppac-count">(0)</span></button>
            <div id="ppac-panel">
                <div id="ppac-panel-header">
                    <h2>⚡ Known Issues</h2>
                    <div class="ppac-header-btns">
                        <button class="ppac-header-btn" id="ppac-position-btn" title="Move panel to other side (P)">⇄</button>
                        <button class="ppac-header-btn" id="ppac-minimize-btn" title="Minimize (Esc)">─</button>
                        <button class="ppac-header-btn" id="ppac-close-btn" title="Close">×</button>
                    </div>
                </div>
                <div id="ppac-hint-bar">
                    💡 Use PPAC filters on the ${panelPosition === 'right' ? 'left' : 'right'} to load data. Panel auto-captures results.
                    <button id="ppac-hide-hint">Got it</button>
                </div>
                <div id="ppac-stats-bar">
                    <div class="ppac-stat">Active: <span class="ppac-stat-val" id="ppac-stat-active">0</span></div>
                    <div class="ppac-stat">Resolved: <span class="ppac-stat-val" id="ppac-stat-resolved">0</span></div>
                    <div class="ppac-stat">Has Fix: <span class="ppac-stat-val" id="ppac-stat-solution">0</span></div>
                    <div class="ppac-stat">⭐: <span class="ppac-stat-val" id="ppac-stat-watched">0</span></div>
                </div>
                <div id="ppac-toolbar">
                    <input type="text" id="ppac-search" placeholder="🔍 Filter results...">
                    <select id="ppac-status-filter" title="Status">
                        <option value="">Status</option>
                        <option value="Active">Active</option>
                        <option value="Resolved">Resolved</option>
                    </select>
                    <select id="ppac-solution-filter" title="Solution">
                        <option value="">Fix</option>
                        <option value="yes">Has</option>
                        <option value="no">None</option>
                    </select>
                    <select id="ppac-date-filter" title="Created">
                        <option value="">Age</option>
                        <option value="7">7d</option>
                        <option value="30">30d</option>
                        <option value="90">90d</option>
                    </select>
                    <select id="ppac-sort" title="Sort">
                        <option value="created-desc">Newest</option>
                        <option value="changed-desc">Updated</option>
                        <option value="title-asc">A-Z</option>
                    </select>
                    <select id="ppac-special-filter" title="Special">
                        <option value="">All</option>
                        <option value="watched">⭐</option>
                        <option value="new">🆕</option>
                    </select>
                    <button id="ppac-export-btn" title="Export JSON">📥</button>
                    <span id="ppac-filter-count"></span>
                </div>
                <div id="ppac-list">
                    <div class="ppac-empty">Waiting for data...<br><br>Use PPAC's Product/Status filters to load issues.<br>Results will appear here automatically.</div>
                </div>
            </div>
            <div id="ppac-detail">
                <div id="ppac-detail-header">
                    <button id="ppac-detail-close">×</button>
                    <div id="ppac-detail-title"></div>
                    <div id="ppac-detail-meta"></div>
                    <div id="ppac-detail-actions"></div>
                </div>
                <div id="ppac-detail-body"></div>
            </div>
        `;

        document.body.appendChild(root);

        // State
        let filteredIssues = [];
        let selectedIssue = null;
        let selectedIndex = -1;
        let hintHidden = localStorage.getItem('ppac-hint-hidden') === 'true';

        // Elements
        const toggleBtn = document.getElementById('ppac-toggle-btn');
        const closeBtn = document.getElementById('ppac-close-btn');
        const minimizeBtn = document.getElementById('ppac-minimize-btn');
        const positionBtn = document.getElementById('ppac-position-btn');
        const panel = document.getElementById('ppac-panel');
        const detail = document.getElementById('ppac-detail');
        const detailClose = document.getElementById('ppac-detail-close');
        const searchInput = document.getElementById('ppac-search');
        const statusFilter = document.getElementById('ppac-status-filter');
        const solutionFilter = document.getElementById('ppac-solution-filter');
        const dateFilter = document.getElementById('ppac-date-filter');
        const sortSelect = document.getElementById('ppac-sort');
        const specialFilter = document.getElementById('ppac-special-filter');
        const exportBtn = document.getElementById('ppac-export-btn');
        const hintBar = document.getElementById('ppac-hint-bar');
        const hideHintBtn = document.getElementById('ppac-hide-hint');

        // Apply initial position
        function applyPosition() {
            root.className = 'pos-' + panelPosition;
            panel.className = panel.classList.contains('open') ? 'open pos-' + panelPosition : 'pos-' + panelPosition;
            detail.className = detail.classList.contains('open') ? 'open pos-' + panelPosition : 'pos-' + panelPosition;
            // Update hint text
            if (hintBar) {
                hintBar.innerHTML = `💡 Use PPAC filters on the ${panelPosition === 'right' ? 'left' : 'right'} to load data. Panel auto-captures results. <button id="ppac-hide-hint">Got it</button>`;
                document.getElementById('ppac-hide-hint').onclick = () => {
                    hintBar.style.display = 'none';
                    localStorage.setItem('ppac-hint-hidden', 'true');
                };
            }
        }

        applyPosition();

        // Hide hint if previously dismissed
        if (hintHidden) {
            hintBar.style.display = 'none';
        }

        hideHintBtn.onclick = () => {
            hintBar.style.display = 'none';
            localStorage.setItem('ppac-hint-hidden', 'true');
        };

        // Panel controls
        toggleBtn.onclick = () => {
            panel.classList.add('open');
            applyPosition();
        };

        closeBtn.onclick = closePanel;
        minimizeBtn.onclick = closePanel;

        positionBtn.onclick = () => {
            panelPosition = panelPosition === 'right' ? 'left' : 'right';
            localStorage.setItem('ppac-panel-position', panelPosition);
            applyPosition();
            showToast('Panel moved to ' + panelPosition);
        };

        detailClose.onclick = closeDetail;

        function closePanel() {
            panel.classList.remove('open');
            detail.classList.remove('open');
        }

        function closeDetail() {
            detail.classList.remove('open');
            selectedIssue = null;
            selectedIndex = -1;
            renderList();
        }

        // Filters
        searchInput.oninput = debounce(applyFilters, 200);
        statusFilter.onchange = applyFilters;
        solutionFilter.onchange = applyFilters;
        dateFilter.onchange = applyFilters;
        sortSelect.onchange = applyFilters;
        specialFilter.onchange = applyFilters;

        exportBtn.onclick = () => {
            const json = JSON.stringify(capturedIssues, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'ppac-issues-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            showToast('Exported ' + capturedIssues.length + ' issues');
        };

        // Keyboard
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+K to toggle
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (panel.classList.contains('open')) closePanel();
                else { panel.classList.add('open'); applyPosition(); }
                return;
            }

            // P to toggle position (when panel open and not in input)
            if (e.key.toLowerCase() === 'p' && panel.classList.contains('open') && !e.target.matches('input, select, textarea')) {
                positionBtn.click();
                return;
            }

            if (!panel.classList.contains('open')) return;

            if (e.key === 'Escape') {
                if (detail.classList.contains('open')) closeDetail();
                else closePanel();
            } else if (e.key === 'ArrowDown' && filteredIssues.length > 0 && !e.target.matches('input, select')) {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, filteredIssues.length - 1);
                showDetail(filteredIssues[selectedIndex].workItemId);
                scrollToSelected();
            } else if (e.key === 'ArrowUp' && filteredIssues.length > 0 && !e.target.matches('input, select')) {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                showDetail(filteredIssues[selectedIndex].workItemId);
                scrollToSelected();
            } else if (e.key === 'Enter' && selectedIssue && !e.target.matches('input, select')) {
                window.open(getPPACUrl(selectedIssue.workItemId), '_blank');
            }
        });

        function scrollToSelected() {
            const el = document.querySelector(`.ppac-issue[data-id="${filteredIssues[selectedIndex]?.workItemId}"]`);
            if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }

        function getPPACUrl(id) {
            return 'https://admin.powerplatform.microsoft.com/support/knownissues/' + id;
        }

        function isNew(issue) {
            const created = new Date(issue.createdDate);
            const daysAgo = (Date.now() - created) / (1000 * 60 * 60 * 24);
            return daysAgo <= 7;
        }

        function wasUpdated(issue) {
            const created = new Date(issue.createdDate);
            const changed = new Date(issue.changedDate);
            return (changed - created) > (1000 * 60 * 60);
        }

        function hasSolution(issue) {
            return issue.solution && issue.solution.trim().length > 0;
        }

        function isWatched(id) {
            return watchedIssues.includes(id);
        }

        function toggleWatch(id) {
            if (isWatched(id)) {
                watchedIssues = watchedIssues.filter(x => x !== id);
                showToast('Removed from watchlist');
            } else {
                watchedIssues.push(id);
                showToast('Added to watchlist');
            }
            localStorage.setItem('ppac-watched', JSON.stringify(watchedIssues));
            updateStats();
            renderList();
            if (selectedIssue && selectedIssue.workItemId === id) {
                showDetail(id);
            }
        }

        function showToast(msg) {
            const toast = document.createElement('div');
            toast.className = 'ppac-toast pos-' + panelPosition;
            toast.textContent = msg;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        }

        function updateStats() {
            const active = capturedIssues.filter(i => i.state === 'Active').length;
            const resolved = capturedIssues.filter(i => i.state === 'Resolved').length;
            const withSolution = capturedIssues.filter(i => hasSolution(i)).length;
            const watched = watchedIssues.filter(id => capturedIssues.some(i => i.workItemId === id)).length;

            document.getElementById('ppac-stat-active').textContent = active;
            document.getElementById('ppac-stat-resolved').textContent = resolved;
            document.getElementById('ppac-stat-solution').textContent = withSolution;
            document.getElementById('ppac-stat-watched').textContent = watched;

            const hasNewIssues = capturedIssues.some(i => isNew(i));
            toggleBtn.classList.toggle('has-new', hasNewIssues);
        }

        function applyFilters() {
            const q = searchInput.value.toLowerCase();
            const status = statusFilter.value;
            const solution = solutionFilter.value;
            const days = dateFilter.value ? parseInt(dateFilter.value) : 0;
            const sort = sortSelect.value;
            const special = specialFilter.value;

            const cutoff = days ? Date.now() - (days * 24 * 60 * 60 * 1000) : 0;

            filteredIssues = capturedIssues.filter(i => {
                if (status && i.state !== status) return false;
                if (solution === 'yes' && !hasSolution(i)) return false;
                if (solution === 'no' && hasSolution(i)) return false;
                if (cutoff && new Date(i.createdDate) < cutoff) return false;
                if (special === 'watched' && !isWatched(i.workItemId)) return false;
                if (special === 'new' && !isNew(i)) return false;
                if (q) {
                    const text = [i.title, i.workItemId, i.product, stripHtml(i.description), stripHtml(i.solution)].join(' ').toLowerCase();
                    if (text.indexOf(q) < 0) return false;
                }
                return true;
            });

            filteredIssues.sort((a, b) => {
                switch (sort) {
                    case 'created-desc': return new Date(b.createdDate) - new Date(a.createdDate);
                    case 'changed-desc': return new Date(b.changedDate) - new Date(a.changedDate);
                    case 'title-asc': return a.title.localeCompare(b.title);
                    default: return 0;
                }
            });

            document.getElementById('ppac-filter-count').textContent = filteredIssues.length + '/' + capturedIssues.length;
            selectedIndex = -1;
            renderList();
        }

        function renderList() {
            const container = document.getElementById('ppac-list');

            if (!filteredIssues.length) {
                container.innerHTML = '<div class="ppac-empty">' + (capturedIssues.length ? 'No issues match filters' : 'Waiting for data...<br><br>Use PPAC filters to load issues.') + '</div>';
                return;
            }

            container.innerHTML = filteredIssues.map((i, idx) => {
                const sel = selectedIssue && selectedIssue.workItemId === i.workItemId ? ' selected' : '';
                const watched = isWatched(i.workItemId) ? ' watched' : '';
                const statusBadge = i.state === 'Active' ? 'ppac-badge-active' : 'ppac-badge-resolved';
                const noSol = !hasSolution(i) ? '<span class="ppac-no-solution">⚠️</span>' : '';
                const newBadge = isNew(i) ? '<span class="ppac-badge ppac-badge-new">NEW</span>' : '';
                const updatedBadge = wasUpdated(i) && !isNew(i) ? '<span class="ppac-badge ppac-badge-updated">Upd</span>' : '';
                const watchIcon = isWatched(i.workItemId) ? '⭐' : '☆';

                return `<div class="ppac-issue${sel}${watched}" data-id="${i.workItemId}" data-idx="${idx}">
                    <div class="ppac-issue-header">
                        <span class="ppac-issue-title">${escHtml(i.title)}</span>
                        <div class="ppac-badges">${newBadge}${updatedBadge}<span class="ppac-badge ${statusBadge}">${i.state}</span></div>
                    </div>
                    <div class="ppac-issue-meta">
                        <button class="ppac-watch-btn${isWatched(i.workItemId) ? ' watched' : ''}" data-watch="${i.workItemId}">${watchIcon}</button>
                        <span class="ppac-issue-product">${escHtml(i.product)}</span>
                        <span>${i.workItemId}</span>
                        <span>${fmtDate(i.createdDate)}</span>
                        ${noSol}
                    </div>
                </div>`;
            }).join('');

            container.querySelectorAll('.ppac-issue').forEach(el => {
                el.onclick = (e) => {
                    if (e.target.classList.contains('ppac-watch-btn')) return;
                    selectedIndex = parseInt(el.dataset.idx);
                    showDetail(el.dataset.id);
                };
            });

            container.querySelectorAll('.ppac-watch-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.stopPropagation();
                    toggleWatch(btn.dataset.watch);
                };
            });
        }

        function showDetail(id) {
            selectedIssue = capturedIssues.find(i => i.workItemId === id);
            if (!selectedIssue) return;

            renderList();

            document.getElementById('ppac-detail-title').textContent = selectedIssue.title;

            const statusBadge = selectedIssue.state === 'Active' ? 'ppac-badge-active' : 'ppac-badge-resolved';
            const newBadge = isNew(selectedIssue) ? '<span class="ppac-badge ppac-badge-new">NEW</span>' : '';

            document.getElementById('ppac-detail-meta').innerHTML = `
                <span class="ppac-badge ${statusBadge}">${selectedIssue.state}</span>
                ${newBadge}
                <div class="ppac-meta-item"><label>Product:</label> ${escHtml(selectedIssue.product)}</div>
                <div class="ppac-meta-item"><label>ID:</label> ${selectedIssue.workItemId}</div>
                <div class="ppac-meta-item"><label>Created:</label> ${fmtDate(selectedIssue.createdDate)}</div>
                <div class="ppac-meta-item"><label>Updated:</label> ${fmtDate(selectedIssue.changedDate)}</div>
            `;

            const ppacUrl = getPPACUrl(selectedIssue.workItemId);
            const watchLabel = isWatched(selectedIssue.workItemId) ? '⭐ Unwatch' : '☆ Watch';

            document.getElementById('ppac-detail-actions').innerHTML = `
                <button class="ppac-btn-primary" onclick="window.open('${ppacUrl}', '_blank')">🔗 Open</button>
                <button class="ppac-btn-secondary" onclick="navigator.clipboard.writeText('${ppacUrl}').then(() => { this.textContent = '✓'; setTimeout(() => this.textContent = '📋 Link', 1500); })">📋 Link</button>
                <button class="ppac-btn-secondary" id="ppac-detail-watch">${watchLabel}</button>
            `;

            document.getElementById('ppac-detail-watch').onclick = () => toggleWatch(selectedIssue.workItemId);

            let body = `<div class="ppac-section">
                <h3>Description</h3>
                <div class="ppac-section-content">${selectedIssue.description || '<em>No description</em>'}</div>
            </div>`;

            if (hasSolution(selectedIssue)) {
                body += `<div class="ppac-section">
                    <h3>Solution / Workaround</h3>
                    <div class="ppac-section-content">${selectedIssue.solution}</div>
                </div>`;
            } else {
                body += `<div class="ppac-section">
                    <h3>Solution / Workaround</h3>
                    <div class="ppac-section-content" style="color: #c19c00;">⚠️ No solution provided yet.</div>
                </div>`;
            }

            document.getElementById('ppac-detail-body').innerHTML = body;
            detail.classList.add('open');
            applyPosition();
        }

        function stripHtml(html) {
            if (!html) return '';
            const div = document.createElement('div');
            div.innerHTML = html;
            return div.textContent || '';
        }

        function escHtml(s) {
            if (!s) return '';
            const div = document.createElement('div');
            div.textContent = s;
            return div.innerHTML;
        }

        function fmtDate(d) {
            if (!d) return 'N/A';
            return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        function debounce(fn, ms) {
            let timer;
            return function() { clearTimeout(timer); timer = setTimeout(fn, ms); };
        }

        // API
        enhancedUI = {
            updateData: function(data) {
                capturedIssues = data;
                document.getElementById('ppac-count').textContent = '(' + data.length + ')';
                updateStats();
                applyFilters();
            },
            destroy: function() {
                root.remove();
                styles.remove();
            }
        };

        if (capturedIssues.length > 0) {
            enhancedUI.updateData(capturedIssues);
        }
    }
})();
