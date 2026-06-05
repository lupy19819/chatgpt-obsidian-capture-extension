function setBadge(tabId, count) {
  const text = count > 0 ? `+${Math.min(count, 99)}` : "";
  chrome.action.setBadgeText({ tabId, text });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#0f766e" });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SET_BADGE") {
    setBadge(sender.tab?.id, Number(message.count || 0));
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === "OPEN_POPUP") {
    chrome.action.openPopup(() => {
      const error = chrome.runtime.lastError;
      if (error) sendResponse({ ok: false, error: error.message });
      else sendResponse({ ok: true });
    });
    return true;
  }

  if (message?.type === "ARCHIVE_UPDATED") {
    setBadge(sender.tab?.id, 0);
    if (sender.tab?.id) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "ARCHIVE_UPDATED",
        conversationId: message.conversationId || ""
      }, () => {});
    }
    sendResponse({ ok: true });
    return false;
  }

  return false;
});
