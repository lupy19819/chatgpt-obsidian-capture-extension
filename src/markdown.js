(function () {
  function yamlString(value) {
    return JSON.stringify(String(value || ""));
  }

  function inferredRole(message, index) {
    if (["user", "assistant", "system"].includes(message.role)) return message.role;
    return index % 2 === 0 ? "user" : "assistant";
  }

  function headingFromText(text, fallback) {
    const cleaned = String(text || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`[\]()|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!cleaned) return fallback;
    return cleaned.length > 34 ? `${cleaned.slice(0, 34)}...` : cleaned;
  }

  function uniqueHeading(base, seen) {
    const key = base || "未命名片段";
    const count = seen.get(key) || 0;
    seen.set(key, count + 1);
    return count ? `${key} (${count + 1})` : key;
  }

  function groupMessages(messages) {
    const sections = [];
    let current = null;
    const seenHeadings = new Map();

    messages.forEach((message, index) => {
      const role = inferredRole(message, index);
      const normalizedMessage = { ...message, role };

      if (role === "user" || !current) {
        const fallback = `对话片段 ${sections.length + 1}`;
        const heading = uniqueHeading(headingFromText(message.text, fallback), seenHeadings);
        current = { heading, messages: [] };
        sections.push(current);
      }

      current.messages.push(normalizedMessage);
    });

    return sections;
  }

  function speakerLabel(role) {
    if (role === "user") return "你";
    if (role === "assistant") return "ChatGPT";
    if (role === "system") return "System";
    return "Unknown";
  }

  function renderMarkdown(conversation) {
    const lines = [
      "---",
      "source: chatgpt-business",
      "capture_method: chrome-extension",
      `conversation_id: ${yamlString(conversation.conversation_id)}`,
      `title: ${yamlString(conversation.title)}`,
      `url: ${yamlString(conversation.url)}`,
      `captured_at: ${yamlString(conversation.captured_at)}`,
      `updated_at: ${yamlString(conversation.updated_at || conversation.captured_at)}`,
      `message_count: ${conversation.messages.length}`,
      "tags:",
      "  - chatgpt/workspace",
      "  - ai-conversation",
      "---",
      "",
      `# ${conversation.title}`,
      "",
      "## Capture Info",
      "",
      "- Source: ChatGPT current page",
      `- Conversation ID: ${conversation.conversation_id}`,
      `- URL: ${conversation.url}`,
      `- Captured at: ${conversation.captured_at}`,
      `- Message count: ${conversation.messages.length}`,
      "",
      "> 提示：本工具只保存当前页面已加载的内容。长对话建议先滚动到顶部，确认历史消息已加载后再保存。",
      "",
      "## Messages",
      ""
    ];

    groupMessages(conversation.messages).forEach((section) => {
      lines.push(`### ${section.heading}`, "");
      section.messages.forEach((message) => {
        lines.push(`**${speakerLabel(message.role)}：**`, "");
        lines.push(message.text || "", "");
      });
    });

    return lines.join("\n").replace(/\n{4,}/g, "\n\n\n");
  }

  function toJsonExport(conversation) {
    return {
      source: "chatgpt-business",
      capture_method: "chrome-extension",
      conversation_id: conversation.conversation_id,
      title: conversation.title,
      url: conversation.url,
      captured_at: conversation.captured_at,
      message_count: conversation.messages.length,
      messages: conversation.messages.map((message) => ({
        message_key: message.message_key,
        role: message.role,
        index: message.index,
        text: message.text,
        content_hash: message.content_hash,
        source_timestamp: message.source_timestamp || null,
        captured_at: message.captured_at || conversation.captured_at
      }))
    };
  }

  function sanitizeFileNamePart(value, fallback) {
    const cleaned = String(value || fallback || "chatgpt-conversation")
      .replace(/[\\/:*?"<>|#%{}$!'@+`=]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90);
    return cleaned || fallback || "chatgpt-conversation";
  }

  function exportBaseName(conversation) {
    const day = conversation.captured_at.slice(0, 10);
    const title = sanitizeFileNamePart(conversation.title, "ChatGPT Conversation");
    const id = sanitizeFileNamePart(conversation.conversation_id, "current").slice(0, 48);
    return `${day} - ${title} - ${id}`;
  }

  window.ChatGPTCapture = {
    ...(window.ChatGPTCapture || {}),
    renderMarkdown,
    toJsonExport,
    exportBaseName
  };
})();
