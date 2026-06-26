# Full Implementation Plan: Local Spreadsheet Audit UI

## Goal
Build a new local-only JavaScript Next.js app at `/Users/bhavya/personal/projects/personal/audit-ui`, then wrap it in Electron so it can be packaged as a Windows installer/exe for non-technical Windows users.

The app accepts CSV/XLS/XLSX files, lets the user choose an Excel sheet when needed, previews the original data, lets the user define output columns through safe mappings/calculations, previews the generated result, and downloads the generated Excel file. All file parsing and generation must happen in the browser because the data is confidential.

## Firm Decisions
- App path: `/Users/bhavya/personal/projects/personal/audit-ui`.
- Parent path: `/Users/bhavya/personal/projects/personal`.
- Framework: Next.js App Router.
- Language: JavaScript only. Do not use TypeScript.
- UI library: Ant Design (`antd`) with `@ant-design/icons`.
- Spreadsheet library: `xlsx`.
- Runtime: local development only.
- Dev port: `3001`.
- Desktop wrapper: Electron.
- Windows packaging: `electron-builder` NSIS installer/exe.
- Use Node 20+ for install/build because current Next/Electron tooling expects it.
- No deployment setup.
- No automated test setup for now.
- No backend upload, API route file handling, server persistence, or remote storage.
- Safe expression builder only. Do not use arbitrary JavaScript, `eval`, function constructors, or freeform formulas.
- V1 transforms one selected sheet only.
- V1 does not filter/group rows, so output row count should match input row count.
- Empty source values should remain empty for text/copy/string operations.
- Math operations should treat blank, missing, or non-numeric values as `0`.
- Division by zero should return `0` rather than blocking generation.

## Scaffold Commands
Run from terminal:

```bash
mkdir -p /Users/bhavya/personal/projects/personal
cd /Users/bhavya/personal/projects/personal
npx create-next-app@latest audit-ui --js --eslint --app --src-dir --import-alias "@/*" --use-npm
cd audit-ui
npm install antd @ant-design/icons xlsx
npm install --save-dev electron electron-builder
```

After scaffolding, update `package.json` scripts so local start uses port `3001`:

```json
{
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint",
    "electron": "electron electron/main.cjs",
    "electron:dev": "ELECTRON_START_URL=http://localhost:3001 electron electron/main.cjs",
    "dist": "npm run build && electron-builder",
    "dist:win": "npm run build && electron-builder --win nsis --x64 --arm64"
  }
}
```

If `next lint` is unavailable in the installed Next version, use the scaffolded `eslint` script.

For static Electron packaging, configure `next.config.mjs` with static export settings:

```js
const nextConfig = {
  output: "export",
  assetPrefix: "./",
  images: {
    unoptimized: true,
  },
};
```

## Suggested File Structure

```text
audit-ui/
  electron/
    main.cjs
  package.json
  next.config.mjs
  src/
    app/
      globals.css
      layout.js
      page.js
    components/
      FileUploadPanel.js
      SheetSelector.js
      SourcePreview.js
      MappingEditor.js
      DerivedColumnDrawer.js
      ValidationPanel.js
      GeneratedPreview.js
      SummaryCards.js
    lib/
      spreadsheet/
        parseWorkbook.js
        exportWorkbook.js
        tableUtils.js
      transforms/
        initialPlan.js
        operations.js
        validatePlan.js
        runTransform.js
```

Keep the implementation compact if desired, but preserve this separation if possible:
- `src/app/page.js`: workflow state and high-level layout.
- `src/components/*`: Ant Design UI pieces.
- `src/lib/spreadsheet/*`: file parsing/export helpers.
- `src/lib/transforms/*`: transformation logic, with no React dependencies.

## Data Model

### Parsed workbook state

```js
{
  fileName: "input.xlsx",
  sheets: [
    {
      name: "Sheet1",
      headers: ["Client", "Amount", "Date"],
      rows: [
        { Client: "A", Amount: 12, Date: "2026-01-01" }
      ],
      rowCount: 1,
      columnCount: 3,
      warnings: []
    }
  ]
}
```

### Transformation plan

```js
{
  columns: [
    {
      id: "col_Client",
      outputName: "Client",
      enabled: true,
      operation: {
        type: "copy",
        source: "Client"
      }
    },
    {
      id: "derived_Total",
      outputName: "Total",
      enabled: true,
      operation: {
        type: "add",
        sources: ["Amount", "Tax"]
      }
    }
  ]
}
```

### Validation report

```js
{
  blockingErrors: [],
  warnings: [],
  rowWarnings: [],
  summary: {
    inputRows: 100,
    outputRows: 100,
    inputColumns: 8,
    outputColumns: 6
  }
}
```

## Spreadsheet Parsing Plan

