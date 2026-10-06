import AppKit
import WebKit

class HISTIAppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    private var destinations: [ObjectIdentifier: (temporary: URL, final: URL)] = [:]

    func applicationDidFinishLaunching(_ notification: Notification) {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .nonPersistent()
        configuration.userContentController.addUserScript(WKUserScript(
            source: "window.HISTI_NATIVE_APP = true;",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = false

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1240, height: 880),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Honey, I Shrunk the Images"
        window.minSize = NSSize(width: 780, height: 600)
        window.contentView = webView
        window.center()
        installMenu()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        guard let site = Bundle.main.resourceURL?.appendingPathComponent("site"),
              FileManager.default.fileExists(atPath: site.appendingPathComponent("index.html").path) else {
            showError("The bundled HISTI page could not be found.")
            return
        }
        webView.loadFileURL(site.appendingPathComponent("index.html"), allowingReadAccessTo: site)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func installMenu() {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu(title: "HISTI")
        appMenu.addItem(withTitle: "About HISTI", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide HISTI", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit HISTI", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)

        let fileItem = NSMenuItem()
        let fileMenu = NSMenu(title: "File")
        let select = fileMenu.addItem(withTitle: "Select Images...", action: #selector(selectImages), keyEquivalent: "o")
        select.target = self
        fileMenu.addItem(withTitle: "Close Window", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        fileItem.submenu = fileMenu
        menu.addItem(fileItem)

        let editItem = NSMenuItem()
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        menu.addItem(editItem)
        NSApp.mainMenu = menu
    }

    @objc func selectImages() {
        webView.evaluateJavaScript("document.getElementById('pick-button').click()", completionHandler: nil)
    }

    func chooseSourceFiles(multiple: Bool, completion: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.title = "Select Images"
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = multiple
        panel.beginSheetModal(for: window) { result in
            completion(result == .OK ? panel.urls : nil)
        }
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        chooseSourceFiles(multiple: parameters.allowsMultipleSelection, completion: completionHandler)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if action.shouldPerformDownload {
            decisionHandler(.download)
        } else if let url = action.request.url, ["https", "http"].contains(url.scheme ?? "") {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
        } else {
            decisionHandler(.allow)
        }
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func chooseDownloadDestination(suggestedFilename: String, completion: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.title = "Save HISTI Output"
        panel.nameFieldStringValue = (suggestedFilename as NSString).lastPathComponent
        panel.canCreateDirectories = true
        panel.beginSheetModal(for: window) { result in
            completion(result == .OK ? panel.url : nil)
        }
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        chooseDownloadDestination(suggestedFilename: suggestedFilename) { destination in
            guard let destination = destination else {
                completionHandler(nil)
                return
            }
            // Finish the download before replacing an existing user-selected file.
            let temporary = destination.deletingLastPathComponent().appendingPathComponent(".histi-\(UUID().uuidString).download")
            self.destinations[ObjectIdentifier(download)] = (temporary, destination)
            completionHandler(temporary)
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        guard let destination = destinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
        do {
            if FileManager.default.fileExists(atPath: destination.final.path) {
                _ = try FileManager.default.replaceItemAt(destination.final, withItemAt: destination.temporary)
            } else {
                try FileManager.default.moveItem(at: destination.temporary, to: destination.final)
            }
            didSaveOutput(at: destination.final)
        } catch {
            try? FileManager.default.removeItem(at: destination.temporary)
            showError("Could not save output: \(error.localizedDescription)")
        }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let destination = destinations.removeValue(forKey: ObjectIdentifier(download)) {
            try? FileManager.default.removeItem(at: destination.temporary)
            showError("Download failed: \(error.localizedDescription)")
        }
    }

    func didSaveOutput(at url: URL) {}

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        showError("The image workspace closed unexpectedly. Reopen HISTI and select the batch again.")
    }

    func showError(_ message: String) {
        let alert = NSAlert()
        alert.messageText = "HISTI"
        alert.informativeText = message
        alert.alertStyle = .warning
        alert.beginSheetModal(for: window, completionHandler: nil)
    }
}
