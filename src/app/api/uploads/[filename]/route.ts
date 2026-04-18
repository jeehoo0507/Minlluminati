import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { filename: string } }
) {
  const { filename } = params

  // path traversal 방지
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return new NextResponse('Not Found', { status: 404 })
  }

  const filepath = path.join(process.cwd(), 'public', 'uploads', filename)

  try {
    const file = await readFile(filepath)
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}
