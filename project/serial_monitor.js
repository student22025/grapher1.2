// Serial Monitor Tab - Processing Grapher Web
import { setStatusBar, showModal } from './ui.js';

export class SerialMonitor {
  constructor(state) {
    this.state = state;
    this.terminal = null;
    this.input = null;
    this.tags = [
      { text: 'SENT:', color: '#67d8ef' },
      { text: '[info]', color: '#98c379' },
      { text: 'ERROR:', color: '#d02662' },
      { text: 'DEBUG:', color: '#e5c07b' }
    ];
    this.buffer = [];
    this.recording = false;
    this.fileHandle = null;
    this.port = null;
    this.reader = null;
    this.baud = 9600;
    this.connected = false;
    this.autoScroll = true;
    this.dataBuffer = '';
    this.userScrolledUp = false; // Track if user manually scrolled up
    this.init();
  }

  init() {
    const tab = document.getElementById('tab-serial');
    tab.innerHTML = `
      <div id="serial-container">
        <div id="serial-terminal"></div>
        <div id="serial-input-bar">
          <input type="text" id="serial-input" placeholder="Type and press Enter to send" autocomplete="off">
          <button id="serial-send-btn">Send</button>
        </div>
      </div>
    `;
    this.terminal = document.getElementById('serial-terminal');
    this.input = document.getElementById('serial-input');
    document.getElementById('serial-send-btn').onclick = () => this.sendTerminal();
    this.input.addEventListener('keydown', e => {
      if (e.key === 'Enter') this.sendTerminal();
    });
    
    // Add scroll event listener to detect manual scrolling
    this.terminal.addEventListener('scroll', () => {
      const isAtBottom = this.isScrolledToBottom();
      this.userScrolledUp = !isAtBottom;
    });
    
    // Add some sample data to show the format
    this.appendTerminal('103,103,104,100,100,100,101,101,102,101,101,103,89,');
    this.appendTerminal('104,106,109,109,114,118,122,130,136,143,149,141,');
    this.appendTerminal('86,81,79,81,75,71,68,67,66,65,72,81,');
    this.appendTerminal('91,88,86,86,83,80,77,76,72,59,72,73,');
    this.appendTerminal('[info] Serial connection established');
    this.appendTerminal('SENT: start_logging');
  }

  // Helper method to check if scrolled to bottom with better tolerance
  isScrolledToBottom() {
    const tolerance = 5; // Increased tolerance for better reliability
    return (this.terminal.scrollTop + this.terminal.clientHeight >= this.terminal.scrollHeight - tolerance);
  }

  // Helper method to scroll to bottom
  scrollToBottom() {
    // Use setTimeout to ensure DOM has updated
    setTimeout(() => {
      this.terminal.scrollTop = this.terminal.scrollHeight;
    }, 0);
  }

