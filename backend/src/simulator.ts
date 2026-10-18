import axios from 'axios'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ADAUSDT']
const API_URL = 'http://localhost:3000/api/v1/trades'

// Helper function to generate realistic random prices and quantities
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
  console.log('⚡ Starting trading-pulse data simulation engine...')
  console.log(`📡 Sending ticks to: ${API_URL}`)

  // Loop infinitely, firing a trade payload every 500 milliseconds
  setInterval(async () => {
    const randomSymbol = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    const payload = getRandomTickerData(randomSymbol)

    try {
      const response = await axios.post(API_URL, payload)
      console.log(`[SIMULATOR] Sent: ${payload.side} ${payload.symbol} @ ${payload.price} | Server Status: ${response.status}`)
    } catch (error: any) {
      console.error(`[SIMULATOR ERROR] Failed to send tick: ${error.message}`)
    }
  }, 500) // 500ms intervals = 2 ticks per second
}

startSimulation()
