"""How "my role" on a testimonial reads: a development field or a technology, with "development" added."""

LANGS = ("en", "ru", "tg")
# Chosen by the site owner: "Python development" · "Python Разработчик" · "Python Барномасоз".
SUFFIX = {"en": " development", "ru": " Разработчик", "tg": " Барномасоз"}


def role_label(name: dict[str, str] | str) -> dict[str, str]:
    """The role in every language. A technology's name is the same in all three; a name that already
    ends in "development" (e.g. "Game development") is used as it is."""
    names = (
        dict.fromkeys(LANGS, name) if isinstance(name, str) else {lang: name.get(lang) or name["en"] for lang in LANGS}
    )
    if names["en"].strip().lower().endswith("development"):
        return names
    return {lang: f"{names[lang]}{SUFFIX[lang]}" for lang in LANGS}
