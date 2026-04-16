export interface ParsedReceiptItem {
  name: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
}

export interface ParsedReceipt {
  supplierName?: string
  date?: string
  items: ParsedReceiptItem[]
  total: number
  rawText: string
}

// 합계/총액 관련 키워드
const TOTAL_KEYWORDS = /(합\s*계|총\s*액|총\s*금\s*액|결\s*제\s*금\s*액|승\s*인\s*금\s*액|공\s*급\s*대\s*가|금\s*액\s*계|받\s*을\s*금\s*액|판\s*매\s*총\s*액|total|amount)/i

// 명백히 헤더/푸터인 줄 (영수증 자체의 메타데이터)
const META_KEYWORDS = /(사업자\s*등록|등록번호|사업자번호|TEL|전화번호|가맹점|승인번호|승인일시|매장명|점포명|단말기|영수증번호|REG\s*NO|결제수단|포인트\s*적립|할인금액|부가세|공급가액|과세\s*물품|면세\s*물품|거스름돈|받은금액|현금|카드종류|카드번호|할부|일시불|관할|\*{3,}|={3,}|-{5,})/i

// 합계 요약 줄
const SUMMARY_KEYWORDS = /^(합\s*계|총\s*액|총\s*금\s*액|소\s*계|부가세|공급가액|과세|면세|결제금액|승인금액|현금\s*결제|카드\s*결제|받을\s*금액|거스름|공급대가|판매총액|금액\s*계)/

const UNIT_PATTERN = /(kg|g|L|ml|cc|개|병|봉|팩|박스|묶음|포|장|매|근|말|되|수|입|캔|통|봉지|상자|세트|세|쌍|벌|EA|ea|PK|pk)/i

function parsePriceFromLine(line: string): number[] {
  return [...line.matchAll(/[\d,]+/g)]
    .map((m) => parseInt(m[0].replace(/,/g, ''), 10))
    .filter((n) => !isNaN(n))
}

export function parseReceiptText(text: string): ParsedReceipt {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  // 날짜 추출
  const dateMatch = text.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/)
  const date = dateMatch
    ? `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    : undefined

  // 합계 금액 추출
  let total = 0
  for (const line of lines) {
    if (TOTAL_KEYWORDS.test(line)) {
      const nums = parsePriceFromLine(line).filter((n) => n >= 100)
      const max = nums.length > 0 ? Math.max(...nums) : 0
      if (max > total) total = max
    }
  }
  if (total === 0) {
    const allNums = [...text.matchAll(/[\d,]{3,}/g)]
      .map((m) => parseInt(m[0].replace(/,/g, ''), 10))
      .filter((n) => n >= 500 && n < 100000000)
    if (allNums.length > 0) total = Math.max(...allNums)
  }

  // 품목 파싱: 한글 2자 이상 있는 모든 줄을 품목 후보로
  const items: ParsedReceiptItem[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 메타/합계 줄 제외
    if (META_KEYWORDS.test(line)) continue
    if (SUMMARY_KEYWORDS.test(line)) continue

    // 너무 짧은 줄 제외
    if (line.length < 2) continue

    // 한글 포함 여부 체크
    const hasKorean = /[가-힣]{2,}/.test(line)
    if (!hasKorean) continue

    // 날짜/시간/숫자만 있는 줄 제외
    if (/^\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}/.test(line)) continue
    if (/^\d{1,2}:\d{2}/.test(line)) continue
    if (/^[\d\s,.\-+*/=:()#%]+$/.test(line)) continue

    // 현재 줄의 숫자 추출
    let prices = parsePriceFromLine(line).filter((n) => n >= 10 && n < 100000000)

    // 품목명 추출: 한글을 포함하는 이름 부분
    const nameMatch = line.match(/([가-힣][가-힣a-zA-Z0-9()&\-+\s]*[가-힣a-zA-Z0-9)])/)
    if (!nameMatch) continue

    const itemName = nameMatch[1].trim().replace(/\s+/g, ' ')
    if (itemName.length < 2) continue

    // 현재 줄에 가격이 없으면 다음 줄에서 가져오기 (다단 레이아웃 대응)
    if (prices.length === 0 && i + 1 < lines.length) {
      const nextLine = lines[i + 1]
      if (!META_KEYWORDS.test(nextLine) && !SUMMARY_KEYWORDS.test(nextLine)) {
        const nextPrices = parsePriceFromLine(nextLine).filter((n) => n >= 10 && n < 100000000)
        if (nextPrices.length > 0 && !/[가-힣]{2,}/.test(nextLine)) {
          prices = nextPrices
          i++ // 다음 줄은 소비된 것으로 처리
        }
      }
    }

    if (prices.length === 0) continue

    const unitMatch = line.match(UNIT_PATTERN)

    // 수량/단가/금액 해석
    let quantity = 1
    let unitPrice = prices[prices.length - 1]
    const totalPrice = prices[prices.length - 1]

    if (prices.length >= 3) {
      // 수량 / 단가 / 금액 3컬럼
      if (prices[0] < 1000) quantity = prices[0]
      unitPrice = prices[prices.length - 2]
    } else if (prices.length === 2) {
      // 수량 + 금액 또는 단가 + 금액
      if (prices[0] < 100) {
        quantity = prices[0]
        unitPrice = Math.round(prices[1] / (quantity || 1))
      } else {
        unitPrice = prices[0]
      }
    }

    items.push({
      name: itemName,
      quantity: quantity || 1,
      unit: unitMatch ? unitMatch[1] : '개',
      unitPrice,
      totalPrice,
    })
  }

  // 거래처명
  let supplierName: string | undefined
  for (const line of lines.slice(0, 6)) {
    if (/^\d+$/.test(line)) continue
    if (/\d{4}[.\-\/]\d/.test(line)) continue
    if (META_KEYWORDS.test(line)) continue
    if (!/[가-힣]/.test(line)) continue
    if (line.length < 2 || line.length > 30) continue
    supplierName = line.replace(/\s*(영수증|거래명세서|명세서|세금계산서|간이영수증).*$/i, '').trim()
    if (supplierName.length > 1) break
  }

  return { supplierName, date, items, total, rawText: text }
}
