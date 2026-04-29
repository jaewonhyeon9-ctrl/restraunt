import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.restaurantId = (user as any).restaurantId
        token.activeRestaurantId =
          (user as any).activeRestaurantId ?? (user as any).restaurantId
        token.name = user.name
      }
      // 매장 전환 시 토큰 리프레시 — session.update() 호출하면 트리거됨
      if (trigger === 'update' && token.id) {
        const u = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { activeRestaurantId: true, role: true },
        })
        if (u) {
          token.activeRestaurantId = u.activeRestaurantId ?? token.restaurantId
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        ;(session.user as any).restaurantId = token.restaurantId
        ;(session.user as any).activeRestaurantId =
          token.activeRestaurantId ?? token.restaurantId
      }
      return session
    },
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: '이메일', type: 'email' },
        password: { label: '비밀번호', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z.object({
          email: z.string().email(),
          password: z.string().min(1),
        }).safeParse(credentials)

        if (!parsed.success) return null

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        })

        if (!user || !user.isActive) return null

        const valid = await bcrypt.compare(parsed.data.password, user.passwordHash)
        if (!valid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          restaurantId: user.restaurantId,
          activeRestaurantId: user.activeRestaurantId ?? user.restaurantId,
        }
      },
    }),
  ],
})