  renderSidebar() {
    const sb = document.getElementById('sidebar');
    const isAdmin = (window.loginInfo && window.loginInfo.role === "admin");
    
    sb.innerHTML = `
      <div class="sidebar-section">
        <h3>Serial Port</h3>
        <button id="serial-connect-btn" class="sidebtn connect-btn">${this.connected ? 'Disconnect' : 'Connect'}</button>
        <label>Port: COM4</label>
        <label>Baud: <input id="serial-baud" type="number" value="${this.baud}" min="300" max="250000"></label>
        <div class="keyboard-hint">Ctrl+Shift+C to connect</div>
      </div>
      
      <div class="sidebar-section">
        <h3>Record Messages</h3>
        <button id="serial-record-btn" class="sidebtn record-btn">${this.recording ? 'Stop Recording' : 'Start Recording'}</button>
        <button id="set-output-file" class="sidebtn">Set Output File</button>
        <div class="keyboard-hint">Ctrl+R to toggle recording</div>
      </div>
      
      <div class="sidebar-section">
        <h3>Terminal Options</h3>
        <button id="serial-clear-btn" class="sidebtn">Clear Terminal</button>
        <label class="scale-option">
          <input type="checkbox" id="auto-scroll" ${this.autoScroll ? 'checked' : ''}>
          Autoscroll: ${this.autoScroll ? 'On' : 'Off'}
        </label>
        <button id="scroll-to-bottom-btn" class="sidebtn">Scroll to Bottom</button>
        <span style="font-size: 0.85em; color: var(--sidebar-heading);">Graph Data: Shown</span>
        <div class="keyboard-hint">Ctrl+L to clear, Ctrl+A to toggle autoscroll, Ctrl+B to scroll to bottom</div>
      </div>
      
      <div class="sidebar-section">
        <h3>Colour Tags</h3>
        <button id="add-tag-btn" class="sidebtn">Add New Tag</button>
        <div id="tag-list"></div>
        <div class="keyboard-hint">Ctrl+T to add tag</div>
      </div>
      
      <div class="sidebar-section">
        <h3>Quick Commands</h3>
        <button id="cmd-start" class="sidebtn quick-cmd">Start Logging</button>
        <button id="cmd-stop" class="sidebtn quick-cmd">Stop Logging</button>
        <button id="cmd-reset" class="sidebtn quick-cmd">Reset Device</button>
        <button id="cmd-status" class="sidebtn quick-cmd">Get Status</button>
      </div>
      
      ${isAdmin ? `
        <div class="sidebar-section">
          <h3>Admin Controls</h3>
          <button class="sidebtn accent" onclick="window.pgLogout()">Logout</button>
        </div>
      ` : `
        <div class="sidebar-section">
          <button class="sidebtn" onclick="window.pgLogout()">Logout</button>
        </div>
      `}
    `;
    
    document.getElementById('serial-connect-btn').onclick = () => this.toggleSerial();
    document.getElementById('serial-baud').onchange = e => { this.baud = Number(e.target.value); };
    document.getElementById('serial-record-btn').onclick = () => this.toggleRecording();
    document.getElementById('set-output-file').onclick = () => this.setOutputFile();
    document.getElementById('serial-clear-btn').onclick = () => this.clearTerminal();
    document.getElementById('add-tag-btn').onclick = () => this.addTag();
    document.getElementById('scroll-to-bottom-btn').onclick = () => {
      this.userScrolledUp = false;
      this.scrollToBottom();
    };
    
    document.getElementById('auto-scroll').onchange = e => {
      this.autoScroll = e.target.checked;
      if (this.autoScroll && !this.userScrolledUp) {
        this.scrollToBottom();
      }
      this.renderSidebar(); // Re-render to update the "On/Off" text
    };
    
    // Quick command handlers
    document.getElementById('cmd-start').onclick = () => this.sendCommand('start_logging');
    document.getElementById('cmd-stop').onclick = () => this.sendCommand('stop_logging');
    document.getElementById('cmd-reset').onclick = () => this.sendCommand('reset');
    document.getElementById('cmd-status').onclick = () => this.sendCommand('status');
    
    this.renderTags();
    setStatusBar(`${this.connected?'Connected':'Disconnected'} | Port: COM4 | ${this.baud} baud | Serial Monitor`);
  }

  sendCommand(command) {
    this.appendTerminal('SENT: ' + command);
    if (this.connected && this.port && this.port.writable) {
      const writer = this.port.writable.getWriter();
      writer.write(new TextEncoder().encode(command+'\n'));
      writer.releaseLock();
    }
  }

  clearTerminal() {
    this.terminal.textContent = '';
    this.buffer = [];
    this.userScrolledUp = false; // Reset scroll state when clearing
  }

  renderTags() {
    let html = '';
    this.tags.forEach((tag, i) => {
      html += `<div class="tag-item">
        <div class="tag-color" style="background-color: ${tag.color}"></div>
        <span class="tag-text">${tag.text}</span>
        <button class="tag-remove" onclick="window.serialRemoveTag(${i})">✕</button>
      </div>`;
    });
    document.getElementById('tag-list').innerHTML = html;
    // Expose for onclick
    window.serialRemoveTag = i => { this.tags.splice(i,1); this.renderTags(); };
  }

  setOutputFile() {
    showModal(`
      <h3>Set Output File</h3>
      <input type="text" id="output-filename" placeholder="serial_log.txt" value="serial_log.txt" style="width: 100%; margin: 1em 0;">
      <div style="text-align: right; margin-top: 1em;">
        <button id="save-output-file" class="sidebtn accent">Set File</button>
        <button class="sidebtn close-modal">Cancel</button>
      </div>
      <script>
      document.getElementById('save-output-file').onclick = () => {
        const filename = document.getElementById('output-filename').value;
        alert('Output file set to: ' + filename);
        document.getElementById('modal').classList.add('hidden');
      };
      </script>
    `);
  }

  addTag() {
    showModal(`
      <h3>Add Colour Tag</h3>
      <input id="tag-txt" type="text" placeholder="Tag text" style="width: 100%; margin: 0.5em 0;" />
      <input id="tag-color" type="color" value="#67d8ef" style="width: 100%; margin: 0.5em 0;" />
      <div style="text-align: right; margin-top: 1em;">
        <button class="sidebtn accent" id="tag-add">Add Tag</button>
        <button class="sidebtn close-modal">Cancel</button>
      </div>
      <script>
      document.getElementById('tag-add').onclick = () => {
        const text = document.getElementById('tag-txt').value;
        const color = document.getElementById('tag-color').value;
        if (text.trim()) {
          window.parentSerialMonitor.tags.push({text: text, color: color});
          window.parentSerialMonitor.renderTags();
        }
        document.getElementById('modal').classList.add('hidden');
      };
      </script>
    `);
    window.parentSerialMonitor = this;
  }

