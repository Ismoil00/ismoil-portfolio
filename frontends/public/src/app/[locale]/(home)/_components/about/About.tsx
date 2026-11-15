import { getTranslations } from "next-intl/server";
import { LuMail, LuMapPin, LuGlobe, LuDownload } from "react-icons/lu";
import type { Locale } from "@/i18n/routing";
import { getProfile } from "@/api/content.api";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { RichText } from "@/components/ui/RichText";
import { Spotlight } from "@/components/ui/Spotlight";

export async function About({ locale }: { locale: Locale }) {
  const [profile, t, ta] = await Promise.all([
    getProfile(locale),
    getTranslations({ locale, namespace: "sections.about" }),
    getTranslations({ locale, namespace: "about" }),
  ]);
  const { about } = profile;

  // The country's name in the page's language; the work-format line follows the two checkboxes.
  const country = new Intl.DisplayNames([locale], { type: "region" }).of(about.countryCode) ?? about.countryCode;
  const workFormat =
    about.openToRemote && about.openToRelocation
      ? ta("workBoth")
      : about.openToRemote
        ? ta("workRemote")
        : about.openToRelocation
          ? ta("workRelocation")
          : null;

  const facts = [
    { icon: LuMapPin, text: `${about.city}, ${country} (${about.utcOffset})` },
    ...(workFormat ? [{ icon: LuGlobe, text: workFormat }] : []),
    ...(profile.email ? [{ icon: LuMail, text: profile.email, href: `mailto:${profile.email}` }] : []),
  ];

  return (
    <Section id="about" eyebrow={t("eyebrow")} title={about.title}>
      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
        <div className="space-y-5">
          {about.paragraphs.map((p, i) => (
            <Reveal key={i} delay={i * 100}>
              <p className={`leading-relaxed ${i === 0 ? "text-xl text-fg sm:text-2xl" : "text-lg text-muted"}`}>
                <RichText text={p} />
              </p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={150} className="lg:pt-2">
          {/* Outer element floats; inner card carries the mouse-follow light. */}
          <div className="animate-bob-soft">
            <Spotlight
              reactiveShadow
              className="rounded-2xl border border-line bg-card backdrop-blur-sm hover:border-accent/40"
            >
              <div className="p-6">
                <ul className="space-y-4">
                  {facts.map(({ icon: Icon, text, href }) => (
                    <li key={text} className="flex items-start gap-3 text-muted">
                      <Icon className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                      {href ? (
                        <a href={href} className="break-all transition-colors hover:text-accent">
                          {text}
                        </a>
                      ) : (
                        <span>{text}</span>
                      )}
                    </li>
                  ))}

                  {/* Resume as a plain row like the facts above (icon first, same text color),
                      underlined. Hover/click behave exactly like the email link: text turns blue. */}
                  <li>
                    <a
                      href={profile.resumeUrl}
                      download
                      className="group/dl inline-flex items-start gap-3 rounded-md text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                    >
                      <LuDownload className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
                      <span className="underline decoration-tint/30 underline-offset-4 transition-colors group-hover/dl:decoration-accent">
                        {ta("resume")}
                      </span>
                    </a>
                  </li>
                </ul>
              </div>
            </Spotlight>
          </div>
        </Reveal>
      </div>
    </Section>
  );
}
