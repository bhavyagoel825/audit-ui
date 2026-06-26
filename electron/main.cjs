const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const isDev = Boolean(process.env.ELECTRON_START_URL);
const TEMPLATE_FOLDER_NAME = "audit-ui-templates";
const TEMPLATE_FILE_NAME = "templates.json";

function getTemplateFilePath(folderPath) {
  return path.join(folderPath, TEMPLATE_FILE_NAME);
}

async function chooseParentFolder(browserWindow, title) {
  const result = await dialog.showOpenDialog(browserWindow, {
    title,
    properties: ["openDirectory", "createDirectory"],
  });

  if (result.canceled || !result.filePaths.length) {
    return null;
  }

  return result.filePaths[0];
}

function normalizeTemplates(value) {
  return Array.isArray(value) ? value.filter((template) => template?.id && template?.name && template?.plan?.columns) : [];
}

async function readTemplateFolder(folderPath) {
  try {
    const content = await fs.readFile(getTemplateFilePath(folderPath), "utf8");
    return normalizeTemplates(JSON.parse(content));
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeTemplateFolder(folderPath, templates) {
  await fs.mkdir(folderPath, { recursive: true });
  await fs.writeFile(getTemplateFilePath(folderPath), `${JSON.stringify(normalizeTemplates(templates), null, 2)}\n`, "utf8");
}

function registerTemplateHandlers() {
  ipcMain.handle("templates:choose-folder", async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const parentFolder = await chooseParentFolder(browserWindow, "Choose where to save template folder");
    if (!parentFolder) {
      return { canceled: true, templates: [] };
    }

    const folderPath = path.join(parentFolder, TEMPLATE_FOLDER_NAME);
    await fs.mkdir(folderPath, { recursive: true });
    const templates = await readTemplateFolder(folderPath);
    return { canceled: false, folderPath, templates };
  });

  ipcMain.handle("templates:load-from-folder", async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender);
    const parentFolder = await chooseParentFolder(browserWindow, "Choose folder to check for templates");
    if (!parentFolder) {
      return { canceled: true, templates: [] };
    }

    const folderPath = path.join(parentFolder, TEMPLATE_FOLDER_NAME);
    const templates = await readTemplateFolder(folderPath);
    return { canceled: false, folderPath, templates };
  });

  ipcMain.handle("templates:save-to-folder", async (event, { templates, folderPath }) => {
    let targetFolder = folderPath;

    if (!targetFolder) {
      const browserWindow = BrowserWindow.fromWebContents(event.sender);
      const parentFolder = await chooseParentFolder(browserWindow, "Choose where to save template folder");
      if (!parentFolder) {
        return { canceled: true, templates: [] };
      }
      targetFolder = path.join(parentFolder, TEMPLATE_FOLDER_NAME);
    }

    await writeTemplateFolder(targetFolder, templates);
    return { canceled: false, folderPath: targetFolder, templates: normalizeTemplates(templates) };
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 980,
    minHeight: 680,
    title: "Spreadsheet Audit Tool",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "out", "index.html"));
  }
}

app.whenReady().then(() => {
  registerTemplateHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});