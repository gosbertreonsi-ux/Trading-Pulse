import 'dotenv/config'
import jwt from 'jsonwebtoken'

const secret = process.env.TRADING_PULSE_API_TOKEN
if (!secret || secret.length < 32) {
  throw new Error('Set a strong TRADING_PULSE_API_TOKEN signing secret before generating JWTs')
}

const mode = process.argv[2] ?? 'worker'
if (mode !== 'worker' && mode !== 'viewer') {
  throw new Error('Usage: npx tsx src/generateToken.ts [worker|viewer]')
}

const token = jwt.sign(
  {
    client: 'trading-pulse-simulator-agent',
    role: mode === 'worker' ? 'high_frequency_ingestion_worker' : 'viewer'
  },
  secret,
  { expiresIn: '24h' }
)

console.log(`${mode} JWT (expires in 24 hours):`)
console.log(token)
console.log('Keep this token private. Never commit it to Git.')
