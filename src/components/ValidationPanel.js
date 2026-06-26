"use client";

import { Alert, Collapse, List, Space } from "antd";

function MessageList({ items }) {
  return <List size="small" dataSource={items} renderItem={(item) => <List.Item>{item}</List.Item>} />;
}

export default function ValidationPanel({ report }) {
  if (!report) {
    return null;
  }

  const collapseItems = [];

  if (report.rowWarnings?.length) {
    collapseItems.push({
      key: "rowWarnings",
      label: `Row warnings (${report.rowWarnings.length})`,
      children: <MessageList items={report.rowWarnings} />,
    });
  }

  return (
    <Space direction="vertical" size="middle" className="full-width">
      {report.blockingErrors.length ? (
        <Alert
          type="error"
          showIcon
          message={`${report.blockingErrors.length} blocking issue${report.blockingErrors.length === 1 ? "" : "s"}`}
          description={<MessageList items={report.blockingErrors} />}
        />
      ) : (
        <Alert type="success" showIcon message="Validation passed" />
      )}
      {report.warnings.length ? (
        <Alert type="warning" showIcon message="Warnings" description={<MessageList items={report.warnings} />} />
      ) : null}
      {collapseItems.length ? <Collapse size="small" items={collapseItems} /> : null}
    </Space>
  );
}