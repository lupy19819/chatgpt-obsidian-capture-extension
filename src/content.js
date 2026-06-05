(function () {
  if (window.__ChatGPTCaptureContentReady) return;
  window.__ChatGPTCaptureContentReady = true;

  const api = window.ChatGPTCapture;

  async function captureConversation() {
    const conversation = api.extractConversation();
    conversation.messages = await api.enrichMessages(
      conversation.conversation_id,
      conversation.captured_at,
      conversation.messages
    );
    return conversation;
  }

  function hideBar() {
    document.getElementById("chatgpt-capture-bar")?.remove();
  }

  async function buildExportBundle() {
    const conversation = await captureConversation();
    const state = await api.updateConversationState(conversation, false);
    const baseName = api.exportBaseName(conversation);
    const files = {
      markdown: {
        filename: `${baseName}.md`,
        content: api.renderMarkdown(conversation),
        mimeType: "text/markdown;charset=utf-8"
      },
      json: {
        filename: `${baseName}.json`,
        content: JSON.stringify(api.toJsonExport(conversation), null, 2),
        mimeType: "application/json;charset=utf-8"
      }
    };

    return { conversation, state, files };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message?.type === "GET_LIGHT_STATUS") {
        const snapshot = api.getConversationSnapshot();
        const previous = await api.getConversationState(snapshot.conversation_id);
        const savedCount = previous?.savedMessageKeys?.length || previous?.savedMessageHashes?.length || 0;
        const unsavedCount = Math.max(0, snapshot.message_count - savedCount);
        const conversation = {
          title: snapshot.title,
          conversation_id: snapshot.conversation_id,
          url: snapshot.url,
          message_count: snapshot.message_count
        };
        const state = {
          ...(previous || {}),
          title: snapshot.title,
          url: snapshot.url,
          messageCount: snapshot.message_count,
          unsavedCount,
          dirty: unsavedCount > 0
        };
        chrome.runtime.sendMessage({ type: "SET_BADGE", count: unsavedCount });
        return { ok: true, conversation, state };
      }
      if (message?.type === "BUILD_EXPORT_BUNDLE") {
        const result = await buildExportBundle();
        return { ok: true, ...result };
      }
      if (message?.type === "MARK_SAVED_CURRENT") {
        const conversation = await captureConversation();
        const state = await api.updateConversationState(conversation, true);
        chrome.runtime.sendMessage({ type: "SET_BADGE", count: 0 });
        chrome.runtime.sendMessage({
          type: "ARCHIVE_UPDATED",
          conversationId: conversation.conversation_id
        }, () => {});
        hideBar();
        return { ok: true, conversation, state };
      }
      if (message?.type === "CLEAR_STATE") {
        const snapshot = api.getConversationSnapshot();
        await api.clearConversationState(snapshot.conversation_id);
        chrome.runtime.sendMessage({ type: "SET_BADGE", count: 0 });
        hideBar();
        return { ok: true };
      }
      return { ok: false, error: "未知操作" };
    })()
      .then(sendResponse)
      .catch((error) => {
        console.error("[ChatGPT Capture]", error);
        sendResponse({ ok: false, error: error.message || String(error) });
    });
    return true;
  });
})();
