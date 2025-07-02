// Live Graph Tab - Processing Grapher Web
import { setStatusBar, showModal } from './ui.js';

export class LiveGraph {
  constructor(state) {
    this.state = state;
    this.graphType = 'line'; // line, dot, bar
    this.data = [];
    this.channelNames = ['Signal-1', 'Signal-2', 'Signal-3', 'Signal-4', 'Signal-5', 'Signal-6', 'Signal-7', 'Signal-8', 'Signal-9', 'Signal-10', 'Signal-11', 'Signal-12', 'Signal-13'];
    this.channelColors = ['#67d8ef', '#d02662', '#61afef', '#e05c7e', '#98c379', '#e5c07b', '#c678dd', '#56b6c2', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'];
    this.channelVisible = new Array(13).fill(true);
    this.maxSamples = 1000;
    this.recording = false;
    this.paused = false;
    this.baud = 9600;
    this.port = null;
    this.reader = null;
    this.connected = false;
    this.autoScale = true;
    this.yMin = 0;
    this.yMax = 1000;
    this.dataRate = 24.0;
    this.lastDataTime = Date.now();
    this.dataCount = 0;
    this.rawBuffer = '';
    this.expandOnly = true;
    this.splitChannels = [1, 2, 3, 4];
    this.currentValues = new Array(13).fill(0);
    this.smoothingBuffer = [];
    this.smoothingFactor = 0.85;
    this.animationFrame = null;
    this.timeOffset = 0;
    this.pixelRatio = window.devicePixelRatio || 1;
    this.outputFilename = 'graph_data.csv';
    this.recordedData = [];
    this.init();
  }

  init() {
    const tab = document.getElementById('tab-live');
    tab.innerHTML = `
      <div id="live-graph-container">
        <canvas id="live-graph" width="900" height="600"></canvas>
      </div>
    `;
    this.canvas = document.getElementById('live-graph');
    this.ctx = this.canvas.getContext('2d');
    
    // Set up high DPI canvas
    this.setupHighDPICanvas();
    
    this.draw();
    
    // Update data rate every second
    setInterval(() => this.updateDataRate(), 1000);
    
    // Start smooth animation loop
    this.startAnimationLoop();
    
    // Simulate data for demo
    this.simulateData();
  }

  setupHighDPICanvas() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.pixelRatio;
    this.canvas.height = rect.height * this.pixelRatio;
    this.ctx.scale(this.pixelRatio, this.pixelRatio);
    this.canvas.style.width = rect.width + 'px';
    this.canvas.style.height = rect.height + 'px';
  }

  startAnimationLoop() {
    const animate = () => {
      this.draw();
      this.animationFrame = requestAnimationFrame(animate);
    };
    animate();
  }

  simulateData() {
    if (!this.paused && this.connected) {
      // Generate realistic multi-channel data with smooth, varied patterns
      const newData = [];
      const time = Date.now() / 1000;
      
      for (let i = 0; i < 13; i++) {
        let value;
        
        // Create different signal patterns for variety
        switch (i % 4) {
          case 0: // Smooth sine waves with noise
            value = 150 + 80 * Math.sin(time * 0.8 + i * 0.5) + 
                   30 * Math.sin(time * 2.5 + i * 0.3) + 
                   15 * Math.sin(time * 5 + i * 0.7) + 
                   (Math.random() - 0.5) * 8;
            break;
          case 1: // Cosine with harmonics
            value = 120 + 60 * Math.cos(time * 0.6 + i * 0.4) + 
                   25 * Math.cos(time * 1.8 + i * 0.6) + 
                   12 * Math.cos(time * 4 + i * 0.2) + 
                   (Math.random() - 0.5) * 6;
            break;
          case 2: // Triangle-like wave
            value = 100 + 50 * Math.sin(time * 1.2 + i * 0.3) + 
                   20 * Math.sin(time * 3.6 + i * 0.8) + 
                   (Math.random() - 0.5) * 10;
            break;
          case 3: // More complex pattern
            value = 130 + 40 * Math.sin(time * 0.4 + i * 0.2) * Math.cos(time * 1.5 + i * 0.5) + 
                   20 * Math.sin(time * 6 + i * 0.9) + 
                   (Math.random() - 0.5) * 5;
            break;
        }
        
        // Ensure values stay in reasonable range
        value = Math.max(0, Math.min(1000, value));
        
        // Apply smoothing for more realistic data
        if (this.smoothingBuffer[i] === undefined) {
          this.smoothingBuffer[i] = value;
        } else {
          this.smoothingBuffer[i] = this.smoothingBuffer[i] * this.smoothingFactor + 
                                   value * (1 - this.smoothingFactor);
        }
        
        newData.push(this.smoothingBuffer[i]);
        this.currentValues[i] = this.smoothingBuffer[i];
      }
      
      this.data.push(newData);
      this.dataCount++;
      this.timeOffset += 1/this.dataRate;
      
      // Record data if recording is active
      if (this.recording) {
        this.recordedData.push([...newData]);
      }
      
      if (this.data.length > this.maxSamples) {
        this.data.shift();
      }
    }
    
    // Smooth 60fps updates
    setTimeout(() => this.simulateData(), 1000 / 60);
  }

