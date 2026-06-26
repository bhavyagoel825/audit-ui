"use client";

import { Alert, Button, Empty, Space, Table, Typography } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { makeTableColumns, makeTableRows } from "@/lib/spreadsheet/tableUtils";

const { Text } = Typography;

function makeDeletedRowsColumns(headers = []) {
  return [
    {
      title: "Source row",
      dataIndex: "__sourceRowNumber",
      key: "__sourceRowNumber",
      width: 110,
      fixed: "left",
    },
    ...makeTableColumns(headers),
  ];
}

export default function GeneratedPreview({ generated, sourceHeaders = [], canDownload, onDownload }) {
  if (!generated) {
    return <Empty description="Generate a preview to inspect output data" />;
  }

  const deletedSourceRows = generated.deletedSourceRows || [];

  return (
    <Space direction="vertical" size="middle" className="full-width">
      <div className="toolbar right">
        <Button type="primary" icon={<DownloadOutlined />} disabled={!canDownload} onClick={onDownload}>
          Download Excel
        </Button>
      </div>
      {deletedSourceRows.length ? (
        <div className="deleted-rows-preview">
          <Alert type="warning" showIcon message={`Deleted source rows (${deletedSourceRows.length})`} />
          <Table
            size="small"
            columns={makeDeletedRowsColumns(sourceHeaders)}
            dataSource={makeTableRows(deletedSourceRows)}
            rowClassName="deleted-source-row"
            scroll={{ x: "max-content" }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            bordered
          />
        </div>
      ) : null}
      {generated.outputRows.length ? (
        <Table
          size="small"
          columns={makeTableColumns(generated.outputHeaders)}
          dataSource={makeTableRows(generated.outputRows)}
          scroll={{ x: "max-content" }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          bordered
        />
      ) : (
        <Empty description={<Text>No output rows remain after delete row conditions.</Text>} />
      )}
    </Space>
  );
}