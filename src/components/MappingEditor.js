"use client";

import { Button, Input, Select, Space, Switch, Table, Tooltip, Typography } from "antd";
import { DeleteOutlined, FolderOpenOutlined, HolderOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { useState } from "react";
import DerivedColumnDrawer from "./DerivedColumnDrawer";
import { DELETE_ROW_MATCH_OPTIONS, DELETE_ROW_RULE_OPTIONS, createDefaultDeleteRowCondition } from "@/lib/transforms/deleteRowConditions";
import { OPERATION_OPTIONS, getDefaultOperation } from "@/lib/transforms/operations";

const { Text } = Typography;

const NUMERIC_OPERATIONS = new Set(["add", "subtract", "multiply"]);

function sourceOptions(headers) {
  return headers.map((header) => ({ value: header, label: header }));
}

function clonePlanWithColumn(plan, columnId, updater) {
  return {
    ...plan,
    columns: plan.columns.map((column) => (column.id === columnId ? updater(column) : column)),
  };
}

function clonePlanWithDeleteRowCondition(plan, conditionId, updater) {
  return {
    ...plan,
    deleteRowConditions: (plan.deleteRowConditions || []).map((condition) => (condition.id === conditionId ? updater(condition) : condition)),
  };
}

function updateOperation(plan, columnId, patch) {
  return clonePlanWithColumn(plan, columnId, (column) => ({
    ...column,
    operation: {
      ...column.operation,
      ...patch,
    },
  }));
}

export default function MappingEditor({
  headers,
  plan,
  onPlanChange,
  onReset,
  onGenerate,
  templates = [],
  selectedTemplateId,
  onTemplateChange,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  templateFolderPath = "",
  onChooseTemplateFolder,
  onLoadTemplatesFromFolder,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState(null);
  const [templateName, setTemplateName] = useState("");

  function reorderColumn(sourceColumnId, targetColumnId) {
    if (!sourceColumnId || sourceColumnId === targetColumnId) {
      return;
    }

    const index = plan.columns.findIndex((column) => column.id === sourceColumnId);
    const nextIndex = plan.columns.findIndex((column) => column.id === targetColumnId);
    if (index < 0 || nextIndex < 0) {
      return;
    }

    const nextColumns = [...plan.columns];
    const [column] = nextColumns.splice(index, 1);
    nextColumns.splice(nextIndex, 0, column);
    onPlanChange({ ...plan, columns: nextColumns });
  }

  function saveTemplate() {
    onSaveTemplate(templateName);
    setTemplateName("");
  }

  function removeColumn(columnId) {
    onPlanChange({ ...plan, columns: plan.columns.filter((column) => column.id !== columnId) });
  }

  function addDeleteRowCondition() {
    onPlanChange({
      ...plan,
      deleteRowConditions: [...(plan.deleteRowConditions || []), createDefaultDeleteRowCondition(headers)],
    });
  }

  function removeDeleteRowCondition(conditionId) {
    onPlanChange({
      ...plan,
      deleteRowConditions: (plan.deleteRowConditions || []).filter((condition) => condition.id !== conditionId),
    });
  }

  function updateDeleteRowCondition(conditionId, patch) {
    onPlanChange(clonePlanWithDeleteRowCondition(plan, conditionId, (condition) => ({ ...condition, ...patch })));
  }

  function addDerivedColumn(values) {
    onPlanChange({
      ...plan,
      columns: [
        ...plan.columns,
        {
          id: `derived_${Date.now()}`,
          outputName: values.outputName,
          enabled: true,
          operation: values.operation,
        },
      ],
    });
    setDrawerOpen(false);
  }

  function renderDeleteRowConditions() {
    const conditions = plan.deleteRowConditions || [];

    return (
      <div className="delete-rules-panel">
        <div className="delete-rules-heading">
          <Text strong>Delete rows</Text>
          <Button icon={<PlusOutlined />} onClick={addDeleteRowCondition}>Add condition</Button>
        </div>
        {conditions.length ? (
          <Space direction="vertical" size="small" className="full-width">
            {conditions.map((condition, index) => (
              <div className="delete-rule-row" key={condition.id}>
                <Switch
                  checked={condition.enabled !== false}
                  onChange={(enabled) => updateDeleteRowCondition(condition.id, { enabled })}
                />
                <Text className="delete-rule-index">#{index + 1}</Text>
                <Select
                  value={condition.rule || "emptyOrZero"}
                  options={DELETE_ROW_RULE_OPTIONS}
                  onChange={(rule) => updateDeleteRowCondition(condition.id, { rule })}
                  style={{ width: 140 }}
                />
                <Select
                  mode="multiple"
                  value={condition.columns || []}
                  options={sourceOptions(headers)}
                  onChange={(columns) => updateDeleteRowCondition(condition.id, { columns })}
                  placeholder="Columns to check"
                  className="delete-rule-columns"
                  maxTagCount="responsive"
                />
                <Select
                  value={condition.match || "any"}
                  options={DELETE_ROW_MATCH_OPTIONS}
                  onChange={(match) => updateDeleteRowCondition(condition.id, { match })}
                  style={{ width: 92 }}
                />
                <Tooltip title="Delete condition">
                  <Button danger icon={<DeleteOutlined />} onClick={() => removeDeleteRowCondition(condition.id)} />
                </Tooltip>
              </div>
            ))}
          </Space>
        ) : (
          <Text type="secondary">No row deletion conditions configured.</Text>
        )}
      </div>
    );
  }

  function renderOperationControls(column) {
    const operation = column.operation;
    const options = sourceOptions(headers);

    if (["copy", "trim", "uppercase", "lowercase"].includes(operation.type)) {
      return (
        <Select
          value={operation.source}
          options={options}
          onChange={(source) => onPlanChange(updateOperation(plan, column.id, { source }))}
          style={{ minWidth: 180 }}
        />
      );
    }

    if (operation.type === "concat") {
      return (
        <Space wrap>
          <Select
            mode="multiple"
            value={operation.sources || []}
            options={options}
            onChange={(sources) => onPlanChange(updateOperation(plan, column.id, { sources }))}
            placeholder="Source columns"
            style={{ minWidth: 240 }}
          />
          <Input
            value={operation.separator ?? ""}
            onChange={(event) => onPlanChange(updateOperation(plan, column.id, { separator: event.target.value }))}
            placeholder="Separator"
            style={{ width: 120 }}
          />
          <Input
            value={operation.literal ?? ""}
            onChange={(event) => onPlanChange(updateOperation(plan, column.id, { literal: event.target.value }))}
            placeholder="Literal"
            style={{ width: 160 }}
          />
        </Space>
      );
    }

    if (NUMERIC_OPERATIONS.has(operation.type)) {
      return (
        <Select
          mode="multiple"
          value={operation.sources || []}
          options={options}
          onChange={(sources) => onPlanChange(updateOperation(plan, column.id, { sources }))}
          placeholder="Numeric source columns"
          style={{ minWidth: 260 }}
        />
      );
    }

    if (operation.type === "divide") {
      return (
        <Select
          mode="multiple"
          maxCount={2}
          value={operation.sources || []}
          options={options}
          onChange={(sources) => onPlanChange(updateOperation(plan, column.id, { sources: sources.slice(0, 2) }))}
          placeholder="Dividend, divisor"
          style={{ minWidth: 260 }}
        />
      );
    }

    if (operation.type === "fallback") {
      return (
        <Space wrap>
          <Select
            value={operation.primarySource}
            options={options}
            onChange={(primarySource) => onPlanChange(updateOperation(plan, column.id, { primarySource }))}
            placeholder="Primary"
            style={{ width: 160 }}
          />
          <Select
            allowClear
            value={operation.fallbackSource}
            options={options}
            onChange={(fallbackSource) => onPlanChange(updateOperation(plan, column.id, { fallbackSource }))}
            placeholder="Fallback source"
            style={{ width: 180 }}
          />
          <Input
            value={operation.fallbackLiteral ?? ""}
            onChange={(event) => onPlanChange(updateOperation(plan, column.id, { fallbackLiteral: event.target.value }))}
            placeholder="Fallback literal"
            style={{ width: 180 }}
          />
        </Space>
      );
    }

    return null;
  }

  const columns = [
    {
      title: "Order",
      key: "order",
      width: 72,
      render: (_, column) => (
        <Tooltip title="Drag to reorder">
          <Button
            className="drag-handle"
            icon={<HolderOutlined />}
            draggable
            onDragStart={(event) => {
              setDraggedColumnId(column.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", column.id);
            }}
            onDragEnd={() => setDraggedColumnId(null)}
          />
        </Tooltip>
      ),
    },
    {
      title: "Enabled",
      dataIndex: "enabled",
      width: 90,
      render: (_, column) => (
        <Switch
          checked={column.enabled}
          onChange={(enabled) => onPlanChange(clonePlanWithColumn(plan, column.id, (current) => ({ ...current, enabled })))}
        />
      ),
    },
    {
      title: "Output column",
      dataIndex: "outputName",
      width: 220,
      render: (_, column) => (
        <Input
          value={column.outputName}
          onChange={(event) => onPlanChange(clonePlanWithColumn(plan, column.id, (current) => ({ ...current, outputName: event.target.value })))}
        />
      ),
    },
    {
      title: "Operation",
      dataIndex: ["operation", "type"],
      width: 190,
      render: (_, column) => (
        <Select
          value={column.operation.type}
          options={OPERATION_OPTIONS}
          onChange={(type) => onPlanChange(clonePlanWithColumn(plan, column.id, (current) => ({ ...current, operation: getDefaultOperation(type, headers) })))}
          style={{ width: 160 }}
        />
      ),
    },
    {
      title: "Inputs",
      key: "inputs",
      render: (_, column) => renderOperationControls(column),
    },
    {
      title: "Delete",
      key: "delete",
      width: 90,
      render: (_, column) => (
        <Tooltip title="Delete column">
          <Button danger icon={<DeleteOutlined />} onClick={() => removeColumn(column.id)} />
        </Tooltip>
      ),
    },
  ];

  const templateOptions = templates.map((template) => ({ value: template.id, label: template.name }));

  return (
    <div className="stack">
      <div className="toolbar">
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => setDrawerOpen(true)}>Add derived column</Button>
          <Button icon={<ReloadOutlined />} onClick={onReset}>Reset mappings</Button>
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            onPressEnter={saveTemplate}
            placeholder="Template name"
            style={{ width: 190 }}
          />
          <Button icon={<SaveOutlined />} onClick={saveTemplate} disabled={!templateName.trim()}>Save template</Button>
          <Select
            allowClear
            value={selectedTemplateId}
            onChange={onTemplateChange}
            options={templateOptions}
            placeholder="Saved templates"
            style={{ minWidth: 190 }}
          />
          <Button disabled={!selectedTemplateId} onClick={() => onApplyTemplate(selectedTemplateId)}>Load template</Button>
          <Button danger disabled={!selectedTemplateId} onClick={() => onDeleteTemplate(selectedTemplateId)}>Delete template</Button>
          <Button icon={<FolderOpenOutlined />} onClick={onChooseTemplateFolder}>Choose template folder</Button>
          <Button onClick={onLoadTemplatesFromFolder}>Load from folder</Button>
        </Space>
        <Button type="primary" onClick={onGenerate}>Generate preview</Button>
      </div>
      {templateFolderPath ? <Text type="secondary">Template folder: {templateFolderPath}</Text> : null}
      {renderDeleteRowConditions()}
      <Table
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={plan.columns}
        pagination={false}
        scroll={{ x: "max-content" }}
        rowClassName={(column) => (column.id === draggedColumnId ? "dragging-row" : "")}
        onRow={(column) => ({
          onDragOver: (event) => {
            if (draggedColumnId) {
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }
          },
          onDrop: (event) => {
            event.preventDefault();
            reorderColumn(event.dataTransfer.getData("text/plain") || draggedColumnId, column.id);
            setDraggedColumnId(null);
          },
        })}
        bordered
      />
      <DerivedColumnDrawer open={drawerOpen} headers={headers} onClose={() => setDrawerOpen(false)} onAdd={addDerivedColumn} />
    </div>
  );
}