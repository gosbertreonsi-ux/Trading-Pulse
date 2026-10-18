import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

// 1. Initialize the explicit Postgres JavaScript translator driver
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

// 2. Export a reusable, singleton client engine container
export const prisma = new PrismaClient({ adapter })
