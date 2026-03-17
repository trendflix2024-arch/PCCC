import { useState, useEffect } from 'react'
import DaumPostcode from 'react-daum-postcode'
import { supabase } from './supabaseClient'

const UNIPASS_KEY = 'k250k296m013b127c080d010m6'

// 브랜드 설정 (brand URL 파라미터로 선택)
const BRANDS = {
  pyunhan: {
    name: '편한인생연구소',
    tag: '통관번호 수정센터',
    primary: '#2d6a4f',   // 딥 그린
    secondary: '#40916c',
    light: '#d8f3dc',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)"/>
        <path d="M20 10c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10S25.5 10 20 10zm0 3c1.7 0 3 1.3 3 3s-1.3 3-3 3-3-1.3-3-3 1.3-3 3-3zm0 14.2c-2.5 0-4.7-1.3-6-3.2.03-2 4-3.1 6-3.1s5.97 1.1 6 3.1c-1.3 1.9-3.5 3.2-6 3.2z" fill="white"/>
      </svg>
    ),
  },
  cool: {
    name: '쿨한인생연구소',
    tag: '통관번호 수정센터',
    primary: '#0077b6',   // 쿨 블루
    secondary: '#0096c7',
    light: '#caf0f8',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)"/>
        <path d="M20 8l2.4 6.4 6.8.6-5.1 4.5 1.6 6.7L20 22.8l-5.7 3.4 1.6-6.7-5.1-4.5 6.8-.6z" fill="white"/>
      </svg>
    ),
  },
  bbunhan: {
    name: '뻔한인생연구소',
    tag: '통관번호 수정센터',
    primary: '#6d28d9',   // 퍼플
    secondary: '#7c3aed',
    light: '#ede9fe',
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="w-10 h-10">
        <circle cx="20" cy="20" r="20" fill="rgba(255,255,255,0.15)"/>
        <path d="M20 11l2 6h6l-5 3.6 1.9 5.9L20 23l-4.9 3.5L17 20.6 12 17h6z" fill="white"/>
        <circle cx="20" cy="20" r="3" fill="rgba(255,255,255,0.4)"/>
      </svg>
    ),
  },
}

const DEFAULT_BRAND = {
  name: '통관번호 수정센터',
  tag: '개인통관고유부호 정정 신청',
  primary: '#1352a2',
  secondary: '#1a6bc7',
  light: '#e8f0fe',
  icon: null,
}

const MOCK_ORDER = {
  name: '홍길동',
  phone: '010-1234-5678',
  pccc: 'P123456789012',
  zipcode: '06236',
}

