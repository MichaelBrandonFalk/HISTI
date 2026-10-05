import AppKit

let app = NSApplication.shared
let delegate = HISTIAppDelegate()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
