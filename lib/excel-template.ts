export type ExcelTemplateColumn = {
  key: string;
  required?: boolean;
  description: string;
  example?: string | number;
  width?: number;
};

export type ExcelReferenceSheet = {
  name: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

export type ExcelImportRow = Record<string, string>;

const loadExcel = async () => import('exceljs');

export const downloadExcelTemplate = async (options: {
  fileName: string;
  entityLabel: string;
  columns: ExcelTemplateColumn[];
  exampleRows: Array<Record<string, string | number>>;
  referenceSheets?: ExcelReferenceSheet[];
}) => {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Bill Pro';
  workbook.created = new Date();

  const instructions = workbook.addWorksheet('Instructions');
  instructions.addRow([`${options.entityLabel} Excel Import Template`]);
  instructions.addRow([
    'Fill the Data sheet without changing the header names. Remove the example row before uploading.',
  ]);
  instructions.addRow([]);
  instructions.addRow(['Column', 'Required', 'Description', 'Example']);
  options.columns.forEach((column) => {
    instructions.addRow([
      column.key,
      column.required ? 'Yes' : 'No',
      column.description,
      column.example ?? '',
    ]);
  });
  instructions.getRow(1).font = { bold: true, size: 16 };
  instructions.getRow(4).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  instructions.getRow(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  instructions.columns = [
    { width: 28 },
    { width: 12 },
    { width: 70 },
    { width: 30 },
  ];
  instructions.views = [{ state: 'frozen', ySplit: 4 }];

  const data = workbook.addWorksheet('Data');
  data.addRow(options.columns.map((column) => column.key));
  options.exampleRows.forEach((example) => {
    data.addRow(options.columns.map((column) => example[column.key] ?? ''));
  });
  data.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  data.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  data.getRow(1).alignment = { vertical: 'middle' };
  data.autoFilter = { from: 'A1', to: `${columnLetter(options.columns.length)}1` };
  data.views = [{ state: 'frozen', ySplit: 1 }];
  data.columns.forEach((worksheetColumn, index) => {
    worksheetColumn.width = options.columns[index]?.width ?? 22;
  });

  options.referenceSheets?.forEach((reference) => {
    const sheet = workbook.addWorksheet(reference.name.slice(0, 31));
    sheet.addRow(reference.headers);
    reference.rows.forEach((row) => sheet.addRow(row));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF475569' } };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    sheet.columns.forEach((column) => {
      column.width = 28;
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = options.fileName.endsWith('.xlsx') ? options.fileName : `${options.fileName}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const readExcelImportRows = async (file: File): Promise<ExcelImportRow[]> => {
  const ExcelJS = await loadExcel();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const sheet = workbook.getWorksheet('Data') ?? workbook.worksheets[0];
  if (!sheet) throw new Error('The workbook does not contain a worksheet.');

  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, columnNumber) => {
    headers[columnNumber - 1] = cell.text.trim();
  });
  if (headers.every((header) => !header)) {
    throw new Error('The first row must contain column headers.');
  }

  const rows: ExcelImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: ExcelImportRow = {};
    let hasValue = false;
    headers.forEach((header, index) => {
      if (!header) return;
      const cell = row.getCell(index + 1);
      const value = cell.value instanceof Date
        ? [
            cell.value.getFullYear(),
            String(cell.value.getMonth() + 1).padStart(2, '0'),
            String(cell.value.getDate()).padStart(2, '0'),
          ].join('-')
        : cell.text.trim();
      record[header] = value;
      if (value) hasValue = true;
    });
    if (hasValue) rows.push(record);
  });
  return rows;
};

const columnLetter = (number: number) => {
  let value = Math.max(1, number);
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
};