export default function CustomsForm() {
  const [urlError, setUrlError]         = useState(null)
  const [orderId, setOrderId]           = useState('')
  const [brand, setBrand]               = useState(DEFAULT_BRAND)
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
    const b     = params.get('brand')
    if (b && BRANDS[b]) setBrand(BRANDS[b])
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

      {/* ── 브랜드 헤더 ── */}
      <div style={{ background: brand.primary }} className="w-full">
        <div className="px-4 pt-5 pb-4 max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            {brand.icon}
            <div>
              <p className="text-white font-extrabold text-xl leading-tight tracking-tight">{brand.name}</p>
              <p className="text-white/60 text-xs mt-0.5 tracking-wide">{brand.tag}</p>
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.15)' }} className="rounded-lg px-4 py-2.5">
            <p className="text-white font-bold text-sm">개인통관고유부호 정정 신청</p>
            <p className="text-white/60 text-xs mt-0.5">Personal Customs Clearance Code Update</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto">

        {/* ── URL 오류 화면 ── */}
        {urlError ? (
          <div className="bg-white border border-red-300 rounded-xl overflow-hidden">
            <div className="bg-red-600 px-5 py-3">
              <p className="text-white font-bold text-sm">접근 오류</p>
            </div>
            <div className="p-5 flex gap-3">
              <svg viewBox="0 0 24 24" className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              <div>
                <p className="text-sm text-gray-800 font-medium mb-1">유효하지 않은 접근입니다</p>
                <p className="text-sm text-gray-600 leading-relaxed">{urlError}</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── 접수번호 + 단계 표시 ── */}
            <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">접수번호</p>
                <p className="text-sm font-mono font-bold text-gray-800 mt-0.5">{orderId || '확인 중...'}</p>
              </div>
              <div className="flex items-center gap-1 text-xs">
                {[
                  { n: 1, label: '정보확인' },
                  { n: 2, label: '검증' },
                  { n: 3, label: '완료' },
                ].map((s, i) => (
                  <div key={s.n} className="flex items-center gap-1">
                    <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                      currentStep === s.n
                        ? 'text-white'
                        : currentStep > s.n
                        ? 'text-green-700 bg-green-50'
                        : 'text-gray-400 bg-gray-100'
                    }`}
                    style={currentStep === s.n ? { background: brand.primary } : {}}>
                      <span>{currentStep > s.n ? '✓' : s.n}</span>
                      <span>{s.label}</span>
                    </div>
                    {i < 2 && <span className="text-gray-300 text-xs">›</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* ── 완료 화면 ── */}
            {submitDone ? (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100" style={{ background: '#f0f7ee' }}>
                  <p className="text-sm font-bold" style={{ color: '#00703c' }}>■ 정정 신청 접수 완료</p>
                </div>
                <div className="p-8 text-center">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                       style={{ background: '#e8f5e9' }}>
                    <svg viewBox="0 0 24 24" className="w-10 h-10" style={{ color: '#00703c' }} fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">신청이 접수되었습니다</h2>
                  <p className="text-sm text-gray-500 mb-5">접수번호: <span className="font-mono font-bold text-gray-700">{orderId}</span></p>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-left space-y-2.5">
                    <p className="text-sm text-gray-600 flex gap-2"><span className="text-gray-400">•</span>정정된 통관 정보가 시스템에 반영됩니다.</p>
                    <p className="text-sm text-gray-600 flex gap-2"><span className="text-gray-400">•</span>처리 완료 후 배송이 재개됩니다.</p>
                    <p className="text-sm text-gray-600 flex gap-2"><span className="text-gray-400">•</span>문의: {brand.name} 고객센터 ☎ 125</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* ── 안내 박스 ── */}
                <div className="mb-3 bg-white rounded-xl overflow-hidden"
                     style={{ border: '1px solid #d0ddef', borderLeft: `4px solid ${brand.primary}` }}>
                  <div className="px-4 py-2.5 border-b" style={{ background: brand.light, borderColor: '#d0ddef' }}>
                    <p className="text-sm font-bold" style={{ color: brand.primary }}>【필독】 개인통관고유부호 정정 안내</p>
                  </div>
                  <div className="px-4 py-3 space-y-2">
                    <p className="text-sm text-gray-700 flex gap-2">
                      <span className="shrink-0 font-bold" style={{ color: brand.primary }}>①</span>
                      관세청 정책 변경으로 <strong>배송지 우편번호</strong>가 개인통관고유부호 등록 정보와 정확히 일치해야 통관이 가능합니다.
                    </p>
                    <p className="text-sm text-gray-700 flex gap-2">
                      <span className="shrink-0 font-bold" style={{ color: brand.primary }}>②</span>
                      미수정 시 수입 물품의 통관이 지연되거나 반송될 수 있습니다.
                    </p>
                    <p className="text-sm text-gray-700 flex gap-2">
                      <span className="shrink-0 font-bold" style={{ color: brand.primary }}>③</span>
                      입력 정보는 관세청 전자통관시스템(UNI-PASS)을 통해 실시간 검증됩니다.
                    </p>
                  </div>
                </div>

                {/* ── 입력 폼 ── */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-200" style={{ background: '#f5f6f7' }}>
                    <p className="text-base font-bold text-gray-800">■ 신청인 정보 입력</p>
                    <p className="text-sm text-gray-500 mt-0.5">아래 정보를 정확하게 확인·수정 후 검증하여 주십시오</p>
                  </div>

                  <div className="divide-y divide-gray-100">

                    {/* 수령인 성함 */}
                    <div className="px-4 py-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        수령인 성함 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={e => { setName(e.target.value); setVerifyStatus('idle') }}
                        placeholder="성함을 입력해 주세요"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">개인통관고유부호에 등록된 성명과 동일하게 입력하여 주십시오.</p>
                    </div>

                    {/* 연락처 */}
                    <div className="px-4 py-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        휴대전화번호 <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setVerifyStatus('idle') }}
                        placeholder="010-0000-0000"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base
                                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <p className="text-xs text-gray-400 mt-1.5">개인통관고유부호에 등록된 휴대전화번호를 입력하여 주십시오.</p>
                    </div>

                    {/* 개인통관고유부호 */}
                    <div className="px-4 py-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        개인통관고유부호 (PCCC) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={pccc}
                        onChange={handlePcccChange}
                        placeholder="P000000000000 (P로 시작하는 13자리)"
                        maxLength={13}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg text-base font-mono
                                   tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <div className="mt-1.5">
                        {pccc && !isPcccValid && (
                          <p className="text-sm flex items-center gap-1" style={{ color: '#d4351c' }}>
                            <span className="font-bold">!</span> P로 시작하는 13자리를 입력해 주세요. (현재 {pccc.length}자)
                          </p>
                        )}
                        {isPcccValid && (
                          <p className="text-sm flex items-center gap-1" style={{ color: '#00703c' }}>
                            <span className="font-bold">✓</span> 형식이 올바릅니다.
                          </p>
                        )}
                        {!pccc && (
                          <p className="text-xs text-gray-400">관세청 전자통관시스템에서 발급받은 13자리 부호</p>
                        )}
                      </div>
                    </div>

                    {/* 배송지 우편번호 */}
                    <div className="px-4 py-4">
                      <label className="block text-sm font-bold text-gray-700 mb-2">
                        배송지 우편번호 <span className="text-red-500">*</span>
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={zipcode}
                          readOnly
                          placeholder="우편번호 5자리"
                          className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-base font-mono
                                     tracking-widest bg-gray-50 text-gray-600 cursor-not-allowed"
                        />
                        <button
                          type="button"
                          onClick={() => setIsPostcodeOpen(true)}
                          className="px-5 py-3 text-white text-sm font-bold rounded-lg transition-colors whitespace-nowrap"
                          style={{ background: brand.primary }}
                          onMouseEnter={e => e.currentTarget.style.background = brand.secondary}
                          onMouseLeave={e => e.currentTarget.style.background = brand.primary}
                        >
                          주소 검색
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1.5">
                        반드시 <strong>'주소 검색'</strong> 버튼을 통해 정확한 우편번호를 선택하여 주십시오.
                      </p>
                    </div>
                  </div>

                  {/* ── 검증 버튼 영역 ── */}
                  <div className="px-4 py-4 border-t border-gray-200" style={{ background: '#f5f6f7' }}>
                    <button
                      type="button"
                      onClick={verifyPCCC}
                      disabled={!isPcccValid || !zipcode || verifyStatus === 'loading'}
                      className="w-full py-4 text-white font-bold text-base rounded-xl transition-colors
                                 flex items-center justify-center gap-2
                                 disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ background: verifyStatus === 'success' ? '#00703c' : brand.primary }}
                    >
                      {verifyStatus === 'loading' ? (
                        <>
                          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                      <div className="mt-3 rounded-xl border p-4 flex gap-3"
                           style={{ background: '#e8f5e9', borderColor: '#a5d6a7' }}>
                        <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0 mt-0.5" style={{ color: '#00703c' }} fill="currentColor">
                          <path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                        </svg>
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#00703c' }}>관세청 검증 완료</p>
                          <p className="text-sm mt-0.5" style={{ color: '#2e7d32' }}>
                            입력하신 정보가 관세청 시스템과 일치합니다. 아래 버튼으로 최종 신청을 완료해 주십시오.
                          </p>
                        </div>
                      </div>
                    )}
                    {verifyStatus === 'fail' && (
                      <div className="mt-3 rounded-xl border p-4" style={{ background: '#fef3f2', borderColor: '#fca5a5' }}>
                        <p className="text-sm font-bold mb-1.5" style={{ color: '#d4351c' }}>✗ 검증 불일치</p>
                        <p className="text-sm mb-2" style={{ color: '#991b1b' }}>
                          입력하신 정보가 관세청 등록 정보와 일치하지 않습니다. 아래 사항을 확인해 주세요.
                        </p>
                        {verifyErrors.length > 0 && (
                          <ul className="space-y-1">
                            {verifyErrors.map((msg, i) => (
                              <li key={i} className="text-sm flex gap-1" style={{ color: '#d4351c' }}>
                                <span>•</span><span>{msg}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {verifyStatus === 'error' && (
                      <div className="mt-3 rounded-xl border p-4 flex gap-3"
                           style={{ background: '#fff8e1', borderColor: '#ffe082' }}>
                        <span className="text-base font-bold shrink-0" style={{ color: '#f57f17' }}>!</span>
                        <div>
                          <p className="text-sm font-bold" style={{ color: '#f57f17' }}>시스템 연결 오류</p>
                          <p className="text-sm mt-0.5 text-gray-600">
                            관세청 서버와의 연결에 실패했습니다. 잠시 후 다시 시도해 주시거나 고객지원센터(☎ 125)로 문의해 주세요.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ── 최종 제출 버튼 ── */}
                  <div className="px-4 py-4 border-t border-gray-200">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={verifyStatus !== 'success' || isSubmitting || submitDone}
                      className="w-full py-4 text-white font-bold text-base rounded-xl transition-colors
                                 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      style={{ background: brand.primary }}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          신청서 제출 중...
                        </>
                      ) : (
                        '정정 신청서 최종 제출'
                      )}
                    </button>
                    <p className="text-center text-sm text-gray-400 mt-2">
                      관세청 검증 완료 후 제출 버튼이 활성화됩니다
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* ── 푸터 ── */}
            <div className="mt-5 pb-8">
              <div className="border-t border-gray-300 pt-4 space-y-2">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor"><path d="M12 1L3 5v6c0 5.25 3.75 10.15 9 11.35C17.25 21.15 21 16.25 21 11V5l-9-4z"/></svg>
                    SSL 보안 암호화
                  </span>
                  <span>|</span>
                  <span>관세청 UNI-PASS 연동</span>
                  <span>|</span>
                  <span>개인정보보호법 준수</span>
                </div>
                <p className="text-center text-sm text-gray-500">
                  고객지원센터 ☎ <strong>125</strong>
                  <span className="text-gray-300 mx-1.5">|</span>
                  평일 09:00 ~ 18:00
                </p>
                <p className="text-center text-xs text-gray-300 leading-relaxed">
                  수집된 개인정보는 통관 업무 외 목적으로 사용되지 않습니다.
                </p>
              </div>
            </div>

          </>
        )}
      </div>

      {/* ── 우편번호 검색 모달 (모바일: 하단 시트) ── */}
      {isPostcodeOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center"
          onClick={() => setIsPostcodeOpen(false)}
        >
          <div
            className="bg-white w-full max-w-lg overflow-hidden rounded-t-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200"
                 style={{ background: brand.primary }}>
              <span className="font-bold text-white text-base">배송지 우편번호 검색</span>
              <button
                onClick={() => setIsPostcodeOpen(false)}
                className="text-blue-200 hover:text-white text-2xl leading-none p-1 w-10 h-10 flex items-center justify-center"
              >
                ✕
              </button>
            </div>
            <DaumPostcode
              onComplete={handlePostcodeSelect}
              style={{ height: '460px' }}
              autoClose={false}
            />
          </div>
        </div>
      )}
    </div>
  )
}