  renderSidebar() {
    const sb = document.getElementById('sidebar');
    const isAdmin = (window.loginInfo && window.loginInfo.role === "admin");
    
    sb.innerHTML = `
      <div class="sidebar-section">
        <h3>Record Graph Data</h3>
        <button id="live-record-btn" class="sidebtn record-btn">${this.recording ? 'Stop Recording' : 'Start Recording'}</button>
        <button id="set-output-file" class="sidebtn">Set Output File</button>
        <div class="output-file-display">File: ${this.outputFilename}</div>
        <div class="keyboard-hint">Ctrl+R to toggle recording</div>
      </div>
      
      <div class="sidebar-section">
        <h3>Graph 1 - Options</h3>
        <div class="graph-options">
          <button id="line-btn" class="option-btn ${this.graphType === 'line' ? 'active' : ''}">Line</button>
          <button id="dot-btn" class="option-btn ${this.graphType === 'dot' ? 'active' : ''}">Dots</button>
          <button id="bar-btn" class="option-btn ${this.graphType === 'bar' ? 'active' : ''}">Bar</button>
        </div>
        
        <div class="scale-controls">
          <div class="scale-row">
            <span>X:</span>
            <input type="number" id="x-scale" value="20" class="scale-input">
            <span>Y:</span>
            <input type="number" id="y-scale" value="1000" class="scale-input">
          </div>
          <label class="scale-option">
            <input type="checkbox" id="expand-only" ${this.expandOnly ? 'checked' : ''}>
            Scale: Expand Only
          </label>
        </div>
      </div>
      
      <div class="sidebar-section">
        <h3>Data Format</h3>
        <div class="data-controls">
          <button id="data-play" class="control-btn ${this.paused ? '' : 'play'}">${this.paused ? '▶' : '⏸'}</button>
          <button id="data-pause" class="control-btn pause">⏸</button>
          <button id="data-clear" class="control-btn">Clear</button>
        </div>
        <div class="keyboard-hint">Space to pause/play, C to clear</div>
        
        <div class="split-section">
          <span>Split:</span>
          <div class="split-controls">
            ${this.splitChannels.map((ch, index) => `
              <span class="split-tag" onclick="window.liveGraphInstance.editSplitChannel(${index})">${ch}</span>
            `).join('')}
            <button class="split-add-btn" onclick="window.liveGraphInstance.addSplitChannel()">+</button>
          </div>
        </div>
        
        <div class="frequency-display">
          <span>Auto: ${this.dataRate.toFixed(1)}Hz</span>
        </div>
      </div>
      
      <div class="sidebar-section signals-section">
        <h3>Graph 1</h3>
        <div class="signals-list">
          ${this.channelNames.map((name, i) => `
            <div class="signal-item ${this.channelVisible[i] ? 'visible' : 'hidden'}" data-channel="${i}">
              <div class="signal-indicator" style="background-color: ${this.channelColors[i]}">
                <span class="signal-icon">${this.channelVisible[i] ? '▲' : '▼'}</span>
              </div>
              <span class="signal-name">${name}</span>
              <span class="signal-value">${this.currentValues[i].toFixed(1)}</span>
            </div>
          `).join('')}
        </div>
        
        <div class="signal-controls">
          <button id="toggle-hidden" class="signal-control-btn">Hidden</button>
          <button id="toggle-empty" class="signal-control-btn">Empty</button>
        </div>
        <div class="keyboard-hint">1-9 to toggle channels</div>
      </div>
      
      <div class="sidebar-section">
        <h3>Serial Settings</h3>
        <button id="live-connect-btn" class="sidebtn connect-btn">${this.connected ? 'Disconnect' : 'Connect Serial'}</button>
        <label>Baud Rate: <input id="live-baud" type="number" value="${this.baud}" min="300" max="250000"></label>
        <label>Max Samples: <input id="max-samples" type="number" value="${this.maxSamples}" min="100" max="10000"></label>
        <div class="keyboard-hint">Ctrl+S to save data</div>
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
    
    // Make instance globally accessible for split channel functions
    window.liveGraphInstance = this;
    
    this.setupEventListeners();
    setStatusBar(`${this.connected ? 'Connected' : 'Disconnected'} | ${this.baud} baud | ${this.dataRate.toFixed(1)} Hz | Live Graph`);
  }

  setupEventListeners() {
    document.getElementById('live-connect-btn').onclick = () => this.toggleSerial();
    document.getElementById('live-record-btn').onclick = () => this.toggleRecording();
    document.getElementById('set-output-file').onclick = () => this.setOutputFile();
    document.getElementById('live-baud').onchange = e => { this.baud = Number(e.target.value); };
    document.getElementById('max-samples').onchange = e => { this.maxSamples = Number(e.target.value); };
    document.getElementById('line-btn').onclick = () => this.setGraphType('line');
    document.getElementById('dot-btn').onclick = () => this.setGraphType('dot');
    document.getElementById('bar-btn').onclick = () => this.setGraphType('bar');
    document.getElementById('expand-only').onchange = e => { this.expandOnly = e.target.checked; };
    document.getElementById('data-play').onclick = () => this.togglePause();
    document.getElementById('data-pause').onclick = () => this.togglePause();
    document.getElementById('data-clear').onclick = () => this.clearGraph();
    document.getElementById('toggle-hidden').onclick = () => this.toggleHiddenChannels();
    document.getElementById('toggle-empty').onclick = () => this.toggleEmptyChannels();
    
    // Signal item click handlers
    document.querySelectorAll('.signal-item').forEach((item, index) => {
      item.onclick = () => this.toggleChannel(index);
    });
  }

  // Split channel management functions
  editSplitChannel(index) {
    showModal(`
      <h3>Edit Split Channel</h3>
      <p>Enter the channel number (1-13):</p>
      <input type="number" id="split-channel-input" value="${this.splitChannels[index]}" min="1" max="13" style="width: 100%; margin: 1em 0;">
      <div style="text-align: right; margin-top: 1em;">
        <button id="save-split-channel" class="sidebtn accent">Save</button>
        <button id="remove-split-channel" class="sidebtn">Remove</button>
        <button class="sidebtn close-modal">Cancel</button>
      </div>
      <script>
      document.getElementById('save-split-channel').onclick = () => {
        const value = parseInt(document.getElementById('split-channel-input').value);
        if (value >= 1 && value <= 13) {
          window.liveGraphInstance.splitChannels[${index}] = value;
          window.liveGraphInstance.renderSidebar();
        }
        document.getElementById('modal').classList.add('hidden');
      };
      document.getElementById('remove-split-channel').onclick = () => {
        window.liveGraphInstance.splitChannels.splice(${index}, 1);
        window.liveGraphInstance.renderSidebar();
        document.getElementById('modal').classList.add('hidden');
      };
      </script>
    `);
  }

  addSplitChannel() {
    if (this.splitChannels.length >= 13) {
      alert('Maximum 13 split channels allowed');
      return;
    }
    
    showModal(`
      <h3>Add Split Channel</h3>
      <p>Enter the channel number (1-13):</p>
      <input type="number" id="new-split-channel-input" value="${this.splitChannels.length + 1}" min="1" max="13" style="width: 100%; margin: 1em 0;">
      <div style="text-align: right; margin-top: 1em;">
        <button id="add-split-channel" class="sidebtn accent">Add</button>
        <button class="sidebtn close-modal">Cancel</button>
      </div>
      <script>
      document.getElementById('add-split-channel').onclick = () => {
        const value = parseInt(document.getElementById('new-split-channel-input').value);
        if (value >= 1 && value <= 13 && !window.liveGraphInstance.splitChannels.includes(value)) {
          window.liveGraphInstance.splitChannels.push(value);
          window.liveGraphInstance.renderSidebar();
        } else if (window.liveGraphInstance.splitChannels.includes(value)) {
          alert('Channel ' + value + ' is already in the split list');
        }
        document.getElementById('modal').classList.add('hidden');
      };
      </script>
    `);
  }

  toggleChannel(index) {
    this.channelVisible[index] = !this.channelVisible[index];
    this.renderSidebar();
  }

  toggleHiddenChannels() {
    const hasHidden = this.channelVisible.some(v => !v);
    if (hasHidden) {
      // Show all hidden channels
      this.channelVisible = this.channelVisible.map(() => true);
    } else {
      // Hide some channels
      for (let i = 4; i < 13; i++) {
        this.channelVisible[i] = false;
      }
    }
    this.renderSidebar();
  }

  toggleEmptyChannels() {
    // Toggle channels that have zero or very low values
    for (let i = 0; i < 13; i++) {
      if (Math.abs(this.currentValues[i]) < 1) {
        this.channelVisible[i] = !this.channelVisible[i];
      }
    }
    this.renderSidebar();
  }

  setOutputFile() {
    showModal(`
      <h3>Set Output File</h3>
      <p>Choose the filename for recording graph data. The file will be saved in CSV format for easy analysis in Excel or other tools.</p>
      <input type="text" id="output-filename" placeholder="graph_data.csv" value="${this.outputFilename}" style="width: 100%; margin: 1em 0;">
      <div class="file-format-info">
        <small>File will include timestamps and all channel data in CSV format</small>
      </div>
      <div style="text-align: right; margin-top: 1em;">
        <button id="save-output-file" class="sidebtn accent">Set File</button>
        <button class="sidebtn close-modal">Cancel</button>
      </div>
      <script>
      document.getElementById('save-output-file').onclick = () => {
        let filename = document.getElementById('output-filename').value.trim();
        if (!filename) filename = 'graph_data.csv';
        
        // Ensure CSV extension
        if (!filename.toLowerCase().endsWith('.csv')) {
          filename += '.csv';
        }
        
        window.liveGraphInstance.outputFilename = filename;
        window.liveGraphInstance.renderSidebar();
        document.getElementById('modal').classList.add('hidden');
      };
      </script>
    `);
  }

  clearGraph() {
    this.data = [];
    this.dataCount = 0;
    this.timeOffset = 0;
    this.currentValues = new Array(13).fill(0);
    this.smoothingBuffer = [];
    this.recordedData = [];
    this.renderSidebar();
  }

  togglePause() {
    this.paused = !this.paused;
    this.renderSidebar();
  }

  setGraphType(type) {
    this.graphType = type;
    this.renderSidebar();
  }

  updateDataRate() {
    const now = Date.now();
    const timeDiff = (now - this.lastDataTime) / 1000;
    if (timeDiff > 0 && this.dataCount > 0) {
      this.dataRate = this.dataCount / timeDiff;
    }
    this.lastDataTime = now;
    this.dataCount = 0;
    
    // Update UI elements
    const freqDisplay = document.querySelector('.frequency-display span');
    if (freqDisplay) {
      freqDisplay.textContent = `Auto: ${this.dataRate.toFixed(1)}Hz`;
    }
  }

  async toggleSerial() {
    if (!this.connected) {
      if (!('serial' in navigator)) {
        alert('Web Serial API not supported in your browser.');
        return;
      }
      try {
        this.port = await navigator.serial.requestPort();
        await this.port.open({ baudRate: this.baud });
        this.connected = true;
        this.reader = this.port.readable.getReader();
        this.readLoop();
      } catch (e) { 
        alert('Serial connection failed: ' + e);
      }
    } else {
      if (this.reader) await this.reader.cancel();
      if (this.port) await this.port.close();
      this.connected = false;
      this.port = null;
      this.reader = null;
    }
    this.renderSidebar();
  }

  async readLoop() {
    let lineBuffer = '';
    
    try {
      while (this.connected && this.reader) {
        const { value, done } = await this.reader.read();
        if (done) break;
        
        if (!this.paused) {
          const text = new TextDecoder().decode(value);
          lineBuffer += text;
          
          // Process complete lines
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() || ''; // Keep incomplete line
          
          for (let line of lines) {
            line = line.trim();
            if (line) {
              // Parse comma-separated values
              let vals = line.split(',').map(v => {
                const num = parseFloat(v.trim());
                return isNaN(num) ? 0 : num;
              });
              
              if (vals.length > 0) {
                // Ensure we have exactly 13 channels
                while (vals.length < 13) vals.push(0);
                vals = vals.slice(0, 13);
                
                // Apply smoothing to incoming data
                for (let i = 0; i < 13; i++) {
                  if (this.smoothingBuffer[i] === undefined) {
                    this.smoothingBuffer[i] = vals[i];
                  } else {
                    this.smoothingBuffer[i] = this.smoothingBuffer[i] * this.smoothingFactor + 
                                           vals[i] * (1 - this.smoothingFactor);
                  }
                  vals[i] = this.smoothingBuffer[i];
                }
                
                this.data.push(vals);
                this.dataCount++;
                this.currentValues = [...vals];
                
                // Record data if recording
                if (this.recording) {
                  this.recordedData.push([...vals]);
                }
                
                if (this.data.length > this.maxSamples) {
                  this.data.shift();
                }
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Serial read error:', e);
    }
    finally { 
      this.connected = false; 
      this.renderSidebar(); 
    }
  }

  draw() {
    const ctx = this.ctx;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    
    // Clear canvas with dark background
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, w, h);
    
    if (!this.data.length) {
      ctx.fillStyle = "#666";
      ctx.font = "16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("No data - Connect serial port to see live graph", w/2, h/2);
      return;
    }
    
    // Calculate scale with better auto-scaling
    let yMin = this.yMin, yMax = this.yMax;
    if (this.autoScale || this.expandOnly) {
      const visibleData = [];
      for (let i = 0; i < this.data.length; i++) {
        for (let ch = 0; ch < 13; ch++) {
          if (this.channelVisible[ch] && this.data[i][ch] !== undefined) {
            visibleData.push(this.data[i][ch]);
          }
        }
      }
      
      if (visibleData.length > 0) {
        yMin = Math.min(...visibleData);
        yMax = Math.max(...visibleData);
        const range = yMax - yMin;
        if (range === 0) {
          yMin -= 50;
          yMax += 50;
        } else {
          yMin -= range * 0.1;
          yMax += range * 0.1;
        }
        
        // Round to nice numbers
        const niceRange = this.getNiceRange(yMin, yMax);
        yMin = niceRange.min;
        yMax = niceRange.max;
      }
    }
    
    // Draw professional grid
    this.drawGrid(ctx, w, h, yMin, yMax);
    
    // Draw channels with anti-aliasing and smooth curves
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    for (let ch = 0; ch < 13; ch++) {
      if (!this.channelVisible[ch]) continue;
      
      ctx.strokeStyle = this.channelColors[ch];
      ctx.fillStyle = this.channelColors[ch];
      ctx.lineWidth = 1.8;
      
      if (this.graphType === 'line') {
        this.drawSmoothLine(ctx, ch, w, h, yMin, yMax);
      } else if (this.graphType === 'dot') {
        this.drawDots(ctx, ch, w, h, yMin, yMax);
      } else if (this.graphType === 'bar') {
        this.drawBars(ctx, ch, w, h, yMin, yMax);
      }
    }
  }

  getNiceRange(min, max) {
    const range = max - min;
    const magnitude = Math.pow(10, Math.floor(Math.log10(range)));
    const normalizedRange = range / magnitude;
    
    let niceRange;
    if (normalizedRange <= 1) niceRange = magnitude;
    else if (normalizedRange <= 2) niceRange = 2 * magnitude;
    else if (normalizedRange <= 5) niceRange = 5 * magnitude;
    else niceRange = 10 * magnitude;
    
    const center = (min + max) / 2;
    return {
      min: center - niceRange / 2,
      max: center + niceRange / 2
    };
  }

  drawGrid(ctx, w, h, yMin, yMax) {
    // Major grid lines
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = 1;
    
    // Horizontal grid lines (10 divisions)
    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    
    // Vertical grid lines (20 divisions)
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    
    // Minor grid lines
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 0.5;
    
    // Minor horizontal lines
    for (let i = 0; i <= 50; i++) {
      if (i % 5 !== 0) { // Skip major lines
        const y = (i / 50) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }
    
    // Draw Y-axis labels with better formatting
    ctx.fillStyle = "#888";
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    
    for (let i = 0; i <= 10; i++) {
      const y = (i / 10) * h;
      const value = yMax - (i / 10) * (yMax - yMin);
      const label = this.formatAxisLabel(value);
      ctx.fillText(label, w - 8, y);
    }
    
    // Draw X-axis labels (time)
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const timeSpan = this.data.length / this.dataRate;
    
    for (let i = 0; i <= 20; i++) {
      const x = (i / 20) * w;
      const timeValue = (i / 20) * timeSpan;
      ctx.fillText(timeValue.toFixed(1) + 's', x, h - 15);
    }
  }

  formatAxisLabel(value) {
    if (Math.abs(value) >= 1000) {
      return (value / 1000).toFixed(1) + 'k';
    } else if (Math.abs(value) >= 1) {
      return value.toFixed(0);
    } else {
      return value.toFixed(2);
    }
  }

  drawSmoothLine(ctx, ch, w, h, yMin, yMax) {
    if (this.data.length < 2) return;
    
    ctx.beginPath();
    let firstPoint = true;
    
    // Use Catmull-Rom spline for smooth curves
    const points = [];
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i][ch] !== undefined) {
        const x = (i / Math.max(this.data.length - 1, 1)) * w;
        const value = this.data[i][ch];
        const y = h - ((value - yMin) / (yMax - yMin)) * h;
        points.push({ x, y, value });
      }
    }
    
    if (points.length < 2) return;
    
    // Draw smooth curve through points
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      
      if (i === 1) {
        // First segment - simple line
        ctx.lineTo(curr.x, curr.y);
      } else {
        // Use quadratic curve for smoothness
        const prevPrev = points[i - 2];
        const cpx = prev.x + (curr.x - prevPrev.x) * 0.1;
        const cpy = prev.y + (curr.y - prevPrev.y) * 0.1;
        ctx.quadraticCurveTo(cpx, cpy, curr.x, curr.y);
      }
    }
    
    ctx.stroke();
  }

  drawDots(ctx, ch, w, h, yMin, yMax) {
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i][ch] !== undefined) {
        const x = (i / Math.max(this.data.length - 1, 1)) * w;
        const value = this.data[i][ch];
        const y = h - ((value - yMin) / (yMax - yMin)) * h;
        
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  drawBars(ctx, ch, w, h, yMin, yMax) {
    const barWidth = w / this.data.length;
    const channelWidth = barWidth / 13;
    
    for (let i = 0; i < this.data.length; i++) {
      if (this.data[i][ch] !== undefined) {
        const x = i * barWidth + ch * channelWidth;
        const value = this.data[i][ch];
        const y = h - ((value - yMin) / (yMax - yMin)) * h;
        const zeroY = h - ((0 - yMin) / (yMax - yMin)) * h;
        const barHeight = Math.abs(y - zeroY);
        
        ctx.fillRect(x, Math.min(y, zeroY), channelWidth - 1, barHeight);
      }
    }
  }

  toggleRecording() {
    if (this.recording) {
      this.recording = false;
      
      // Export recorded data as CSV
      if (this.recordedData.length > 0) {
        this.exportRecordedData();
      }
      
      this.recordedData = [];
    } else {
      this.recording = true;
      this.recordedData = [];
    }
    this.renderSidebar();
  }

  exportRecordedData() {
    // Create CSV with proper headers
    let csv = 'Timestamp,' + this.channelNames.join(',') + '\n';
    
    // Add data rows with timestamps
    this.recordedData.forEach((row, index) => {
      const timestamp = (index / this.dataRate).toFixed(3);
      csv += timestamp + ',' + row.map(val => val.toFixed(3)).join(',') + '\n';
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = this.outputFilename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  saveCSV() {
    if (this.data.length === 0) {
      alert('No data to save');
      return;
    }
    
    let csv = 'Timestamp,' + this.channelNames.join(',') + '\n';
    csv += this.data.map((row, index) => {
      const timestamp = (index / this.dataRate).toFixed(3);
      return timestamp + ',' + row.map(val => val.toFixed(3)).join(',');
    }).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `live_graph_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Keyboard shortcuts handler
  handleKeyboard(e) {
    if (e.ctrlKey) {
      switch (e.key) {
        case 'r':
          this.toggleRecording();
          e.preventDefault();
          break;
        case 's':
          this.saveCSV();
          e.preventDefault();
          break;
      }
    } else {
      switch (e.key) {
        case ' ':
          this.togglePause();
          e.preventDefault();
          break;
        case 'c':
        case 'C':
          this.clearGraph();
          e.preventDefault();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          const channelIndex = parseInt(e.key) - 1;
          if (channelIndex < 13) {
            this.toggleChannel(channelIndex);
          }
          e.preventDefault();
          break;
      }
    }
  }
}