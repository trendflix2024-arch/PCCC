// Vercel → NCloud Cloud Functions (KR-2, Korean IP) → UNI-PASS
import crypto from 'crypto'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { prsEcmNo, nmKor, crkyCn } = req.query
  const accessKey = process.env.NCLOUD_ACCESS_KEY
  const secretKey = process.env.NCLOUD_SECRET_KEY

  if (!accessKey || !secretKey) {
    return res.status(500).json({ error: 'NCloud credentials not configured' })
  }

  const method = 'POST'
  const path = '/api/v1/namespaces/vKFGaASNuaM8/actions/unipass-proxy?blocking=true'
  const timestamp = Date.now().toString()
  const message = `${method}\n${path}\n${timestamp}`
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64')

  try {
    const upstream = await fetch(`https://kr2-cf.apigw.ntruss.com${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ncp-apigw-timestamp': timestamp,
        'x-ncp-iam-access-key': accessKey,
        'x-ncp-apigw-signature-v2': signature,
      },
      body: JSON.stringify({ crkyCn, prsEcmNo, nmKor }),
    })

    const data = await upstream.json()
    // NCloud CF wraps action return in data.response.result
    // Our proxy returns {statusCode, headers, body: JSON.stringify({rsltCd})}
    // So body is a JSON string that needs parsing
    const result = data?.response?.result ?? data
    let finalResult = result
    if (typeof result?.body === 'string') {
      try { finalResult = JSON.parse(result.body) } catch { /* keep result as-is */ }
    }
    return res.status(200).json(finalResult)
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
