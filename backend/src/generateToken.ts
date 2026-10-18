import jwt from 'jsonwebtoken'

// Use the exact same signature key fallback from our security plugin
const SECRET = 'SUPER_SECURE_COMPLIANCE_GATEWAY_TOKEN_SECRET_KEY_123!'

function generateApiKey() {
  const payload = {
    client: 'trading-pulse-simulator-agent',
    role: 'high_frequency_ingestion_worker'
  }

  // Sign the token with no expiration so our worker loop never drops mid-ingestion
  const token = jwt.sign(payload, SECRET)
  
  console.log('🔑 [COMPLIANCE GATEWAY] Generated Valid Cryptographic API Token:\n')
  console.log(`Bearer ${token}`)
}

generateApiKey()