Use `xlsx` in browser-only mode:

1. Read selected file via `file.arrayBuffer()`.
2. Parse with `XLSX.read(arrayBuffer, { type: "array", cellDates: true })`.
3. For each sheet, convert to rows with `XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false })`.
4. Infer headers from the first object keys.
5. Keep original rows as immutable source state.
6. When user selects a sheet, initialize the transformation plan from that sheet's headers.

Parsing guardrails:
- Reject unsupported file extensions.
- Show empty-sheet warning.
- Show duplicate header warning/error if detected.
- Show row and column counts before mapping.
- Do not upload or send file content anywhere.

## Spreadsheet Export Plan

Use `xlsx` in browser:

1. Validate transformation plan.
2. Run transform against original rows.
3. Use `XLSX.utils.json_to_sheet(outputRows, { header: outputHeaders })`.
4. Create workbook with `XLSX.utils.book_new()` and `XLSX.utils.book_append_sheet()`.
5. Download with `XLSX.writeFile(workbook, generatedFileName)`.
6. Generated preview must use the exact `outputRows` used for download.

## Desktop Packaging Plan

Use Electron as a thin local shell around the statically exported Next app:

1. `npm run build` creates the static Next export in `out/`.
2. `electron/main.cjs` loads `out/index.html` in packaged mode.
3. `electron:dev` loads `http://localhost:3001` while the Next dev server is running.
4. `electron-builder` packages `electron/**/*`, `out/**/*`, and `package.json`.
5. `npm run dist:win` creates Windows NSIS installer artifacts under `release/` for x64 and ARM64 Windows.

Recommended Windows packaging command:

```bash
cd /Users/bhavya/personal/projects/personal/audit-ui
nvm use 20
npm run dist:win
```

Note: building Windows `.exe` installers from macOS may require Wine or may be more reliable from a Windows machine/CI runner. The app config should support Windows packaging either way. The x64 artifact is the one most Windows users need; ARM64 is for Windows on ARM devices.

## Supported Safe Operations

Implement these first:

1. `copy`: copy a source column as-is.
2. `concat`: concatenate selected columns and/or literals using a separator.
3. `add`: numeric addition of two or more source columns.
4. `subtract`: numeric subtraction from first source minus later sources.
5. `multiply`: numeric multiplication of two or more source columns.
6. `divide`: numeric division of first source by second source.
7. `trim`: trim string value from one source column.
8. `uppercase`: uppercase string value from one source column.
9. `lowercase`: lowercase string value from one source column.
10. `fallback`: use primary source value, otherwise fallback source/literal.
11. `dateFormat`: optional v1 operation if simple formatting can be implemented safely; otherwise hide it until reliable.

Blocking errors:
- Duplicate output column names.
- Enabled column with empty output name.
- Enabled operation references a missing source column.
- Operation config is incomplete.
- Output row count differs from input row count.

Warnings:
- Very large files may be slow locally.

Important: for V1, math operations deliberately coerce blank, missing, and non-numeric inputs to `0` based on the latest requirement. Text operations should preserve blanks.

## UI Plan With Ant Design

### Overall layout
Use `Layout`, `Typography`, `Space`, `Card`, `Tabs`, `Steps`, `Alert`, and `Button`.

Keep UI minimal and work-focused:
- Top title: `Spreadsheet Audit Tool`.
- Small note: `Files are processed locally in your browser.`
- Summary cards for file name, selected sheet, row count, column count, generated columns.
- Tabs: `Source`, `Mappings`, `Generated`.

### Upload flow
Component: `FileUploadPanel.js`

Use Ant Design `Upload.Dragger`:
- Accept `.csv,.xls,.xlsx`.
- Use `beforeUpload={() => false}` to prevent upload.
- On file selection, parse client-side.
- Clear previous generated output when a new file is selected.

### Sheet selection
Component: `SheetSelector.js`

Use `Select`:
- Show sheet names.
- On selection, load rows/headers and initialize default mapping plan.
- For CSV, use one synthetic sheet name like `CSV`.

### Source preview
Component: `SourcePreview.js`

Use Ant Design `Table`:
- Dynamic columns from selected sheet headers.
- Paginated rows.
- Horizontal scroll for many columns.
- Show parse warnings/errors above table using `Alert`.

### Mapping editor
Component: `MappingEditor.js`

Use Ant Design `Table` for output columns:
Columns in mapping table:
- Enabled: `Switch`.
- Output column name: `Input`.
- Operation type: `Select`.
- Source columns: `Select` with `mode="multiple"` where needed.
- Separator/literal/value controls based on operation.
- Reorder: up/down icon buttons from `@ant-design/icons`.
- Delete/exclude: disable switch or delete icon.

