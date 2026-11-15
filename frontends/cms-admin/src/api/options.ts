import "server-only";
import type {
  Company,
  DevelopmentField,
  Experience,
  Institute,
  Position,
  ProductType,
  Project,
  TechStack,
  Testimonial,
} from "@/types/api";
import { serverGet } from "./server";

/** Lists that editor forms pick from, loaded on the server in parallel. */
export const loadOptions = {
  companies: () => serverGet<Company[]>("/admin/selectors/companies"),
  techs: () => serverGet<TechStack[]>("/admin/selectors/tech-stacks"),
  fields: () => serverGet<DevelopmentField[]>("/admin/selectors/development-fields"),
  positions: () => serverGet<Position[]>("/admin/selectors/positions"),
  institutes: () => serverGet<Institute[]>("/admin/selectors/institutes"),
  productTypes: () => serverGet<ProductType[]>("/admin/selectors/product-types"),
  projects: () => serverGet<Project[]>("/admin/projects"),
  testimonials: () => serverGet<Testimonial[]>("/admin/testimonials"),
  experiences: () => serverGet<Experience[]>("/admin/experiences"),
};
