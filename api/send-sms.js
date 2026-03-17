// Vercel 서버리스 함수 — 알리고 SMS 발송
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { phone, orderId, brandName, brandKey, seller } = req.body

  if (!phone || !orderId) {
    return res.status(400).json({ ok: false, message: '필수 파라미터 누락' })
  }

  const baseUrl = 'https://pccc-six.vercel.app'
  const link = `${baseUrl}/?orderId=${encodeURIComponent(orderId)}&token=ok&brand=${brandKey || ''}&seller=${encodeURIComponent(seller || '')}`

  const title = `[${brandName}] 통관정보 수정 안내`
  const msg = [
    `[${brandName}] 통관정보 수정 안내`,
    ``,
    `고객님, 주문하신 상품의 통관 처리를 위해 개인통관고유부호 확인이 필요합니다.`,
    ``,
    `아래 링크를 클릭하여 정보를 확인·수정해 주세요.`,
    `▶ ${link}`,
  ].join('\n')

  console.log('[send-sms] env check:', {
    userid_set: !!process.env.ALIGO_USERID,
    apikey_set: !!process.env.ALIGO_APIKEY,
    sender_set: !!process.env.ALIGO_SENDER,
    userid_val: process.env.ALIGO_USERID,
    apikey_len: process.env.ALIGO_APIKEY?.length,
  })

  const params = new URLSearchParams({
    userid:    process.env.ALIGO_USERID,
    apikey:    process.env.ALIGO_APIKEY,
    sender:    process.env.ALIGO_SENDER,
    receiver:  phone.replace(/[^0-9]/g, ''),
    msg,
    msg_type:  'LMS',
    title,
  })

  try {
    const aligoRes = await fetch('https://apis.aligo.in/send/', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    params.toString(),
    })
    const data = await aligoRes.json()

    // 알리고 result_code: '1' = 성공
    if (String(data.result_code) === '1') {
      return res.status(200).json({ ok: true, msgid: data.msg_id })
    } else {
      return res.status(200).json({ ok: false, message: data.message })
    }
  } catch (err) {
    console.error('Aligo SMS error:', err)
    return res.status(500).json({ ok: false, message: err.message })
  }
}
