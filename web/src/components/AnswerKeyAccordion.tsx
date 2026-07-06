import { MarkdownContent } from "@/components/MarkdownContent";

/**
 * Collapsed-by-default reveal for an IELTS test's answer key, using a native
 * `<details>` accordion — no completion gate here (self-study reference, not
 * unlocked by a runner), just a persistent warning so learners self-regulate
 * rather than peek before attempting the test.
 */
export function AnswerKeyAccordion({ answerKeyMd }: { answerKeyMd: string }) {
  return (
    <details className="overflow-hidden rounded-xl border border-streak/50 bg-streak-bg">
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-4 py-3 font-bold text-streak-foreground">
        ⚠️ Đáp án & giải thích
      </summary>
      <div className="border-t border-streak/30 px-4 py-3 text-sm">
        <p className="mb-3 text-streak-foreground">
          Chỉ mở khi bạn đã tự làm xong. Xem trước sẽ giảm hiệu quả luyện tập.
        </p>
        {answerKeyMd.trim().length > 0 ? (
          <MarkdownContent content={answerKeyMd} />
        ) : (
          <p className="text-muted-foreground">Đề này chưa có đáp án.</p>
        )}
      </div>
    </details>
  );
}
