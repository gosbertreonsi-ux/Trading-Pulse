import 'dotenv/config'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import Fastify from 'fastify'
import prismaPlugin from '../plugins/db'
import redisPlugin from '../plugins/redis'
import securityPlugin from '../plugins/security'
import tradeRoutes from '../routes/trades'
import alertRoutes from '../routes/alerts'
import marketOverviewRoutes from '../routes/marketOverview'
import { aggregateCandlestick } from '../services/aggregator'

// Requires disposable PostgreSQL and Redis services. The dedicated CI job
// supplies a test database; this test never reads local production credentials.
test('authenticated ingestion persists and aggregates across tenant boundaries', {
  skip: process.env.RUN_TRADING_PULSE_INTEGRATION !== '1'
}, async () => {
  // Refuse to mutate a developer database when this test is run manually.
  const database = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost/invalid')
  if (!['127.0.0.1', 'localhost', '::1'].includes(database.hostname) ||
      database.pathname !== '/trading_pulse_test') {
    throw new Error('Integration tests require a disposable local trading_pulse_test database')
  }

  const server = Fastify({ logger: false })
  try {
    await server.register(prismaPlugin)
    await server.register(redisPlugin)
    await server.register(securityPlugin)
    await server.register(tradeRoutes)
    await server.register(alertRoutes)
    await server.register(marketOverviewRoutes)
    await server.ready()

    const mainTenant = 'integration-primary'
    const otherTenant = 'integration-other'
    const worker = server.jwt.sign({ client: mainTenant, role: 'high_frequency_ingestion_worker' }, { expiresIn: '1h' })
    const viewer = server.jwt.sign({ client: mainTenant, role: 'viewer' }, { expiresIn: '1h' })
    const otherViewer = server.jwt.sign({ client: otherTenant, role: 'viewer' }, { expiresIn: '1h' })
    const symbol = 'BTCUSDT'
    const headers = (token: string) => ({ authorization: `Bearer ${token}` })

    const noMarketToken = await server.inject({ method: 'GET', url: '/api/v1/markets/overview' })
    assert.equal(noMarketToken.statusCode, 401, 'Market quotes require a viewer JWT')
    const emptyQuotes = await server.inject({
      method: 'GET', url: '/api/v1/markets/overview', headers: headers(otherViewer)
    })
    assert.equal(emptyQuotes.statusCode, 200)
    const emptyData = (emptyQuotes.json() as {
      quotes: Array<{ symbol: string; price: number | null; spark: number[] }>
    }).quotes
    assert.deepEqual(emptyData.map(quote => quote.symbol), ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'])
    assert.ok(emptyData.every(quote => quote.price === null && quote.spark.length === 0),
      'No tenant trades means no fabricated prices')

    const unauth = await server.inject({ method: 'GET', url: '/api/v1/charts?symbol=BTCUSDT' })
    assert.equal(unauth.statusCode, 401, 'Unauthenticated market data is rejected')

    const readOnlyPost = await server.inject({
      method: 'POST', url: '/api/v1/trades', headers: headers(viewer),
      payload: { symbol, price: 100, quantity: 1, side: 'BUY' }
    })
    assert.equal(readOnlyPost.statusCode, 403, 'Viewers cannot forge market ticks')

    const invalid = await server.inject({
      method: 'POST', url: '/api/v1/trades', headers: headers(worker),
      payload: { symbol, price: -1, quantity: 1, side: 'BUY' }
    })
    assert.equal(invalid.statusCode, 400, 'Invalid trade values are rejected')

    const unauthAlert = await server.inject({ method: 'GET', url: '/api/v1/alerts' })
    assert.equal(unauthAlert.statusCode, 401)
    const workerPost = await server.inject({
      method: 'POST', url: '/api/v1/alerts', headers: headers(worker),
      payload: { symbol, direction: 'ABOVE', targetPrice: 105 }
    })
    assert.equal(workerPost.statusCode, 403, 'Workers may not create viewer alerts')
    const badAlert = await server.inject({
      method: 'POST', url: '/api/v1/alerts', headers: headers(viewer),
      payload: { symbol, direction: 'SIDEWAYS', targetPrice: -1 }
    })
    assert.equal(badAlert.statusCode, 400)

    const newAlert = await server.inject({
      method: 'POST', url: '/api/v1/alerts', headers: headers(viewer),
      payload: { symbol, direction: 'ABOVE', targetPrice: 105 }
    })
    assert.equal(newAlert.statusCode, 201, newAlert.body)
    const alertId = (newAlert.json() as { data: { id: string } }).data.id
    const otherTenantAlert = await server.inject({
      method: 'POST', url: '/api/v1/alerts', headers: headers(otherViewer),
      payload: { symbol, direction: 'BELOW', targetPrice: 120 }
    })
    assert.equal(otherTenantAlert.statusCode, 201)
    const otherAlertId = (otherTenantAlert.json() as { data: { id: string } }).data.id

    const start = Math.floor((Date.now() - 180_000) / 60_000) * 60_000
    const points = [
      { price: 100, quantity: 1, side: 'BUY', ms: 1000 },
      { price: 106, quantity: 2, side: 'BUY', ms: 15000 },
      { price: 99, quantity: 3, side: 'SELL', ms: 47000 }
    ] as const

    for (const point of points) {
      const written = await server.inject({
        method: 'POST', url: '/api/v1/trades', headers: headers(worker),
        payload: { symbol, price: point.price, quantity: point.quantity, side: point.side }
      })
      assert.equal(written.statusCode, 202, written.body)
      const data = written.json() as { success: boolean; id: string; cached: boolean }
      assert.equal(data.success, true)
      assert.equal(data.cached, true, 'Redis hot cache is reachable')

      const quotesResponse = await server.inject({
        method: 'GET', url: '/api/v1/markets/overview', headers: headers(viewer)
      })
      assert.equal(quotesResponse.statusCode, 200)
      const quotesPayload = quotesResponse.json() as {
        window: string;
        quotes: Array<{ symbol: string; price: number | null; changePercent: number | null; spark: number[] }>
      }
      assert.equal(quotesPayload.window, 'last-24-ticks')
      assert.equal(quotesPayload.quotes[0].symbol, symbol)
      assert.equal(quotesPayload.quotes[0].price, point.price,
        'Authenticated overview uses the latest persisted tick')
      assert.equal(quotesPayload.quotes[1].price, null, 'No invented ETH price')
      assert.equal(quotesPayload.quotes[2].price, null, 'No invented SOL price')
      assert.equal(quotesPayload.quotes[0].changePercent === null, quotesPayload.quotes[0].spark.length < 2)

      const otherQuotes = await server.inject({
        method: 'GET', url: '/api/v1/markets/overview', headers: headers(otherViewer)
      })
      assert.ok((otherQuotes.json() as {
        quotes: Array<{ price: number | null }>
      }).quotes.every(quote => quote.price === null),
        'Other tenants cannot see our last simulated trade')

      // The unfinished current-minute candle comes from tenant-scoped,
      // durable trades before the worker finalizes any OHLCV rows.
      const openResponse = await server.inject({
        method: 'GET', url: '/api/v1/charts?symbol=BTCUSDT&limit=20',
        headers: headers(viewer)
      })
      assert.equal(openResponse.statusCode, 200, openResponse.body)
      const openCandle = (openResponse.json() as {
        openCandle: null | { timestamp: string; close: number; volume: number; lastTickAt: string }
      }).openCandle
      assert.ok(openCandle, 'Current-minute preview is available immediately')
      assert.equal(openCandle.close, point.price)
      assert.ok(new Date(openCandle.lastTickAt).getTime() > 0)
      const otherPreview = await server.inject({
        method: 'GET', url: '/api/v1/charts?symbol=BTCUSDT&limit=20',
        headers: headers(otherViewer)
      })
      assert.equal((otherPreview.json() as { openCandle: unknown }).openCandle, null,
        'Current-minute preview never leaks across tenants')

      // Backdate only these isolated fixtures so the same CI run can test a
      // finished minute instead of needing a real-time minute-long sleep.
      await server.db.trade.update({
        where: { id: data.id },
        data: { timestamp: new Date(start + point.ms) }
      })
    }

    const redisTicks = await server.redis.lRange(`ticks:${mainTenant}:${symbol}`, 0, -1)
    assert.equal(redisTicks.length, points.length)

    const hiddenTrades = await server.inject({
      method: 'GET', url: `/api/v1/trades?symbol=${symbol}`, headers: headers(otherViewer)
    })
    assert.equal(hiddenTrades.statusCode, 200)
    assert.equal((hiddenTrades.json() as { count: number }).count, 0, 'Other tenants cannot see trades')

    const writes = await aggregateCandlestick(server, symbol, mainTenant)
    assert.equal(writes, 1, 'Exactly one completed candle is persisted')
    assert.equal(await aggregateCandlestick(server, symbol, mainTenant), 0, 'Reprocessing is idempotent')

    const response = await server.inject({
      method: 'GET', url: `/api/v1/charts?symbol=${symbol}&limit=20`, headers: headers(viewer)
    })
    assert.equal(response.statusCode, 200, response.body)
    const { success, data } = response.json() as {
      success: boolean;
      data: Array<{ clientId: string; timestamp: string; open: string; high: string; low: string; close: string; volume: string }>
    }
    assert.equal(success, true)
    assert.equal(data.length, 1)
    const candle = data[0]
    assert.equal(candle.clientId, mainTenant)
    assert.equal(new Date(candle.timestamp).getTime(), start)
    assert.deepEqual(
      [Number(candle.open), Number(candle.high), Number(candle.low), Number(candle.close), Number(candle.volume)],
      [100, 106, 99, 99, 6]
    )

    const hiddenChart = await server.inject({
      method: 'GET', url: `/api/v1/charts?symbol=${symbol}`, headers: headers(otherViewer)
    })
    assert.equal(hiddenChart.statusCode, 200)
    assert.equal((hiddenChart.json() as { data: unknown[] }).data.length, 0, 'Other tenants cannot see candles')

    const alertsResponse = await server.inject({
      method: 'GET', url: '/api/v1/alerts', headers: headers(viewer)
    })
    assert.equal(alertsResponse.statusCode, 200)
    const savedAlert = (alertsResponse.json() as {
      data: Array<{ id: string; status: string; targetPrice: string; observedPrice: string; triggeredAt: string }>
    }).data
    assert.equal(savedAlert.length, 1, 'Tenant lists only their alerts')
    assert.equal(savedAlert[0].id, alertId)
    assert.equal(savedAlert[0].status, 'TRIGGERED', 'Threshold tripped at 106')
    assert.equal(Number(savedAlert[0].observedPrice), 106)
    assert.ok(savedAlert[0].triggeredAt)

    const otherAlerts = await server.inject({
      method: 'GET', url: '/api/v1/alerts', headers: headers(otherViewer)
    })
    assert.equal((otherAlerts.json() as { data: Array<{ id: string; status: string }> }).data.length, 1)
    assert.equal((otherAlerts.json() as { data: Array<{ id: string; status: string }> }).data[0].status, 'ACTIVE')
    assert.equal(await server.db.priceAlert.count({
      where: { id: alertId, status: 'TRIGGERED' }
    }), 1, 'Alert cannot be retriggered')

    const crossDelete = await server.inject({
      method: 'DELETE', url: `/api/v1/alerts/${otherAlertId}`,
      headers: headers(viewer)
    })
    assert.equal(crossDelete.statusCode, 404, 'Other tenant alert cannot be deleted')
    const remove = await server.inject({
      method: 'DELETE', url: `/api/v1/alerts/${alertId}`,
      headers: headers(viewer)
    })
    assert.equal(remove.statusCode, 200)
    assert.equal(await server.db.priceAlert.count({ where: { id: alertId } }), 0)

  } finally {
    await server.close()
  }
})
