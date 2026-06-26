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
    return Array.isArray(templates) ? templates.filter((template) => template?.id && template?.name && template?.plan?.columns) : [];
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

  function handleSaveTemplate(templateName) {
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

    setMappingTemplates(nextTemplates);
    setSelectedTemplateId(nextTemplate.id);
    storeTemplates(nextTemplates);
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

  function handleDeleteTemplate(templateId) {
    const nextTemplates = mappingTemplates.filter((template) => template.id !== templateId);
    setMappingTemplates(nextTemplates);
    if (selectedTemplateId === templateId) {
      setSelectedTemplateId(null);
    }
    storeTemplates(nextTemplates);
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
