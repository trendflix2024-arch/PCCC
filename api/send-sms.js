// Vercel 서버리스 함수 — 솔라피 SMS 발송
import crypto from 'crypto'

function solapiAuth() {
  const date = new Date().toISOString()
  const salt = crypto.randomBytes(8).toString('hex')
  const signature = crypto
    .createHmac('sha256', process.env.SOLAPI_API_SECRET)
    .update(date + salt)
    .digest('hex')
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`
}

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

  const subject = `[${brandName}] 통관정보 수정 안내`
  const text = [
    `[${brandName}] 통관정보 수정 안내`,
    ``,
    `고객님, 주문하신 상품의 통관 처리를 위해 개인통관고유부호 확인이 필요합니다.`,
    ``,
    `아래 링크를 클릭하여 정보를 확인·수정해 주세요.`,
    `▶ ${link}`,
  ].join('\n')

  try {
    const solapiRes = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': solapiAuth(),
      },
      body: JSON.stringify({
        message: {
          to:      phone.replace(/[^0-9]/g, ''),
          from:    process.env.SOLAPI_SENDER,
          text,
          type:    'LMS',
          subject,
        },
      }),
    })

    const data = await solapiRes.json()
    console.log('[solapi]', JSON.stringify(data))

    if (solapiRes.ok && data.messageId) {
      return res.status(200).json({ ok: true, msgid: data.messageId })
    } else {
      const errMsg = data.errorMessage || data.message || '발송 실패'
      return res.status(200).json({ ok: false, message: errMsg })
    }
  } catch (err) {
    console.error('Solapi SMS error:', err)
    return res.status(500).json({ ok: false, message: err.message })
  }
}
