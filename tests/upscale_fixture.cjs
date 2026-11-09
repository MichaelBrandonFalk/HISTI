function segment(marker, payload) {
  const header = Buffer.alloc(4);
  header[0] = 0xff; header[1] = marker;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

function withMetadata(jpeg, width = 1920, height = 1080) {
  const exif = Buffer.alloc(86);
  exif.write("Exif\0\0", 0, "ascii");
  exif.write("II", 6, "ascii");
  exif.writeUInt16LE(42, 8); exif.writeUInt32LE(8, 10);
  const entry = (offset, tag, value) => {
    exif.writeUInt16LE(tag, offset); exif.writeUInt16LE(4, offset + 2);
    exif.writeUInt32LE(1, offset + 4); exif.writeUInt32LE(value, offset + 8);
  };
  exif.writeUInt16LE(3, 14);
  entry(16, 0x0100, width); entry(28, 0x0101, height); entry(40, 0x8769, 50);
  exif.writeUInt16LE(2, 56);
  entry(58, 0xa002, width); entry(70, 0xa003, height);
  const xmp = Buffer.from(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:tiff="http://ns.adobe.com/tiff/1.0/" xmlns:exif="http://ns.adobe.com/exif/1.0/" tiff:ImageWidth="${width}" tiff:ImageLength="${height}" exif:PixelXDimension="${width}" exif:PixelYDimension="${height}" tiff:Artist="HISTI upscale metadata test"/></rdf:RDF></x:xmpmeta>`);
  return Buffer.concat([jpeg.subarray(0, 2), segment(0xe1, exif), segment(0xe1, xmp),
    segment(0xfe, Buffer.from("Preserve this JPEG comment")), jpeg.subarray(2)]);
}

module.exports = { withMetadata };
