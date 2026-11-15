import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Container } from "@/components/ui/Container";

export default function NotFound() {
  const t = useTranslations("notFound");
  return (
    <Container className="flex min-h-svh flex-col items-center justify-center text-center">
      <p className="font-display text-8xl font-bold text-accent">404</p>
      <h1 className="mt-4 font-display text-2xl">{t("title")}</h1>
      <Link href="/" className="mt-8 rounded-full bg-accent px-6 py-3 font-display text-bg">
        {t("back")}
      </Link>
    </Container>
  );
}
