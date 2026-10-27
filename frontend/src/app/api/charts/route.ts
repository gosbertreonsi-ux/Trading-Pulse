
import { NextRequest, NextResponse } from 'next/server'


export async function GET(request: NextRequest) {
  const token = process.env.TRADING_PULSE_VIEWER_JWT
  const backendUrl =
    process.env.TRADING_PULSE_API_URL ?? 'http://127.0.0.1:3001'

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Server API credentials are not configured' },
      { status: 503 }
    )
  }

  const symbol = request.nextUrl.searchParams.get('symbol')
  const limit = request.nextUrl.searchParams.get('limit') ?? '500'

  if (!symbol || !/^[A-Z0-9]{3,10}$/.test(symbol)) {
    return NextResponse.json(
      { success: false, error: 'A valid symbol is required' },
      { status: 400 }
    )
  }

  const parsedLimit = Number(limit)

  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > 500
  ) {
    return NextResponse.json(
      { success: false, error: 'Limit must be between 1 and 500' },
      { status: 400 }
    )
  }

  try {
    const url = new URL('/api/v1/charts', backendUrl)
    url.searchParams.set('symbol', symbol)
    url.searchParams.set('limit', String(parsedLimit))

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })

    const body = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Backend chart request failed' },
        { status: response.status === 401 ? 401 : 502 }
      )
    }

    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('[CHART API PROXY]', error)

    return NextResponse.json(
      { success: false, error: 'Cannot reach the market-data backend' },
      { status: 502 }
    )
  }
}
