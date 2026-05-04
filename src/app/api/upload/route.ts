import { NextRequest, NextResponse } from 'next/server'
import { getAuth } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { nanoid } from 'nanoid'
import { checkRateLimit } from '@/lib/rateLimit'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/** Magic bytes 검증 — MIME 타입이 실제 파일 내용과 일치하는지 확인 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false

  switch (mimeType) {
    case 'image/jpeg':
      // FF D8 FF
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    case 'image/png':
      // 89 50 4E 47 0D 0A 1A 0A
      return (
        buffer[0] === 0x89 && buffer[1] === 0x50 &&
        buffer[2] === 0x4e && buffer[3] === 0x47
      )
    case 'image/gif':
      // 47 49 46 38 (GIF8)
      return (
        buffer[0] === 0x47 && buffer[1] === 0x49 &&
        buffer[2] === 0x46 && buffer[3] === 0x38
      )
    case 'image/webp':
      // RIFF....WEBP  (bytes 0-3: 52 49 46 46, bytes 8-11: 57 45 42 50)
      return (
        buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 &&
        buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 &&
        buffer[10] === 0x42 && buffer[11] === 0x50
      )
    case 'application/pdf':
      // 25 50 44 46 (%PDF)
      return (
        buffer[0] === 0x25 && buffer[1] === 0x50 &&
        buffer[2] === 0x44 && buffer[3] === 0x46
      )
    default:
      return false
  }
}

export async function POST(req: NextRequest) {
  const session = await getAuth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate limiting: 유저당 1분에 20개 업로드
  if (!checkRateLimit(`upload:${session.user.id}`, 20, 60 * 1000)) {
    return NextResponse.json(
      { error: '업로드 횟수를 초과했습니다. 잠시 후 다시 시도해주세요' },
      { status: 429 }
    )
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일을 선택해주세요' }, { status: 400 })

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 10MB 이하여야 합니다' }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '지원하지 않는 파일 형식입니다 (jpg/png/gif/webp/pdf)' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  // Magic bytes 검증 (실제 파일 내용 확인)
  if (!validateMagicBytes(buffer, file.type)) {
    return NextResponse.json(
      { error: '파일 내용이 선택한 형식과 일치하지 않습니다' },
      { status: 400 }
    )
  }

  // MIME 기반 확장자 결정 (사용자 파일명 신뢰 안 함)
  const ext = MIME_TO_EXT[file.type] ?? 'bin'
  const filename = `${nanoid()}.${ext}`
  const filepath = path.join(UPLOAD_DIR, filename)

  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(filepath, buffer)

  return NextResponse.json({ url: `/api/uploads/${filename}`, name: file.name })
}
