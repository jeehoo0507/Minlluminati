#!/bin/sh
set -e

# 1. 데이터베이스 마이그레이션 실행
echo "🔧 Running database migrations..."
# npx를 사용하는 것이 인자(flag) 전달에 훨씬 안정적입니다.
node node_modules/prisma/build/index.js db push --accept-data-loss

# 2. 데이터베이스 시딩 (Admin 계정 생성)
echo "🌱 Seeding database..."
node -e "
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()
async function seed() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@minlluminati.local'
    const pw = process.env.ADMIN_PASSWORD || 'changeme123'
    const existing = await prisma.user.findUnique({ where: { email } })
    if (!existing) {
      const hashed = await bcrypt.hash(pw, 12)
      await prisma.user.create({ 
        data: { 
          email, 
          name: '관리자', 
          password: hashed, 
          passwordSet: true, 
          role: 'ADMIN' 
        } 
      })
      console.log('✅ Admin created:', email)
    } else {
      console.log('ℹ️ Admin already exists.')
    }
  } catch (error) {
    console.error('❌ Seeding error:', error)
    process.exit(1)
  } finally {
    await prisma.\$disconnect()
  }
}
seed()
"

# 3. 서버 시작
echo "🚀 Starting server..."
exec node server.js