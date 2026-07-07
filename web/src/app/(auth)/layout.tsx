/**
 * Desktop split-screen shell for the auth pages (mockup 01-d): left half is a
 * primary brand panel (hidden below lg — mobile keeps the single centered
 * column), right half centers whatever page is active. Presentation only.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-center">
        <div aria-hidden className="absolute -top-24 -right-16 size-72 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-28 -left-20 size-80 rounded-full bg-white/10" />
        <div aria-hidden className="absolute top-1/4 right-24 size-20 rounded-full bg-white/10" />
        <div className="relative max-w-md">
          <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-white/15 text-xl font-bold">
            H
          </div>
          <p className="text-display font-extrabold">Học chắc, thi tốt IELTS mỗi ngày.</p>
          <p className="mt-4 text-body text-primary-foreground/80">
            Lộ trình cá nhân hoá theo trình độ, luyện tập có phản hồi tức thì và duy trì streak
            học tập.
          </p>
        </div>
      </div>
      <div className="lg:flex lg:flex-col lg:justify-center">{children}</div>
    </div>
  );
}
