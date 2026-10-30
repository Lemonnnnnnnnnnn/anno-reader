/**
 * Injects a chapter-summary trigger button / card at the end of the
 * chapter body inside the EPUB iframe.
 *
 * The injected markup communicates with the parent window via postMessage:
 *
 *   iframe → parent:
 *     { type: 'summary-click', hasSummary: boolean }
 *     { type: 'summary-pref-change', language: 'auto'|'chinese'|'english' }
 *     { type: 'summary-copy', text: string }
 *
 *   parent → iframe:
 *     { type: 'summary-init', hasSummary: boolean, content?: string,
 *       language?: 'auto'|'chinese'|'english' }                 // after load / restore
 *     { type: 'summary-stream-start' }                          // begin streaming
 *     { type: 'summary-stream-chunk', text: string }            // accumulated text
 *     { type: 'summary-done', content: string }                 // final markdown
 *     { type: 'summary-error', message: string }
 *     { type: 'summary-copied', ok: boolean }                   // copy ack
 *
 * The card renders plain text while streaming (to avoid mid-stream markdown
 * glitches) and a lightweight markdown render once the stream completes.
 *
 * State is driven entirely by postMessage from the parent so the iframe is
 * never rebuilt when a summary is created/updated (preserving scroll position).
 */

// Unique class prefix to avoid clashing with EPUB CSS.
const STYLE = `
<style data-chapter-summary>
/* class display rules must not defeat the hidden attribute */
.chapter-summary-root [hidden] { display: none !important; }
.chapter-summary-root {
  margin: 3em 0 1em;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  color: inherit;
}
.chapter-summary-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  padding: 0.55em 1.2em;
  font-size: 0.95em;
  font-weight: 500;
  color: inherit;
  background: color-mix(in srgb, currentColor 10%, transparent);
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}
.chapter-summary-trigger:hover {
  background: color-mix(in srgb, currentColor 18%, transparent);
  border-color: color-mix(in srgb, currentColor 40%, transparent);
}
.chapter-summary-card {
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 12px;
  padding: 1em 1.2em;
  background: color-mix(in srgb, currentColor 6%, transparent);
  box-shadow: 0 1px 3px color-mix(in srgb, currentColor 8%, transparent);
}
.chapter-summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6em;
  margin-bottom: 0.6em;
}
.chapter-summary-header-left {
  display: inline-flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
}
.chapter-summary-title {
  font-size: 0.8em;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.7;
  white-space: nowrap;
}
.chapter-summary-status {
  font-size: 0.8em;
  opacity: 0.6;
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  white-space: nowrap;
}
.chapter-summary-header-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  margin-left: auto;
}
.chapter-summary-lang {
  font-size: 0.78em;
  font-family: inherit;
  color: inherit;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 8px;
  padding: 0.15em 0.3em;
  cursor: pointer;
}
.chapter-summary-lang:disabled {
  opacity: 0.5;
  cursor: default;
}
.chapter-summary-lang option { color: initial; background: initial; }
.chapter-summary-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6em;
  height: 1.6em;
  font-size: 0.8em;
  color: inherit;
  background: transparent;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 0.15s ease, background 0.15s ease;
}
.chapter-summary-close:hover { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent); }
.chapter-summary-content {
  line-height: 1.7;
  font-size: 0.98em;
}
.chapter-summary-content.streaming {
  white-space: pre-wrap;
  word-break: break-word;
}
.chapter-summary-content h2,
.chapter-summary-content h3,
.chapter-summary-content h4,
.chapter-summary-content h5 {
  margin: 0.8em 0 0.3em;
  line-height: 1.3;
}
.chapter-summary-content p { margin: 0.5em 0; }
.chapter-summary-content p:first-child { margin-top: 0; }
.chapter-summary-content ul,
.chapter-summary-content ol { margin: 0.4em 0.4em 0.4em 1.4em; padding: 0; }
.chapter-summary-content li { margin: 0.2em 0; }
.chapter-summary-content li::marker { opacity: 0.7; }
.chapter-summary-content blockquote {
  margin: 0.6em 0;
  padding: 0.1em 0 0.1em 0.8em;
  border-left: 3px solid color-mix(in srgb, currentColor 30%, transparent);
  opacity: 0.85;
}
.chapter-summary-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
  background: color-mix(in srgb, currentColor 10%, transparent);
  border-radius: 4px;
  padding: 0.1em 0.3em;
}
.chapter-summary-content pre {
  overflow-x: auto;
  padding: 0.6em;
  background: color-mix(in srgb, currentColor 8%, transparent);
  border-radius: 8px;
}
.chapter-summary-content pre code { background: transparent; padding: 0; }
.chapter-summary-content hr {
  border: none;
  border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  margin: 0.8em 0;
}
.chapter-summary-footer {
  margin-top: 0.8em;
  display: flex;
  justify-content: flex-end;
  gap: 0.5em;
}
.chapter-summary-action,
.chapter-summary-copy {
  font-size: 0.82em;
  padding: 0.35em 0.9em;
  color: inherit;
  background: transparent;
  border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.15s ease;
}
.chapter-summary-action:hover,
.chapter-summary-copy:hover {
  background: color-mix(in srgb, currentColor 12%, transparent);
}
.chapter-summary-error {
  color: #c0392b;
  font-size: 0.9em;
}
/* Loading spinner */
.chapter-summary-spinner {
  width: 0.85em;
  height: 0.85em;
  border: 1.5px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  display: inline-block;
  animation: chapter-summary-spin 0.7s linear infinite;
}
@keyframes chapter-summary-spin {
  to { transform: rotate(360deg); }
}
</style>`;

