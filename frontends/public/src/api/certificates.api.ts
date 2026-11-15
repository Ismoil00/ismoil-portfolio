import "server-only";
import type { Locale } from "@/i18n/routing";
import type { CertificateFilterOptions, CertificateQuery, CertificatesPage } from "@/types/content";
import { apiGet } from "./client";
import { endpoints } from "./endpoints";

/** Query params in the shape the backend expects (repeated keys for lists: ?field=a&field=b). */
function toParams(locale: Locale, q: CertificateQuery) {
  const params = new URLSearchParams({ lang: locale, offset: String(q.offset), limit: String(q.limit) });
  q.fields?.forEach((v) => params.append("field", v));
  if (q.from) params.set("from", q.from);
  if (q.to) params.set("to", q.to);
  return params;
}

/** One page of certificates (most recent first), filtered. */
export const getCertificatesPage = (locale: Locale, q: CertificateQuery) =>
  apiGet<CertificatesPage>(endpoints.certificates, toParams(locale, q));

/** Fields of study and date bounds that the filters can offer. */
export const getCertificateFilterOptions = (locale: Locale) =>
  apiGet<CertificateFilterOptions>(endpoints.certificateFilters, { lang: locale });
