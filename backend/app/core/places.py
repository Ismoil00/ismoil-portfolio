"""Countries (ISO 3166-1 alpha-2) and time zones (IANA) for the About section's location."""

from datetime import UTC, datetime
from functools import cache
from zoneinfo import ZoneInfo, available_timezones

# Every officially assigned ISO 3166-1 alpha-2 code. Names are shown by the sites in each language
# (the browser's Intl.DisplayNames), so only codes are stored.
COUNTRY_CODES = frozenset(
    """
    AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW
    BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI
    FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN
    IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME
    MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF
    PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV
    SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE
    YT ZA ZM ZW
    """.split()
)


@cache
def time_zones() -> frozenset[str]:
    """IANA zones like "Asia/Dushanbe" (the tzdata package provides them on Windows too)."""
    return frozenset(z for z in available_timezones() if "/" in z and not z.startswith(("Etc/", "SystemV/")))


def utc_offset_label(zone: str, at: datetime | None = None) -> str:
    """ "GMT+5", "GMT+5:30", "GMT-3" — the zone's current offset (follows daylight saving)."""
    offset = (at or datetime.now(UTC)).astimezone(ZoneInfo(zone)).utcoffset()
    minutes = int(offset.total_seconds() // 60) if offset else 0
    sign = "+" if minutes >= 0 else "-"
    hours, rest = divmod(abs(minutes), 60)
    return f"GMT{sign}{hours}" + (f":{rest:02d}" if rest else "")
