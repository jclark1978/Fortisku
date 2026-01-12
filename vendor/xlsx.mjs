/**
 * Minimal XLSX reader reliant on in-browser APIs.
 * Supports extracting worksheets and shared strings required for FortiSKU Finder.
 * Inspired by SheetJS public API surface (read + utils.sheet_to_json header:1).
 */

/* eslint-disable no-bitwise */
const textDecoder = new TextDecoder("utf-8");

function toUint8Array(data) {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error("Unsupported data type for XLSX.read");
}

function readUint16LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function readUint32LE(buffer, offset) {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    (buffer[offset + 3] << 24)
  );
}

class BitReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.offset = 0;
    this.bitBuffer = 0;
    this.bitLength = 0;
  }

  readBits(count) {
    let result = 0;
    let bitsRead = 0;

    while (bitsRead < count) {
      if (this.bitLength === 0) {
        if (this.offset >= this.bytes.length) {
          throw new Error("Unexpected end of Deflate stream");
        }
        this.bitBuffer = this.bytes[this.offset++];
        this.bitLength = 8;
      }

      const take = Math.min(this.bitLength, count - bitsRead);
      const mask = (1 << take) - 1;
      result |= ((this.bitBuffer & mask) << bitsRead);
      this.bitBuffer >>= take;
      this.bitLength -= take;
      bitsRead += take;
    }

    return result >>> 0;
  }

  alignToByte() {
    this.bitBuffer = 0;
    this.bitLength = 0;
  }
}

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10,
  11, 13, 15, 17, 19, 23, 27, 31,
  35, 43, 51, 59, 67, 83, 99, 115,
  131, 163, 195, 227, 258
];

const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 2, 2, 2, 2,
  3, 3, 3, 3, 4, 4, 4, 4,
  5, 5, 5, 5, 0
];

const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13,
  17, 25, 33, 49, 65, 97, 129, 193,
  257, 385, 513, 769, 1025, 1537, 2049, 3073,
  4097, 6145, 8193, 12289, 16385, 24577
];

const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2,
  3, 3, 4, 4, 5, 5, 6, 6,
  7, 7, 8, 8, 9, 9, 10, 10,
  11, 11, 12, 12, 13, 13
];

const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

function buildHuffmanTree(lengths) {
  const maxBits = Math.max(...lengths);
  const codes = new Uint32Array(lengths.length);
  const blCount = new Uint32Array(maxBits + 1);
  const nextCode = new Uint32Array(maxBits + 1);

  for (const length of lengths) {
    if (length > 0) {
      blCount[length]++;
    }
  }

  let code = 0;
  for (let bits = 1; bits <= maxBits; bits++) {
    code = (code + blCount[bits - 1]) << 1;
    nextCode[bits] = code;
  }

  for (let symbol = 0; symbol < lengths.length; symbol++) {
    const len = lengths[symbol];
    if (len !== 0) {
      codes[symbol] = nextCode[len];
      nextCode[len]++;
    }
  }

  const root = {};
  for (let symbol = 0; symbol < lengths.length; symbol++) {
    const len = lengths[symbol];
    if (!len) continue;
    let node = root;
    const codeValue = codes[symbol];

    for (let bitIndex = len - 1; bitIndex >= 0; bitIndex--) {
      const bit = (codeValue >> bitIndex) & 1;
      if (bit === 0) {
        if (!node.left) node.left = {};
        node = node.left;
      } else {
        if (!node.right) node.right = {};
        node = node.right;
      }
    }
    node.symbol = symbol;
  }

  return root;
}

const FIXED_LITERAL_LENGTHS = (() => {
  const lengths = new Array(288).fill(0);
  for (let i = 0; i <= 143; i++) lengths[i] = 8;
  for (let i = 144; i <= 255; i++) lengths[i] = 9;
  for (let i = 256; i <= 279; i++) lengths[i] = 7;
  for (let i = 280; i <= 287; i++) lengths[i] = 8;
  return lengths;
})();

const FIXED_DISTANCE_LENGTHS = new Array(32).fill(5);
const FIXED_LITERAL_TREE = buildHuffmanTree(FIXED_LITERAL_LENGTHS);
const FIXED_DISTANCE_TREE = buildHuffmanTree(FIXED_DISTANCE_LENGTHS);

