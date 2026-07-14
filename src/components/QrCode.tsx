import { useMemo } from "react";

type QrCodeProps = {
  className?: string;
  value: string;
};

type QrVersionConfig = {
  dataCodewords: number;
  eccCodewords: number;
  size: number;
  version: number;
};

const VERSION_CONFIGS: QrVersionConfig[] = [
  { version: 1, size: 21, dataCodewords: 19, eccCodewords: 7 },
  { version: 2, size: 25, dataCodewords: 34, eccCodewords: 10 },
  { version: 3, size: 29, dataCodewords: 55, eccCodewords: 15 },
  { version: 4, size: 33, dataCodewords: 80, eccCodewords: 20 },
  { version: 5, size: 37, dataCodewords: 108, eccCodewords: 26 },
];

const GF_EXP = (() => {
  const values = new Array<number>(512);
  let value = 1;

  for (let index = 0; index < 255; index += 1) {
    values[index] = value;
    value <<= 1;

    if (value & 0x100) {
      value ^= 0x11d;
    }
  }

  for (let index = 255; index < values.length; index += 1) {
    values[index] = values[index - 255];
  }

  return values;
})();

const GF_LOG = (() => {
  const values = new Array<number>(256).fill(0);

  for (let index = 0; index < 255; index += 1) {
    values[GF_EXP[index]] = index;
  }

  return values;
})();

function gfMultiply(left: number, right: number) {
  if (!left || !right) {
    return 0;
  }

  return GF_EXP[GF_LOG[left] + GF_LOG[right]];
}

function reedSolomonGenerator(degree: number) {
  let generator = [1];

  for (let factor = 0; factor < degree; factor += 1) {
    const next = new Array<number>(generator.length + 1).fill(0);

    for (let index = 0; index < generator.length; index += 1) {
      next[index] ^= generator[index];
      next[index + 1] ^= gfMultiply(generator[index], GF_EXP[factor]);
    }

    generator = next;
  }

  return generator;
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree);
  const remainder = new Array<number>(degree).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder.shift()!;
    remainder.push(0);

    for (let index = 0; index < degree; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }

  return remainder;
}

function appendBits(bits: number[], value: number, length: number) {
  for (let index = length - 1; index >= 0; index -= 1) {
    bits.push((value >>> index) & 1);
  }
}

function selectVersion(bytes: Uint8Array) {
  const requiredBits = 4 + 8 + bytes.length * 8;

  return VERSION_CONFIGS.find(
    (config) => requiredBits <= config.dataCodewords * 8,
  );
}

function makeDataCodewords(bytes: Uint8Array, config: QrVersionConfig) {
  const bits: number[] = [];
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);

  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }

  const capacityBits = config.dataCodewords * 8;
  const terminatorBits = Math.min(4, capacityBits - bits.length);
  appendBits(bits, 0, terminatorBits);

  while (bits.length % 8) {
    bits.push(0);
  }

  const codewords: number[] = [];

  for (let index = 0; index < bits.length; index += 8) {
    let codeword = 0;

    for (let offset = 0; offset < 8; offset += 1) {
      codeword = (codeword << 1) | bits[index + offset];
    }

    codewords.push(codeword);
  }

  for (let padIndex = 0; codewords.length < config.dataCodewords; padIndex += 1) {
    codewords.push(padIndex % 2 ? 0x11 : 0xec);
  }

  return codewords;
}

