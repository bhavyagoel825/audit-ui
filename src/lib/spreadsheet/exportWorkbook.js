import * as XLSX from "xlsx";

function makeOutputFileName(fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, "") || "audit-output";
  return `${baseName}-generated.xlsx`;
}

function makeCellFromValue(value) {
  if (value === null || value === undefined) {
    return { t: "s", v: "" };
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return { t: "n", v: value };
  }

  if (typeof value === "boolean") {
    return { t: "b", v: value };
  }

  if (value instanceof Date) {
    return { t: "d", v: value };
  }

  return { t: "s", v: String(value) };
}

function makeCellFromMetadata(metadata, fallbackValue) {
  if (!metadata) {
    return makeCellFromValue(fallbackValue);
  }

  const cell = makeCellFromValue(metadata.value);
  if (["n", "s", "b", "d", "str"].includes(metadata.type)) {
    cell.t = metadata.type === "str" ? "s" : metadata.type;
  }

  if (metadata.format) {
    cell.z = metadata.format;
  }

  return cell;
}

function makeWorksheet(outputRows, outputHeaders, outputCellMetadataRows = []) {
  const worksheet = {};

  outputHeaders.forEach((header, columnIndex) => {
    const address = XLSX.utils.encode_cell({ r: 0, c: columnIndex });
    worksheet[address] = { t: "s", v: header };
  });

  outputRows.forEach((row, rowIndex) => {
    const rowMetadata = outputCellMetadataRows[rowIndex] || {};

    outputHeaders.forEach((header, columnIndex) => {
      const address = XLSX.utils.encode_cell({ r: rowIndex + 1, c: columnIndex });
      worksheet[address] = makeCellFromMetadata(rowMetadata[header], row[header]);
    });
  });

  worksheet["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: outputRows.length, c: Math.max(outputHeaders.length - 1, 0) },
  });

  return worksheet;
}

export function downloadExcel(outputRows, outputHeaders, fileName, outputCellMetadataRows = []) {
  const worksheet = makeWorksheet(outputRows, outputHeaders, outputCellMetadataRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Generated");
  XLSX.writeFile(workbook, makeOutputFileName(fileName));
}