function decodeSymbol(reader, tree) {
  let node = tree;
  while (node.symbol === undefined) {
    const bit = reader.readBits(1);
    node = bit ? node.right : node.left;
    if (!node) {
      throw new Error("Invalid Huffman code while inflating.");
    }
  }
  return node.symbol;
}

function ensureCapacity(buffer, needed) {
  if (buffer.length >= needed) {
    return buffer;
  }
  let newLength = buffer.length * 2 || 1024;
  while (newLength < needed) {
    newLength *= 2;
  }
  const expanded = new Uint8Array(newLength);
  expanded.set(buffer);
  return expanded;
}

function inflateRaw(input, expectedSize) {
  const reader = new BitReader(input);
  let output = expectedSize ? new Uint8Array(expectedSize) : new Uint8Array(1024);
  let outPosition = 0;
  let isFinalBlock = false;

  while (!isFinalBlock) {
    isFinalBlock = reader.readBits(1) === 1;
    const blockType = reader.readBits(2);

    if (blockType === 0) {
      reader.alignToByte();
      const len = reader.readBits(16);
      reader.readBits(16); // nlen (unused, integrity)
      const needed = outPosition + len;
      output = ensureCapacity(output, needed);
      for (let i = 0; i < len; i++) {
        output[outPosition++] = reader.readBits(8);
      }
    } else {
      let literalTree;
      let distanceTree;

      if (blockType === 1) {
        literalTree = FIXED_LITERAL_TREE;
        distanceTree = FIXED_DISTANCE_TREE;
      } else if (blockType === 2) {
        const HLIT = reader.readBits(5) + 257;
        const HDIST = reader.readBits(5) + 1;
        const HCLEN = reader.readBits(4) + 4;

        const codeLengths = new Array(19).fill(0);
        for (let i = 0; i < HCLEN; i++) {
          codeLengths[CODE_LENGTH_ORDER[i]] = reader.readBits(3);
        }

        const codeLengthTree = buildHuffmanTree(codeLengths);
        const lengths = [];

        while (lengths.length < HLIT + HDIST) {
          const symbol = decodeSymbol(reader, codeLengthTree);
          if (symbol <= 15) {
            lengths.push(symbol);
          } else if (symbol === 16) {
            const repeat = reader.readBits(2) + 3;
            const last = lengths[lengths.length - 1];
            for (let i = 0; i < repeat; i++) lengths.push(last);
          } else if (symbol === 17) {
            const repeat = reader.readBits(3) + 3;
            for (let i = 0; i < repeat; i++) lengths.push(0);
          } else if (symbol === 18) {
            const repeat = reader.readBits(7) + 11;
            for (let i = 0; i < repeat; i++) lengths.push(0);
          }
        }

        literalTree = buildHuffmanTree(lengths.slice(0, HLIT));
        distanceTree = buildHuffmanTree(lengths.slice(HLIT));
      } else {
        throw new Error("Unsupported compression type (only Deflate is supported).");
      }

      while (true) {
        const symbol = decodeSymbol(reader, literalTree);
        if (symbol < 256) {
          output = ensureCapacity(output, outPosition + 1);
          output[outPosition++] = symbol;
        } else if (symbol === 256) {
          break;
        } else {
          const lengthIndex = symbol - 257;
          const length =
            LENGTH_BASE[lengthIndex] + reader.readBits(LENGTH_EXTRA[lengthIndex]);

          const distSymbol = decodeSymbol(reader, distanceTree);
          const distance =
            DIST_BASE[distSymbol] + reader.readBits(DIST_EXTRA[distSymbol]);

          output = ensureCapacity(output, outPosition + length);
          for (let i = 0; i < length; i++) {
            output[outPosition] = output[outPosition - distance];
            outPosition++;
          }
        }
      }
    }
  }

  return output.subarray(0, outPosition);
}

function strFromU8(arr) {
  return textDecoder.decode(arr);
}

function findEndOfCentralDirectory(data) {
  for (let i = data.length - 22; i >= 0 && i >= data.length - 65558; i--) {
    if (readUint32LE(data, i) === 0x06054b50) {
      return i;
    }
  }
  throw new Error("Invalid XLSX: End of central directory not found.");
}

