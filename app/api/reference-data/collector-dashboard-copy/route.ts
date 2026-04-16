import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import {
  DEFAULT_COLLECTOR_DASHBOARD_COPY,
  normalizeCollectorDashboardCopy,
} from '@/lib/collector-dashboard-copy';

const filePath = path.join(process.cwd(), 'lib', 'collector-dashboard-copy.json');

const readCopyFile = async () => {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return normalizeCollectorDashboardCopy(parsed);
  } catch {
    return {
      en: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.en },
      mm: { ...DEFAULT_COLLECTOR_DASHBOARD_COPY.mm },
    };
  }
};

export async function GET() {
  const copy = await readCopyFile();
  return NextResponse.json({ copy });
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { message: 'Invalid payload.' },
        { status: 400 },
      );
    }

    const copy = normalizeCollectorDashboardCopy(
      (body as { copy?: unknown }).copy ?? body,
    );
    const pretty = JSON.stringify(copy, null, 2);
    await fs.writeFile(filePath, `${pretty}\n`, 'utf8');

    return NextResponse.json({ message: 'Collector dashboard copy saved.', copy });
  } catch {
    return NextResponse.json(
      { message: 'Failed to save collector dashboard copy.' },
      { status: 500 },
    );
  }
}
