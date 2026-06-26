"use client";

import { Alert, Card, ConfigProvider, Layout, Space, Steps, Tabs, Typography, message } from "antd";
import { useEffect, useMemo, useState } from "react";
import FileUploadPanel from "@/components/FileUploadPanel";
import GeneratedPreview from "@/components/GeneratedPreview";
import MappingEditor from "@/components/MappingEditor";
import SheetSelector from "@/components/SheetSelector";
import SourcePreview from "@/components/SourcePreview";
import SummaryCards from "@/components/SummaryCards";
import ValidationPanel from "@/components/ValidationPanel";
import { downloadExcel } from "@/lib/spreadsheet/exportWorkbook";
import { getSheetData, parseSpreadsheetFile } from "@/lib/spreadsheet/parseWorkbook";
import { createInitialPlan } from "@/lib/transforms/initialPlan";
import { runTransform } from "@/lib/transforms/runTransform";
import { validatePlan } from "@/lib/transforms/validatePlan";

const { Content } = Layout;
const { Text, Title } = Typography;
const MAPPING_TEMPLATE_STORAGE_KEY = "audit-ui.mapping-templates";
const TEMPLATE_FOLDER_NAME = "audit-ui-templates";
const TEMPLATE_FILE_NAME = "templates.json";
let browserTemplateFolderHandle = null;
let browserTemplateFolderLabel = "";

function normalizeTemplates(value) {
  return Array.isArray(value) ? value.filter((template) => template?.id && template?.name && template?.plan?.columns) : [];
}

async function readBrowserTemplateFolder(folderHandle) {
  try {
    const fileHandle = await folderHandle.getFileHandle(TEMPLATE_FILE_NAME);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return normalizeTemplates(JSON.parse(text));
  } catch (error) {
    if (error.name === "NotFoundError") {
      return [];
    }

    throw error;
  }
}

async function writeBrowserTemplateFolder(folderHandle, templates) {
  const fileHandle = await folderHandle.getFileHandle(TEMPLATE_FILE_NAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(`${JSON.stringify(normalizeTemplates(templates), null, 2)}\n`);
  await writable.close();
}

async function chooseBrowserTemplateParentFolder(title) {
  const parentFolderHandle = await window.showDirectoryPicker({ mode: "readwrite", startIn: "documents" });
  const folderHandle = await parentFolderHandle.getDirectoryHandle(TEMPLATE_FOLDER_NAME, { create: true });
  browserTemplateFolderHandle = folderHandle;
  browserTemplateFolderLabel = `${parentFolderHandle.name}/${TEMPLATE_FOLDER_NAME}`;

  return {
    folderHandle,
    folderPath: browserTemplateFolderLabel,
    title,
  };
}

function createBrowserTemplateApi() {
  if (typeof window === "undefined" || typeof window.showDirectoryPicker !== "function") {
    return null;
  }

  return {
    async chooseTemplateFolder() {
      const { folderHandle, folderPath } = await chooseBrowserTemplateParentFolder("Choose where to save template folder");
      return { canceled: false, folderPath, templates: await readBrowserTemplateFolder(folderHandle) };
    },
    async loadTemplatesFromFolder() {
      const { folderHandle, folderPath } = await chooseBrowserTemplateParentFolder("Choose folder to check for templates");
      return { canceled: false, folderPath, templates: await readBrowserTemplateFolder(folderHandle) };
    },
    async saveTemplatesToFolder(templates) {
      if (!browserTemplateFolderHandle) {
        const { folderHandle, folderPath } = await chooseBrowserTemplateParentFolder("Choose where to save template folder");
        await writeBrowserTemplateFolder(folderHandle, templates);
        return { canceled: false, folderPath, templates: normalizeTemplates(templates) };
      }

      await writeBrowserTemplateFolder(browserTemplateFolderHandle, templates);
      return { canceled: false, folderPath: browserTemplateFolderLabel || browserTemplateFolderHandle.name, templates: normalizeTemplates(templates) };
    },
  };
}

function getTemplateApi() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.auditTemplates || createBrowserTemplateApi();
}

function getStepIndex(workbookData, generated) {
  if (generated) {
    return 2;
  }

  if (workbookData) {
    return 1;
  }

  return 0;
}

function clonePlan(plan) {
  return JSON.parse(JSON.stringify(plan || { columns: [] }));
}

function loadStoredTemplates() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const stored = window.localStorage.getItem(MAPPING_TEMPLATE_STORAGE_KEY);
    const templates = stored ? JSON.parse(stored) : [];
    return normalizeTemplates(templates);
  } catch {
    return [];
  }
}