function unzip(data) {
  const bytes = toUint8Array(data);
  const eocd = findEndOfCentralDirectory(bytes);
  const totalEntries = readUint16LE(bytes, eocd + 10);
  const centralDirOffset = readUint32LE(bytes, eocd + 16);

  const files = {};
  let offset = centralDirOffset;

  for (let entry = 0; entry < totalEntries; entry++) {
    const signature = readUint32LE(bytes, offset);
    if (signature !== 0x02014b50) {
      throw new Error("Invalid central directory signature in XLSX.");
    }

    const compressionMethod = readUint16LE(bytes, offset + 10);
    const compressedSize = readUint32LE(bytes, offset + 20);
    const uncompressedSize = readUint32LE(bytes, offset + 24);
    const fileNameLength = readUint16LE(bytes, offset + 28);
    const extraLength = readUint16LE(bytes, offset + 30);
    const commentLength = readUint16LE(bytes, offset + 32);
    const localHeaderOffset = readUint32LE(bytes, offset + 42);

    const fileName = strFromU8(bytes.subarray(offset + 46, offset + 46 + fileNameLength));
    offset = offset + 46 + fileNameLength + extraLength + commentLength;

    const localSignature = readUint32LE(bytes, localHeaderOffset);
    if (localSignature !== 0x04034b50) {
      throw new Error("Invalid local file header signature.");
    }

    const localNameLength = readUint16LE(bytes, localHeaderOffset + 26);
    const localExtraLength = readUint16LE(bytes, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;

    const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
    let fileData;

    if (compressionMethod === 0) {
      fileData = compressed.slice();
    } else if (compressionMethod === 8) {
      fileData = inflateRaw(compressed, uncompressedSize);
    } else {
      throw new Error(`Unsupported compression method: ${compressionMethod}`);
    }

    files[fileName] = fileData;
  }

  return files;
}

function parseXml(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "application/xml");
  const parserError = doc.querySelector("parsererror");
  if (parserError) {
    throw new Error(`XML parsing failed: ${parserError.textContent}`);
  }
  return doc;
}

function resolvePath(base, relative) {
  if (relative.startsWith("/")) return relative.slice(1);
  const stack = base.split("/");
  stack.pop();
  const segments = relative.split("/");
  for (const segment of segments) {
    if (segment === "." || segment === "") continue;
    if (segment === "..") {
      stack.pop();
    } else {
      stack.push(segment);
    }
  }
  return stack.join("/");
}

function parseSharedStrings(xml) {
  if (!xml) return [];
  const doc = parseXml(xml);
  const siNodes = doc.getElementsByTagName("si");
  const strings = [];

  for (const si of siNodes) {
    let text = "";
    const tNodes = si.getElementsByTagName("t");
    if (tNodes.length) {
      for (const node of tNodes) {
        text += node.textContent || "";
      }
    } else {
      text = si.textContent || "";
    }
    strings.push(text);
  }

  return strings;
}

function columnIndexFromRef(ref) {
  const match = ref.match(/^[A-Z]+/i);
  const column = match ? match[0].toUpperCase() : "A";
  let index = 0;
  for (let i = 0; i < column.length; i++) {
    index = index * 26 + (column.charCodeAt(i) - 64);
  }
  return index - 1;
}

