#!/bin/sh
set -e

echo "🔧 Running database migrations..."
npx prisma db push

echo "🌱 Seeding database..."
node -e "
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()
async function seed() {
  const email = process.env.ADMIN_EMAIL || 'admin@minlluminati.local'
  const pw = process.env.ADMIN_PASSWORD || 'changeme123'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) {
    const hashed = await bcrypt.hash(pw, 12)
    await prisma.user.create({ data: { email, name: '관리자', password: hashed, passwordSet: true, role: 'ADMIN' } })
    console.log('Admin created:', email)
  }
  await prisma.\$disconnect()
}
seed().catch(e => { console.error(e); process.exit(1) })
"

echo "🚀 Starting server..."
exec node server.js
