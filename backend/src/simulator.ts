
import axios from 'axios'
import 'dotenv/config'

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT']

const API_URL =
  process.env.TRADING_PULSE_API_URL ??
  'http://localhost:3000'

const SIMULATOR_TOKEN = process.env.SIMULATOR_TOKEN

if (!SIMULATOR_TOKEN) {
  throw new Error(
    'Missing SIMULATOR_TOKEN in backend .env'
  )
}

const fallbackPrices: Record<string, number> = {
  BTCUSDT: 65000,
  ETHUSDT: 2600,
  SOLUSDT: 150,
}

const lastPrices = { ...fallbackPrices }

async function getMarketPrice(symbol: string): Promise<number> {
  try {
    const response = await axios.get(
      'https://api.binance.com/api/v3/ticker/price',
      {
        params: { symbol },
        timeout: 5000,
      }
    )

    const price = Number(response.data.price)

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error('Invalid price received')
    }

    lastPrices[symbol] = price
    return price
  } catch (error) {
    // Development fallback only; this is not real market data.
    const previous = lastPrices[symbol] ?? fallbackPrices[symbol]
    const variation = previous * 0.0002 * (Math.random() - 0.5)
    const simulated = Number((previous + variation).toFixed(8))

    lastPrices[symbol] = simulated

    console.warn(
      `[SIMULATOR] ${symbol}: using simulated price; live feed unavailable`
    )

    return simulated
  }
}

async function sendTick(symbol: string): Promise<void> {
  const price = await getMarketPrice(symbol)

  const payload = {
    symbol,
    price,
    quantity: Number((Math.random() * 1.5 + 0.1).toFixed(4)),
    side: Math.random() > 0.5 ? 'BUY' : 'SELL',
  }

  try {
    const response = await axios.post(
      `${API_URL}/api/v1/trades`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${SIMULATOR_TOKEN}`,
        },
        timeout: 5000,
      }
    )

    console.log(
      `[TICK ACCEPTED] ${symbol} price=${price} status=${response.status}`
    )
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.error(
        '[INGESTION ERROR]',
        error.response?.status,
        error.response?.data ?? error.message
      )
    } else {
      console.error('[INGESTION ERROR]', error)
    }
  }
}

async function startSimulation() {
  console.log('[SIMULATOR] Starting market tick feed')

  // Send one tick for each symbol every two seconds.
  setInterval(() => {
    for (const symbol of SYMBOLS) {
      void sendTick(symbol)
    }
  }, 2000)
}

void startSimulation()