function makeMatrix(config: QrVersionConfig) {
  const modules = Array.from({ length: config.size }, () =>
    new Array<boolean>(config.size).fill(false),
  );
  const reserved = Array.from({ length: config.size }, () =>
    new Array<boolean>(config.size).fill(false),
  );

  function set(row: number, col: number, value: boolean, isReserved = true) {
    if (row < 0 || col < 0 || row >= config.size || col >= config.size) {
      return;
    }

    modules[row][col] = value;
    reserved[row][col] = isReserved;
  }

  function drawFinder(row: number, col: number) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const isSeparator = x === -1 || x === 7 || y === -1 || y === 7;
        const isOuter = x === 0 || x === 6 || y === 0 || y === 6;
        const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        set(row + y, col + x, !isSeparator && (isOuter || isCenter));
      }
    }
  }

  function drawAlignment(centerRow: number, centerCol: number) {
    if (reserved[centerRow][centerCol]) {
      return;
    }

    for (let y = -2; y <= 2; y += 1) {
      for (let x = -2; x <= 2; x += 1) {
        const distance = Math.max(Math.abs(x), Math.abs(y));
        set(centerRow + y, centerCol + x, distance !== 1);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, config.size - 7);
  drawFinder(config.size - 7, 0);

  for (let index = 8; index < config.size - 8; index += 1) {
    const value = index % 2 === 0;
    set(6, index, value);
    set(index, 6, value);
  }

  if (config.version > 1) {
    const positions = [6, config.size - 7];

    for (const row of positions) {
      for (const col of positions) {
        drawAlignment(row, col);
      }
    }
  }

  set(config.version * 4 + 9, 8, true);

  for (let index = 0; index < 9; index += 1) {
    reserved[8][index] = true;
    reserved[index][8] = true;
  }

  for (let index = 0; index < 8; index += 1) {
    reserved[config.size - 1 - index][8] = true;
  }

  for (let index = 0; index < 7; index += 1) {
    reserved[8][config.size - 1 - index] = true;
  }

  return { modules, reserved, set };
}

function formatBits(maskPattern: number) {
  const errorCorrectionLevelBits = 0b01;
  const data = (errorCorrectionLevelBits << 3) | maskPattern;
  let bits = data << 10;

  for (let index = 14; index >= 10; index -= 1) {
    if ((bits >>> index) & 1) {
      bits ^= 0x537 << (index - 10);
    }
  }

  return ((data << 10) | bits) ^ 0x5412;
}

function writeFormatBits(
  modules: boolean[][],
  set: (row: number, col: number, value: boolean) => void,
  maskPattern: number,
) {
  const size = modules.length;
  const bits = formatBits(maskPattern);
  const bit = (index: number) => Boolean((bits >>> index) & 1);

  for (let index = 0; index <= 5; index += 1) {
    set(8, index, bit(index));
  }

  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));

  for (let index = 9; index < 15; index += 1) {
    set(14 - index, 8, bit(index));
  }

  for (let index = 0; index < 8; index += 1) {
    set(size - 1 - index, 8, bit(index));
  }

  for (let index = 8; index < 15; index += 1) {
    set(8, size - 15 + index, bit(index));
  }
}

function encodeQr(value: string) {
  const bytes = new TextEncoder().encode(value);
  const config = selectVersion(bytes);

  if (!config) {
    throw new Error("QR code value is too long.");
  }

  const dataCodewords = makeDataCodewords(bytes, config);
  const eccCodewords = reedSolomonRemainder(dataCodewords, config.eccCodewords);
  const bits: number[] = [];

  for (const codeword of [...dataCodewords, ...eccCodewords]) {
    appendBits(bits, codeword, 8);
  }

  const { modules, reserved, set } = makeMatrix(config);
  let bitIndex = 0;
  let upward = true;

  for (let col = config.size - 1; col >= 1; col -= 2) {
    if (col === 6) {
      col -= 1;
    }

    for (let step = 0; step < config.size; step += 1) {
      const row = upward ? config.size - 1 - step : step;

      for (let offset = 0; offset < 2; offset += 1) {
        const moduleCol = col - offset;

        if (reserved[row][moduleCol]) {
          continue;
        }

        modules[row][moduleCol] = bits[bitIndex] === 1;
        bitIndex += 1;
      }
    }

    upward = !upward;
  }

  for (let row = 0; row < config.size; row += 1) {
    for (let col = 0; col < config.size; col += 1) {
      if (!reserved[row][col] && (row + col) % 2 === 0) {
        modules[row][col] = !modules[row][col];
      }
    }
  }

  writeFormatBits(modules, set, 0);
  return modules;
}

function modulesToPath(modules: boolean[][], quietZone: number) {
  const parts: string[] = [];

  modules.forEach((row, rowIndex) => {
    row.forEach((isDark, colIndex) => {
      if (isDark) {
        parts.push(`M${colIndex + quietZone} ${rowIndex + quietZone}h1v1h-1z`);
      }
    });
  });

  return parts.join("");
}

export function QrCode({ className = "", value }: QrCodeProps) {
  const qrResult = useMemo(() => {
    if (!value) {
      return { error: "", matrix: null };
    }

    try {
      return { error: "", matrix: encodeQr(value) };
    } catch {
      return {
        error: "This student link is too long for the built-in QR code.",
        matrix: null,
      };
    }
  }, [value]);

  if (qrResult.error) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
        {qrResult.error}
      </p>
    );
  }

  if (!qrResult.matrix) {
    return null;
  }

  const quietZone = 4;
  const viewBoxSize = qrResult.matrix.length + quietZone * 2;

  return (
    <svg
      aria-label="QR code"
      className={className}
      role="img"
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="#fff" height={viewBoxSize} width={viewBoxSize} />
      <path d={modulesToPath(qrResult.matrix, quietZone)} fill="#0f172a" />
    </svg>
  );
}