function encodeColumn(index) {
  let col = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function encodeCell(row, col) {
  return `${encodeColumn(col)}${row + 1}`;
}

function encodeRange(range) {
  return `${encodeCell(range.s.r, range.s.c)}:${encodeCell(range.e.r, range.e.c)}`;
}

function parseSheetXml(xml, sharedStrings) {
  const doc = parseXml(xml);
  const sheetData = doc.getElementsByTagName("sheetData")[0];
  const rows = [];
  let maxCol = 0;
  let maxRow = 0;

  if (!sheetData) {
    return { rows: [], ref: "A1:A1" };
  }

  const rowNodes = sheetData.getElementsByTagName("row");
  for (const rowNode of rowNodes) {
    const rowIndexAttr = rowNode.getAttribute("r");
    const rowIndex = rowIndexAttr ? parseInt(rowIndexAttr, 10) - 1 : rows.length;
    if (!rows[rowIndex]) rows[rowIndex] = [];
    const cellNodes = rowNode.getElementsByTagName("c");

    for (const cell of cellNodes) {
      const ref = cell.getAttribute("r") || "";
      const colIndex = columnIndexFromRef(ref);
      const type = cell.getAttribute("t") || "";
      let value = null;

      const vNode = cell.getElementsByTagName("v")[0];
      const isNode = cell.getElementsByTagName("is")[0];

      if (type === "s" && vNode) {
        const idx = parseInt(vNode.textContent || "0", 10);
        value = sharedStrings[idx] ?? "";
      } else if (type === "b" && vNode) {
        value = vNode.textContent === "1";
      } else if (type === "str" && vNode) {
        value = vNode.textContent || "";
      } else if (type === "inlineStr" && isNode) {
        value = isNode.textContent || "";
      } else if (vNode) {
        const numeric = Number(vNode.textContent);
        value = Number.isFinite(numeric) ? numeric : vNode.textContent || "";
      } else {
        value = "";
      }

      const row = rows[rowIndex];
      if (colIndex >= row.length) {
        row.length = colIndex + 1;
      }
      row[colIndex] = value;
      if (colIndex > maxCol) maxCol = colIndex;
    }

    if (rowIndex > maxRow) maxRow = rowIndex;
  }

  for (let r = 0; r < rows.length; r++) {
    if (!rows[r]) continue;
    for (let c = 0; c < rows[r].length; c++) {
      if (rows[r][c] === undefined) rows[r][c] = "";
    }
  }

  const ref = encodeRange({
    s: { r: 0, c: 0 },
    e: { r: Math.max(maxRow, 0), c: Math.max(maxCol, 0) }
  });

  return { rows, ref };
}

function trimEmptyRows(rows) {
  const trimmed = [];
  for (const row of rows) {
    if (!row) continue;
    const hasValue = row.some((cell) => cell !== undefined && cell !== "" && cell !== null);
    if (hasValue) {
      trimmed.push(row);
    } else {
      trimmed.push(row.map(() => ""));
    }
  }
  return trimmed;
}

function sheetToJson(sheet, options = {}) {
  const { header = "A" } = options;
  const rows = sheet.__rows || [];
  if (!rows.length) return [];

  if (header === 1) {
    return rows.map((row) => row.slice());
  }

  const headers = rows[0].map((value, index) => {
    if (value === undefined || value === null || value === "") {
      return encodeColumn(index);
    }
    return String(value);
  });

  const data = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const record = {};
    let hasValue = false;
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      const value = row[j];
      if (value !== undefined && value !== null && value !== "") {
        record[key] = value;
        hasValue = true;
      }
    }
    if (hasValue) {
      data.push(record);
    }
  }

  return data;
}

export async function read(data, options = {}) {
  const files = unzip(toUint8Array(data));
  const workbookXml = files["xl/workbook.xml"];
  if (!workbookXml) {
    throw new Error("Workbook is missing xl/workbook.xml");
  }

  const workbookDoc = parseXml(strFromU8(workbookXml));
  const sheets = workbookDoc.getElementsByTagName("sheet");
  const relsXml = files["xl/_rels/workbook.xml.rels"];
  const relationships = {};

  if (relsXml) {
    const relsDoc = parseXml(strFromU8(relsXml));
    const relNodes = relsDoc.getElementsByTagName("Relationship");
    for (const rel of relNodes) {
      relationships[rel.getAttribute("Id")] = rel.getAttribute("Target");
    }
  }

  const sharedStringsXml = files["xl/sharedStrings.xml"]
    ? strFromU8(files["xl/sharedStrings.xml"])
    : null;
  const sharedStrings = parseSharedStrings(sharedStringsXml);

  const workbook = {
    SheetNames: [],
    Sheets: {}
  };

  for (const sheet of sheets) {
    const name = sheet.getAttribute("name");
    const rId = sheet.getAttribute("r:id");
    const sheetPath = relationships[rId] || `worksheets/sheet${workbook.SheetNames.length + 1}.xml`;
    const fullPath = resolvePath("xl/workbook.xml", sheetPath);
    const sheetFile = files[fullPath];
    if (!sheetFile) {
      continue;
    }

    const parsed = parseSheetXml(strFromU8(sheetFile), sharedStrings);
    const normalizedRows = trimEmptyRows(parsed.rows);
    workbook.SheetNames.push(name);
    workbook.Sheets[name] = {
      "!ref": parsed.ref,
      __rows: normalizedRows
    };
  }

  if (!workbook.SheetNames.length) {
    throw new Error("Workbook does not contain any worksheets.");
  }

  return workbook;
}

export const utils = {
  sheet_to_json: sheetToJson
};

export default {
  read,
  utils
};
