const MAGIC_BYTES: Record<string, { signatures: number[][]; offset: number }> = {
  jpeg: { signatures: [[0xFF, 0xD8, 0xFF]], offset: 0 },
  png: { signatures: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 1, 0x0A]], offset: 0 },
  gif87a: { signatures: [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61]], offset: 0 },
  gif89a: { signatures: [[0x47, 0x49, 0x46, 0x38, 0x39, 0x61]], offset: 0 },
  pdf: { signatures: [[0x25, 0x50, 0x44, 0x46]], offset: 0 },
};

export function validateMagicBytes(buffer: Uint8Array, extension: string): boolean {
  const ext = extension.toLowerCase();
  const info = MAGIC_BYTES[ext];

  if (!info) {
    return false;
  }

  for (const signature of info.signatures) {
    let match = true;
    for (let i = 0; i < signature.length; i++) {
      const pos = info.offset + i;
      if (buffer[pos] !== signature[i]) {
        match = false;
        break;
      }
    }
    if (match) {
      return true;
    }
  }

  return false;
}

export function validateFileExtension(filename: string, allowed: string[]): string | null {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1 || lastDot === 0) {
    return null;
  }

  const ext = filename.slice(lastDot + 1).toLowerCase();

  if (ext.includes(".")) {
    return null;
  }

  if (ext.includes("\0")) {
    return null;
  }

  if (!allowed.includes(ext)) {
    return null;
  }

  return ext;
}
