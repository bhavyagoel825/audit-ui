const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("auditTemplates", {
  chooseTemplateFolder: () => ipcRenderer.invoke("templates:choose-folder"),
  loadTemplatesFromFolder: () => ipcRenderer.invoke("templates:load-from-folder"),
  saveTemplatesToFolder: (templates, folderPath) => ipcRenderer.invoke("templates:save-to-folder", { templates, folderPath }),
});