  appendTerminal(line) {
    // Tag coloring
    let colored = line;
    this.tags.forEach(tag => {
      if (colored.includes(tag.text))
        colored = colored.replaceAll(tag.text, `<span style="color:${tag.color}">${tag.text}</span>`);
    });
    
    // Keep buffer short
    this.buffer.push(line);
    if (this.buffer.length > 1000) this.buffer.shift();
    
    // Add the new line to terminal
    this.terminal.innerHTML += colored + '<br>';
    
    // Handle autoscroll logic
    if (this.autoScroll && !this.userScrolledUp) {
      this.scrollToBottom();
    }
    
    // Record to file if recording
    if (this.recording && this.fileHandle) this.fileHandle.write(line+'\n');
  }

  sendTerminal() {
    const val = this.input.value.trim();
    if (val) {
      this.appendTerminal('SENT: ' + val);
      // Send to serial port if connected
      if (this.connected && this.port && this.port.writable) {
        const writer = this.port.writable.getWriter();
        writer.write(new TextEncoder().encode(val+'\n'));
        writer.releaseLock();
      }
      this.input.value = '';
    }
  }

  async toggleSerial() {
    if (!this.connected) {
      // Connect
      if (!('serial' in navigator)) {
        alert('Web Serial API not supported in your browser. Use Chrome or Edge.');
        return;
      }
      try {
        this.port = await navigator.serial.requestPort();
        await this.port.open({ baudRate: this.baud });
        this.connected = true;
        this.reader = this.port.readable.getReader();
        this.appendTerminal('[info] Serial connection established');
        this.readLoop();
      } catch (e) {
        this.appendTerminal('ERROR: Serial connection failed - ' + e.message);
      }
    } else {
      // Disconnect
      if (this.reader) await this.reader.cancel();
      if (this.port) await this.port.close();
      this.connected = false;
      this.port = null;
      this.reader = null;
      this.appendTerminal('[info] Serial connection closed');
    }
    this.renderSidebar();
  }

  async readLoop() {
    try {
      while (this.connected && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        const text = new TextDecoder().decode(value);
        this.dataBuffer += text;
        
        // Process complete lines
        const lines = this.dataBuffer.split('\n');
        this.dataBuffer = lines.pop() || ''; // Keep incomplete line
        
        for (let line of lines) {
          line = line.trim();
          if (line) {
            this.appendTerminal(line);
          }
        }
      }
    } catch (e) {
      this.appendTerminal('ERROR: Serial read error - ' + e.message);
    }
    finally {
      this.connected = false;
      this.renderSidebar();
    }
  }

  toggleRecording() {
    if (this.recording) {
      this.recording = false;
      if (this.fileHandle) this.fileHandle.close();
      this.fileHandle = null;
      this.appendTerminal('[info] Recording stopped');
    } else {
      // Download all buffer as TXT
      const blob = new Blob([this.buffer.join('\n')], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'serial_log.txt';
      a.click();
      URL.revokeObjectURL(a.href);
      this.recording = true;
      this.appendTerminal('[info] Recording started');
    }
    this.renderSidebar();
  }

  // Keyboard shortcuts handler
  handleKeyboard(e) {
    if (e.ctrlKey) {
      switch (e.key) {
        case 'r':
          this.toggleRecording();
          e.preventDefault();
          break;
        case 'l':
          this.clearTerminal();
          e.preventDefault();
          break;
        case 'a':
          this.autoScroll = !this.autoScroll;
          if (this.autoScroll && !this.userScrolledUp) {
            this.scrollToBottom();
          }
          this.renderSidebar(); // Call renderSidebar to update the "On/Off" text
          e.preventDefault();
          break;
        case 't':
          this.addTag();
          e.preventDefault();
          break;
        case 'b':
          this.userScrolledUp = false;
          this.scrollToBottom();
          e.preventDefault();
          break;
      }
      
      if (e.shiftKey && e.key === 'C') {
        this.toggleSerial();
        e.preventDefault();
      }
    }
    
    // Focus input field when typing (if not in an input already)
    if (!e.ctrlKey && !e.altKey && e.key.length === 1 && 
        !document.activeElement.matches('input, textarea')) {
      this.input.focus();
      this.input.value += e.key;
      e.preventDefault();
    }
  }
}