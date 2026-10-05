import AppKit
import WebKit

class BatchSmokeDelegate: HISTIAppDelegate {
    let fixtures: URL
    let outputDirectory: URL
    private var started = Date()
    private var stage = "loading"
    private var timer: Timer?
    private var lastProgress = ""

    init(fixtures: URL, output: URL) {
        self.fixtures = fixtures
        self.outputDirectory = output
        super.init()
    }

    override func applicationDidFinishLaunching(_ notification: Notification) {
        super.applicationDidFinishLaunching(notification)
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in self.poll() }
    }

    override func chooseSourceFiles(multiple: Bool, completion: @escaping ([URL]?) -> Void) {
        do {
            let files = try FileManager.default.contentsOfDirectory(at: fixtures, includingPropertiesForKeys: nil)
                .filter { ["jpg", "png"].contains($0.pathExtension) }.sorted { $0.lastPathComponent < $1.lastPathComponent }
            guard multiple && files.count == 101 else { fail("Expected multiple selection with 101 fixtures") }
            completion(files)
        } catch { fail(error.localizedDescription) }
    }

    override func chooseDownloadDestination(suggestedFilename: String, completion: @escaping (URL?) -> Void) {
        print("Saving \(suggestedFilename)")
        completion(outputDirectory.appendingPathComponent(suggestedFilename))
    }

    override func didSaveOutput(at url: URL) {
        if url.pathExtension == "jpg" && stage == "individual" {
            stage = "zip"
            webView.evaluateJavaScript("document.getElementById('download-all-button').click()", completionHandler: nil)
        } else if url.pathExtension == "zip" && stage == "zip" {
            print("PASS: native picker processed 100 JPGs into 200 outputs, skipped PNG, saved JPG and ZIP (\(Int(Date().timeIntervalSince(started)))s)")
            timer?.invalidate()
            NSApp.terminate(nil)
        }
    }

    func poll() {
        if Date().timeIntervalSince(started) > 600 { fail("Timed out in stage \(stage)") }
        webView.evaluateJavaScript("({version: window.HISTI_CORE?.APP_VERSION, count: document.getElementById('results-body')?.rows.length, ready: document.getElementById('ready-count')?.textContent, skipped: document.getElementById('error-count')?.textContent, busy: document.getElementById('process-button')?.textContent, status: document.getElementById('status-line')?.textContent})") { value, error in
            if let error = error {
                if self.stage != "loading" { self.fail(error.localizedDescription) }
                return
            }
            guard let status = value as? [String: Any] else { return }
            if self.stage == "loading", status["version"] as? String == "V1.5" {
                self.stage = "selection"
                self.selectImages()
            } else if self.stage == "selection", status["count"] as? Int == 201 {
                guard status["skipped"] as? String == "1" else { self.fail("PNG not immediately skipped") }
                self.stage = "processing"
                self.webView.evaluateJavaScript("document.getElementById('process-button').click()", completionHandler: nil)
            } else if self.stage == "processing", status["busy"] as? String == "Process" {
                guard status["ready"] as? String == "200", status["skipped"] as? String == "1" else {
                    self.fail("Wrong batch result: \(status)")
                }
                self.stage = "individual"
                self.webView.evaluateJavaScript("document.querySelector('#results-body button').click()", completionHandler: nil)
            }
            let progress = status["status"] as? String ?? ""
            if progress != self.lastProgress { print(progress); self.lastProgress = progress }
        }
    }

    override func showError(_ message: String) { fail(message) }

    func fail(_ message: String) -> Never {
        fputs("FAIL: \(message)\n", stderr)
        exit(1)
    }
}

@main struct BatchSmoke {
    static func main() throws {
        setbuf(stdout, nil)
        guard CommandLine.arguments.count == 3 else { fatalError("Expected fixture and output paths") }
        let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        // Also exercise replacement of an existing file through the normal save path.
        try Data("previous output".utf8).write(to: output.appendingPathComponent("ActionBible_051_16x9_1920x1080.jpg"))
        let delegate = BatchSmokeDelegate(fixtures: URL(fileURLWithPath: CommandLine.arguments[1]), output: output)
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        app.run()
    }
}
