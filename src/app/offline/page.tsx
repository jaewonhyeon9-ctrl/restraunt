export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-8 text-center">
      <h1 className="text-2xl font-semibold">오프라인입니다</h1>
      <p className="text-sm text-slate-600">
        인터넷 연결을 확인한 뒤 다시 시도해 주세요.
      </p>
    </main>
  );
}