const SCRIPT = `
<script data-chapter-summary>
(function() {
  var HAS_SUMMARY = false;
  var LAST_MD = '';
  var COPY_FEEDBACK_TIMER = null;

  var LANG_LABELS = { auto: 'Auto', chinese: 'Chinese', english: 'English' };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  function inline(s) {
    return s
      .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*([^*]+)\\*/g, '<em>$1</em>');
  }
  function markdownToHtml(md) {
    var lines = escapeHtml(md).split('\\n');
    var html = [];
    var inUl = false, inOl = false, inQuote = false;
    function closeLists() {
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (inOl) { html.push('</ol>'); inOl = false; }
    }
    function closeQuote() {
      if (inQuote) { html.push('</blockquote>'); inQuote = false; }
    }
    function closeAll() { closeLists(); closeQuote(); }
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var h = line.match(/^(#{1,4})\\s+(.*)$/);
      if (h) {
        closeAll();
        var lvl = Math.min(4, h[1].length) + 1;
        html.push('<h' + lvl + '>' + inline(h[2]) + '</h' + lvl + '>');
        continue;
      }
      var quote = line.match(/^&gt;\\s?(.*)$/);
      if (quote) {
        closeLists();
        if (!inQuote) { html.push('<blockquote>'); inQuote = true; }
        if (quote[1]) { html.push('<p>' + inline(quote[1]) + '</p>'); }
        continue;
      }
      var hr = line.match(/^\\s*(---+|\\*\\*\\*+)\\s*$/);
      if (hr) {
        closeAll();
        html.push('<hr>');
        continue;
      }
      var ul = line.match(/^\\s*[-*]\\s+(.*)$/);
      if (ul) {
        closeQuote();
        if (!inUl) { closeLists(); html.push('<ul>'); inUl = true; }
        html.push('<li>' + inline(ul[1]) + '</li>');
        continue;
      }
      var ol = line.match(/^\\s*\\d+\\.\\s+(.*)$/);
      if (ol) {
        closeQuote();
        if (!inOl) { closeLists(); html.push('<ol>'); inOl = true; }
        html.push('<li>' + inline(ol[1]) + '</li>');
        continue;
      }
      if (line.trim() === '') { closeAll(); continue; }
      closeAll();
      html.push('<p>' + inline(line) + '</p>');
    }
    closeAll();
    return html.join('');
  }

  var root = document.querySelector('.chapter-summary-root');
  if (!root) return;
  var trigger = root.querySelector('.chapter-summary-trigger');
  var card = root.querySelector('.chapter-summary-card');
  var statusEl = root.querySelector('.chapter-summary-status');
  var contentEl = root.querySelector('.chapter-summary-content');
  var langSelect = root.querySelector('.chapter-summary-lang');
  var closeBtn = root.querySelector('.chapter-summary-close');
  var copyBtn = root.querySelector('.chapter-summary-copy');
  var actionBtn = root.querySelector('.chapter-summary-action');
  var errorEl = root.querySelector('.chapter-summary-error');

  function showButton() {
    trigger.hidden = false;
    card.hidden = true;
    trigger.textContent = HAS_SUMMARY ? '✓ View summary' : '✦ Summarize chapter';
  }
  function showCard() {
    trigger.hidden = true;
    card.hidden = false;
  }
  function setCopying(feedback) {
    if (COPY_FEEDBACK_TIMER) clearTimeout(COPY_FEEDBACK_TIMER);
    copyBtn.textContent = feedback;
    COPY_FEEDBACK_TIMER = setTimeout(function () {
      copyBtn.textContent = 'Copy';
      COPY_FEEDBACK_TIMER = null;
    }, 1500);
  }
  function renderDone(md) {
    contentEl.classList.remove('streaming');
    contentEl.innerHTML = markdownToHtml(md);
    statusEl.innerHTML = '';
    actionBtn.hidden = false;
    actionBtn.textContent = 'Regenerate';
    copyBtn.hidden = false;
    langSelect.disabled = false;
    errorEl.textContent = '';
  }
  function startStreaming() {
    showCard();
    contentEl.classList.add('streaming');
    contentEl.textContent = '';
    statusEl.innerHTML = '<span class="chapter-summary-spinner"></span> Summarizing…';
    actionBtn.hidden = true;
    copyBtn.hidden = true;
    langSelect.disabled = true;
    errorEl.textContent = '';
  }

  // --- initial state: assume no summary until the parent says otherwise ---
  showButton();

  function notifyParent() {
    window.parent.postMessage({ type: 'summary-click', hasSummary: HAS_SUMMARY }, '*');
  }

  trigger.addEventListener('click', notifyParent);
  actionBtn.addEventListener('click', notifyParent);

  langSelect.addEventListener('change', function () {
    window.parent.postMessage({
      type: 'summary-pref-change',
      language: langSelect.value,
    }, '*');
  });

  closeBtn.addEventListener('click', function () {
    showButton();
  });

  copyBtn.addEventListener('click', function () {
    if (!LAST_MD) return;
    window.parent.postMessage({ type: 'summary-copy', text: LAST_MD }, '*');
  });

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    switch (data.type) {
      case 'summary-init':
        HAS_SUMMARY = !!data.hasSummary;
        if (data.language && LANG_LABELS[data.language]) {
          langSelect.value = data.language;
        }
        if (HAS_SUMMARY && data.content) {
          showCard();
          renderDone(data.content);
        } else {
          showButton();
        }
        break;
      case 'summary-stream-start':
        startStreaming();
        break;
      case 'summary-stream-chunk':
        if (!contentEl.classList.contains('streaming')) {
          startStreaming();
        }
        contentEl.textContent = data.text || '';
        break;
      case 'summary-done':
        HAS_SUMMARY = true;
        LAST_MD = data.content || '';
        renderDone(data.content || '');
        break;
      case 'summary-error':
        statusEl.innerHTML = '';
        actionBtn.hidden = false;
        actionBtn.textContent = 'Retry';
        copyBtn.hidden = true;
        langSelect.disabled = false;
        errorEl.textContent = data.message || 'Failed to generate summary';
        break;
      case 'summary-copied':
        setCopying(data.ok === false ? 'Copy failed' : 'Copied ✓');
        break;
    }
  });
})();
</script>`;

