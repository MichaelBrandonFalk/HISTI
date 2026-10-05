import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

let directory = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
let width = 3840
let height = 2160
var pixels = [UInt8](repeating: 255, count: width * height * 4)
var noise: UInt32 = 1234567
for y in 0..<height {
    for x in 0..<width {
        noise = noise &* 1664525 &+ 1013904223
        let grain = Int((noise >> 24) & 31)
        let offset = (y * width + x) * 4
        let color = x < 600 ? [185, 35, 35] : x > 3240 ? [35, 35, 185] : [35, 150, 35]
        for channel in 0..<3 { pixels[offset + channel] = UInt8(color[channel] + grain) }
    }
}
let provider = CGDataProvider(data: Data(pixels) as CFData)!
let image = CGImage(width: width, height: height, bitsPerComponent: 8, bitsPerPixel: 32,
                    bytesPerRow: width * 4, space: CGColorSpace(name: CGColorSpace.sRGB)!,
                    bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.noneSkipLast.rawValue),
                    provider: provider, decode: nil, shouldInterpolate: false, intent: .defaultIntent)!

func segment(_ marker: UInt8, _ payload: String) -> Data {
    let bytes = Data(payload.utf8)
    let length = bytes.count + 2
    return Data([0xff, marker, UInt8(length >> 8), UInt8(length & 255)]) + bytes
}

for index in 1...100 {
    let name = index <= 50
        ? String(format: "batch_%03d_16x9_3840x2160.jpg", index)
        : String(format: "ActionBible_%03d.jpg", index)
    let encoded = NSMutableData()
    let destination = CGImageDestinationCreateWithData(encoded, UTType.jpeg.identifier as CFString, 1, nil)!
    let properties: [CFString: Any] = [
        kCGImageDestinationLossyCompressionQuality: 0.82,
        kCGImagePropertyTIFFDictionary: [kCGImagePropertyTIFFArtist: "HISTI source \(index)",
                                        kCGImagePropertyTIFFCopyright: "Batch verification",
                                        kCGImagePropertyTIFFOrientation: 1],
        kCGImagePropertyExifDictionary: [kCGImagePropertyExifPixelXDimension: width,
                                        kCGImagePropertyExifPixelYDimension: height,
                                        kCGImagePropertyExifDateTimeOriginal: "2026:10:05 12:00:00"],
        kCGImagePropertyIPTCDictionary: [kCGImagePropertyIPTCKeywords: ["HISTI", "batch100"]]
    ]
    CGImageDestinationAddImage(destination, image, properties as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { fatalError("Could not create JPG") }
    let raw = encoded as Data
    let xmp = "http://ns.adobe.com/xap/1.0/\0<x:xmpmeta xmlns:x=\"adobe:ns:meta/\"><rdf:RDF xmlns:rdf=\"http://www.w3.org/1999/02/22-rdf-syntax-ns#\"><rdf:Description xmlns:tiff=\"http://ns.adobe.com/tiff/1.0/\" xmlns:exif=\"http://ns.adobe.com/exif/1.0/\" tiff:ImageWidth=\"3840\" tiff:ImageLength=\"2160\" exif:PixelXDimension=\"3840\" exif:PixelYDimension=\"2160\" tiff:Artist=\"HISTI source \(index)\"/></rdf:RDF></x:xmpmeta>"
    let output = raw.prefix(2) + segment(0xfe, "HISTI source \(index)") + segment(0xe1, xmp) + raw.dropFirst(2)
    try output.write(to: directory.appendingPathComponent(name))
}
try Data("not a JPG".utf8).write(to: directory.appendingPathComponent("skipped.png"))
print("Created 100 3840x2160 JPGs with EXIF, XMP, IPTC, comments and crop markers")
