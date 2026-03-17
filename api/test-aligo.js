// 임시 디버그용 — 테스트 후 삭제
export default async function handler(req, res) {
  const uid = process.env.ALIGO_USERID
  const key = process.env.ALIGO_APIKEY

  // Vercel 함수의 아웃바운드 IP 확인
  const ipRes = await fetch('https://api.ipify.org?format=json').catch(() => null)
  const ipData = ipRes ? await ipRes.json().catch(() => null) : null

  const params = new URLSearchParams({ user_id: uid, key })

  try {
    const r = await fetch('https://apis.aligo.in/remain/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await r.json()
    return res.status(200).json({
      vercel_outbound_ip: ipData?.ip ?? 'unknown',
      aligo_response: data,
      env: { uid, keylen: key?.length, sender: process.env.ALIGO_SENDER },
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
