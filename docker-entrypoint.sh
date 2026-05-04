#!/bin/sh
set -e

# 1. 데이터베이스 마이그레이션 실행
echo "🔧 Running database migrations..."
node node_modules/prisma/build/index.js db push --accept-data-loss

# 2. 데이터베이스 시딩 (Admin 계정 생성/승격)
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
          role: 'OWNER'
        }
      })
      console.log('✅ Owner created:', email)
    } else {
      // 기존 계정을 OWNER로 승격
      if (existing.role !== 'OWNER') {
        await prisma.user.update({ where: { email }, data: { role: 'OWNER' } })
        console.log('✅ Promoted to OWNER:', email)
      } else {
        console.log('ℹ️ Owner already exists:', email)
      }
    }

    // 히든 뱃지 upsert
    const badges = [
      { key: 'hidden_linear_algebra', name: '선형대수학자', description: 'Linear algebra 문제집의 모든 문제를 해결했습니다.', title: '선형대수학자', isHidden: true, isActive: true, sortOrder: 99 },
    ]
    for (const badge of badges) {
      await prisma.badge.upsert({ where: { key: badge.key }, create: badge, update: {} })
      console.log('✅ Badge upserted:', badge.key)
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
