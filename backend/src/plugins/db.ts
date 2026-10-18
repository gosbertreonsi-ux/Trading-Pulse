import 'dotenv/config'
import fp from 'fastify-plugin'
import { FastifyPluginAsync } from 'fastify'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

declare module 'fastify' {
  interface FastifyInstance {
    db: PrismaClient
  }
}

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  // 1. Hook up the precise Prisma 7 adapter engine
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  // 2. Connect to PostgreSQL on server boot
  await prisma.$connect()

  // 3. Decorate the Fastify instance so routes can call it via 'this.db' or 'fastify.db'
  fastify.decorate('db', prisma)

  // 4. Cleanly disconnect pool lines when the server shuts down
  fastify.addHook('onClose', async (server) => {
    await server.db.$disconnect()
  })
}

export default fp(prismaPlugin)
