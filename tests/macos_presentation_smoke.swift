import AppKit
import WebKit

class PresentationSmokeDelegate: HISTIAppDelegate {
    private var timer: Timer?
    private let started = Date()
    private var running = false

    override func applicationDidFinishLaunching(_ notification: Notification) {
        super.applicationDidFinishLaunching(notification)
        timer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in self.poll() }
    }

    private func poll() {
        if Date().timeIntervalSince(started) > 60 { fail("Native presentation test timed out") }
        webView.evaluateJavaScript("({loaded: document.readyState === 'complete' && window.HISTI_CORE?.APP_VERSION === 'V1.7', result: window.HISTI_TEST_RESULT})") { value, error in
            if let error = error { self.fail(error.localizedDescription) }
            guard let status = value as? [String: Any] else { return }
            if let result = status["result"] as? [String: Any] {
                guard result["passed"] as? Bool == true else { self.fail(result["message"] as? String ?? "Test failed") }
                print(result["message"] as? String ?? "PASS")
                self.timer?.invalidate()
                NSApp.terminate(nil)
            } else if status["loaded"] as? Bool == true && !self.running {
                self.running = true
                do {
                    let checks = try String(contentsOfFile: CommandLine.arguments[1], encoding: .utf8)
                    let script = checks + "\nrunHistiPresentationChecks(true).then(message => { window.HISTI_TEST_RESULT = {passed: true, message}; }).catch(error => { window.HISTI_TEST_RESULT = {passed: false, message: error.message}; }); null;"
                    self.webView.evaluateJavaScript(script) { _, error in
                        if let error = error { self.fail(error.localizedDescription) }
                    }
                } catch { self.fail(error.localizedDescription) }
            }
        }
    }

    override func showError(_ message: String) { fail(message) }

    private func fail(_ message: String) -> Never {
        fputs("FAIL: \(message)\n", stderr)
        exit(1)
    }
}

@main struct PresentationSmoke {
    static func main() {
        precondition(CommandLine.arguments.count == 2, "Expected presentation checks file")
        setbuf(stdout, nil)
        let delegate = PresentationSmokeDelegate()
        let app = NSApplication.shared
        app.setActivationPolicy(.regular)
        app.delegate = delegate
        app.run()
    }
}
