"use client";

import { Alert, Empty, Space, Table } from "antd";
import { makeTableColumns, makeTableRows } from "@/lib/spreadsheet/tableUtils";

export default function SourcePreview({ sheet, deletedSourceRows = [] }) {
  if (!sheet) {
    return <Empty description="Upload a file to preview source data" />;
  }

  const deletedRowNumbers = new Set(deletedSourceRows.map((row) => row.__sourceRowNumber));

  return (
    <Space direction="vertical" size="middle" className="full-width">
      {sheet.warnings.map((warning) => (
        <Alert key={warning} type="warning" showIcon message={warning} />
      ))}
      {deletedRowNumbers.size ? (
        <Alert type="warning" showIcon message={`${deletedRowNumbers.size} source row${deletedRowNumbers.size === 1 ? " is" : "s are"} highlighted for deletion.`} />
      ) : null}
      <Table
        size="small"
        columns={makeTableColumns(sheet.headers)}
        dataSource={makeTableRows(sheet.rows)}
        rowClassName={(_, index) => (deletedRowNumbers.has(index + 2) ? "deleted-source-row" : "")}
        scroll={{ x: "max-content" }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        bordered
      />
    </Space>
  );
}