function storeTemplates(templates) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(MAPPING_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

export default function Home() {
  const [messageApi, contextHolder] = message.useMessage();
  const [workbookData, setWorkbookData] = useState(null);
  const [selectedSheetName, setSelectedSheetName] = useState(null);
  const [plan, setPlan] = useState({ columns: [] });
  const [generated, setGenerated] = useState(null);
  const [validationReport, setValidationReport] = useState(null);
  const [parseError, setParseError] = useState("");
  const [parsing, setParsing] = useState(false);
  const [mappingTemplates, setMappingTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [templateFolderPath, setTemplateFolderPath] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMappingTemplates(loadStoredTemplates());
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  const selectedSheet = useMemo(() => {
    return getSheetData(workbookData, selectedSheetName);
  }, [workbookData, selectedSheetName]);

  const generatedColumnCount = plan.columns.filter((column) => column.enabled).length;
  const canDownload = Boolean(generated?.outputRows && validationReport && !validationReport.blockingErrors.length);

  function createPlanFromTemplateSelection(headers) {
    const template = mappingTemplates.find((current) => current.id === selectedTemplateId);
    return template ? clonePlan(template.plan) : createInitialPlan(headers);
  }

  async function handleFileSelected(file) {
    setParsing(true);
    setParseError("");
    setGenerated(null);
    setValidationReport(null);

    try {
      const parsed = await parseSpreadsheetFile(file);
      const firstSheet = parsed.sheets[0] || null;
      setWorkbookData(parsed);
      setSelectedSheetName(firstSheet?.name || null);
      setPlan(createPlanFromTemplateSelection(firstSheet?.headers || []));
      messageApi.success("File parsed locally.");
    } catch (error) {
      setWorkbookData(null);
      setSelectedSheetName(null);
      setPlan({ columns: [] });
      setParseError(error.message || "Unable to parse spreadsheet.");
    } finally {
      setParsing(false);
    }
  }

  function handleSelectSheet(sheetName) {
    const sheet = getSheetData(workbookData, sheetName);
    setSelectedSheetName(sheetName);
    setPlan(createPlanFromTemplateSelection(sheet?.headers || []));
    setGenerated(null);
    setValidationReport(null);
  }

  function handleResetMappings() {
    setPlan(createInitialPlan(selectedSheet?.headers || []));
    setGenerated(null);
    setValidationReport(null);
  }

  function handlePlanChange(nextPlan) {
    setPlan(nextPlan);
    setGenerated(null);
    setValidationReport(null);
  }

  async function persistTemplates(nextTemplates) {
    const templateApi = getTemplateApi();

    if (!templateApi) {
      storeTemplates(nextTemplates);
      return true;
    }

    try {
      const result = await templateApi.saveTemplatesToFolder(nextTemplates, templateFolderPath || null);
      if (result?.canceled) {
        return false;
      }

      setTemplateFolderPath(result.folderPath || "");
      return true;
    } catch (error) {
      messageApi.error(error.message || "Unable to save templates to folder.");
      return false;
    }
  }

  async function handleChooseTemplateFolder() {
    const templateApi = getTemplateApi();
    if (!templateApi) {
      messageApi.warning("Template folders need a browser with folder access support, or the desktop app.");
      return;
    }

    try {
      const result = await templateApi.chooseTemplateFolder();
      if (result?.canceled) {
        return;
      }

      setTemplateFolderPath(result.folderPath || "");
      setMappingTemplates(result.templates || []);
      setSelectedTemplateId(null);
      messageApi.success(`Template folder ready. Loaded ${result.templates?.length || 0} template${result.templates?.length === 1 ? "" : "s"}.`);
    } catch (error) {
      messageApi.error(error.message || "Unable to choose template folder.");
    }
  }

  async function handleLoadTemplatesFromFolder() {
    const templateApi = getTemplateApi();
    if (!templateApi) {
      setMappingTemplates(loadStoredTemplates());
      messageApi.warning("Template folders need a browser with folder access support, or the desktop app. Loaded browser templates instead.");
      return;
    }

    try {
      const result = await templateApi.loadTemplatesFromFolder();
      if (result?.canceled) {
        return;
      }

      setTemplateFolderPath(result.folderPath || "");
      setMappingTemplates(result.templates || []);
      setSelectedTemplateId(null);
      messageApi.success(`Loaded ${result.templates?.length || 0} template${result.templates?.length === 1 ? "" : "s"}.`);
    } catch (error) {
      messageApi.error(error.message || "Unable to load templates from folder.");
    }
  }

  async function handleSaveTemplate(templateName) {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      return;
    }

    const now = new Date().toISOString();
    const existingTemplate = mappingTemplates.find((template) => template.name.toLowerCase() === trimmedName.toLowerCase());
    const nextTemplate = {
      id: existingTemplate?.id || `template_${Date.now()}`,
      name: trimmedName,
      plan: clonePlan(plan),
      updatedAt: now,
    };
    const nextTemplates = existingTemplate
      ? mappingTemplates.map((template) => (template.id === existingTemplate.id ? nextTemplate : template))
      : [...mappingTemplates, nextTemplate];

    const saved = await persistTemplates(nextTemplates);
    if (!saved) {
      return;
    }

    setMappingTemplates(nextTemplates);
    setSelectedTemplateId(nextTemplate.id);
    messageApi.success(existingTemplate ? "Template updated." : "Template saved.");
  }

  function handleApplyTemplate(templateId) {
    const template = mappingTemplates.find((current) => current.id === templateId);
    if (!template) {
      return;
    }

    const nextPlan = clonePlan(template.plan);
    setSelectedTemplateId(templateId);
    setPlan(nextPlan);
    setGenerated(null);
    setValidationReport(selectedSheet ? validatePlan(nextPlan, selectedSheet.headers, selectedSheet.rows) : null);
    messageApi.success("Template loaded.");
  }

  async function handleDeleteTemplate(templateId) {
    const nextTemplates = mappingTemplates.filter((template) => template.id !== templateId);
    const saved = await persistTemplates(nextTemplates);
    if (!saved) {
      return;
    }

    setMappingTemplates(nextTemplates);
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId(null);
    }
    messageApi.success("Template deleted.");
  }

  function handleGenerate() {
    if (!selectedSheet) {
      return;
    }

    const initialReport = validatePlan(plan, selectedSheet.headers, selectedSheet.rows);
    if (initialReport.blockingErrors.length) {
      setGenerated(null);
      setValidationReport(initialReport);
      return;
    }

    const nextGenerated = runTransform(selectedSheet.rows, plan, selectedSheet.cellMetadataRows);
    const finalReport = validatePlan(plan, selectedSheet.headers, selectedSheet.rows, nextGenerated.outputRows.length);
    finalReport.rowWarnings = nextGenerated.rowWarnings;

    setGenerated(finalReport.blockingErrors.length ? null : nextGenerated);
    setValidationReport(finalReport);
  }

  function handleDownload() {
    if (!canDownload) {
      return;
    }

    downloadExcel(generated.outputRows, generated.outputHeaders, workbookData.fileName, generated.outputCellMetadataRows);
  }

  const tabItems = [
    {
      key: "source",
      label: "Source",
      children: <SourcePreview sheet={selectedSheet} deletedSourceRows={generated?.deletedSourceRows || []} />,
    },
    {
      key: "mappings",
      label: "Mappings",
      children: selectedSheet ? (
        <Space direction="vertical" size="middle" className="full-width">
          <MappingEditor
            headers={selectedSheet.headers}
            plan={plan}
            onPlanChange={handlePlanChange}
            onReset={handleResetMappings}
            onGenerate={handleGenerate}
            templates={mappingTemplates}
            selectedTemplateId={selectedTemplateId}
            onTemplateChange={setSelectedTemplateId}
            onSaveTemplate={handleSaveTemplate}
            onApplyTemplate={handleApplyTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            templateFolderPath={templateFolderPath}
            onChooseTemplateFolder={handleChooseTemplateFolder}
            onLoadTemplatesFromFolder={handleLoadTemplatesFromFolder}
          />
          <ValidationPanel report={validationReport} />
        </Space>
      ) : (
        <Alert type="info" showIcon message="Upload a spreadsheet before editing mappings." />
      ),
    },
    {
      key: "generated",
      label: "Generated",
      children: (
        <Space direction="vertical" size="middle" className="full-width">
          <ValidationPanel report={validationReport} />
          <GeneratedPreview
            generated={generated}
            sourceHeaders={selectedSheet?.headers || []}
            canDownload={canDownload}
            onDownload={handleDownload}
          />
        </Space>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          borderRadius: 6,
          fontFamily: "var(--font-geist-sans), Arial, sans-serif",
        },
      }}
    >
      {contextHolder}
      <Layout className="app-shell">
        <Content className="app-content">
          <Space direction="vertical" size="large" className="full-width">
            <div className="page-heading">
              <div>
                <Title level={2}>Spreadsheet Audit Tool</Title>
                <Text type="secondary">Files are processed locally in your browser.</Text>
              </div>
            </div>

            <Card>
              <FileUploadPanel
                parsing={parsing}
                parseError={parseError}
                templates={mappingTemplates}
                selectedTemplateId={selectedTemplateId}
                onTemplateChange={setSelectedTemplateId}
                onFileSelected={handleFileSelected}
              />
            </Card>

            <Steps
              current={getStepIndex(workbookData, generated)}
              items={[
                { title: "Upload" },
                { title: "Map" },
                { title: "Generate" },
              ]}
            />

            <SummaryCards fileName={workbookData?.fileName} sheet={selectedSheet} generatedColumnCount={generatedColumnCount} />

            {workbookData ? (
              <Card>
                <SheetSelector sheets={workbookData.sheets} selectedSheetName={selectedSheetName} onSelectSheet={handleSelectSheet} />
              </Card>
            ) : null}

            <Card className="main-card">
              <Tabs items={tabItems} destroyInactiveTabPane={false} />
            </Card>
          </Space>
        </Content>
      </Layout>
    </ConfigProvider>
  );
}
