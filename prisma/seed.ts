import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString = 'postgresql://postgres.xtujnrdxlcfmpjpvsiqe:guswodnjs12%5E%5E@aws-1-ap-south-1.pooler.supabase.com:5432/postgres'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

async function main() {
  // 레스토랑 생성
  const restaurant = await prisma.restaurant.create({
    data: {
      id: 'restaurant-001',
      name: '우리 식당',
    },
  })
  console.log('레스토랑 생성:', restaurant.name)

  // 사장 계정 생성
  const passwordHash = await bcrypt.hash('wodnjs12^^', 10)
  const owner = await prisma.user.create({
    data: {
      restaurantId: restaurant.id,
      email: 'capetern@kakao.com',
      passwordHash,
      name: '사장님',
      role: 'OWNER',
    },
  })
  console.log('사장 계정 생성:', owner.email)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
