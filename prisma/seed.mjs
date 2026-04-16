import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import bcrypt from 'bcryptjs'

const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL 환경변수가 필요합니다')

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

const passwordHash = await bcrypt.hash('wodnjs12^^', 10)

const restaurant = await prisma.restaurant.create({
  data: { id: 'restaurant-001', name: '우리 식당' },
})
console.log('레스토랑 생성:', restaurant.name)

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

await prisma.$disconnect()
