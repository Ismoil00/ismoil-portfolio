"use server";

import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import type { CertificateQuery, CertificatesPage } from "@/types/content";
import { getCertificatesPage } from "./certificates.api";
import { cleanList, cleanMonth, cleanPaging } from "./query-guards";

/** Server Action the certificates page calls for "Show more" and filter changes (see experience.actions.ts). */
export async function loadCertificatesPage(locale: string, query: CertificateQuery): Promise<CertificatesPage> {
  if (!hasLocale(routing.locales, locale)) throw new Error("Unsupported locale");
  return getCertificatesPage(locale, {
    ...cleanPaging(query),
    fields: cleanList(query?.fields),
    from: cleanMonth(query?.from),
    to: cleanMonth(query?.to),
  });
}
