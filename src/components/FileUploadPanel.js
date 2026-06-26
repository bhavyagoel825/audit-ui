"use client";

import { Alert, Select, Space, Typography, Upload } from "antd";
import { InboxOutlined } from "@ant-design/icons";

const { Dragger } = Upload;

export default function FileUploadPanel({ parsing, parseError, templates = [], selectedTemplateId, onTemplateChange, onFileSelected }) {
  const templateOptions = templates.map((template) => ({ value: template.id, label: template.name }));

  return (
    <div className="stack">
      {parseError ? <Alert type="error" showIcon message={parseError} /> : null}
      {templateOptions.length ? (
        <Space wrap align="center">
          <Typography.Text strong>Template</Typography.Text>
          <Select
            data-testid="file-template-select"
            allowClear
            value={selectedTemplateId}
            onChange={onTemplateChange}
            options={templateOptions}
            placeholder="Start from saved template"
            style={{ minWidth: 280 }}
          />
        </Space>
      ) : null}
      <Dragger
        data-testid="file-upload-dragger"
        accept=".csv,.xls,.xlsx"
        maxCount={1}
        multiple={false}
        showUploadList={false}
        beforeUpload={(file) => {
          onFileSelected(file);
          return false;
        }}
        disabled={parsing}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">Drop a spreadsheet here or choose a file</p>
        <p className="ant-upload-hint">CSV, XLS, and XLSX files are parsed locally in this browser.</p>
      </Dragger>
    </div>
  );
}