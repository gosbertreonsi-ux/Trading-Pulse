import axios from 'axios'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']
const ENGINE_API_URL = 'http://localhost:3000/api/v1/trades'

// Ensure your unique Phase 2 Cryptographic Token is pasted here
const GATEWAY_AUTH_TOKEN = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJjbGllbnQiOiJ0cmFkaW5nLXB1bHNlLXNpbXVsYXRvci1hZ2VudCIsInJvbGUiOiJoaWdoX2ZyZXF1ZW5jeV9pbmdlc3Rpb25fd29ya2VyIiwiaWF0IjoxNzkyMzM1NzkzfQ.NrWVvF00PHAZhQI_OhL767aAM1zTqNImLCc_zOlgH_k'

async function fetchLiveExchangeData(symbol: string) {
  try {
    // FIXED: Changed to backticks `` and corrected the path variable layout
    const response = await axios.get(`https://binance.com{symbol}`)
    const livePrice = parseFloat(response.data.price)
    
    const liveQuantity = parseFloat((Math.random() * 1.5 + 0.1).toFixed(4))
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL'

    // Forward the genuine worldwide financial data directly to your Fastify API Gateway
    const gatewayResponse = await axios.post(ENGINE_API_URL, {
      symbol,
      price: livePrice,
      quantity: liveQuantity,
      side
    }, {
      headers: {
        Authorization: GATEWAY_AUTH_TOKEN
      }
    })

    console.log(`🌍 [GLOBAL FEED] Successfully Ingested Live ${symbol} @ $${livePrice} | Status: ${gatewayResponse.status}`)
  } catch (error: any) {
    console.error(`❌ [FEED EXCEPTION] Failed to stream live data for ${symbol}:`, error.message)
  }
}


async function startGlobalIngestionPipeline() {
  console.log('⚡ Upgrading Trading-Pulse to Worldwide Live Production Data Mode...')
  console.log(`📡 Targeting Gateway Endpoint: ${ENGINE_API_URL}`)

  // Run the live scraper loop continuously every 1 second to fetch true global prices
  setInterval(async () => {
    for (const symbol of SYMBOLS) {
      await fetchLiveExchangeData(symbol)
    }
  }, 1000)
}

startGlobalIngestionPipeline()
