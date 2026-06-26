export const OPERATION_LABELS = {
  copy: "Copy",
  concat: "Concatenate",
  add: "Add",
  subtract: "Subtract",
  multiply: "Multiply",
  divide: "Divide",
  trim: "Trim",
  uppercase: "Uppercase",
  lowercase: "Lowercase",
  fallback: "Fallback",
};

export const OPERATION_OPTIONS = Object.entries(OPERATION_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function getDefaultOperation(type, headers) {
  const first = headers[0] || "";
  const second = headers[1] || "";

  if (type === "copy") {
    return { type, source: first };
  }

  if (["trim", "uppercase", "lowercase"].includes(type)) {
    return { type, source: first };
  }

  if (["add", "subtract", "multiply"].includes(type)) {
    return { type, sources: [first, second].filter(Boolean) };
  }

  if (type === "divide") {
    return { type, sources: [first, second].filter(Boolean).slice(0, 2) };
  }

  if (type === "fallback") {
    return { type, primarySource: first, fallbackSource: second, fallbackLiteral: "" };
  }

  return { type: "concat", sources: [], separator: " ", literal: "" };
}

export function normalizeNumber(value) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { ok: true, value: 0 };
  }

  const normalized = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(normalized) ? { ok: true, value: normalized } : { ok: true, value: 0 };
}

function isFilled(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

export function runOperation(row, operation) {
  const type = operation?.type;

  if (type === "copy") {
    return row[operation.source] ?? "";
  }

  if (type === "concat") {
    const values = (operation.sources || []).map((source) => row[source] ?? "");
    if (isFilled(operation.literal)) {
      values.push(operation.literal);
    }
    return values.map((value) => String(value)).join(operation.separator ?? "");
  }

  if (["add", "subtract", "multiply", "divide"].includes(type)) {
    const numbers = (operation.sources || []).map((source) => normalizeNumber(row[source]).value);

    if (type === "add") {
      return numbers.reduce((total, value) => total + value, 0);
    }

    if (type === "subtract") {
      return numbers.slice(1).reduce((total, value) => total - value, numbers[0]);
    }

    if (type === "multiply") {
      return numbers.reduce((total, value) => total * value, 1);
    }

    return numbers[1] === 0 ? 0 : numbers[0] / numbers[1];
  }

  if (type === "trim") {
    return String(row[operation.source] ?? "").trim();
  }

  if (type === "uppercase") {
    return String(row[operation.source] ?? "").toUpperCase();
  }

  if (type === "lowercase") {
    return String(row[operation.source] ?? "").toLowerCase();
  }

  if (type === "fallback") {
    const primary = row[operation.primarySource];
    if (isFilled(primary)) {
      return primary;
    }

    if (operation.fallbackSource) {
      const fallbackValue = row[operation.fallbackSource];
      if (isFilled(fallbackValue)) {
        return fallbackValue;
      }
    }

    return operation.fallbackLiteral ?? "";
  }

  return "";
}

export function collectOperationWarnings() {
  return [];
}