/**
 * XML 1.0 text escaping shared by all serializers. Rejects characters XML
 * cannot represent; never accepts raw SVG/HTML markup.
 */
export function xml(text: string): string {
  if (/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(text)) {
    throw new RangeError('label contains an invalid XML character');
  }
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}
