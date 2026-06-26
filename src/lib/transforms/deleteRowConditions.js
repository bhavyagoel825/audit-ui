export const DELETE_ROW_RULE_LABELS = {
  empty: "Empty",
  zero: "0",
  emptyOrZero: "Empty or 0",
};

export const DELETE_ROW_RULE_OPTIONS = Object.entries(DELETE_ROW_RULE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const DELETE_ROW_MATCH_OPTIONS = [
  { value: "any", label: "OR" },
  { value: "all", label: "AND" },
];

export function createDefaultDeleteRowCondition(headers = []) {
  return {
    id: `delete_rows_${Date.now()}`,
    enabled: true,
    rule: "emptyOrZero",
    match: "any",
    columns: headers[0] ? [headers[0]] : [],
  };
}

function isEmpty(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isZero(value) {
  if (isEmpty(value)) {
    return false;
  }

  const normalized = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(normalized) && normalized === 0;
}

export function doesValueMatchDeleteRule(value, rule) {
  if (rule === "empty") {
    return isEmpty(value);
  }

  if (rule === "zero") {
    return isZero(value);
  }

  return isEmpty(value) || isZero(value);
}

export function isValidDeleteRowCondition(condition, headers) {
  const selectedColumns = condition?.columns || [];
  return Boolean(
    condition?.enabled !== false &&
      DELETE_ROW_RULE_LABELS[condition?.rule] &&
      ["any", "all"].includes(condition?.match) &&
      selectedColumns.length &&
      selectedColumns.every((column) => headers.includes(column)),
  );
}

export function shouldDeleteRow(row, condition) {
  const selectedColumns = condition?.columns || [];
  if (!selectedColumns.length) {
    return false;
  }

  const matcher = (column) => doesValueMatchDeleteRule(row[column], condition.rule);
  return condition.match === "all" ? selectedColumns.every(matcher) : selectedColumns.some(matcher);
}

export function shouldKeepRow(row, conditions = []) {
  const enabledConditions = conditions.filter((condition) => condition?.enabled !== false);
  return !enabledConditions.some((condition) => shouldDeleteRow(row, condition));
}