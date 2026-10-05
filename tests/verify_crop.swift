import Foundation
import CoreGraphics
import ImageIO

for file in CommandLine.arguments.dropFirst() {
    let url = URL(fileURLWithPath: file)
    let source = CGImageSourceCreateWithURL(url as CFURL, nil)!
    let image = CGImageSourceCreateImageAtIndex(source, 0, nil)!
    var pixels = [UInt8](repeating: 0, count: 9 * 4)
    pixels.withUnsafeMutableBytes { buffer in
        let context = CGContext(data: buffer.baseAddress, width: 9, height: 1,
                                bitsPerComponent: 8, bytesPerRow: 9 * 4,
                                space: CGColorSpace(name: CGColorSpace.sRGB)!,
                                bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
        context.interpolationQuality = .none
        context.draw(image, in: CGRect(x: 0, y: 0, width: 9, height: 1))
    }
    let square = image.width == 3000
    if square {
        for offset in stride(from: 0, to: pixels.count, by: 4) {
            precondition(pixels[offset] < 100 && pixels[offset + 1] > 100 && pixels[offset + 2] < 100, "Square crop kept an outer color band")
        }
    } else {
        precondition(pixels[0] > 150 && pixels[1] < 100, "Landscape lost the left red edge")
        precondition(pixels[34] > 150 && pixels[32] < 100, "Landscape lost the right blue edge")
    }
    let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)! as NSDictionary
    let exif = properties[kCGImagePropertyExifDictionary] as! NSDictionary
    precondition(exif[kCGImagePropertyExifPixelXDimension] as? Int == image.width)
    precondition(exif[kCGImagePropertyExifPixelYDimension] as? Int == image.height)
    print("PASS: \(url.lastPathComponent) crop pixels and EXIF dimensions")
}
