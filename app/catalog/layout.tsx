export default function CatalogLayout({ children }: { children: React.ReactNode }) {
  // w-full is load-bearing: body is `flex flex-col` (app/layout.tsx), and a flex
  // item with an auto margin on the cross axis doesn't stretch — without w-full,
  // main shrinks to fit its own content instead of always filling up to
  // max-w-5xl, so its rendered width silently varies page to page by content.
  return <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-8">{children}</main>;
}
