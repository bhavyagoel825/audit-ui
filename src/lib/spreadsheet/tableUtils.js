export function makeTableColumns(headers) {
  return headers.map((header) => ({
    title: header,
    dataIndex: header,
    key: header,
    width: 180,
    ellipsis: true,
  }));
}

export function makeTableRows(rows) {
  return rows.map((row, index) => ({
    key: index,
    ...row,
  }));
}