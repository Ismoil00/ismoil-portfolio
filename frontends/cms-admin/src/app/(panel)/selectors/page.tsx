import type { Metadata } from "next";
import { serverGet } from "@/api/server";
import { PageHeader } from "@/components/layout/PageHeader";
import type { AnySelectorItem, DevelopmentField, Instrument, SelectorKind } from "@/types/api";
import { kinds } from "./_components/kinds";
import { SelectorsView } from "./_components/SelectorsView";

export const metadata: Metadata = { title: "Selectors" };

export default async function SelectorsPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const requested = (await searchParams).kind;
  const kind: SelectorKind = kinds.some((k) => k.kind === requested) ? (requested as SelectorKind) : "development-fields";

  const [items, fields, instruments] = await Promise.all([
    serverGet<AnySelectorItem[]>(`/admin/selectors/${kind}`),
    // Tech stacks pick their categories from these two lists.
    kind === "tech-stacks" ? serverGet<DevelopmentField[]>("/admin/selectors/development-fields") : Promise.resolve([]),
    kind === "tech-stacks" ? serverGet<Instrument[]>("/admin/selectors/instruments") : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Selectors" description="The lists the other pages pick from. Drag to set the order they appear in." />
      <SelectorsView key={kind} kind={kind} items={items} fields={fields} instruments={instruments} />
    </>
  );
}
