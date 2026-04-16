export interface ParsedSupplier {
  name?: string
  phone?: string
  address?: string
  businessNumber?: string
  contactName?: string
  category?: string
  rawText: string
}

export function parseSupplierText(text: string): ParsedSupplier {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // 사업자등록번호 (000-00-00000 형태)
  const bizNumMatch = text.match(/(\d{3})-(\d{2})-(\d{5})/)
  const businessNumber = bizNumMatch ? bizNumMatch[0] : undefined

  // 전화번호 (02-..., 031-..., 010-... 등)
  const phoneMatch = text.match(/(?:전화|TEL|tel|☎|📞)?\s*(\d{2,4}-\d{3,4}-\d{4})/)
  const phone = phoneMatch ? phoneMatch[1] : undefined

  // 주소 추출 (시/도로 시작하는 줄)
  const addressLine = lines.find((l) =>
    /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(l)
  )
  const address = addressLine?.replace(/^(주\s*소|address)[:：]?\s*/i, '').trim()

  // 담당자명 추출
  const contactLine = lines.find((l) => /(담당|대표|성명|이름)[:：]/.test(l))
  const contactName = contactLine?.replace(/(담당|대표|성명|이름)[:：]\s*/, '').trim()

  // 카테고리 추측 (업종 키워드)
  let category: string | undefined
  if (/(육류|정육|돼지|소고기|닭고기)/.test(text)) category = '육류'
  else if (/(채소|야채|농산|신선)/.test(text)) category = '채소'
  else if (/(수산|해산|생선|어패류)/.test(text)) category = '수산'
  else if (/(음료|주류|술|맥주|소주)/.test(text)) category = '음료'
  else if (/(조미료|양념|소스)/.test(text)) category = '양념'
  else if (/(식품|식자재|도매)/.test(text)) category = '식자재'

  // 상호명 추출
  // 우선순위: 명시적 상호 표기 → 첫 줄 → 사업자등록증 상 상호
  let name: string | undefined

  // 패턴 1: "상호: XXX" 또는 "업체명: XXX"
  const explicitNameLine = lines.find((l) =>
    /^(상\s*호|업\s*체\s*명|거래처|공급자|판매자|회사명)[:：]/.test(l)
  )
  if (explicitNameLine) {
    name = explicitNameLine.replace(/^(상\s*호|업\s*체\s*명|거래처|공급자|판매자|회사명)[:：]\s*/, '').trim()
  }

  // 패턴 2: 첫 번째 줄이 상호명인 경우가 많음 (날짜/숫자/영수증 텍스트 제외)
  if (!name) {
    for (const line of lines.slice(0, 5)) {
      // 숫자만 있거나, 날짜 형태이거나, 너무 짧으면 제외
      if (/^\d+$/.test(line)) continue
      if (/\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}/.test(line)) continue
      if (line.length < 2) continue
      // 주소 라인 제외
      if (addressLine && line === addressLine) continue
      // 한글이 포함된 줄을 상호명으로
      if (/[가-힣]/.test(line)) {
        name = line
          .replace(/\s*(영수증|거래명세서|명세서|세금계산서|간이영수증).*$/i, '')
          .trim()
        if (name.length > 1) break
      }
    }
  }

  return {
    name,
    phone,
    address,
    businessNumber,
    contactName,
    category,
    rawText: text,
  }
}
