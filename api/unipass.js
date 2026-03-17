// 관세청 UNI-PASS API 프록시 (CORS 우회)
export default async function handler(req, res) {
  const params = new URLSearchParams(req.query)
  const url = `https://unipass.customs.go.kr/ext/rest/persEcmQry/retrievePersEcm?${params}`

  try {
    const upstream = await fetch(url)
    const text = await upstream.text()
    res.setHeader('Content-Type', 'text/xml; charset=utf-8')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(upstream.status).send(text)
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
