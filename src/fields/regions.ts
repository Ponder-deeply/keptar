// Hungarian counties plus Budapest and "abroad". Values are stable slugs.
export const REGIONS = [
  { label: 'Budapest', value: 'budapest' },
  { label: 'Bács-Kiskun', value: 'bacs-kiskun' },
  { label: 'Baranya', value: 'baranya' },
  { label: 'Békés', value: 'bekes' },
  { label: 'Borsod-Abaúj-Zemplén', value: 'borsod-abauj-zemplen' },
  { label: 'Csongrád-Csanád', value: 'csongrad-csanad' },
  { label: 'Fejér', value: 'fejer' },
  { label: 'Győr-Moson-Sopron', value: 'gyor-moson-sopron' },
  { label: 'Hajdú-Bihar', value: 'hajdu-bihar' },
  { label: 'Heves', value: 'heves' },
  { label: 'Jász-Nagykun-Szolnok', value: 'jasz-nagykun-szolnok' },
  { label: 'Komárom-Esztergom', value: 'komarom-esztergom' },
  { label: 'Nógrád', value: 'nograd' },
  { label: 'Pest', value: 'pest' },
  { label: 'Somogy', value: 'somogy' },
  { label: 'Szabolcs-Szatmár-Bereg', value: 'szabolcs-szatmar-bereg' },
  { label: 'Tolna', value: 'tolna' },
  { label: 'Vas', value: 'vas' },
  { label: 'Veszprém', value: 'veszprem' },
  { label: 'Zala', value: 'zala' },
  { label: 'Külföld', value: 'kulfold' },
]

export type Region = (typeof REGIONS)[number]['value']
