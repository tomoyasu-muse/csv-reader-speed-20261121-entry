// A fast drop-in replacement for csv-reader 1.0.0.
//
// It returns exactly the reference reader's answer for every
// input ({columns, rows, errors} under the same broken-row
// policy), but where the reference walks the text one character
// at a time and builds each field character by character, this
// reader jumps between the only characters that matter (comma,
// quote, LF, CR) with indexOf and copies each plain run of text
// with a single slice. The semantics are unchanged:
//
//   - a U+FEFF at the very start is dropped;
//   - a record ends at LF or CRLF; a line with no characters is
//     no record;
//   - a CR outside quotes that is not followed by LF is dropped
//     (stray_cr);
//   - a field that opens with a quote runs to the next undoubled
//     quote; "" inside is one quote, and each CRLF or lone CR
//     inside becomes one LF; text after the closing quote, up to
//     the next comma or line break, is appended as it stands
//     (quote_junk); a quote that never closes is a literal
//     character and the rest is re-read unquoted
//     (unterminated_quote);
//   - a quote inside an unquoted field is a literal character;
//   - rows are padded (short_row) or cut (long_row) to the
//     first record's width; errors are {code, line, row} in the
//     order met, line being the 1-based line the record starts
//     on, counting line breaks inside quoted fields too.

const COMMA = 0;
const BREAK = 1;
const END = 2;

export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const n = text.length;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  let pos = text[0] === '\uFEFF' ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;

  // Reads an unquoted run starting with `value` (already holding
  // `added` kept characters) up to the next comma or line break.
  // Returns [value, ended, added].
  function readUnquoted(value, added) {
    for (;;) {
      if (pos >= n) return [value, END, added];
      const ci = text.indexOf(',', pos);
      const li = text.indexOf('\n', pos);
      const ri = text.indexOf('\r', pos);
      let next = n;
      let kind = -1; // 0 comma, 1 LF, 2 CR
      if (ci !== -1 && ci < next) { next = ci; kind = 0; }
      if (li !== -1 && li < next) { next = li; kind = 1; }
      if (ri !== -1 && ri < next) { next = ri; kind = 2; }
      if (kind === -1) {
        value += text.slice(pos);
        added += n - pos;
        pos = n;
        return [value, END, added];
      }
      if (next > pos) {
        value += text.slice(pos, next);
        added += next - pos;
        pos = next;
      }
      if (kind === 0) {
        pos += 1;
        return [value, COMMA, added];
      }
      if (kind === 1) {
        pos += 1;
        line += 1;
        return [value, BREAK, added];
      }
      // CR: part of a CRLF break, or a stray CR to drop.
      if (text[pos + 1] === '\n') {
        pos += 2;
        line += 1;
        return [value, BREAK, added];
      }
      errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
      pos += 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  // Returns [value, ended].
  function readQuoted() {
    const open = pos;
    const openLine = line;
    let value = '';
    pos += 1;
    let closed = false;
    while (pos < n) {
      const qi = text.indexOf('"', pos);
      const li = text.indexOf('\n', pos);
      const ri = text.indexOf('\r', pos);
      let next = n;
      let kind = -1; // 0 quote, 1 LF, 2 CR
      if (qi !== -1 && qi < next) { next = qi; kind = 0; }
      if (li !== -1 && li < next) { next = li; kind = 1; }
      if (ri !== -1 && ri < next) { next = ri; kind = 2; }
      if (kind === -1) {
        pos = n;
        break;
      }
      if (next > pos) {
        value += text.slice(pos, next);
        pos = next;
      }
      if (kind === 0) {
        if (text[pos + 1] === '"') {
          value += '"';
          pos += 2;
          continue;
        }
        pos += 1;
        closed = true;
        break;
      }
      if (kind === 1) {
        value += '\n';
        line += 1;
        pos += 1;
        continue;
      }
      // CR or CRLF inside quotes: each reads as one LF.
      value += '\n';
      line += 1;
      pos += text[pos + 1] === '\n' ? 2 : 1;
    }
    if (!closed) {
      // Never closed: the quote is a literal character and the
      // text after it is read again as an unquoted field.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      const r = readUnquoted('"', 1);
      return [r[0], r[1]];
    }
    if (pos >= n) return [value, END];
    const c = text[pos];
    if (c === ',') {
      pos += 1;
      return [value, COMMA];
    }
    if (c === '\n') {
      pos += 1;
      line += 1;
      return [value, BREAK];
    }
    if (c === '\r' && text[pos + 1] === '\n') {
      pos += 2;
      line += 1;
      return [value, BREAK];
    }
    // Junk after the closing quote, appended as it stands.
    const junk = readUnquoted(value, 0);
    if (junk[2] > 0) {
      errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
    }
    return [junk[0], junk[1]];
  }

  for (;;) {
    // Lines left with no characters are no records.
    while (pos < n) {
      if (text[pos] === '\n') {
        pos += 1;
        line += 1;
      } else if (text[pos] === '\r' && text[pos + 1] === '\n') {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let ended = COMMA;
    let quoted = false;
    while (ended === COMMA) {
      quoted = text[pos] === '"';
      const f = quoted ? readQuoted() : readUnquoted('', 0);
      fields.push(f[0]);
      ended = f[1];
    }

    // A line that held only stray CRs is no record either.
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
