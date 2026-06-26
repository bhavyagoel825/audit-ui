"use client";

import { Drawer, Form, Input, Select, Space, Button } from "antd";
import { OPERATION_OPTIONS, getDefaultOperation } from "@/lib/transforms/operations";

export default function DerivedColumnDrawer({ open, headers, onClose, onAdd }) {
  const [form] = Form.useForm();

  function handleSubmit() {
    const values = form.getFieldsValue();
    const operationType = values.operationType || "concat";
    onAdd({
      outputName: values.outputName || "Derived column",
      operation: getDefaultOperation(operationType, headers),
    });
    form.resetFields();
  }

  return (
    <Drawer title="Add derived column" open={open} onClose={onClose} width={420} destroyOnClose data-testid="derived-column-drawer">
      <Form form={form} layout="vertical" initialValues={{ operationType: "concat" }}>
        <Form.Item label="Output name" name="outputName">
          <Input data-testid="derived-output-name" placeholder="New output column" />
        </Form.Item>
        <Form.Item label="Operation" name="operationType">
          <Select data-testid="derived-operation" options={OPERATION_OPTIONS.filter((option) => option.value !== "copy")} />
        </Form.Item>
        <Space className="toolbar right">
          <Button onClick={onClose}>Cancel</Button>
          <Button data-testid="derived-add-column" type="primary" onClick={handleSubmit}>Add column</Button>
        </Space>
      </Form>
    </Drawer>
  );
}