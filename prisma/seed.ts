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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
