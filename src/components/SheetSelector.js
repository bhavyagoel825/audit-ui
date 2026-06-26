"use client";

import { Select, Space, Typography } from "antd";

export default function SheetSelector({ sheets, selectedSheetName, onSelectSheet }) {
  return (
    <Space wrap align="center">
      <Typography.Text strong>Sheet</Typography.Text>
      <Select
        value={selectedSheetName}
        onChange={onSelectSheet}
        options={sheets.map((sheet) => ({
          value: sheet.name,
          label: `${sheet.name} (${sheet.rowCount} rows, ${sheet.columnCount} columns)`,
        }))}
        style={{ minWidth: 280 }}
      />
    </Space>
  );
}