Actions:
- `Add derived column` opens `DerivedColumnDrawer` or adds a blank row.
- `Reset mappings` restores default copy plan from source headers.
- `Generate preview` validates and runs transformation.

### Generated preview
Component: `GeneratedPreview.js`

Use Ant Design `Table`:
- Shows generated rows after successful validation.
- Uses same output data that will be exported.
- Download button enabled only when there are no blocking errors and generated output exists.

### Validation panel
Component: `ValidationPanel.js`

Use `Alert`, `List`, `Collapse`, or `Result`:
- Blocking errors shown as red error alert.
- Warnings shown as yellow warning alert.
- Summary shown as compact counts.

## Implementation Phases

### Phase 1: Scaffold and dependencies
1. Create parent folder.
2. Scaffold JavaScript Next app.
3. Install `antd`, `@ant-design/icons`, `xlsx`.
4. Update scripts for port `3001`.
5. Clean default starter content.

### Phase 2: Spreadsheet helpers
Create:
- `src/lib/spreadsheet/parseWorkbook.js`
- `src/lib/spreadsheet/exportWorkbook.js`
- `src/lib/spreadsheet/tableUtils.js`

Functions:
- `parseSpreadsheetFile(file)`
- `getSheetData(workbookData, sheetName)`
- `makeTableColumns(headers)`
- `makeTableRows(rows)`
- `downloadExcel(outputRows, outputHeaders, fileName)`

### Phase 3: Transform helpers
Create:
- `src/lib/transforms/initialPlan.js`
- `src/lib/transforms/operations.js`
- `src/lib/transforms/validatePlan.js`
- `src/lib/transforms/runTransform.js`

Functions:
- `createInitialPlan(headers)`
- `validatePlan(plan, headers, rows)`
- `runTransform(rows, plan)`
- `runOperation(row, operation)`
- `normalizeNumber(value)`

### Phase 4: Components
Create:
- `FileUploadPanel.js`
- `SheetSelector.js`
- `SummaryCards.js`
- `SourcePreview.js`
- `MappingEditor.js`
- `ValidationPanel.js`
- `GeneratedPreview.js`

Wire them in `src/app/page.js`.

### Phase 5: Styling
Update `src/app/globals.css`:
- Basic page background.
- Content max width.
- Table scroll handling.
- Compact toolbar spacing.
- No decorative/marketing UI.

### Phase 6: Local verification
Run:

```bash
cd /Users/bhavya/personal/projects/personal/audit-ui
npm run dev
```

Open:

```text
http://localhost:3001
```

Manual checks:
1. Upload CSV.
2. Upload XLSX with multiple sheets and select a sheet.
3. Confirm source preview rows and columns.
4. Rename a column.
5. Exclude/delete a column.
6. Reorder output columns.
7. Add derived concat column.
8. Add numeric add/subtract/multiply/divide column.
9. Confirm divide-by-zero blocks generation.
10. Confirm missing source column blocks generation.
11. Confirm duplicate output names block generation.
12. Generate output preview.
13. Download Excel.
14. Reopen downloaded Excel and compare with preview.

### Phase 7: Desktop packaging verification

Run:

```bash
cd /Users/bhavya/personal/projects/personal/audit-ui
nvm use 20
npm run build
npm run electron
```

Then package Windows installer:

```bash
npm run dist:win
```

Manual desktop checks:
1. Electron app opens without a dev server in packaged/static mode.
2. Upload and parse CSV/XLS/XLSX.
3. Generate preview and download Excel from inside Electron.
4. Confirm downloaded file can be opened from Windows Excel.
5. Confirm the Windows installer/exe runs on a clean Windows user account.

## Minimal Acceptance Criteria
- App runs locally at `http://localhost:3001`.
- User can upload CSV/XLS/XLSX without server upload.
- User can view source file data.
- User can choose an Excel sheet.
- User can see all detected columns.
- User can include/exclude columns.
- User can rename columns.
- User can reorder columns.
- User can add calculated/merged derived columns using safe operations.
- User can validate and generate output.
- Blocking errors prevent download.
- User can preview generated output.
- User can download generated Excel.
- Electron desktop app can load the exported Next UI without a backend server.
- Windows installer/exe can be generated with `npm run dist:win`.
- Original data is never mutated during transformations.

## Notes For Next Session
- The implementation should be created in `/Users/bhavya/personal/projects/personal/audit-ui`, not inside `/Users/bhavya/personal/projects/dr`.
- Keep everything local and browser-only.
- Avoid tests and deployment unless the user later asks for them.
- Use JavaScript file extensions: `.js`, not `.ts` or `.tsx`.
- Use Ant Design components for the UI instead of custom component libraries.
- Keep Electron as a thin local wrapper; do not move spreadsheet data into a backend process unless a later requirement needs it.
