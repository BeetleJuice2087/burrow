// Draws Burrow's app icon: a lantern-lit tunnel with a gem pickaxe, as pixel art. Writes one 1024px PNG to the path given. Add `full` for the edge-to-edge version phones crop to their own shape.
import Cocoa
let art = [
  "................",
  "................",
  "..........PP....",
  ".......PPPPgg...",
  "......PP..Hgg...",
  ".........H.PP...",
  "........H...P...",
  ".......H....P...",
  "......H.........",
  ".....H..........",
  "....H...........",
  "...H............",
  "ssddssddssddssdd",
  "ddddddddddrddddd",
  "dddrdddddddddddd",
  "rrrrrrrrrrrrrrrr",
]
let colors: [Character: (CGFloat, CGFloat, CGFloat)] = ["P": (0.72, 0.76, 0.82), "g": (0.35, 0.86, 0.80), "H": (0.70, 0.46, 0.22), "s": (0.42, 0.66, 0.30), "d": (0.45, 0.30, 0.20), "r": (0.31, 0.31, 0.36)]
let size = 1024, inset = 100, cell = (size - inset * 2) / 16
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
let full = CommandLine.arguments.count > 2
let tile = full ? CGRect(x: 0, y: 0, width: size, height: size) : CGRect(x: inset, y: inset, width: cell * 16, height: cell * 16)
if !full { ctx.addPath(CGPath(roundedRect: tile, cornerWidth: 180, cornerHeight: 180, transform: nil)); ctx.clip() }
let glow = CGGradient(colorsSpace: CGColorSpace(name: CGColorSpace.sRGB), colors: [CGColor(red: 0.95, green: 0.70, blue: 0.30, alpha: 1), CGColor(red: 0.13, green: 0.11, blue: 0.20, alpha: 1)] as CFArray, locations: [0, 1])!
ctx.setFillColor(CGColor(red: 0.13, green: 0.11, blue: 0.20, alpha: 1)); ctx.fill(tile)
ctx.drawRadialGradient(glow, startCenter: CGPoint(x: 512, y: 560), startRadius: 0, endCenter: CGPoint(x: 512, y: 560), endRadius: 460, options: [])
for (row, line) in art.enumerated() {
  for (col, ch) in line.enumerated() {
    guard let c = colors[ch] else { continue }
    ctx.setFillColor(CGColor(red: c.0, green: c.1, blue: c.2, alpha: 1))
    ctx.fill(CGRect(x: inset + col * cell, y: size - inset - (row + 1) * cell, width: cell, height: cell))
  }
}
let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
