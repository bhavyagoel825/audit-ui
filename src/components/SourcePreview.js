"use client";

import { Alert, Empty, Space, Table } from "antd";
import { makeTableColumns, makeTableRows } from "@/lib/spreadsheet/tableUtils";

export default function SourcePreview({ sheet }) {
  if (!sheet) {
    return <Empty description="Upload a file to preview source data" />;
  }

  return (
    <Space direction="vertical" size="middle" className="full-width">
      {sheet.warnings.map((warning) => (
        <Alert key={warning} type="warning" showIcon message={warning} />
      ))}
      <Table
        size="small"
        columns={makeTableColumns(sheet.headers)}
        dataSource={makeTableRows(sheet.rows)}
        scroll={{ x: "max-content" }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        bordered
      />
    </Space>
  );
}