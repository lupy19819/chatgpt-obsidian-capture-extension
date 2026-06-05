(function () {
  function isSupportedChatGPTPage() {
    return /^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(location.href);
  }

  function getConversationId() {
    const match = location.pathname.match(/\/(?:c|chat)\/([^/?#]+)/);
    if (match) return match[1];
    return location.pathname.replace(/^\/+/, "").replace(/[^a-zA-Z0-9_-]+/g, "-") || "current";
  }

  function cleanTitle(title) {
    return String(title || "")
      .replace(/\s*[-|]\s*ChatGPT.*$/i, "")
      .replace(/^ChatGPT\s*[-|]\s*/i, "")
      .trim();
  }

  function getTitle() {
    const candidates = [
      document.querySelector("main h1"),
      document.querySelector("title"),
      document.querySelector('meta[property="og:title"]')
    ];
    for (const node of candidates) {
      const value = node?.content || node?.innerText || node?.textContent;
      const title = cleanTitle(value);
      if (title && title.toLowerCase() !== "chatgpt") return title;
    }
    return "ChatGPT Conversation";
  }

  function roleFromNode(node) {
    const explicitRole = node.getAttribute("data-message-author-role")
      || node.querySelector("[data-message-author-role]")?.getAttribute("data-message-author-role");
    if (explicitRole) return explicitRole;

    const testId = node.getAttribute("data-testid") || "";
    if (/user-message/i.test(testId)) return "user";
    if (/assistant-message/i.test(testId)) return "assistant";

    const childTestId = Array.from(node.querySelectorAll("[data-testid]"))
      .map((child) => child.getAttribute("data-testid") || "")
      .join(" ");
    if (/user-message/i.test(childTestId)) return "user";
    if (/assistant-message/i.test(childTestId)) return "assistant";

    const aria = `${node.getAttribute("aria-label") || ""} ${node.textContent.slice(0, 120)}`;
    if (/you said|user/i.test(aria)) return "user";
    if (/chatgpt said|assistant/i.test(aria)) return "assistant";

    const author = node.querySelector('[data-testid*="author"], [class*="author"]')?.textContent || "";
    if (/you|user/i.test(author)) return "user";
    if (/chatgpt|assistant/i.test(author)) return "assistant";

    return "unknown";
  }

  function tableToMarkdown(table) {
    const rows = Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.querySelectorAll("th,td")).map((cell) =>
        cell.innerText.replace(/\s+/g, " ").trim().replace(/\|/g, "\\|")
      )
    ).filter((row) => row.length);

    if (!rows.length) return "";
    const widths = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const normalized = rows.map((row) => [...row, ...Array(Math.max(0, widths - row.length)).fill("")]);
    const header = normalized[0];
    const separator = header.map(() => "---");
    const body = normalized.slice(1);
    return [header, separator, ...body].map((row) => `| ${row.join(" | ")} |`).join("\n");
  }

  function textFromNode(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll("button, svg, style, script, textarea, input").forEach((el) => el.remove());

    clone.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code") || pre;
      const language = code.className.match(/language-([\w-]+)/)?.[1] || "";
      const block = document.createElement("div");
      block.textContent = `\n\n\`\`\`${language}\n${code.innerText.trimEnd()}\n\`\`\`\n\n`;
      pre.replaceWith(block);
    });

    clone.querySelectorAll("table").forEach((table) => {
      const block = document.createElement("div");
      block.textContent = `\n\n${tableToMarkdown(table)}\n\n`;
      table.replaceWith(block);
    });

    clone.querySelectorAll("a[href]").forEach((link) => {
      const href = link.href;
      const label = link.innerText.trim() || href;
      link.textContent = label === href ? href : `${label} (${href})`;
    });

    return clone.innerText
      .replace(/\u00a0/g, " ")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function getSourceTimestamp(node) {
    const time = node.querySelector("time[datetime]");
    return time?.getAttribute("datetime") || null;
  }

  function findMessageNodes() {
    const selectors = [
      '[data-testid^="conversation-turn-"]',
      '[data-message-author-role]',
      '[data-testid="user-message"]',
      '[data-testid="assistant-message"]',
      "main article"
    ];
    const seen = new Set();
    const nodes = [];
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((node) => {
        if (!seen.has(node) && node.textContent.trim()) {
          seen.add(node);
          nodes.push(node);
        }
      });
      if (nodes.length) break;
    }
    return nodes;
  }

  function getConversationSnapshot() {
    if (!isSupportedChatGPTPage()) {
      throw new Error("请在 ChatGPT 对话页面使用此扩展。");
    }

    return {
      conversation_id: getConversationId(),
      title: getTitle(),
      url: location.href,
      message_count: findMessageNodes().length
    };
  }

  function extractConversation() {
    if (!isSupportedChatGPTPage()) {
      throw new Error("请在 ChatGPT 对话页面使用此扩展。");
    }

    const capturedAt = new Date().toISOString();
    const conversationId = getConversationId();
    const messageNodes = findMessageNodes();
    const messages = messageNodes.map((node, index) => ({
      role: roleFromNode(node),
      index: index + 1,
      text: textFromNode(node),
      source_timestamp: getSourceTimestamp(node)
    })).filter((message) => message.text);

    if (!messages.length) {
      throw new Error("无法识别消息区域，或当前页面没有已加载的消息。");
    }

    return {
      source: "chatgpt-business",
      capture_method: "chrome-extension",
      conversation_id: conversationId,
      title: getTitle(),
      url: location.href,
      captured_at: capturedAt,
      updated_at: capturedAt,
      message_count: messages.length,
      messages
    };
  }

  function isGenerating() {
    return Boolean(
      document.querySelector('[data-testid="stop-button"], button[aria-label*="Stop"], button[aria-label*="停止"]')
    );
  }

  window.ChatGPTCapture = {
    ...(window.ChatGPTCapture || {}),
    isSupportedChatGPTPage,
    getConversationSnapshot,
    extractConversation,
    isGenerating
  };
})();
