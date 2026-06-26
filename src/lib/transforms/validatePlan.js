import { DELETE_ROW_RULE_LABELS, isValidDeleteRowCondition, shouldDeleteRow } from "./deleteRowConditions";

const NUMERIC_OPERATIONS = new Set(["add", "subtract", "multiply", "divide"]);
const SINGLE_SOURCE_OPERATIONS = new Set(["copy", "trim", "uppercase", "lowercase"]);

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function addMissingSourceErrors(errors, source, headers, outputName) {
  if (!source || !headers.includes(source)) {
    errors.push(`${outputName}: operation references a missing source column.`);
  }
}

function validateOperationConfig(column, headers, errors) {
  const operation = column.operation || {};
  const outputName = column.outputName || "Unnamed column";

  if (SINGLE_SOURCE_OPERATIONS.has(operation.type)) {
    addMissingSourceErrors(errors, operation.source, headers, outputName);
    return;
  }

  if (operation.type === "concat") {
    const sources = operation.sources || [];
    const hasLiteral = !isBlank(operation.literal);
    if (!sources.length && !hasLiteral) {
      errors.push(`${outputName}: concat needs at least one source column or literal.`);
    }
    sources.forEach((source) => addMissingSourceErrors(errors, source, headers, outputName));
    return;
  }

  if (NUMERIC_OPERATIONS.has(operation.type)) {
    const sources = operation.sources || [];
    const minimumSources = operation.type === "divide" ? 2 : 2;
    if (sources.length < minimumSources) {
      errors.push(`${outputName}: ${operation.type} needs at least ${minimumSources} source columns.`);
    }
    if (operation.type === "divide" && sources.length > 2) {
      errors.push(`${outputName}: divide supports exactly two source columns.`);
    }
    sources.forEach((source) => addMissingSourceErrors(errors, source, headers, outputName));
    return;
  }

  if (operation.type === "fallback") {
    addMissingSourceErrors(errors, operation.primarySource, headers, outputName);
    if (!operation.fallbackSource && isBlank(operation.fallbackLiteral)) {
      errors.push(`${outputName}: fallback needs a fallback source or literal.`);
    }
    if (operation.fallbackSource) {
      addMissingSourceErrors(errors, operation.fallbackSource, headers, outputName);
    }
    return;
  }

  errors.push(`${outputName}: operation config is incomplete.`);
}

function validateDeleteRowConditions(conditions, headers, errors) {
  conditions.forEach((condition, index) => {
    if (condition?.enabled === false) {
      return;
    }

    const conditionLabel = `Delete row condition ${index + 1}`;
    const selectedColumns = condition?.columns || [];

    if (!DELETE_ROW_RULE_LABELS[condition?.rule]) {
      errors.push(`${conditionLabel}: select a valid rule.`);
    }

    if (!["any", "all"].includes(condition?.match)) {
      errors.push(`${conditionLabel}: select OR or AND.`);
    }

    if (!selectedColumns.length) {
      errors.push(`${conditionLabel}: select at least one source column.`);
    }

    selectedColumns.forEach((column) => {
      if (!headers.includes(column)) {
        errors.push(`${conditionLabel}: ${column} is not in the source sheet.`);
      }
    });
  });
}

function countDeletedRows(rows, plan, headers) {
  const validConditions = (plan.deleteRowConditions || []).filter((condition) => isValidDeleteRowCondition(condition, headers));
  if (!validConditions.length) {
    return 0;
  }

  return rows.reduce((count, row) => {
    return validConditions.some((condition) => shouldDeleteRow(row, condition)) ? count + 1 : count;
  }, 0);
}

export function validatePlan(plan, headers, rows, expectedOutputRows = null) {
  const blockingErrors = [];
  const warnings = [];
  const enabledColumns = plan.columns.filter((column) => column.enabled);
  const deleteRowConditions = plan.deleteRowConditions || [];
  const outputNames = enabledColumns.map((column) => String(column.outputName || "").trim());
  const seenOutputNames = new Set();

  outputNames.forEach((outputName) => {
    if (!outputName) {
      blockingErrors.push("Enabled column has an empty output name.");
      return;
    }

    const key = outputName.toLowerCase();
    if (seenOutputNames.has(key)) {
      blockingErrors.push(`Duplicate output column name: ${outputName}.`);
    }
    seenOutputNames.add(key);
  });

  enabledColumns.forEach((column) => validateOperationConfig(column, headers, blockingErrors));
  validateDeleteRowConditions(deleteRowConditions, headers, blockingErrors);

  const deletedRows = countDeletedRows(rows, plan, headers);
  const expectedRowsAfterDeletion = rows.length - deletedRows;

  if (expectedOutputRows !== null && expectedOutputRows !== expectedRowsAfterDeletion) {
    blockingErrors.push("Output row count does not match the configured delete row conditions.");
  }

  if (rows.length > 5000) {
    warnings.push("Large files may take a moment to transform locally in the browser.");
  }

  return {
    blockingErrors: Array.from(new Set(blockingErrors)),
    warnings,
    rowWarnings: [],
    summary: {
      inputRows: rows.length,
      outputRows: expectedOutputRows ?? expectedRowsAfterDeletion,
      deletedRows,
      inputColumns: headers.length,
      outputColumns: enabledColumns.length,
    },
  };
}