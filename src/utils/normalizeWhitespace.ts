const NBSP_REGEX = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
const INVISIBLE_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;

const normalizeWhitespace = (value: string): string =>
  value
    .replace(NBSP_REGEX, ' ')
    .replace(INVISIBLE_REGEX, ' ');

export default normalizeWhitespace;
