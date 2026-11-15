// Countries and time zones for the About section (the backend checks the same lists).

/** ISO 3166-1 alpha-2 codes; names come from the browser (Intl.DisplayNames), in any language. */
export const COUNTRY_CODES = `AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW
BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI
FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN
IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME
MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF
PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV
SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE
YT ZA ZM ZW`.split(/\s+/);

/** "TJ" → "🇹🇯" */
export function flag(code: string) {
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function countryOptions() {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) => a.name.localeCompare(b.name));
}

/** "GMT+5", "GMT+5:30", "GMT-3" — the zone's offset right now. */
export function offsetLabel(zone: string, at = new Date()) {
  const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return part === "GMT" ? "GMT+0" : (part ?? "");
}

/** IANA zones ("Asia/Dushanbe") with their current offset, sorted by offset then name. */
export function timeZoneOptions() {
  const zones = Intl.supportedValuesOf("timeZone");
  const minutes = (label: string) => {
    const match = /GMT([+-])(\d+)(?::(\d+))?/.exec(label);
    return match ? (match[1] === "-" ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0)) : 0;
  };
  return zones
    .map((zone) => ({ zone, offset: offsetLabel(zone) }))
    .sort((a, b) => minutes(a.offset) - minutes(b.offset) || a.zone.localeCompare(b.zone));
}
