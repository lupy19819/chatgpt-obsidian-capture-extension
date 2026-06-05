const statusEl = document.getElementById("status");
const detailsEl = document.getElementById("details");
const buttons = Array.from(document.querySelectorAll("button"));

if (new URLSearchParams(location.search).get("embedded") === "1") {
  document.body.classList.add("embedded");
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function setBusy(isBusy) {
  buttons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function formatDate(value) {
  if (!value) return "未保存";
  return new Date(value).toLocaleString();
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function ensureContentScript(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: [
      "src/hashing.js",
      "src/parser.js",
      "src/markdown.js",
      "src/storage.js",
      "src/content.js"
    ]
  });
}

async function sendToContent(type) {
  const tab = await getActiveTab();
  if (!/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(tab?.url || "")) {
    throw new Error("请在 ChatGPT 对话页面使用此扩展。");
  }

  await ensureContentScript(tab.id);

  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tab.id, { type }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error("页面脚本尚未就绪，请刷新 ChatGPT 页面后重试。"));
      else if (!response?.ok) reject(new Error(response?.error || "操作失败"));
      else resolve(response);
    });
  });
}

async function saveWithConfiguredFolder(kind, markSaved) {
  const access = window.ChatGPTCaptureFileAccess;
  const bundle = await sendToContent("BUILD_EXPORT_BUNDLE");

  if (!await access.hasWritableDirectory()) {
    throw new Error("还没有选择归档文件夹。请先点击“选择归档文件夹”。");
  }

  const files = [];
  if (kind === "markdown" || kind === "both") files.push(bundle.files.markdown);
  if (kind === "json" || kind === "both") files.push(bundle.files.json);
  await access.writeFiles(files);

  if (markSaved) {
    const saved = await sendToContent("MARK_SAVED_CURRENT");
    render(saved);
    return saved;
  }

  render(bundle);
  return bundle;
}

function render(response) {
  const { conversation, state } = response;
  document.getElementById("title").textContent = conversation.title;
  document.getElementById("conversation-id").textContent = conversation.conversation_id;
  document.getElementById("dirty").textContent = state.dirty
    ? `有 ${state.unsavedCount} 条新内容未归档`
    : "已归档";
  document.getElementById("message-count").textContent = String(conversation.message_count);
  document.getElementById("last-saved").textContent = formatDate(state.lastSavedAt);
  detailsEl.hidden = false;
  setStatus("提示：只保存当前页面已加载的内容。");
}

async function run(type, successText) {
  setBusy(true);
  try {
    const response = await sendToContent(type);
    if (response.conversation) render(response);
    setStatus(successText);
  } catch (error) {
    setStatus(error.message, true);
    console.error("[ChatGPT Capture]", error);
  } finally {
    setBusy(false);
  }
}

async function runFolderExport(kind, markSaved, successText) {
  setBusy(true);
  try {
    await saveWithConfiguredFolder(kind, markSaved);
    setStatus(successText);
  } catch (error) {
    setStatus(error.message, true);
    console.error("[ChatGPT Capture]", error);
  } finally {
    setBusy(false);
  }
}

document.getElementById("update").addEventListener("click", () => runFolderExport("both", true, "已写入归档文件夹，并更新归档状态。"));
document.getElementById("markdown").addEventListener("click", () => runFolderExport("markdown", false, "已写入完整 Markdown。"));
document.getElementById("json").addEventListener("click", () => runFolderExport("json", false, "已写入完整 JSON。"));
document.getElementById("choose-folder").addEventListener("click", async () => {
  setBusy(true);
  try {
    const handle = await window.ChatGPTCaptureFileAccess.chooseDirectory();
    setStatus(`归档文件夹已设置：${handle.name}`);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    setBusy(false);
  }
});
document.getElementById("clear").addEventListener("click", () => run("CLEAR_STATE", "已清除本会话归档状态。"));

run("GET_LIGHT_STATUS", "提示：只保存当前页面已加载的内容。");
