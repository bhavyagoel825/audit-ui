"use client";

import { Button, Empty, Space, Table } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { makeTableColumns, makeTableRows } from "@/lib/spreadsheet/tableUtils";

export default function GeneratedPreview({ generated, canDownload, onDownload }) {
  if (!generated?.outputRows?.length) {
    return <Empty description="Generate a preview to inspect output data" />;
  }

  return (
    <Space direction="vertical" size="middle" className="full-width">
      <div className="toolbar right">
        <Button type="primary" icon={<DownloadOutlined />} disabled={!canDownload} onClick={onDownload}>
          Download Excel
        </Button>
      </div>
      <Table
        size="small"
        columns={makeTableColumns(generated.outputHeaders)}
        dataSource={makeTableRows(generated.outputRows)}
        scroll={{ x: "max-content" }}
        pagination={{ pageSize: 20, showSizeChanger: true }}
        bordered
      />
    </Space>
  );
}