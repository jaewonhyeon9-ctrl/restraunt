import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 더찰칵",
  description: "더찰칵 앱의 개인정보처리방침",
};

export const dynamic = "force-static";

const EFFECTIVE_DATE = "2026년 4월 21일";
const CONTACT_EMAIL = "jaewonhyeon9@gmail.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10 text-slate-800">
      <h1 className="text-3xl font-bold">개인정보처리방침</h1>
      <p className="mt-2 text-sm text-slate-500">시행일: {EFFECTIVE_DATE}</p>

      <p className="mt-6 leading-relaxed">
        더찰칵(이하 &ldquo;서비스&rdquo;)은 식당 운영에 필요한 주문, 재고, 근태, 매출,
        지출 관리를 위한 웹 및 모바일 애플리케이션입니다. 본 방침은 서비스가 수집하는
        개인정보의 종류, 이용 목적, 보관 기간, 제3자 제공, 이용자의 권리 등에 대해
        설명합니다.
      </p>

      <Section title="1. 수집하는 개인정보 항목">
        <p>서비스는 다음과 같은 정보를 수집합니다.</p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>
            <strong>계정 정보</strong>: 이메일 주소, 비밀번호(암호화 저장), 이름,
            역할(사장/직원)
          </li>
          <li>
            <strong>매장 운영 데이터</strong>: 주문 내역, 재고 현황, 근태 기록,
            매출/지출 내역, 직원 정보(이름, 시급 등), 거래처 정보
          </li>
          <li>
            <strong>영수증 이미지</strong>: 지출 등록 시 사용자가 카메라 또는
            파일 업로드를 통해 제공하는 영수증 사진
          </li>
          <li>
            <strong>푸시 알림 구독 정보</strong>: 알림 수신을 위한 브라우저 구독
            식별자(endpoint)
          </li>
          <li>
            <strong>기술 정보</strong>: 로그인 세션 쿠키, 접속 IP, 기기 정보,
            브라우저 정보
          </li>
        </ul>
      </Section>

      <Section title="2. 개인정보의 이용 목적">
        <ul className="list-disc pl-6 space-y-1">
          <li>서비스 제공 및 사용자 인증</li>
          <li>매장 운영 데이터의 저장 및 조회 기능 제공</li>
          <li>영수증 이미지의 자동 인식(OCR) 처리</li>
          <li>푸시 알림 발송</li>
          <li>오류 분석 및 서비스 개선</li>
          <li>법적 의무 이행</li>
        </ul>
      </Section>

      <Section title="3. 개인정보의 보관 기간">
        <p>
          서비스는 회원 탈퇴 또는 계정 삭제 요청 시까지 개인정보를 보관합니다.
          관련 법령에 따라 일정 기간 보관이 필요한 경우에는 해당 기간 동안만
          보관한 후 파기합니다.
        </p>
      </Section>

      <Section title="4. 제3자 제공 및 처리 위탁">
        <p>
          서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만
          안정적인 서비스 제공을 위해 다음의 사업자에게 데이터 처리 업무를
          위탁합니다.
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>
            <strong>Vercel Inc.</strong> &mdash; 애플리케이션 호스팅
          </li>
          <li>
            <strong>Supabase Inc.</strong> &mdash; 데이터베이스 저장
          </li>
          <li>
            <strong>Cloudinary Inc.</strong> &mdash; 영수증 이미지 저장 및 처리
          </li>
          <li>
            <strong>Google LLC</strong> &mdash; 영수증 이미지 OCR 처리(해당
            기능 사용 시)
          </li>
        </ul>
        <p className="mt-2">
          위탁받은 사업자는 각자의 개인정보처리방침에 따라 정보를 보호하며,
          서비스는 업무 수행 목적 외의 개인정보 이용을 금지합니다.
        </p>
      </Section>

      <Section title="5. 이용자의 권리">
        <p>
          이용자는 언제든지 자신의 개인정보에 대해 다음 권리를 행사할 수
          있습니다.
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>개인정보의 열람, 수정, 삭제 요구</li>
          <li>개인정보 처리 정지 요구</li>
          <li>계정 삭제(회원 탈퇴)</li>
        </ul>
        <p className="mt-2">
          권리 행사는 앱 내 설정을 통하거나 아래 연락처로 요청하실 수 있으며,
          서비스는 지체 없이 조치합니다.
        </p>
      </Section>

      <Section title="6. 개인정보의 안전성 확보 조치">
        <ul className="list-disc pl-6 space-y-1">
          <li>비밀번호의 단방향 암호화 저장(bcrypt)</li>
          <li>전송 구간 HTTPS 암호화</li>
          <li>접근 권한 최소화 및 역할 기반 접근 제어</li>
          <li>세션 쿠키의 HttpOnly, Secure, SameSite 설정</li>
        </ul>
      </Section>

      <Section title="7. 카메라 및 사진 접근 권한">
        <p>
          지출 또는 거래처 등록 시 영수증을 촬영하기 위해 기기 카메라 및 사진
          접근 권한이 요청될 수 있습니다. 해당 권한은 사용자가 직접 촬영을
          실행할 때만 사용되며, 이미지는 지출/거래처 데이터에 연동되어 저장되고
          그 외 목적으로 사용되지 않습니다.
        </p>
      </Section>

      <Section title="8. 푸시 알림">
        <p>
          이용자가 동의한 경우 서비스는 주문 접수, 재고 경고 등 업무 알림을
          발송할 수 있습니다. 알림 수신은 기기 또는 브라우저 설정에서 언제든지
          해제할 수 있습니다.
        </p>
      </Section>

      <Section title="9. 아동의 개인정보 보호">
        <p>
          서비스는 만 14세 미만 아동을 대상으로 하지 않으며, 만 14세 미만의
          개인정보를 의도적으로 수집하지 않습니다.
        </p>
      </Section>

      <Section title="10. 방침의 변경">
        <p>
          본 방침은 법령 및 서비스 정책 변경에 따라 수정될 수 있으며, 변경 시
          시행일을 갱신하여 본 페이지에 공지합니다.
        </p>
      </Section>

      <Section title="11. 연락처">
        <p>
          개인정보와 관련된 문의, 요청, 불만 사항은 다음 연락처로 접수할 수
          있습니다.
        </p>
        <ul className="mt-2 list-disc pl-6 space-y-1">
          <li>
            이메일:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-blue-600 underline"
            >
              {CONTACT_EMAIL}
            </a>
          </li>
        </ul>
      </Section>

      <footer className="mt-12 border-t pt-4 text-xs text-slate-500">
        시행일: {EFFECTIVE_DATE}
      </footer>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-2 leading-relaxed">{children}</div>
    </section>
  );
}
