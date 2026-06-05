(function () {
  const DB_NAME = "chatgpt-capture-file-access";
  const DB_VERSION = 1;
  const STORE_NAME = "handles";
  const DIRECTORY_KEY = "archive-directory";

  function ensureSupported() {
    if (!window.showDirectoryPicker) {
      throw new Error("当前 Chrome 不支持文件夹授权写入，请升级 Chrome 后重试。");
    }
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async function idbSet(key, value) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function idbDelete(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async function requestWritablePermission(handle) {
    const options = { mode: "readwrite" };
    if (await handle.queryPermission(options) === "granted") return true;
    return await handle.requestPermission(options) === "granted";
  }

  async function chooseDirectory() {
    ensureSupported();
    const handle = await window.showDirectoryPicker({
      id: "chatgpt-obsidian-capture",
      mode: "readwrite"
    });
    if (!await requestWritablePermission(handle)) {
      throw new Error("未获得归档文件夹写入权限。");
    }
    await idbSet(DIRECTORY_KEY, handle);
    return handle;
  }

  async function getDirectoryHandle() {
    return await idbGet(DIRECTORY_KEY);
  }

  async function hasWritableDirectory() {
    const handle = await getDirectoryHandle();
    if (!handle) return false;
    return await requestWritablePermission(handle);
  }

  async function writeFile(file) {
    const directory = await getDirectoryHandle();
    if (!directory) {
      throw new Error("还没有选择归档文件夹。");
    }
    if (!await requestWritablePermission(directory)) {
      throw new Error("归档文件夹写入权限已失效，请重新选择归档文件夹。");
    }

    const fileHandle = await directory.getFileHandle(file.filename, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(new Blob([file.content], { type: file.mimeType || "text/plain;charset=utf-8" }));
    await writable.close();
  }

  async function writeFiles(files) {
    for (const file of files) {
      await writeFile(file);
    }
  }

  async function clearDirectory() {
    await idbDelete(DIRECTORY_KEY);
  }

  window.ChatGPTCaptureFileAccess = {
    chooseDirectory,
    getDirectoryHandle,
    hasWritableDirectory,
    writeFiles,
    clearDirectory
  };
})();
