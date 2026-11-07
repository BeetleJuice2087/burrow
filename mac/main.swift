// Burrow for Mac: a small native window around the same game the browser runs.
// The game's localStorage calls land in real files in ~/Library/Application Support/Burrow, so there is no 5 MB limit
// and browser clean-ups can't touch a world. Built by mac/build.sh with the Command Line Tools; Xcode isn't needed.
// BURROW_DATA picks another data folder and BURROW_TEST runs a script once the game is up, then quits.
import Cocoa
import WebKit

let env = ProcessInfo.processInfo.environment
let dataDir: URL = {
  let url = env["BURROW_DATA"].map { URL(fileURLWithPath: $0) } ?? FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("Burrow")
  try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
  return url
}()
let writes = DispatchQueue(label: "burrow.writes") // one at a time, in the order the game asked
let keyChars = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "._-"))
func fileFor(_ key: String) -> URL { dataDir.appendingPathComponent((key.addingPercentEncoding(withAllowedCharacters: keyChars) ?? key) + ".json") }

func storedItems() -> [String: String] {
  var out: [String: String] = [:]
  for f in (try? FileManager.default.contentsOfDirectory(at: dataDir, includingPropertiesForKeys: nil)) ?? [] where f.pathExtension == "json" {
    if let key = f.deletingPathExtension().lastPathComponent.removingPercentEncoding, let text = try? String(contentsOf: f, encoding: .utf8) { out[key] = text }
  }
  return out
}
// runs before the page: the game finds these files where it expects localStorage to be
func storageShim() -> String {
  let json = (try? JSONSerialization.data(withJSONObject: storedItems())).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
  return """
  (() => {
    const items = new Map(Object.entries(\(json)));
    const post = window.webkit.messageHandlers.store;
    const store = {
      getItem: k => items.has(String(k)) ? items.get(String(k)) : null,
      setItem(k, v) { items.set(String(k), String(v)); post.postMessage({op: 'set', key: String(k), value: String(v)}); },
      removeItem(k) { items.delete(String(k)); post.postMessage({op: 'remove', key: String(k)}); },
      clear() { for (const k of [...items.keys()]) store.removeItem(k); },
      key: i => [...items.keys()][i] ?? null,
      get length() { return items.size; }
    };
    Object.defineProperty(window, 'localStorage', {value: store, configurable: true});
    window.BurrowApp = {version: 1};
    const log = t => window.webkit.messageHandlers.log.postMessage(String(t));
    window.addEventListener('error', e => log(e.message + ' at ' + e.filename + ':' + e.lineno));
    window.addEventListener('unhandledrejection', e => log('rejected: ' + e.reason));
  })();
  """
}

final class Bridge: NSObject, WKScriptMessageHandler {
  func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
    if message.name == "log" {
      let line = "\(Date()) \(message.body)\n"
      writes.async {
        let url = dataDir.appendingPathComponent("errors.log")
        if let h = try? FileHandle(forWritingTo: url) { h.seekToEndOfFile(); h.write(Data(line.utf8)); h.closeFile() } else { try? line.write(to: url, atomically: true, encoding: .utf8) }
      }
      return
    }
    guard let b = message.body as? [String: Any], let op = b["op"] as? String, let key = b["key"] as? String else { return }
    let value = b["value"] as? String
    writes.async {
      if op == "set", let value { try? value.write(to: fileFor(key), atomically: true, encoding: .utf8) }
      else if op == "remove" { try? FileManager.default.removeItem(at: fileFor(key)) }
    }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
  var window: NSWindow!
  var web: WKWebView!
  let bridge = Bridge()

