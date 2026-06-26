import { collectOperationWarnings, runOperation } from "./operations";

function isFilled(value) {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function getPassthroughMetadata(rowMetadata, row, operation) {
  const type = operation?.type;

  if (type === "copy") {
    return rowMetadata?.[operation.source] ?? null;
  }

  if (type === "fallback") {
    const primary = row[operation.primarySource];
    if (isFilled(primary)) {
      return rowMetadata?.[operation.primarySource] ?? null;
    }

    if (operation.fallbackSource && isFilled(row[operation.fallbackSource])) {
      return rowMetadata?.[operation.fallbackSource] ?? null;
    }
  }

  return null;
}

export function runTransform(rows, plan, cellMetadataRows = []) {
  const enabledColumns = plan.columns.filter((column) => column.enabled);
  const outputHeaders = enabledColumns.map((column) => column.outputName.trim());
  const rowWarnings = [];
  const outputCellMetadataRows = [];

  const outputRows = rows.map((row, rowIndex) => {
    const rowMetadata = cellMetadataRows[rowIndex] || {};
    const outputRowMetadata = {};

    const outputRow = enabledColumns.reduce((currentOutputRow, column) => {
      const outputName = column.outputName.trim();
      currentOutputRow[outputName] = runOperation(row, column.operation);
      outputRowMetadata[outputName] = getPassthroughMetadata(rowMetadata, row, column.operation);
      rowWarnings.push(...collectOperationWarnings(row, rowIndex, outputName, column.operation));
      return currentOutputRow;
    }, {});

    outputCellMetadataRows.push(outputRowMetadata);
    return outputRow;
  });

  return {
    outputHeaders,
    outputRows,
    outputCellMetadataRows,
    rowWarnings: rowWarnings.slice(0, 50),
  };
}