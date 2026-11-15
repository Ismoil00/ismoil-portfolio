import { LuBuilding2 } from "react-icons/lu";
import { SvgIcon } from "@/components/ui/SvgIcon";
import type { Company, DevelopmentField, Position, ProductType, Project, TechStack, Testimonial } from "@/types/api";
import type { PickerOption } from "./Picker";

// Picker options built from selector lists, with their icons — shared by the editor forms.

export const companyOptions = (items: Company[]): PickerOption[] =>
  items.map((c) => ({
    value: c.id,
    label: c.name,
    icon: c.logo ? (
      // eslint-disable-next-line @next/next/no-img-element -- uploaded logo
      <img src={c.logo.url} alt="" className="size-4 object-contain" />
    ) : (
      <LuBuilding2 className="size-4 text-faint" />
    ),
  }));

export const techOptions = (items: TechStack[]): PickerOption[] =>
  items.map((t) => ({ value: t.id, label: t.name, icon: <SvgIcon svg={t.icon_svg} color={t.color} className="size-4" /> }));

export const fieldOptions = (items: DevelopmentField[]): PickerOption[] =>
  items.map((f) => ({
    value: f.id,
    label: f.name.en,
    icon: f.icon_svg ? <SvgIcon svg={f.icon_svg} className="size-4 text-accent" /> : undefined,
  }));

export const typeOptions = (items: ProductType[]): PickerOption[] =>
  items.map((t) => ({ value: t.id, label: t.name.en, icon: <SvgIcon svg={t.icon_svg} className="size-4 text-accent" /> }));

export const positionOptions = (items: Position[]): PickerOption[] => items.map((p) => ({ value: p.id, label: p.name.en }));

export const projectOptions = (items: Project[]): PickerOption[] =>
  items.map((p) => ({ value: p.id, label: p.title.en, note: p.end.slice(0, 4) }));

export const testimonialOptions = (items: Testimonial[]): PickerOption[] =>
  items.map((t) => ({ value: t.id, label: `${t.author_name.en} · ${t.company.name}`, note: t.given_on.slice(0, 4) }));
