(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.HISTI_ZIP = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const encoder = typeof TextEncoder !== "undefined" ? new TextEncoder() : null;
  const crcTable = makeCrcTable();

  function makeCrcTable() {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let c = i;
      for (let k = 0; k < 8; k += 1) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      table[i] = c >>> 0;
    }
    return table;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function encodeText(value) {
    if (encoder) {
      return encoder.encode(value);
    }

    const encoded = unescape(encodeURIComponent(value));
    const bytes = new Uint8Array(encoded.length);
    for (let i = 0; i < encoded.length; i += 1) {
      bytes[i] = encoded.charCodeAt(i);
    }
    return bytes;
  }

  function dateParts(date) {
    const year = Math.max(1980, date.getFullYear());
    const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
    const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
    return { dosTime, dosDate };
  }

  function setBytes(target, offset, source) {
    target.set(source, offset);
  }

  function makeHeader(length) {
    const bytes = new Uint8Array(length);
    return { bytes, view: new DataView(bytes.buffer) };
  }

  async function toBytes(file) {
    const data = file.data || file.blob;
    if (data instanceof Uint8Array) {
      return data;
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    if (data && typeof data.arrayBuffer === "function") {
      return new Uint8Array(await data.arrayBuffer());
    }
    throw new Error(`Cannot ZIP ${file.name}.`);
  }

  async function createZipBlob(files) {
    const localParts = [];
    const centralParts = [];
    const now = dateParts(new Date());
    let offset = 0;

    for (const file of files) {
      const nameBytes = encodeText(file.name);
      const dataBytes = await toBytes(file);
      const crc = crc32(dataBytes);

      if (dataBytes.length > 0xffffffff || offset > 0xffffffff) {
        throw new Error("ZIP output is too large.");
      }

      const local = makeHeader(30 + nameBytes.length);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x0800, true);
      local.view.setUint16(8, 0, true);
      local.view.setUint16(10, now.dosTime, true);
      local.view.setUint16(12, now.dosDate, true);
      local.view.setUint32(14, crc, true);
      local.view.setUint32(18, dataBytes.length, true);
      local.view.setUint32(22, dataBytes.length, true);
      local.view.setUint16(26, nameBytes.length, true);
      local.view.setUint16(28, 0, true);
      setBytes(local.bytes, 30, nameBytes);

      const central = makeHeader(46 + nameBytes.length);
      central.view.setUint32(0, 0x02014b50, true);
      central.view.setUint16(4, 20, true);
      central.view.setUint16(6, 20, true);
      central.view.setUint16(8, 0x0800, true);
      central.view.setUint16(10, 0, true);
      central.view.setUint16(12, now.dosTime, true);
      central.view.setUint16(14, now.dosDate, true);
      central.view.setUint32(16, crc, true);
      central.view.setUint32(20, dataBytes.length, true);
      central.view.setUint32(24, dataBytes.length, true);
      central.view.setUint16(28, nameBytes.length, true);
      central.view.setUint16(30, 0, true);
      central.view.setUint16(32, 0, true);
      central.view.setUint16(34, 0, true);
      central.view.setUint16(36, 0, true);
      central.view.setUint32(38, 0, true);
      central.view.setUint32(42, offset, true);
      setBytes(central.bytes, 46, nameBytes);

      localParts.push(local.bytes, dataBytes);
      centralParts.push(central.bytes);
      offset += local.bytes.length + dataBytes.length;
    }

    const centralOffset = offset;
    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = makeHeader(22);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(4, 0, true);
    end.view.setUint16(6, 0, true);
    end.view.setUint16(8, files.length, true);
    end.view.setUint16(10, files.length, true);
    end.view.setUint32(12, centralSize, true);
    end.view.setUint32(16, centralOffset, true);
    end.view.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, end.bytes], { type: "application/zip" });
  }

  return {
    createZipBlob,
    crc32,
  };
});
