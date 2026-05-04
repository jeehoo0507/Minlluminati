import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@minlluminati.local'
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123'

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!existing) {
    const hashed = await bcrypt.hash(adminPassword, 12)
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: '관리자',
        password: hashed,
        passwordSet: true,
        role: 'ADMIN',
      },
    })
    console.log(`✓ Admin created: ${adminEmail}`)
  } else {
    console.log(`✓ Admin already exists: ${adminEmail}`)
  }

  // ── 히든 뱃지 시드 ──────────────────────────────────────────────
  const badges = [
    {
      key: 'hidden_linear_algebra',
      name: '선형대수학자',
      description: 'Linear algebra 문제집의 모든 문제를 해결했습니다.',
      title: '선형대수학자',
      isHidden: true,
      isActive: true,
      sortOrder: 99,
    },
  ]

  for (const badge of badges) {
    await prisma.badge.upsert({
      where: { key: badge.key },
      create: badge,
      update: {},
    })
    console.log(`✓ Badge upserted: ${badge.key}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
