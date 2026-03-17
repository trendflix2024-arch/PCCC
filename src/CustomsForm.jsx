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
  const [urlError, setUrlError]         = useState(null)
  const [orderId, setOrderId]           = useState('')
  const [name, setName]                 = useState('')
  const [phone, setPhone]               = useState('')
  const [pccc, setPccc]                 = useState('')
  const [zipcode, setZipcode]           = useState('')
  const [isPostcodeOpen, setIsPostcodeOpen] = useState(false)
  const [verifyStatus, setVerifyStatus] = useState('idle') // idle|loading|success|fail|error
  const [verifyErrors, setVerifyErrors] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitDone, setSubmitDone]     = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oid   = params.get('orderId')
    const token = params.get('token')
    if (!oid || !token) {
      setUrlError('유효하지 않은 접근입니다. 발송된 알림톡 링크를 통해 다시 접속해 주세요.')
      return
    }
    setOrderId(oid)
    setName(MOCK_ORDER.name)
    setPhone(MOCK_ORDER.phone)
    setPccc(MOCK_ORDER.pccc)
    setZipcode(MOCK_ORDER.zipcode)
  }, [])

  const isPcccValid = pccc.length === 13 && pccc.startsWith('P')

  // 현재 단계 계산
  const currentStep = submitDone ? 3 : verifyStatus === 'success' ? 2 : 1

  const handlePcccChange = (e) => {
    setPccc(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 13))
    setVerifyStatus('idle')
  }

  const handlePostcodeSelect = (data) => {
    setZipcode(data.zonecode)
    setIsPostcodeOpen(false)
    setVerifyStatus('idle')
  }

  /* ── 관세청 UNI-PASS 검증 ── */
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
      const res = await fetch(`/api/unipass/ext/rest/persEcmQry/retrievePersEcm?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const xmlText = await res.text()
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
      if (doc.querySelector('parsererror')) throw new Error('응답 파싱 오류')
      const tCnt = parseInt(doc.querySelector('tCnt')?.textContent ?? '0', 10)
      if (tCnt === 1) {
        setVerifyStatus('success')
      } else if (tCnt === -1) {
        setVerifyStatus('error')
      } else {
        const msgs = [...doc.querySelectorAll('errMsgCn')].map(el => el.textContent.trim()).filter(Boolean)
        setVerifyErrors(msgs)
        setVerifyStatus('fail')
      }
    } catch (err) {
      console.error('PCCC 검증 오류:', err)
      setVerifyErrors([err.message])
      setVerifyStatus('error')
    }
  }

  /* ── 최종 제출 ── */
  const handleSubmit = async () => {
    if (verifyStatus !== 'success' || isSubmitting || submitDone) return
    setIsSubmitting(true)
    const d = new Date()
    const updatedAt = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    const { error } = await supabase.from('orders').upsert({
      id: orderId || `ORD-${Date.now()}`,
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
      alert('저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setSubmitDone(true)
  }

  /* ────────────────── RENDER ────────────────── */
  return (
    <div className="min-h-screen" style={{ background: '#f3f2f1' }}>

      {/* ── 관세청 브랜딩 헤더 ── */}
      <div style={{ background: '#003087' }} className="w-full">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
               style={{ background: 'rgba(255,255,255,0.15)' }}>
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4z"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">대한민국 관세청</p>
            <p className="text-blue-200 text-xs leading-tight">Korea Customs Service</p>
          </div>
        </div>
      </div>
      <div style={{ background: '#1352a2' }} className="w-full">
        <div className="max-w-lg mx-auto px-4 py-3">
          <h1 className="text-white font-bold text-base leading-tight">개인통관고유부호 정정 신청</h1>
          <p className="text-blue-200 text-xs mt-0.5">Personal Customs Clearance Code Update</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-5">

        {/* ── URL 오류 화면 ── */}
        {urlError ? (
          <div className="bg-white border border-red-300 rounded-lg overflow-hidden">
            <div className="bg-red-600 px-5 py-3">
              <p className="text-white font-bold text-sm">접근 오류</p>
            </div>
            <div className="p-5 flex gap-3">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div>
                <p className="text-sm text-gray-800 font-medium mb-1">유효하지 않은 접근입니다</p>
                <p className="text-xs text-gray-600 leading-relaxed">{urlError}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── 접수번호 + 단계 표시 ── */}
            <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">접수번호</p>
                <p className="text-sm font-mono font-bold text-gray-800">{orderId || '확인 중...'}</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                {[
                  { n: 1, label: '정보 확인' },
                  { n: 2, label: '관세청 검증' },
                  { n: 3, label: '제출 완료' },
                ].map((s, i) => (
                  <div key={s.n} className="flex items-center gap-1.5">
                    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                      currentStep === s.n
                        ? 'text-white'
                        : currentStep > s.n
                        ? 'text-green-700 bg-green-50'
                        : 'text-gray-400 bg-gray-100'
                    }`}
                    style={currentStep === s.n ? { background: '#1352a2' } : {}}>
                      <span>{currentStep > s.n ? '✓' : s.n}</span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < 2 && <span className="text-gray-300">›</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── 완료 화면 ── */}
            {submitDone ? (
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100" style={{ background: '#f0f7ee' }}>
                  <p className="text-sm font-bold" style={{ color: '#00703c' }}>■ 정정 신청 접수 완료</p>
                </div>
                <div className="p-8 text-center">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                       style={{ background: '#e8f5e9' }}>
                    <svg viewBox="0 0 24 24" className="w-8 h-8" style={{ color: '#00703c' }} fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                  <h2 className="text-lg font-bold text-gray-900 mb-1">신청이 접수되었습니다</h2>
                  <p className="text-xs text-gray-500 mb-4">접수번호: <span className="font-mono font-bold text-gray-700">{orderId}</span></p>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left space-y-1.5">
                    <p className="text-xs text-gray-600 flex gap-2"><span className="text-gray-400">•</span>정정된 통관 정보가 관세청 시스템에 반영됩니다.</p>
                    <p className="text-xs text-gray-600 flex gap-2"><span className="text-gray-400">•</span>처리 완료 후 배송이 재개됩니다.</p>
                    <p className="text-xs text-gray-600 flex gap-2"><span className="text-gray-400">•</span>문의: 관세청 고객지원센터 ☎ 125</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ── 안내 박스 ── */}
                <div className="mb-4 bg-white rounded-lg overflow-hidden"
                     style={{ borderLeft: '4px solid #1352a2', border: '1px solid #d0ddef', borderLeftWidth: '4px' }}>
                  <div className="px-4 py-2.5 border-b" style={{ background: '#eef2fa', borderColor: '#d0ddef' }}>
                    <p className="text-xs font-bold" style={{ color: '#1352a2' }}>【필독】 개인통관고유부호 정정 안내</p>
                  </div>
                  <div className="px-4 py-3 space-y-1.5">
                    <p className="text-xs text-gray-700 flex gap-2">
                      <span className="shrink-0 font-bold" style={{ color: '#1352a2' }}>①</span>
                      관세청 정책 변경으로 <strong>배송지 우편번호</strong>가 개인통관고유부호 등록 정보와 정확히 일치해야 통관이 가능합니다.
                    </p>
                    <p className="text-xs text-gray-700 flex gap-2">
                      <span className="shrink-0 font-bold" style={{ color: '#1352a2' }}>②</span>
                      미수정 시 수입 물품의 통관이 지연되거나 반송될 수 있습니다.
                    </p>
                    <p className="text-xs text-gray-700 flex gap-2">
                      <span className="shrink-0 font-bold" style={{ color: '#1352a2' }}>③</span>
                      입력 정보는 관세청 전자통관시스템(UNI-PASS)을 통해 실시간 검증됩니다.
                    </p>
                  </div>
                </div>

                {/* ── 입력 폼 ── */}
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-200" style={{ background: '#f5f6f7' }}>
                    <p className="text-sm font-bold text-gray-800">■ 신청인 정보 입력</p>
                    <p className="text-xs text-gray-500 mt-0.5">아래 정보를 정확하게 확인·수정 후 검증하여 주십시오</p>
                  </div>

                  <div className="divide-y divide-gray-100">

                    {/* 수령인 성함 */}
                    <div className="px-5 py-4">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        수령인 성함 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); setVerifyStatus('idle') }}
                        placeholder="성함을 입력해 주세요"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm
                                   focus:outline-none focus:ring-2 focus:border-blue-500 transition-colors"
                        style={{ '--tw-ring-color': '#1352a2' }}
                      />
                      <p className="text-xs text-gray-400 mt-1">개인통관고유부호에 등록된 성명과 동일하게 입력하여 주십시오.</p>
                    </div>

                    {/* 연락처 */}
                    <div className="px-5 py-4">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        휴대전화번호 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setVerifyStatus('idle') }}
                        placeholder="010-0000-0000"
                        className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm
                                   focus:outline-none focus:ring-2 focus:border-blue-500 transition-colors"
                      />
                      <p className="text-xs text-gray-400 mt-1">개인통관고유부호에 등록된 휴대전화번호를 입력하여 주십시오.</p>
                    </div>

                    {/* 개인통관고유부호 */}
                    <div className="px-5 py-4">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        개인통관고유부호 (PCCC) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={pccc}
                        onChange={handlePcccChange}
                        placeholder="P000000000000 (P로 시작하는 13자리)"
                        maxLength={13}
                        className="w-full px-3 py-2.5 border border-gray-300 rounded text-sm font-mono
                                   tracking-widest focus:outline-none focus:ring-2 focus:border-blue-500 transition-colors"
                      />
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {pccc && !isPcccValid && (
                          <p className="text-xs flex items-center gap-1" style={{ color: '#d4351c' }}>
                            <span className="font-bold">!</span> P로 시작하는 13자리를 입력해 주세요. (현재 {pccc.length}자)
                          </p>
                        )}
                        {isPcccValid && (
                          <p className="text-xs flex items-center gap-1" style={{ color: '#00703c' }}>
                            <span className="font-bold">✓</span> 형식이 올바릅니다.
                          </p>
                        )}
                        {!pccc && (
                          <p className="text-xs text-gray-400">관세청 전자통관시스템에서 발급받은 13자리 부호</p>
                        )}
                      </div>
                    </div>

                    {/* 배송지 우편번호 */}
                    <div className="px-5 py-4">
                      <label className="block text-xs font-bold text-gray-600 mb-1.5">
                        배송지 우편번호 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={zipcode}
                          readOnly
                          placeholder="우편번호 5자리"
                          className="flex-1 px-3 py-2.5 border border-gray-200 rounded text-sm font-mono
                                     tracking-widest bg-gray-50 text-gray-600 cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setIsPostcodeOpen(true)}
                          className="px-4 py-2.5 text-white text-sm font-medium rounded transition-colors whitespace-nowrap"
                          style={{ background: '#1352a2' }}
                          onMouseEnter={e => e.target.style.background = '#003087'}
                          onMouseLeave={e => e.target.style.background = '#1352a2'}
                        >
                          주소 검색
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        반드시 <strong>'주소 검색'</strong> 버튼을 통해 정확한 우편번호를 선택하여 주십시오.
                      </p>
                    </div>
                  </div>

                  {/* ── 검증 버튼 영역 ── */}
                  <div className="px-5 py-4 border-t border-gray-200" style={{ background: '#f5f6f7' }}>
                    <button
                      type="button"
                      onClick={verifyPCCC}
                      disabled={!isPcccValid || !zipcode || verifyStatus === 'loading'}
                      className="w-full py-3 text-white font-bold text-sm rounded transition-colors
                                 flex items-center justify-center gap-2
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: verifyStatus === 'success' ? '#00703c' : '#003087' }}
                    >
                      {verifyStatus === 'loading' ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          관세청 UNI-PASS 검증 중...
                        </>
                      ) : verifyStatus === 'success' ? (
                        '✓ 검증 완료 — 재검증하기'
                      ) : (
                        '관세청 UNI-PASS 검증 요청'
                      )}
                    </button>

                    {/* 검증 결과 */}
                    {verifyStatus === 'success' && (
                      <div className="mt-3 rounded border p-3 flex gap-2"
                           style={{ background: '#e8f5e9', borderColor: '#a5d6a7' }}>
                        <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#00703c' }} fill="currentColor">
                          <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                        </svg>
                        <div>
                          <p className="text-xs font-bold" style={{ color: '#00703c' }}>관세청 검증 완료</p>
                          <p className="text-xs mt-0.5" style={{ color: '#2e7d32' }}>
                            입력하신 정보가 관세청 시스템과 일치합니다. 아래 버튼으로 최종 신청을 완료해 주십시오.
                          </p>
                        </div>
                      </div>
                    )}
                    {verifyStatus === 'fail' && (
                      <div className="mt-3 rounded border p-3" style={{ background: '#fef3f2', borderColor: '#fca5a5' }}>
                        <div className="flex gap-2 mb-1.5">
                          <span className="text-xs font-bold shrink-0" style={{ color: '#d4351c' }}>✗ 검증 불일치</span>
                        </div>
                        <p className="text-xs mb-1.5" style={{ color: '#991b1b' }}>
                          입력하신 정보가 관세청 등록 정보와 일치하지 않습니다. 아래 사항을 확인해 주세요.
                        </p>
                        {verifyErrors.length > 0 && (
                          <ul className="space-y-0.5">
                            {verifyErrors.map((msg, i) => (
                              <li key={i} className="text-xs flex gap-1" style={{ color: '#d4351c' }}>
                                <span>•</span><span>{msg}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {verifyStatus === 'error' && (
                      <div className="mt-3 rounded border p-3 flex gap-2"
                           style={{ background: '#fff8e1', borderColor: '#ffe082' }}>
                        <span className="text-xs font-bold shrink-0" style={{ color: '#f57f17' }}>!</span>
                        <div>
                          <p className="text-xs font-bold" style={{ color: '#f57f17' }}>시스템 연결 오류</p>
                          <p className="text-xs mt-0.5 text-gray-600">
                            관세청 서버와의 연결에 실패했습니다. 잠시 후 다시 시도해 주시거나 고객지원센터(☎ 125)로 문의해 주세요.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 최종 제출 버튼 ── */}
                  <div className="px-5 py-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={verifyStatus !== 'success' || isSubmitting || submitDone}
                      className="w-full py-3.5 text-white font-bold text-sm rounded transition-colors
                                 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ background: '#003087' }}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          신청서 제출 중...
                        </>
                      ) : (
                        '정정 신청서 최종 제출'
                      )}
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-2">
                      관세청 검증 완료 후 제출 버튼이 활성화됩니다
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ── 공식 푸터 ── */}
            <div className="mt-6 pb-6 space-y-3">
              <div className="border-t border-gray-300 pt-4">
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4z"/></svg>
                    SSL 보안 암호화
                  </span>
                  <span>|</span>
                  <span>관세청 UNI-PASS 연동</span>
                  <span>|</span>
                  <span>개인정보보호법 준수</span>
                </div>
                <p className="text-center text-xs text-gray-400 mt-2">
                  고객지원센터 ☎ <strong className="text-gray-500">125</strong>
                  <span className="text-gray-300 mx-1">|</span>
                  평일 09:00 ~ 18:00
                </p>
                <p className="text-center text-xs text-gray-300 mt-1">
                  본 서비스는 관세청 전자통관시스템(UNI-PASS)과 연동되며, 수집된 개인정보는 통관 업무 외 목적으로 사용되지 않습니다.
                </p>
              </div>
            </div>

          </>
        )}
      </div>

      {/* ── 우편번호 검색 모달 ── */}
      {isPostcodeOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center"
          onClick={() => setIsPostcodeOpen(false)}
        >
          <div
            className="bg-white w-full sm:max-w-md overflow-hidden rounded-t-xl sm:rounded-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200"
                 style={{ background: '#003087' }}>
              <span className="font-bold text-white text-sm">배송지 우편번호 검색</span>
              <button
                onClick={() => setIsPostcodeOpen(false)}
                className="text-blue-200 hover:text-white text-xl leading-none p-1"
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