  func applicationDidFinishLaunching(_ note: Notification) {
    let conf = WKWebViewConfiguration()
    conf.userContentController.add(bridge, name: "store")
    conf.userContentController.add(bridge, name: "log")
    conf.userContentController.addUserScript(WKUserScript(source: storageShim(), injectionTime: .atDocumentStart, forMainFrameOnly: true))
    conf.preferences.isElementFullscreenEnabled = true
    conf.mediaTypesRequiringUserActionForPlayback = []
    web = WKWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 800), configuration: conf)
    web.navigationDelegate = self
    web.uiDelegate = self
    web.allowsBackForwardNavigationGestures = false
    web.allowsMagnification = false
    web.underPageBackgroundColor = NSColor(calibratedRed: 0.05, green: 0.05, blue: 0.08, alpha: 1)

    window = NSWindow(contentRect: web.frame, styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
    window.title = "Burrow"
    window.titlebarAppearsTransparent = true
    window.titleVisibility = .hidden
    window.appearance = NSAppearance(named: .darkAqua)
    window.backgroundColor = web.underPageBackgroundColor
    window.minSize = NSSize(width: 800, height: 560)
    window.contentView = web
    window.center()
    window.setFrameAutosaveName("Burrow")
    window.collectionBehavior = [.fullScreenPrimary]
    window.makeKeyAndOrderFront(nil)
    NSApp.activate(ignoringOtherApps: true)

    let res = Bundle.main.resourceURL!.appendingPathComponent("game")
    web.loadFileURL(res.appendingPathComponent("index.html"), allowingReadAccessTo: res)
  }

  func applicationShouldTerminateAfterLastWindowClosed(_ s: NSApplication) -> Bool { true }

  // one last save, and let the writes finish, before the app goes
  func applicationShouldTerminate(_ s: NSApplication) -> NSApplication.TerminateReply {
    var done = false
    let finish = {
      if done { return }
      done = true
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { writes.sync {}; NSApp.reply(toApplicationShouldTerminate: true) }
    }
    web.evaluateJavaScript("saveGame(); 1") { _, _ in finish() }
    DispatchQueue.main.asyncAfter(deadline: .now() + 2) { finish() }
    return .terminateLater
  }

  func webView(_ w: WKWebView, didFinish nav: WKNavigation!) {
    guard let path = env["BURROW_TEST"], let script = try? String(contentsOfFile: path, encoding: .utf8) else { return }
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
      w.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { r in
        var text = ""
        switch r { case .success(let v): text = "\(v)"; case .failure(let e): text = "FAILED \(e)" }
        try? text.write(to: dataDir.appendingPathComponent("test-result.txt"), atomically: true, encoding: .utf8)
        w.takeSnapshot(with: nil) { img, _ in
          if let img, let tiff = img.tiffRepresentation, let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) { try? png.write(to: dataDir.appendingPathComponent("test-shot.png")) }
          NSApp.terminate(nil)
        }
      }
    }
  }

  // a world downloaded from the Saves page goes to the Downloads folder, as it does in a browser
  func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) { decisionHandler(a.shouldPerformDownload ? .download : .allow) }
  func webView(_ w: WKWebView, navigationAction a: WKNavigationAction, didBecome d: WKDownload) { d.delegate = self }
  func webView(_ w: WKWebView, navigationResponse r: WKNavigationResponse, didBecome d: WKDownload) { d.delegate = self }
  func webView(_ w: WKWebView, decidePolicyFor r: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) { decisionHandler(r.canShowMIMEType ? .allow : .download) }
  func download(_ d: WKDownload, decideDestinationUsing r: URLResponse, suggestedFilename name: String, completionHandler: @escaping (URL?) -> Void) {
    let dir = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
    let base = (name as NSString).deletingPathExtension, ext = (name as NSString).pathExtension
    var url = dir.appendingPathComponent(name), n = 1
    while FileManager.default.fileExists(atPath: url.path) { n += 1; url = dir.appendingPathComponent("\(base)-\(n).\(ext)") }
    completionHandler(url)
  }
  // "Load a file" on the Saves page
  func webView(_ w: WKWebView, runOpenPanelWith p: WKOpenPanelParameters, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
    let panel = NSOpenPanel()
    panel.allowsMultipleSelection = false
    panel.canChooseDirectories = false
    panel.directoryURL = FileManager.default.urls(for: .downloadsDirectory, in: .userDomainMask)[0]
    panel.beginSheetModal(for: window) { completionHandler($0 == .OK ? panel.urls : nil) }
  }
}

func buildMenu() -> NSMenu {
  let bar = NSMenu()
  func menu(_ title: String, _ items: [(String, Selector?, String)]) {
    let m = NSMenu(title: title), top = NSMenuItem()
    for (t, sel, key) in items {
      if t == "-" { m.addItem(.separator()) } else { m.addItem(withTitle: t, action: sel, keyEquivalent: key) }
    }
    top.submenu = m; bar.addItem(top)
  }
  menu("Burrow", [("About Burrow", #selector(NSApplication.orderFrontStandardAboutPanel(_:)), ""), ("-", nil, ""), ("Hide Burrow", #selector(NSApplication.hide(_:)), "h"), ("-", nil, ""), ("Quit Burrow", #selector(NSApplication.terminate(_:)), "q")])
  menu("Edit", [("Cut", #selector(NSText.cut(_:)), "x"), ("Copy", #selector(NSText.copy(_:)), "c"), ("Paste", #selector(NSText.paste(_:)), "v"), ("Select All", #selector(NSText.selectAll(_:)), "a")])
  menu("Window", [("Minimize", #selector(NSWindow.miniaturize(_:)), "m"), ("Toggle Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f"), ("Close", #selector(NSWindow.performClose(_:)), "w")])
  return bar
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.mainMenu = buildMenu()
app.run()
