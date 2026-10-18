import axios from 'axios'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT']
const API_URL = 'http://localhost:3000/api/v1/trades'

// PASTED TOKEN: Replace this string placeholder with your exact generated token from Step 3
const COMPLIANCE_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnQiOiJ0cmFkaW5nLXB1bHNlLXNpbXVsYXRvci1hZ2VudCIsInJvbGUiOiJoaWdoX2ZyZXF1ZW5jeV9pbmdlc3Rpb25fd29ya2VyIiwiaWF0IjoxNzkyMzM1NzkzfQ.NrWVvF00PHAZhQI_OhL767aAM1zTqNImLCc_zOlgH_k'

function getRandomTickerData(symbol: string) {
  let basePrice = 65000
  if (symbol === 'ETHUSDT') basePrice = 2600
  if (symbol === 'SOLUSDT') basePrice = 150
  if (symbol === 'ADAUSDT') basePrice = 0.35

  const variance = basePrice * 0.002 * (Math.random() - 0.5)
  const price = parseFloat((basePrice + variance).toFixed(4))
  const quantity = parseFloat((Math.random() * 2).toFixed(4))
  const side = Math.random() > 0.5 ? 'BUY' : 'SELL'

  return { symbol, price, quantity, side }
}

async function startSimulation() {
  console.log('⚡ Starting secure trading-pulse data simulation engine...')
  console.log(`📡 Stream targets: ${API_URL}`)

  setInterval(async () => {
    const randomSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    const payload = getRandomTickerData(randomSymbol)

    try {
      // Inject the required authorization token directly inside your HTTP Axios configurations array
      const response = await axios.post(API_URL, payload, {
        headers: {
          Authorization: COMPLIANCE_TOKEN
        }
      })
      console.log(`[SECURE SIMULATOR] Sent: ${payload.side} ${payload.symbol} | Gateway Status: ${response.status}`)
    } catch (error: any) {
      console.error(`[SIMULATOR BLOCKED] Ingestion failed: ${error.response?.data?.error || error.message}`)
    }
  }, 500)
}

startSimulation()
