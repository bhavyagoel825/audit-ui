"use client";

import { Alert, Collapse, List, Space, Typography } from "antd";

const { Text } = Typography;

function MessageList({ items }) {
  return <List size="small" dataSource={items} renderItem={(item) => <List.Item>{item}</List.Item>} />;
}

export default function ValidationPanel({ report }) {
  if (!report) {
    return null;
  }

  const collapseItems = [];
  const summaryText = report.summary
    ? `Input rows: ${report.summary.inputRows}. Output rows: ${report.summary.outputRows}. Deleted rows: ${report.summary.deletedRows || 0}.`
    : null;

  if (report.rowWarnings?.length) {
    collapseItems.push({
      key: "rowWarnings",
      label: `Row warnings (${report.rowWarnings.length})`,
      children: <MessageList items={report.rowWarnings} />,
    });
  }

  return (
    <Space direction="vertical" size="middle" className="full-width" data-testid="validation-panel">
      {report.blockingErrors.length ? (
        <Alert
          data-testid="validation-errors"
          type="error"
          showIcon
          message={`${report.blockingErrors.length} blocking issue${report.blockingErrors.length === 1 ? "" : "s"}`}
          description={<MessageList items={report.blockingErrors} />}
        />
      ) : (
        <Alert data-testid="validation-success" type="success" showIcon message="Validation passed" description={summaryText ? <Text>{summaryText}</Text> : null} />
      )}
      {report.warnings.length ? (
        <Alert data-testid="validation-warnings" type="warning" showIcon message="Warnings" description={<MessageList items={report.warnings} />} />
      ) : null}
      {collapseItems.length ? <Collapse size="small" items={collapseItems} /> : null}
    </Space>
  );
}