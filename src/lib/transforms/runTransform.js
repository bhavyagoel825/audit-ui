import { collectOperationWarnings, runOperation } from "./operations";

export function runTransform(rows, plan) {
  const enabledColumns = plan.columns.filter((column) => column.enabled);
  const outputHeaders = enabledColumns.map((column) => column.outputName.trim());
  const rowWarnings = [];

  const outputRows = rows.map((row, rowIndex) => {
    return enabledColumns.reduce((outputRow, column) => {
      const outputName = column.outputName.trim();
      outputRow[outputName] = runOperation(row, column.operation);
      rowWarnings.push(...collectOperationWarnings(row, rowIndex, outputName, column.operation));
      return outputRow;
    }, {});
  });

  return {
    outputHeaders,
    outputRows,
    rowWarnings: rowWarnings.slice(0, 50),
  };
}