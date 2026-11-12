// @uwe A13 — Catálogo de unidades de presentación (PU).
//
// Reexporta los componentes existentes con su ID de PU sin mover archivos, para
// no romper imports. Ver docs/uwe/04-modelo-presentacion/01-unidades-presentacion.md.
//
// Las páginas (PU-01, PU-02, PU-13..PU-19) se listan en PRESENTATION_UNITS pero
// no se reexportan aquí porque son `default` de rutas de Next.js.

export { SiteHeader } from "@/components/public/SiteHeader";
export { SiteFooter } from "@/components/public/SiteFooter";
export { LeadCard, PostCard } from "@/components/public/PostCard";
export { LeftRail, RightSidebar } from "@/components/public/Sidebar";
export { Pagination } from "@/components/public/Pagination";
export { EmptyState } from "@/components/public/EmptyState";
export { PostImage } from "@/components/public/PostImage";
export { AdSlot, type AdVariant } from "@/components/public/AdSlot";

export type PresentationUnit = {
  id: string;
  name: string;
  module: string;
  kind: "layout" | "component" | "page" | "client-component";
};

export const PRESENTATION_UNITS: readonly PresentationUnit[] = [
  { id: "PU-01", name: "App Shell", module: "src/app/layout.tsx", kind: "layout" },
  {
    id: "PU-02",
    name: "Public Shell",
    module: "src/app/(public)/layout.tsx",
    kind: "layout",
  },
  {
    id: "PU-03",
    name: "Site Header",
    module: "src/components/public/SiteHeader.tsx",
    kind: "component",
  },
  {
    id: "PU-04",
    name: "Site Footer",
    module: "src/components/public/SiteFooter.tsx",
    kind: "component",
  },
  {
    id: "PU-05",
    name: "Lead Card",
    module: "src/components/public/PostCard.tsx",
    kind: "component",
  },
  {
    id: "PU-06",
    name: "Post Card",
    module: "src/components/public/PostCard.tsx",
    kind: "component",
  },
  {
    id: "PU-07",
    name: "Post Image",
    module: "src/components/public/PostImage.tsx",
    kind: "component",
  },
  {
    id: "PU-08",
    name: "Left Rail",
    module: "src/components/public/Sidebar.tsx",
    kind: "component",
  },
  {
    id: "PU-09",
    name: "Right Sidebar",
    module: "src/components/public/Sidebar.tsx",
    kind: "component",
  },
  {
    id: "PU-10",
    name: "Pagination",
    module: "src/components/public/Pagination.tsx",
    kind: "component",
  },
  {
    id: "PU-11",
    name: "Empty State",
    module: "src/components/public/EmptyState.tsx",
    kind: "component",
  },
  {
    id: "PU-12",
    name: "Ad Slot",
    module: "src/components/public/AdSlot.tsx",
    kind: "component",
  },
  {
    id: "PU-13",
    name: "Admin Shell",
    module: "src/app/admin/layout.tsx",
    kind: "layout",
  },
  {
    id: "PU-14",
    name: "Admin Dashboard",
    module: "src/app/admin/page.tsx",
    kind: "page",
  },
  {
    id: "PU-15",
    name: "Queue Table",
    module: "src/app/admin/queue/page.tsx",
    kind: "page",
  },
  {
    id: "PU-16",
    name: "RawItem Detail",
    module: "src/app/admin/queue/[id]/page.tsx",
    kind: "page",
  },
  {
    id: "PU-17",
    name: "Posts Table",
    module: "src/app/admin/posts/page.tsx",
    kind: "page",
  },
  {
    id: "PU-18",
    name: "Sources Manager",
    module: "src/app/admin/sources/page.tsx",
    kind: "page",
  },
  {
    id: "PU-19",
    name: "Categories Manager",
    module: "src/app/admin/categories/page.tsx",
    kind: "page",
  },
  {
    id: "PU-20",
    name: "Login Form",
    module: "src/app/admin/login/login-form.tsx",
    kind: "client-component",
  },
];

export function findPresentationUnit(
  id: string
): PresentationUnit | undefined {
  return PRESENTATION_UNITS.find((unit) => unit.id === id);
}
