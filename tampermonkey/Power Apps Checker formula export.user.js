// ==UserScript==
// @name         Power Apps Checker formula export
// @namespace    https://jukkan.com
// @version      0.6
// @description  Intercepts Power Apps Studio authoring API traffic. Extracts formula errors (RuleErrorEvent), formula scripts, performance findings, and accessibility results. One-click export for AI coding agents.
// @author       Jukka Niiranen
// @match        https://make.powerapps.com/*
// @match        https://*.gateway.prod.island.powerapps.com/*
// @match        https://*.gateway.*.island.powerapps.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  const state = {
    formulaDiagnostics: [],   // normalized from RuleErrorEvent
    formulaScripts: {},       // prop ID → script text (only flagged ones)
    accessibility: [],        // from getaccessibilityerrorsasync
    performance: [],          // from getappcheckerperformanceresponsesasync
    rawEventCount: 0,
    lastCaptureTime: null,
  };

  const SEVERITY_MAP = { 0: 'info', 1: 'info', 2: 'warning', 3: 'warning', 4: 'error', 5: 'error' };
  const TAG = '[PA-Checker]';

  // ── 1. Intercept fetch() ───────────────────────────────────────────
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (url.includes('/api/v2/invoke') || url.includes('/api/v1/invoke')) {
        const clone = response.clone();
        clone.json().then(processPayload).catch(() => {});
      }
    } catch (_) {}

    return response;
  };

  // ── 2. Also intercept XHR ─────────────────────────────────────────
  const origXHROpen = XMLHttpRequest.prototype.open;
  const origXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this._paUrl = url;
    return origXHROpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this._paUrl && (this._paUrl.includes('/api/v2/invoke') || this._paUrl.includes('/api/v1/invoke'))) {
      this.addEventListener('load', function () {
        try { processPayload(JSON.parse(this.responseText)); } catch (_) {}
      });
    }
    return origXHRSend.call(this, body);
  };

  // ── 3. Process the full invoke response ───────────────────────────
  function processPayload(data) {
    if (!Array.isArray(data)) return;

    let foundAnything = false;

    // ── Walk for RuleErrorEvent objects ──
    const events = [];
    function walkEvents(obj) {
      if (!obj || typeof obj !== 'object') return;
      if (Array.isArray(obj)) { obj.forEach(walkEvents); return; }
      if (obj.controlName && obj.errors && obj.propertyName) {
        events.push(obj);
        return;
      }
      Object.values(obj).forEach(walkEvents);
    }
    walkEvents(data);

    if (events.length > 0) {
      state.rawEventCount = events.length;
      state.formulaDiagnostics = normalizeDiagnostics(events);
      foundAnything = true;
      console.log(`${TAG} ✅ ${events.length} RuleErrorEvent(s) → ${state.formulaDiagnostics.length} diagnostics`);
    }

    // ── Flat items: prop:*:script and prop:*:hasErrorsOrWarnings ──
    const scripts = {};
    const flagged = new Set();

    for (const item of data) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      for (const [key, value] of Object.entries(item)) {
        if (key.includes(':script') && typeof value === 'string') {
          const parts = key.split(':');
          if (parts.length >= 2) scripts[parts[1]] = value;
        } else if (key.includes(':hasErrorsOrWarnings') && value === true) {
          const parts = key.split(':');
          if (parts.length >= 2) flagged.add(parts[1]);
        }
      }
    }

    const newScripts = {};
    for (const pid of flagged) {
      if (scripts[pid]) newScripts[pid] = scripts[pid];
    }
    if (Object.keys(newScripts).length > 0) {
      state.formulaScripts = newScripts;
      foundAnything = true;
      console.log(`${TAG} ✅ ${Object.keys(newScripts).length} formula script(s) with errors`);
    }

    // ── Named checker calls (accessibility, performance) ──
    for (const item of data) {
      if (!item?.dresult?.f || !Array.isArray(item.dresult.f) || item.dresult.f.length === 0) continue;
      const first = item.dresult.f[0];
      if (first.accessibilityTypes !== undefined) {
        state.accessibility = item.dresult.f;
        foundAnything = true;
        console.log(`${TAG} ✅ ${item.dresult.f.length} accessibility issue(s)`);
      } else if (first.ruleName !== undefined) {
        state.performance = item.dresult.f;
        foundAnything = true;
        console.log(`${TAG} ✅ ${item.dresult.f.length} performance issue(s)`);
      }
    }

    if (foundAnything) {
      state.lastCaptureTime = new Date().toISOString();
      showUI();
    }
  }

  // ── 4. Normalize RuleErrorEvent → flat diagnostics ────────────────
  function unwrapList(val) {
    if (Array.isArray(val)) return val;
    if (val && typeof val === 'object' && Array.isArray(val.f)) return val.f;
    return [];
  }

  function normalizeDiagnostics(events) {
    const out = [];
    for (const ev of events) {
      const controlName = ev.controlName || '?';
      const controlId = String(ev.controlId || '');
      const propertyName = ev.propertyName || '';

      for (const err of unwrapList(ev.errors)) {
        if (!err || typeof err !== 'object') continue;
        const sev = err.severity ?? 2;
        const span = err.textSpan;
        out.push({
          controlName, controlId, propertyName,
          severity: SEVERITY_MAP[sev] || 'unknown',
          severityNum: sev,
          messageKey: err.messageKey || '',
          shortMessage: err.shortMessage || '',
          longMessage: err.longMessage || '',
          textSpan: span ? { min: span.min, lim: span.lim } : null,
          howToFixMessages: unwrapList(err.howToFixMessages).filter(m => typeof m === 'string'),
          links: unwrapList(err.links).filter(l => l && l.url).map(l => ({ title: l.title || '', url: l.url })),
        });
      }
    }
    return out;
  }

  // ── 5. Format: Copilot ────────────────────────────────────────────
  function formatCopilot() {
    const d = state.formulaDiagnostics;
    const s = state.formulaScripts;
    const lines = [
      'Power Apps Studio checker results for the current canvas app.',
      'Please fix the corresponding Power Fx formulas in the pa.yaml source.',
      '',
    ];

    const errors = d.filter(x => x.severity === 'error');
    if (errors.length) {
      lines.push('ERRORS (must fix):');
      for (const e of errors) {
        lines.push(`  ${e.controlName}.${e.propertyName}: ${e.shortMessage}`);
        if (e.howToFixMessages.length) lines.push(`    Fix: ${e.howToFixMessages[0]}`);
        if (e.textSpan) lines.push(`    At chars ${e.textSpan.min}-${e.textSpan.lim}`);
      }
      lines.push('');
    }

    const warnings = d.filter(x => x.severity === 'warning');
    if (warnings.length) {
      const byProp = {};
      for (const w of warnings) {
        const k = `${w.controlName}.${w.propertyName}`;
        (byProp[k] ??= []).push(w);
      }
      lines.push('WARNINGS:');
      for (const [k, items] of Object.entries(byProp)) {
        if (items.length === 1) {
          lines.push(`  ${k}: ${items[0].shortMessage}`);
        } else {
          lines.push(`  ${k}: ${items.length} issues`);
          for (const w of items) {
            const msg = w.shortMessage.length > 100 ? w.shortMessage.slice(0, 97) + '...' : w.shortMessage;
            lines.push(`    - ${msg}`);
          }
        }
      }
      lines.push('');
    }

    if (Object.keys(s).length) {
      lines.push('FORMULAS WITH ERRORS (from Studio):');
      for (const [pid, script] of Object.entries(s)) {
        const txt = script.length > 600 ? script.slice(0, 600) + '\n... (truncated)' : script;
        lines.push(`  prop:${pid}:`);
        for (const ln of txt.split('\n')) lines.push(`    ${ln}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // ── 6. Format: Markdown ───────────────────────────────────────────
  function formatMarkdown() {
    const d = state.formulaDiagnostics;
    const s = state.formulaScripts;
    const lines = [
      '# Power Apps Formula Checker Results',
      '',
      `Captured: ${state.lastCaptureTime}`,
      '',
    ];

    const errors = d.filter(x => x.severity === 'error');
    const warnings = d.filter(x => x.severity === 'warning');
    lines.push(`**${d.length} diagnostics:** ${errors.length} errors, ${warnings.length} warnings`);
    if (Object.keys(s).length) lines.push(`**${Object.keys(s).length} formula scripts** with errors/warnings captured`);
    lines.push('');

    if (errors.length) {
      lines.push('## Errors', '');
      for (const e of errors) {
        lines.push(`### \`${e.controlName}.${e.propertyName}\``, '');
        lines.push(`**${e.shortMessage}**`);
        if (e.longMessage) lines.push(`> ${e.longMessage}`);
        if (e.messageKey) lines.push(`Key: \`${e.messageKey}\``);
        if (e.textSpan) lines.push(`Span: chars ${e.textSpan.min}–${e.textSpan.lim}`);
        for (const fix of e.howToFixMessages) lines.push(`Fix: ${fix}`);
        for (const link of e.links) lines.push(`Ref: [${link.title || 'docs'}](${link.url})`);
        lines.push('');
      }
    }

    if (warnings.length) {
      lines.push('## Warnings', '');
      const byCtrl = {};
      for (const w of warnings) {
        const k = `${w.controlName}.${w.propertyName}`;
        (byCtrl[k] ??= []).push(w);
      }
      for (const [k, items] of Object.entries(byCtrl)) {
        lines.push(`### \`${k}\` (${items.length} warnings)`, '');
        for (const w of items) {
          lines.push(`- ${w.shortMessage}`);
          if (w.messageKey) lines.push(`  Key: \`${w.messageKey}\``);
        }
        lines.push('');
      }
    }

    // Performance
    if (state.performance.length) {
      lines.push('## Performance & Best Practices', '');
      const byRule = {};
      for (const p of state.performance) {
        const r = p.ruleName || 'Unknown';
        (byRule[r] ??= []).push(p);
      }
      for (const [rule, items] of Object.entries(byRule)) {
        lines.push(`### ${rule} (${items.length})`, '');
        for (const p of items) {
          const entity = p.entityName || p.entity || '?';
          const prop = p.propertyName || '';
          lines.push(`- **${entity}**${prop ? ' → `' + prop + '`' : ''}: ${p.longMessage || p.shortMessage}`);
        }
        lines.push('');
      }
    }

    // Accessibility (compact)
    if (state.accessibility.length) {
      lines.push(`## Accessibility (${state.accessibility.length} issues)`, '');
      const byType = {};
      for (const a of state.accessibility) {
        const k = a.shortMessage;
        if (!byType[k]) byType[k] = { controls: [], fix: '' };
        byType[k].controls.push(a.entity);
        byType[k].fix = unwrapList(a.howToFixMessages)[0] || '';
      }
      for (const [msg, info] of Object.entries(byType)) {
        const preview = info.controls.slice(0, 6).join(', ');
        const more = info.controls.length > 6 ? ` +${info.controls.length - 6} more` : '';
        lines.push(`- **${msg}** (${info.controls.length}): ${preview}${more}`);
        if (info.fix) lines.push(`  Fix: ${info.fix}`);
      }
      lines.push('');
    }

    // Formula scripts
    if (Object.keys(s).length) {
      lines.push('## Formula Scripts with Errors/Warnings', '');
      for (const [pid, script] of Object.entries(s)) {
        const preview = script.length > 800 ? script.slice(0, 800) + '\n... (truncated)' : script;
        lines.push(`### prop:${pid}`, '', '```powerfx', preview, '```', '');
      }
    }

    return lines.join('\n');
  }

  // ── 7. Format: JSON ───────────────────────────────────────────────
  function formatJSON() {
    return JSON.stringify({
      capturedAt: state.lastCaptureTime,
      summary: {
        formulaDiagnostics: state.formulaDiagnostics.length,
        errors: state.formulaDiagnostics.filter(x => x.severity === 'error').length,
        warnings: state.formulaDiagnostics.filter(x => x.severity === 'warning').length,
        formulaScripts: Object.keys(state.formulaScripts).length,
        performanceIssues: state.performance.length,
        accessibilityIssues: state.accessibility.length,
      },
      formulaDiagnostics: state.formulaDiagnostics,
      formulaScripts: state.formulaScripts,
      performance: state.performance.map(p => ({
        rule: p.ruleName, entity: p.entityName || p.entity,
        property: p.propertyName, message: p.longMessage || p.shortMessage,
      })),
    }, null, 2);
  }

  // ── 8. Summary line for the floating UI ───────────────────────────
  function summaryText() {
    const e = state.formulaDiagnostics.filter(x => x.severity === 'error').length;
    const w = state.formulaDiagnostics.filter(x => x.severity === 'warning').length;
    const s = Object.keys(state.formulaScripts).length;
    const parts = [];
    if (e) parts.push(`${e} err`);
    if (w) parts.push(`${w} warn`);
    if (s) parts.push(`${s} scripts`);
    if (state.performance.length) parts.push(`${state.performance.length} perf`);
    if (state.accessibility.length) parts.push(`${state.accessibility.length} a11y`);
    return parts.length ? parts.join(' · ') : 'No issues';
  }

  // ── 9. Floating UI ────────────────────────────────────────────────
  let uiEl = null;

  function showUI() {
    if (uiEl) {
      uiEl.querySelector('.pa-status').textContent = `✅ ${summaryText()}`;
      return;
    }

    uiEl = document.createElement('div');
    uiEl.id = 'pa-checker-export';
    uiEl.innerHTML = `
      <style>
        #pa-checker-export {
          position: fixed; bottom: 12px; right: 12px; z-index: 999999;
          background: #1e1e1e; border: 1px solid #333; border-radius: 8px;
          padding: 8px 10px; font-family: 'Segoe UI', system-ui, sans-serif;
          box-shadow: 0 4px 16px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 6px;
          max-width: 320px;
        }
        #pa-checker-export .pa-status {
          font-size: 11px; color: #ccc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        #pa-checker-export .pa-row { display: flex; gap: 4px; flex-wrap: wrap; }
        #pa-checker-export button {
          padding: 5px 10px; border: none; border-radius: 4px;
          font-size: 11px; font-weight: 600; cursor: pointer; color: #fff;
          transition: opacity 0.15s;
        }
        #pa-checker-export button:hover { opacity: 0.85; }
        .pa-copilot { background: #0078d4; }
        .pa-md      { background: #5c2d91; }
        .pa-json    { background: #107c10; }
        .pa-save    { background: #555; }
        .pa-close   { background: transparent; color: #888; padding: 2px 6px; font-size: 14px;
                      position: absolute; top: 4px; right: 6px; }
        .pa-close:hover { color: #fff; }
      </style>
      <button class="pa-close" title="Dismiss">×</button>
      <div class="pa-status">✅ ${summaryText()}</div>
      <div class="pa-row">
        <button class="pa-copilot" title="Copy prompt-ready text for Copilot / Claude Code">📋 Copilot</button>
        <button class="pa-md" title="Copy full Markdown report">📋 Markdown</button>
        <button class="pa-json" title="Copy structured JSON">📋 JSON</button>
        <button class="pa-save" title="Download sanitized JSON file">💾 Save</button>
      </div>
    `;
    document.body.appendChild(uiEl);

    uiEl.querySelector('.pa-copilot').addEventListener('click', () => copyToClipboard(formatCopilot(), 'Copilot'));
    uiEl.querySelector('.pa-md').addEventListener('click', () => copyToClipboard(formatMarkdown(), 'Markdown'));
    uiEl.querySelector('.pa-json').addEventListener('click', () => copyToClipboard(formatJSON(), 'JSON'));
    uiEl.querySelector('.pa-save').addEventListener('click', saveToFile);
    uiEl.querySelector('.pa-close').addEventListener('click', () => { uiEl.remove(); uiEl = null; });
  }

  function copyToClipboard(text, label) {
    navigator.clipboard.writeText(text).then(() => flash(`✅ ${label} copied!`));
  }

  function flash(msg) {
    const el = uiEl?.querySelector('.pa-status');
    if (!el) return;
    el.textContent = msg;
    setTimeout(() => { el.textContent = `✅ ${summaryText()}`; }, 2500);
  }

  function saveToFile() {
    const json = formatJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pa-checker-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash('✅ Saved!');
  }

  // ── 10. Console API ───────────────────────────────────────────────
  window.paChecker = {
    state,
    copilot:  () => { const t = formatCopilot();  console.log(t); return t; },
    markdown: () => { const t = formatMarkdown(); console.log(t); return t; },
    json:     () => formatJSON(),
    show:     showUI,
    load:     function (jsonArrayOrString) {
      const parsed = typeof jsonArrayOrString === 'string' ? JSON.parse(jsonArrayOrString) : jsonArrayOrString;
      processPayload(parsed);
    },
  };

  console.log(`${TAG} v0.5 loaded. Waiting for Studio API calls...`);
  console.log(`${TAG} Console: paChecker.copilot() | paChecker.markdown() | paChecker.load(json)`);
})();