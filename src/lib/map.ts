// Ссылка «Как добраться»: своя ссылка салона на 2ГИС или поиск по адресу в 2ГИС.
const CITY: Record<string, string> = { 'бишкек': 'bishkek', 'ош': 'osh', 'каракол': 'karakol', 'джалал-абад': 'jalal_abad' };

export function mapLink(s: { mapUrl?: string | null; name: string; city?: string | null; address?: string | null }) {
  if (s.mapUrl) return s.mapUrl;
  const city = CITY[(s.city ?? '').trim().toLowerCase()];
  const q = encodeURIComponent([s.name, s.address].filter(Boolean).join(', '));
  return city ? `https://2gis.kg/${city}/search/${q}` : `https://2gis.kg/search/${q}`;
}
