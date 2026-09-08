'use client';

import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  downloadExcelTemplate,
  ExcelImportRow,
  ExcelReferenceSheet,
  ExcelTemplateColumn,
  readExcelImportRows,
} from '@/lib/excel-template';

type ImportFailure = { row: number; message: string };

type ExcelBulkActionsProps = {
  entityLabel: string;
  fileName: string;
  columns: ExcelTemplateColumn[];
  exampleRows: Array<Record<string, string | number>>;
  referenceSheets?: ExcelReferenceSheet[];
  onImportRow: (row: ExcelImportRow, rowNumber: number) => Promise<void>;
  onComplete?: () => void | Promise<void>;
  disabled?: boolean;
};

export default function ExcelBulkActions({
  entityLabel,
  fileName,
  columns,
  exampleRows,
  referenceSheets,
  onImportRow,
  onComplete,
  disabled = false,
}: ExcelBulkActionsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [resultOpen, setResultOpen] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [failures, setFailures] = useState<ImportFailure[]>([]);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadExcelTemplate({ fileName, entityLabel, columns, exampleRows, referenceSheets });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || isImporting) return;
    setIsImporting(true);
    setProgress('Reading workbook...');
    setFailures([]);
    setSuccessCount(0);

    try {
      const rows = await readExcelImportRows(file);
      if (rows.length === 0) throw new Error('The Data sheet has no rows to import.');

      const requiredColumns = columns.filter((column) => column.required).map((column) => column.key);
      const nextFailures: ImportFailure[] = [];
      let imported = 0;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rowNumber = index + 2;
        setProgress(`Importing ${index + 1} of ${rows.length}...`);
        const missing = requiredColumns.filter((key) => !String(row[key] ?? '').trim());
        if (missing.length > 0) {
          nextFailures.push({ row: rowNumber, message: `Missing: ${missing.join(', ')}` });
          continue;
        }
        try {
          await onImportRow(row, rowNumber);
          imported += 1;
        } catch (error) {
          nextFailures.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : 'Import failed.',
          });
        }
      }

      setSuccessCount(imported);
      setFailures(nextFailures);
      if (imported > 0) await onComplete?.();
    } catch (error) {
      setFailures([{ row: 0, message: error instanceof Error ? error.message : 'Import failed.' }]);
    } finally {
      setProgress('');
      setIsImporting(false);
      setResultOpen(true);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={handleDownload} disabled={disabled || isDownloading || isImporting}>
          <Download className="mr-2 h-4 w-4" />
          {isDownloading ? 'Preparing...' : `Download ${entityLabel} Template`}
        </Button>
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled || isImporting}>
          <Upload className="mr-2 h-4 w-4" />
          {isImporting ? progress || 'Importing...' : `Upload ${entityLabel} Excel`}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />
      </div>

      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{entityLabel} import result</DialogTitle>
            <DialogDescription>
              {successCount} row(s) imported successfully; {failures.length} row(s) failed.
            </DialogDescription>
          </DialogHeader>
          {failures.length > 0 && (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {failures.map((failure, index) => (
                <p key={`${failure.row}-${index}`}>
                  {failure.row > 0 ? `Excel row ${failure.row}: ` : ''}{failure.message}
                </p>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button type="button" onClick={() => setResultOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
