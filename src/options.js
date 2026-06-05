const statusEl = document.getElementById("status");
const access = window.ChatGPTCaptureFileAccess;

async function refreshStatus() {
  const handle = await access.getDirectoryHandle();
  if (!handle) {
    statusEl.textContent = "还没有选择归档文件夹。";
    return;
  }

  const writable = await access.hasWritableDirectory();
  statusEl.textContent = writable
    ? `当前归档文件夹：${handle.name}`
    : `当前归档文件夹：${handle.name}，但需要重新授权。`;
}

document.getElementById("choose").addEventListener("click", async () => {
  try {
    const handle = await access.chooseDirectory();
    statusEl.textContent = `当前归档文件夹：${handle.name}`;
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

document.getElementById("clear").addEventListener("click", async () => {
  await access.clearDirectory();
  await refreshStatus();
});

refreshStatus();
