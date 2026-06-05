(function () {
  if (window.__ChatGPTCaptureAutoWatcherReady) return;
  window.__ChatGPTCaptureAutoWatcherReady = true;

  const STORAGE_KEY = "conversations";
  const INITIAL_DELAY_MS = 12000;
  const POLL_INTERVAL_MS = 30000;
  const URL_WATCH_MS = 1000;
  let lastUrl = location.href;
  let lastSignature = "";
  let nextCheckAt = 0;
  let currentCycleMs = POLL_INTERVAL_MS;
  let running = false;
  let uiHiddenForUrl = "";
  let expanded = false;

  function isConversationPage() {
    return /^\/(?:c|chat)\/[^/?#]+/.test(location.pathname);
  }

  function getConversationId() {
    const match = location.pathname.match(/\/(?:c|chat)\/([^/?#]+)/);
    if (match) return match[1];
    return location.pathname.replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "current";
  }

  function isGenerating() {
    return Boolean(
      document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop"], button[aria-label*="停止"]')
    );
  }

  function countLoadedMessages() {
    const selectors = [
      '[data-testid^="conversation-turn-"]',
      '[data-message-author-role]',
      '[data-testid="user-message"]',
      '[data-testid="assistant-message"]',
      "main article"
    ];

    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector)).filter((node) => node.textContent.trim());
      if (nodes.length) return nodes.length;
    }
    return 0;
  }

  function getStorage(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => resolve(result || {}));
    });
  }

  function setBadge(count) {
    chrome.runtime.sendMessage({ type: "SET_BADGE", count }, () => {});
  }

  function getUi() {
    return document.getElementById("chatgpt-capture-lite-panel");
  }

  function removeUi() {
    getUi()?.remove();
  }

  function setProgress(progress) {
    const ring = getUi()?.querySelector('[data-role="ring"]');
    if (!ring) return;
    const degrees = Math.max(0, Math.min(360, progress * 360));
    ring.style.background = `conic-gradient(#0f766e ${degrees}deg, #d1d5db ${degrees}deg)`;
  }

  function updateProgressRing() {
    if (!isConversationPage()) {
      removeUi();
      return;
    }

    ensureUi();
    if (!nextCheckAt) {
      setProgress(0);
      return;
    }

    const elapsed = currentCycleMs - Math.max(0, nextCheckAt - Date.now());
    setProgress(elapsed / currentCycleMs);
  }

  function setStatus(text, tone) {
    const status = getUi()?.querySelector('[data-role="status"]');
    if (!status) return;
    status.textContent = text;
    status.dataset.tone = tone || "neutral";
    status.style.color = tone === "dirty" ? "#0f766e" : "#4b5563";
  }

  function clearUnsavedInfo() {
    lastSignature = "";
    setBadge(0);
    setStatus("已同步", "clean");
    setProgress(0);
    scheduleNextCheck();
  }

  function applyPanelMode(panel) {
    const expandedHeight = Math.max(420, Math.min(720, window.innerHeight - 96));
    panel.dataset.mode = expanded ? "expanded" : "compact";
    Object.assign(panel.style, {
      width: expanded ? "420px" : "230px",
      height: expanded ? `${expandedHeight}px` : "112px",
      padding: expanded ? "0" : "12px",
      overflow: "hidden",
      transition: "width 220ms ease, height 220ms ease, padding 220ms ease, box-shadow 220ms ease, transform 220ms ease, opacity 180ms ease"
    });

    const compact = panel.querySelector('[data-role="compact"]');
    const expandedView = panel.querySelector('[data-role="expanded"]');
    if (compact) {
      Object.assign(compact.style, {
        opacity: expanded ? "0" : "1",
        transform: expanded ? "scale(0.98)" : "scale(1)",
        pointerEvents: expanded ? "none" : "auto",
        position: expanded ? "absolute" : "relative",
        inset: expanded ? "0" : "auto",
        transition: "opacity 160ms ease, transform 220ms ease"
      });
    }
    if (expandedView) {
      Object.assign(expandedView.style, {
        opacity: expanded ? "1" : "0",
        transform: expanded ? "scale(1)" : "scale(0.985)",
        pointerEvents: expanded ? "auto" : "none",
        position: expanded ? "relative" : "absolute",
        inset: expanded ? "auto" : "0",
        height: "100%",
        transition: "opacity 180ms ease 80ms, transform 220ms ease"
      });
    }
  }

  function expandPanel() {
    expanded = true;
    const panel = ensureUi();
    if (!panel) return;
    const frame = panel.querySelector('[data-role="popup-frame"]');
    if (frame) {
      frame.src = chrome.runtime.getURL("src/popup.html?embedded=1");
    }
    applyPanelMode(panel);
  }

  function collapsePanel() {
    expanded = false;
    const panel = ensureUi();
    if (panel) applyPanelMode(panel);
  }

  function ensureUi() {
    if (!isConversationPage() || uiHiddenForUrl === location.href) return null;

    let panel = getUi();
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = "chatgpt-capture-lite-panel";
    Object.assign(panel.style, {
      position: "fixed",
      right: "18px",
      top: "112px",
      zIndex: "2147483647",
      width: "230px",
      padding: "12px",
      border: "1px solid rgba(15, 23, 42, 0.16)",
      borderRadius: "8px",
      background: "#ffffff",
      color: "#111827",
      boxShadow: "0 16px 36px rgba(15, 23, 42, 0.18)",
      font: '13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    });
    panel.innerHTML = `
      <div data-role="compact">
        <div style="display:flex;align-items:center;gap:10px;">
          <div data-role="ring" style="width:28px;height:28px;border-radius:999px;background:conic-gradient(#0f766e 0deg,#d1d5db 0deg);display:grid;place-items:center;flex:0 0 auto;">
            <div style="width:18px;height:18px;border-radius:999px;background:#fff;"></div>
          </div>
          <div style="min-width:0;flex:1 1 auto;">
            <div style="font-weight:700;">ChatGPT 归档</div>
            <div data-role="status" style="margin-top:2px;color:#4b5563;overflow-wrap:anywhere;">等待自动检查</div>
          </div>
          <button type="button" data-action="close" title="隐藏" style="width:26px;height:26px;border:0;background:transparent;color:#6b7280;cursor:pointer;font:18px/1 system-ui;">×</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button type="button" data-action="update" style="height:32px;flex:1;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;cursor:pointer;font:inherit;font-weight:600;">更新归档</button>
          <button type="button" data-action="check" title="立即检查" style="width:36px;height:32px;border:1px solid #d1d5db;border-radius:6px;background:#f9fafb;color:#111827;cursor:pointer;font:inherit;">↻</button>
        </div>
      </div>
      <div data-role="expanded">
        <button type="button" data-action="collapse" title="缩小" style="position:absolute;right:10px;top:10px;z-index:2;width:30px;height:30px;border:0;border-radius:6px;background:#f3f4f6;color:#4b5563;cursor:pointer;font:18px/1 system-ui;">–</button>
        <iframe data-role="popup-frame" title="ChatGPT 当前对话归档" allow="file-system-access" style="display:block;width:100%;height:100%;border:0;background:#fff;"></iframe>
      </div>
    `;
    panel.addEventListener("click", (event) => {
      const action = event.target?.dataset?.action;
      if (action === "close") {
        uiHiddenForUrl = location.href;
        removeUi();
      }
      if (action === "update") {
        expandPanel();
      }
      if (action === "check") {
        checkDirty({ force: true });
      }
      if (action === "collapse") {
        collapsePanel();
      }
    });
    document.documentElement.appendChild(panel);
    applyPanelMode(panel);
    return panel;
  }

  function scheduleNextCheck(delay = POLL_INTERVAL_MS) {
    currentCycleMs = delay;
    nextCheckAt = Date.now() + delay;
  }

  async function checkDirty(options = {}) {
    if (running || document.visibilityState !== "visible" || !isConversationPage()) return;
    if (isGenerating()) {
      setStatus("回复生成中，稍后检查", "neutral");
      scheduleNextCheck();
      return;
    }

    running = true;
    ensureUi();

    try {
      const conversationId = getConversationId();
      const messageCount = countLoadedMessages();
      const signature = `${conversationId}:${messageCount}:${location.href}`;
      if (!options.force && signature === lastSignature) {
        scheduleNextCheck();
        return;
      }
      lastSignature = signature;

      if (!messageCount) {
        setBadge(0);
        setStatus("等待对话加载", "neutral");
        scheduleNextCheck(8000);
        return;
      }

      const result = await getStorage([STORAGE_KEY]);
      const previous = result[STORAGE_KEY]?.[conversationId];
      const savedCount = previous?.savedMessageKeys?.length || previous?.savedMessageHashes?.length || 0;
      const unsavedCount = Math.max(0, messageCount - savedCount);
      setBadge(unsavedCount);

      if (unsavedCount > 0) {
        setStatus(`约 ${unsavedCount} 条未同步`, "dirty");
      } else {
        setStatus("已同步", "clean");
      }
      scheduleNextCheck();
    } finally {
      running = false;
    }
  }

  function handleUrlChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    lastSignature = "";
    uiHiddenForUrl = "";
    expanded = false;
    scheduleNextCheck(INITIAL_DELAY_MS);
    if (isConversationPage()) {
      const panel = ensureUi();
      if (panel) {
        const frame = panel.querySelector('[data-role="popup-frame"]');
        if (frame) frame.removeAttribute("src");
        applyPanelMode(panel);
      }
      setStatus("等待自动检查", "neutral");
    } else {
      removeUi();
      setBadge(0);
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "ARCHIVE_UPDATED") {
      if (!message.conversationId || message.conversationId === getConversationId()) {
        clearUnsavedInfo();
      }
      sendResponse({ ok: true });
      return false;
    }
    return false;
  });

  setInterval(() => {
    handleUrlChange();
    updateProgressRing();
    if (isConversationPage() && nextCheckAt && Date.now() >= nextCheckAt) {
      checkDirty();
    }
  }, URL_WATCH_MS);

  if (isConversationPage()) {
    ensureUi();
    scheduleNextCheck(INITIAL_DELAY_MS);
  }
})();
