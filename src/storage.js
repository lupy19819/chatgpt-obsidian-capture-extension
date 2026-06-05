(function () {
  const STORAGE_KEY = "conversations";

  function getStorage(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve(result);
      });
    });
  }

  function setStorage(value) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(value, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message));
        else resolve();
      });
    });
  }

  async function getAllConversations() {
    const result = await getStorage([STORAGE_KEY]);
    return result[STORAGE_KEY] || {};
  }

  async function getConversationState(conversationId) {
    const conversations = await getAllConversations();
    return conversations[conversationId] || null;
  }

  function computeState(previous, conversation, markSaved) {
    const now = new Date().toISOString();
    const currentMessageKeys = conversation.messages.map((message) => message.message_key);
    const currentMessageHashes = conversation.messages.map((message) => message.content_hash);
    const savedMessageKeys = markSaved
      ? currentMessageKeys
      : previous?.savedMessageKeys || previous?.savedMessageHashes || [];
    const savedSet = new Set(savedMessageKeys);
    const unsavedMessageKeys = currentMessageKeys.filter((key) => !savedSet.has(key));

    return {
      title: conversation.title,
      url: conversation.url,
      firstSeenAt: previous?.firstSeenAt || now,
      lastSeenAt: now,
      lastSavedAt: markSaved ? now : previous?.lastSavedAt || null,
      savedMessageHashes: markSaved ? currentMessageHashes : previous?.savedMessageHashes || [],
      savedMessageKeys,
      currentMessageHashes,
      currentMessageKeys,
      unsavedMessageKeys,
      unsavedCount: unsavedMessageKeys.length,
      messageCount: conversation.messages.length,
      dirty: unsavedMessageKeys.length > 0
    };
  }

  async function updateConversationState(conversation, markSaved) {
    const conversations = await getAllConversations();
    const previous = conversations[conversation.conversation_id] || null;
    conversations[conversation.conversation_id] = computeState(previous, conversation, markSaved);
    await setStorage({ [STORAGE_KEY]: conversations });
    return conversations[conversation.conversation_id];
  }

  async function clearConversationState(conversationId) {
    const conversations = await getAllConversations();
    delete conversations[conversationId];
    await setStorage({ [STORAGE_KEY]: conversations });
  }

  window.ChatGPTCapture = {
    ...(window.ChatGPTCapture || {}),
    getConversationState,
    updateConversationState,
    clearConversationState
  };
})();
