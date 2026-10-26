import 'dotenv/config'
import jwt from 'jsonwebtoken'

const secret = process.env.TRADING_PULSE_API_TOKEN
if (!secret || secret.length < 32) {
  throw new Error('Set TRADING_PULSE_API_TOKEN to a strong secret (at least 32 characters) before generating a worker token')
}

const token = jwt.sign(
  {
    client: 'trading-pulse-simulator-agent',
    role: 'high_frequency_ingestion_worker'
  },
  secret,
  { expiresIn: '24h' }
)

console.log('Simulator token (expires in 24 hours):')
console.log(token)
console.log('Store this token in SIMULATOR_TOKEN. Never commit it to Git.')
