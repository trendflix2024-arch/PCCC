import { useState, useEffect } from 'react'
import DaumPostcode from 'react-daum-postcode'
import { supabase } from './supabaseClient'

const UNIPASS_KEY = 'k250k296m013b127c080d010m6'

const MOCK_ORDER = {
  name: '홍길동',
  phone: '010-1234-5678',
  pccc: 'P123456789012',
  zipcode: '06236',
}

export default function CustomsForm() {
  const [urlError, setUrlError] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [pccc, setPccc] = useState('')
  const [zipcode, setZipcode] = useState('')
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState('idle') // idle | loading | success | fail | error
  const [verifyErrors, setVerifyErrors] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDone, setSubmitDone] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const orderId = params.get('orderId')
    const token = params.get('token')

    if (!orderId || !token) {
      setUrlError('유효하지 않은 접근입니다. 알림톡 링크를 통해 다시 접속해 주세요.')
      return
    }

    setName(MOCK_ORDER.name)
    setPhone(MOCK_ORDER.phone)
    setPccc(MOCK_ORDER.pccc)
    setZipcode(MOCK_ORDER.zipcode)
  }, [])

  const isPcccValid = pccc.length === 13 && pccc.startsWith('P')

  const handlePcccChange = (e) => {
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 13)
    setPccc(val)
    setVerifyStatus('idle')
  }

  const handlePostcodeSelect = (data) => {
    setZipcode(data.zonecode)
    setIsPostcodeOpen(false)
    setVerifyStatus('idle')
  }

  const verifyPCCC = async () => {
    if (!isPcccValid || !zipcode) return
    setVerifyStatus('loading')
    setVerifyErrors([])

    try {
      const params = new URLSearchParams({
        crkyCn: UNIPASS_KEY,
        persEcm: pccc,
        pltxNm: name.trim(),
        cralTelno: phone.replace(/[^0-9]/g, ''),
        custPsno: zipcode,
      })

      const res = await fetch(
        `/api/unipass/ext/rest/persEcmQry/retrievePersEcm?${params}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const xmlText = await res.text()
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml')

      if (doc.querySelector('parsererror')) throw new Error('XML 파싱 오류')

      const tCnt = parseInt(doc.querySelector('tCnt')?.textContent ?? '0', 10)

      if (tCnt === 1) {
        setVerifyStatus('success')
      } else if (tCnt === -1) {
        setVerifyStatus('error')
      } else {
        // tCnt === 0: 불일치 — 구체적인 오류 메시지 파싱
        const msgs = [...doc.querySelectorAll('errMsgCn')].map((el) => el.textContent.trim()).filter(Boolean)
        setVerifyErrors(msgs)
        setVerifyStatus('fail')
      }
    } catch (err) {
      console.error('PCCC 검증 오류:', err)
      setVerifyErrors([err.message])
      setVerifyStatus('error')
    }
  }

  const handleSubmit = async () => {
    if (verifyStatus !== 'success' || isSubmitting || submitDone) return
    setIsSubmitting(true)

    const urlParams = new URLSearchParams(window.location.search)
    const orderId = urlParams.get('orderId') || `ORD-${Date.now()}`
    const d = new Date()
    const updatedAt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`

    const { error } = await supabase.from('orders').upsert({
      id: orderId,
      name: name.trim(),
      phone: phone.replace(/[^0-9]/g, ''),
      pccc,
      zipcode,
      updated_at: updatedAt,
      status: 'pending_resubmit',
    })

    setIsSubmitting(false)

    if (error) {
      console.error('Supabase 저장 오류:', error)
      alert('저장 중 오류가 발생했습니다. 다시 시도해 주세요.')
      return
    }

    setSubmitDone(true)
    alert('수정이 성공적으로 완료되어 통관이 재개됩니다.')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <header className="mb-6 text-center">
          <p className="text-xs text-gray-400 mb-1 tracking-widest uppercase">관세청 통관 서비스</p>
          <h1 className="text-2xl font-bold text-gray-900">통관 정보 수정</h1>
        </header>

        {urlError ? (
          /* URL Error Screen */
          <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center">
            <div className="text-5xl mb-4">🚫</div>
            <p className="font-semibold text-red-800 mb-2 text-lg">접근 오류</p>
            <p className="text-red-600 text-sm leading-relaxed">{urlError}</p>
          </div>
        ) : (
          <>
            {/* Warning Box */}
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-5 flex gap-3">
              <span className="text-amber-500 text-xl shrink-0 mt-0.5">⚠️</span>
              <div>
                <p className="font-semibold text-amber-900 text-sm mb-1">
                  관세청 정책 변경 안내 — 필수 확인
                </p>
                <p className="text-amber-800 text-sm leading-relaxed">
                  관세청 정책 변경으로 <strong>우편번호(배송지 주소)</strong>가 개인통관고유부호에
                  등록된 정보와 정확히 일치해야만 통관이 가능합니다. 아래 정보를 확인하고
                  수정 후 검증해 주세요.
                </p>
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">

              {/* 수령인 성함 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  수령인 성함
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="성함을 입력해 주세요"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             transition-colors"
                />
              </div>

              {/* 연락처 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  연락처
                </label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="연락처를 입력해 주세요"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             transition-colors"
                />
              </div>

              {/* 개인통관고유부호 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  개인통관고유부호 (PCCC)
                </label>
                <input
                  type="text"
                  value={pccc}
                  onChange={handlePcccChange}
                  placeholder="P로 시작하는 13자리 입력"
                  maxLength={13}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                             focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                             transition-colors font-mono tracking-wider"
                />
                {pccc && !isPcccValid && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <span>!</span> P로 시작하는 13자리를 입력해 주세요. (현재 {pccc.length}자)
                  </p>
                )}
                {isPcccValid && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <span>✓</span> 형식이 올바릅니다.
                  </p>
                )}
              </div>

              {/* 배송지 우편번호 */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">
                  배송지 우편번호
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={zipcode}
                    readOnly
                    placeholder="우편번호"
                    maxLength={5}
                    className="flex-1 px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm
                               bg-gray-50 text-gray-600 cursor-not-allowed font-mono tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setIsPostcodeOpen(true)}
                    className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg
                               hover:bg-blue-700 active:bg-blue-800 transition-colors whitespace-nowrap"
                  >
                    주소 검색
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  반드시 '주소 검색' 버튼을 통해 우편번호를 입력해 주세요.
                </p>
              </div>

              {/* Divider */}
              <hr className="border-gray-100" />

              {/* 검증 버튼 */}
              <div>
                <button
                  type="button"
                  onClick={verifyPCCC}
                  disabled={!isPcccValid || !zipcode || verifyStatus === 'loading'}
                  className="w-full py-3 bg-gray-800 text-white font-medium rounded-xl text-sm
                             hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed
                             transition-colors flex items-center justify-center gap-2"
                >
                  {verifyStatus === 'loading' ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      관세청 검증 중...
                    </>
                  ) : (
                    '통관 정보 검증하기'
                  )}
                </button>

                {/* Verification result */}
                {verifyStatus === 'success' && (
                  <div className="mt-3 flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg p-3">
                    <span className="text-green-600 font-bold text-base shrink-0">✓</span>
                    <p className="text-sm text-green-700 font-medium">
                      개인통관고유부호가 정상적으로 확인되었습니다. 아래 버튼으로 최종 제출해 주세요.
                    </p>
                  </div>
                )}
                {verifyStatus === 'fail' && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-red-500 font-bold text-base shrink-0">✗</span>
                      <p className="text-sm text-red-700 font-medium">
                        검증에 실패했습니다. 입력 정보를 다시 확인해 주세요.
                      </p>
                    </div>
                    {verifyErrors.length > 0 && (
                      <ul className="mt-1 space-y-0.5 pl-5 list-disc">
                        {verifyErrors.map((msg, i) => (
                          <li key={i} className="text-xs text-red-600">{msg}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {verifyStatus === 'error' && (
                  <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-orange-500 font-bold text-base shrink-0">!</span>
                      <p className="text-sm text-orange-700 font-medium">
                        관세청 서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.
                      </p>
                    </div>
                    {verifyErrors.length > 0 && (
                      <p className="text-xs text-orange-600 pl-1 font-mono break-all">
                        {verifyErrors[0]}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* 최종 제출 버튼 */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={verifyStatus !== 'success' || isSubmitting || submitDone}
                className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl text-sm
                           hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed
                           transition-colors"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    처리 중...
                  </span>
                ) : submitDone ? (
                  '수정 완료 ✓'
                ) : (
                  '최종 수정 완료'
                )}
              </button>

              {/* Bottom notice */}
              <p className="text-center text-xs text-gray-400 pt-1">
                개인정보는 통관 목적으로만 사용되며, 관세청에 안전하게 전송됩니다.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Daum Postcode Modal */}
      {isPostcodeOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setIsPostcodeOpen(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-800 text-sm">우편번호 검색</span>
              <button
                onClick={() => setIsPostcodeOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none p-1"
              >
                ✕
              </button>
            </div>
            <DaumPostcode
              onComplete={handlePostcodeSelect}
              style={{ height: '420px' }}
              autoClose={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