// The markup — visibility/state is driven entirely by postMessage from the parent.
const MARKUP = `
<div class="chapter-summary-root">
  <button type="button" class="chapter-summary-trigger"></button>
  <div class="chapter-summary-card" hidden>
    <div class="chapter-summary-header">
      <span class="chapter-summary-header-left">
        <span class="chapter-summary-title">✦ Chapter Summary</span>
        <span class="chapter-summary-status"></span>
      </span>
      <span class="chapter-summary-header-actions">
        <select class="chapter-summary-lang" title="Summary language (switching regenerates)">
          <option value="auto">Auto</option>
          <option value="chinese">Chinese</option>
          <option value="english">English</option>
        </select>
        <button type="button" class="chapter-summary-close" title="Collapse">✕</button>
      </span>
    </div>
    <div class="chapter-summary-content"></div>
    <div class="chapter-summary-error"></div>
    <div class="chapter-summary-footer">
      <button type="button" class="chapter-summary-copy" hidden>Copy</button>
      <button type="button" class="chapter-summary-action" hidden></button>
    </div>
  </div>
</div>`;

/**
 * Inject the chapter-summary trigger/card into an srcdoc HTML string.
 * Splices the fragment just before the closing `</body>` tag.
 *
 * The fragment is stateless w.r.t. summary content: initial visibility shows
 * the trigger button, and the parent drives the real state via a
 * `summary-init` postMessage after the iframe loads. This keeps the iframe
 * srcdoc stable across summary create/update so scroll position is preserved.
 */
export function injectSummaryButton(srcdoc: string): string {
  const fragment = STYLE + MARKUP + SCRIPT;
  const closingBody = "</body>";
  const idx = srcdoc.lastIndexOf(closingBody);
  if (idx === -1) {
    return srcdoc + fragment;
  }
  return srcdoc.slice(0, idx) + fragment + srcdoc.slice(idx);
}
