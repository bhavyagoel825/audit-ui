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
    <Drawer title="Add derived column" open={open} onClose={onClose} width={420} destroyOnClose>
      <Form form={form} layout="vertical" initialValues={{ operationType: "concat" }}>
        <Form.Item label="Output name" name="outputName">
          <Input placeholder="New output column" />
        </Form.Item>
        <Form.Item label="Operation" name="operationType">
          <Select options={OPERATION_OPTIONS.filter((option) => option.value !== "copy")} />
        </Form.Item>
        <Space className="toolbar right">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit}>Add column</Button>
        </Space>
      </Form>
    </Drawer>
  );
}