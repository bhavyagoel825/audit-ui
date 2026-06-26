"use client";

import { Card, Col, Row, Statistic } from "antd";

export default function SummaryCards({ fileName, sheet, generatedColumnCount }) {
  return (
    <Row gutter={[12, 12]}>
      <Col xs={24} md={8} lg={6}>
        <Card size="small">
          <Statistic title="File" value={fileName || "No file"} />
        </Card>
      </Col>
      <Col xs={12} md={8} lg={6}>
        <Card size="small">
          <Statistic title="Selected sheet" value={sheet?.name || "None"} />
        </Card>
      </Col>
      <Col xs={12} md={4} lg={4}>
        <Card size="small">
          <Statistic title="Rows" value={sheet?.rowCount || 0} />
        </Card>
      </Col>
      <Col xs={12} md={4} lg={4}>
        <Card size="small">
          <Statistic title="Columns" value={sheet?.columnCount || 0} />
        </Card>
      </Col>
      <Col xs={12} md={4} lg={4}>
        <Card size="small">
          <Statistic title="Generated columns" value={generatedColumnCount || 0} />
        </Card>
      </Col>
    </Row>
  );
}