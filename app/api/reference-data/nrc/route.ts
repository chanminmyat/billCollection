import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'lib', 'nrc-data.json');

export async function GET() {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return NextResponse.json({ content });
  } catch (error) {
    return NextResponse.json(
      { message: 'Failed to read NRC data.' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const content = body?.content;

    if (typeof content !== 'string') {
      return NextResponse.json(
        { message: 'Content must be a JSON string.' },
        { status: 400 }
      );
    }

    const parsed = JSON.parse(content);
    const pretty = JSON.stringify(parsed, null, 2);
    await fs.writeFile(filePath, `${pretty}\n`, 'utf8');

    return NextResponse.json({ message: 'NRC data saved.' });
  } catch (error) {
    return NextResponse.json(
      { message: 'Invalid JSON. Please check formatting.' },
      { status: 400 }
    );
  }
}
