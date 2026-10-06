import AppKit
import WebKit

class BatchSmokeDelegate: HISTIAppDelegate {
    let fixtures: URL
    let outputDirectory: URL
    let mode: String
    var expectedOutputs: Int { mode == "both" ? 200 : 100 }
    private var started = Date()
    private var stage = "loading"
    private var timer: Timer?
    private var lastProgress = ""

    init(fixtures: URL, output: URL, mode: String) {
        self.fixtures = fixtures
        self.outputDirectory = output
        self.mode = mode
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
            print("PASS: \(mode): 100 JPGs into \(expectedOutputs) outputs, skipped PNG, saved JPG and ZIP (\(Int(Date().timeIntervalSince(started)))s)")
            timer?.invalidate()
            NSApp.terminate(nil)
        }
    }

    func poll() {
        if Date().timeIntervalSince(started) > 600 { fail("Timed out in stage \(stage)") }
        webView.evaluateJavaScript("({version: window.HISTI_CORE?.APP_VERSION, count: document.getElementById('results-body')?.rows.length, ready: document.getElementById('ready-count')?.textContent, skipped: document.getElementById('error-count')?.textContent, busy: document.getElementById('process-button')?.textContent, status: document.getElementById('status-line')?.textContent, locked: [...document.querySelectorAll('[data-output-target]')].every(input => input.disabled)})") { value, error in
            if let error = error {
                if self.stage != "loading" { self.fail(error.localizedDescription) }
                return
            }
            guard let status = value as? [String: Any] else { return }
            if self.stage == "loading", status["version"] as? String == "V1.6" {
                self.stage = "selection"
                let script = self.mode == "16x9" ? "document.getElementById('output-square').click()"
                    : self.mode == "1x1" ? "document.getElementById('output-landscape').click()" : "true"
                self.webView.evaluateJavaScript(script) { _, error in
                    if let error = error { self.fail(error.localizedDescription) }
                    self.selectImages()
                }
            } else if self.stage == "selection", status["count"] as? Int == self.expectedOutputs + 1 {
                guard status["skipped"] as? String == "1" else { self.fail("PNG not immediately skipped") }
                self.stage = "processing"
                self.webView.evaluateJavaScript("document.getElementById('process-button').click()", completionHandler: nil)
            } else if self.stage == "processing", status["busy"] as? String == "Process" {
                guard status["ready"] as? String == String(self.expectedOutputs), status["skipped"] as? String == "1" else {
                    self.fail("Wrong batch result: \(status)")
                }
                self.stage = "individual"
                self.webView.evaluateJavaScript("document.querySelector('#results-body button').click()", completionHandler: nil)
            }
            if status["busy"] as? String == "Processing...", status["locked"] as? Bool != true {
                self.fail("Output choices were not locked during processing")
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
        guard CommandLine.arguments.count == 4 else { fatalError("Expected fixture path, output path and mode") }
        let mode = CommandLine.arguments[3]
        precondition(["both", "16x9", "1x1"].contains(mode))
        let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
        try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
        // Also exercise replacement of an existing file through the normal save path.
        let firstName = mode == "1x1" ? "ActionBible_051_1x1_3000x3000.jpg" : "ActionBible_051_16x9_1920x1080.jpg"
        try Data("previous output".utf8).write(to: output.appendingPathComponent(firstName))
        let delegate = BatchSmokeDelegate(fixtures: URL(fileURLWithPath: CommandLine.arguments[1]), output: output, mode: mode)
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        app.run()
    }
}
