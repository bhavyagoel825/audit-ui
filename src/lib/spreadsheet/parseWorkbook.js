import * as XLSX from "xlsx";

const SUPPORTED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);

function getExtension(fileName) {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

function normalizeHeader(value, index) {
  const text = String(value ?? "").trim();
  return text || `Column ${index + 1}`;
}

function makeUniqueHeaders(headerRow) {
  const seen = new Map();
  const duplicates = new Set();

  const headers = headerRow.map((value, index) => {
    const baseHeader = normalizeHeader(value, index);
    const count = seen.get(baseHeader) || 0;
    seen.set(baseHeader, count + 1);

    if (count > 0) {
      duplicates.add(baseHeader);
      return `${baseHeader} (${count + 1})`;
    }

    return baseHeader;
  });

  return { headers, duplicates: Array.from(duplicates) };
}

function worksheetToSheetData(worksheet, sheetName) {
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });

  const warnings = [];

  if (!matrix.length) {
    return {
      name: sheetName,
      headers: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
      warnings: ["Sheet is empty."],
    };
  }

  const widestRowLength = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  const headerRow = Array.from({ length: widestRowLength }, (_, index) => matrix[0]?.[index] ?? "");
  const { headers, duplicates } = makeUniqueHeaders(headerRow);

  if (duplicates.length) {
    warnings.push(`Duplicate source headers were renamed: ${duplicates.join(", ")}.`);
  }

  const rows = matrix.slice(1).map((row) => {
    return headers.reduce((record, header, index) => {
      record[header] = row[index] ?? "";
      return record;
    }, {});
  });

  return {
    name: sheetName,
    headers,
    rows,
    rowCount: rows.length,
    columnCount: headers.length,
    warnings,
  };
}

export async function parseSpreadsheetFile(file) {
  const extension = getExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("Unsupported file type. Choose a CSV, XLS, or XLSX file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

  const sheets = workbook.SheetNames.map((sheetName) => {
    return worksheetToSheetData(workbook.Sheets[sheetName], extension === "csv" ? "CSV" : sheetName);
  });

  return {
    fileName: file.name,
    sheets,
  };
}

export function getSheetData(workbookData, sheetName) {
  return workbookData?.sheets.find((sheet) => sheet.name === sheetName) || null;
}