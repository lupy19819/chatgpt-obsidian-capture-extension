(function () {
  const UI_NOISE_LINES = new Set([
    "copy",
    "copied",
    "edit",
    "regenerate",
    "share",
    "read aloud",
    "good response",
    "bad response"
  ]);

  function normalizeText(text) {
    return String(text || "")
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trimEnd())
      .filter((line) => !UI_NOISE_LINES.has(line.trim().toLowerCase()))
      .join("\n")
      .trim()
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n");
  }

  async function sha256(value) {
    const bytes = new TextEncoder().encode(String(value));
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  async function enrichMessages(conversationId, capturedAt, messages) {
    const safeConversationId = conversationId || "unknown";
    const enriched = [];

    for (const message of messages) {
      const normalized = normalizeText(message.text);
      const contentHash = await sha256(normalized);
      const messageKey = await sha256(`${safeConversationId}\n${message.role}\n${normalized}`);
      enriched.push({
        ...message,
        normalized_text: normalized,
        content_hash: contentHash,
        message_key: messageKey,
        captured_at: capturedAt
      });
    }

    return enriched;
  }

  window.ChatGPTCapture = {
    ...(window.ChatGPTCapture || {}),
    normalizeText,
    sha256,
    enrichMessages
  };
})();
