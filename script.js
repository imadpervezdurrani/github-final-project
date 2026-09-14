/**
 * AuraCalc — Modern Glassmorphism Calculator
 * Core Logic, Web Audio Feedback, History & Keyboard Navigation
 */

class Calculator {
  constructor() {
    // State
    this.currentInput = '0';
    this.previousInput = '';
    this.operation = null;
    this.shouldResetInput = false;
    this.history = this.loadHistory();
    this.soundEnabled = localStorage.getItem('auracalc_sound') !== 'false';
    this.isScientificOpen = false;

    // DOM Elements
    this.expressionDisplay = document.getElementById('expression-display');
    this.resultDisplay = document.getElementById('result-display');
    this.keypad = document.getElementById('keypad');
    this.scientificPanel = document.getElementById('scientific-panel');
    this.historyDrawer = document.getElementById('history-drawer');
    this.historyList = document.getElementById('history-list');
    this.toast = document.getElementById('toast');

    // Button Toggles
    this.btnModeToggle = document.getElementById('btn-mode-toggle');
    this.btnSoundToggle = document.getElementById('btn-sound-toggle');
    this.soundIconOn = document.getElementById('sound-icon-on');
    this.soundIconOff = document.getElementById('sound-icon-off');
    this.btnHistoryToggle = document.getElementById('btn-history-toggle');
    this.btnCloseHistory = document.getElementById('btn-close-history');
    this.btnClearHistory = document.getElementById('btn-clear-history');
    this.btnCopy = document.getElementById('btn-copy');

    // Web Audio Context for feedback clicks
    this.audioCtx = null;

    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateDisplay();
    this.updateSoundIcon();
    this.renderHistory();
  }

  /* -------------------------------------------------------------------------- */
  /*  Sound Synthesis (Web Audio API)                                            */
  /* -------------------------------------------------------------------------- */
  playClickSound(frequency = 600, duration = 0.035, type = 'sine') {
    if (!this.soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!this.audioCtx && AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context might be restricted before user gesture
    }
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('auracalc_sound', this.soundEnabled);
    this.updateSoundIcon();
    if (this.soundEnabled) {
      this.playClickSound(750, 0.05);
      this.showToast('Sound effects enabled');
    } else {
      this.showToast('Sound effects muted');
    }
  }

  updateSoundIcon() {
    if (this.soundEnabled) {
      this.soundIconOn.classList.remove('hidden');
      this.soundIconOff.classList.add('hidden');
      this.btnSoundToggle.classList.add('active');
    } else {
      this.soundIconOn.classList.add('hidden');
      this.soundIconOff.classList.remove('hidden');
      this.btnSoundToggle.classList.remove('active');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*  Event Handlers & Setup                                                    */
  /* -------------------------------------------------------------------------- */
  setupEventListeners() {
    // Keypad Click Event Delegation
    this.keypad.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      this.handleButtonAction(btn);
    });

    // Scientific Panel Buttons
    this.scientificPanel.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      this.handleScientificAction(btn.dataset.action);
    });

    // Mode Toggle (Scientific)
    this.btnModeToggle.addEventListener('click', () => {
      this.isScientificOpen = !this.isScientificOpen;
      this.scientificPanel.classList.toggle('open', this.isScientificOpen);
      this.btnModeToggle.classList.toggle('active', this.isScientificOpen);
      this.playClickSound(550, 0.04);
    });

    // Sound Toggle
    this.btnSoundToggle.addEventListener('click', () => this.toggleSound());

    // History Toggle & Drawer
    this.btnHistoryToggle.addEventListener('click', () => {
      this.historyDrawer.classList.add('open');
      this.playClickSound(500, 0.04);
    });
    this.btnCloseHistory.addEventListener('click', () => {
      this.historyDrawer.classList.remove('open');
      this.playClickSound(450, 0.04);
    });
    this.btnClearHistory.addEventListener('click', () => this.clearHistory());

    // Copy Result
    this.btnCopy.addEventListener('click', (e) => {
      e.stopPropagation();
      this.copyToClipboard();
    });

    // Keyboard Support
    window.addEventListener('keydown', (e) => this.handleKeyboard(e));
  }

  /* -------------------------------------------------------------------------- */
  /*  Core Calculator Operations                                                */
  /* -------------------------------------------------------------------------- */
  handleButtonAction(btn) {
    const action = btn.dataset.action;

    switch (action) {
      case 'number':
        this.appendNumber(btn.dataset.num);
        this.playClickSound(600);
        break;
      case 'decimal':
        this.appendDecimal();
        this.playClickSound(620);
        break;
      case 'operator':
        this.chooseOperation(btn.dataset.op);
        this.playClickSound(750);
        break;
      case 'calculate':
        this.calculate();
        this.playClickSound(900, 0.06, 'triangle');
        break;
      case 'clear':
        this.clearAll();
        this.playClickSound(400, 0.05);
        break;
      case 'delete':
        this.deleteLast();
        this.playClickSound(480);
        break;
      case 'negate':
        this.toggleSign();
        this.playClickSound(580);
        break;
      case 'percent':
        this.applyPercent();
        this.playClickSound(650);
        break;
    }

    this.updateDisplay();
    this.highlightActiveOperator();
  }

  appendNumber(number) {
    if (this.currentInput === '0' || this.shouldResetInput) {
      this.currentInput = number;
      this.shouldResetInput = false;
    } else {
      // Prevent overflow limit (e.g., 15 digits)
      if (this.currentInput.replace('-', '').length >= 15) return;
      this.currentInput += number;
    }
  }

  appendDecimal() {
    if (this.shouldResetInput) {
      this.currentInput = '0.';
      this.shouldResetInput = false;
      return;
    }
    if (!this.currentInput.includes('.')) {
      this.currentInput += '.';
    }
  }

  deleteLast() {
    if (this.shouldResetInput) return;
    if (this.currentInput.length === 1 || (this.currentInput.length === 2 && this.currentInput.startsWith('-'))) {
      this.currentInput = '0';
    } else {
      this.currentInput = this.currentInput.slice(0, -1);
    }
  }

  toggleSign() {
    if (this.currentInput === '0' || this.currentInput === 'Error') return;
    this.currentInput = (parseFloat(this.currentInput) * -1).toString();
  }

  applyPercent() {
    if (this.currentInput === 'Error') return;
    const current = parseFloat(this.currentInput);
    if (isNaN(current)) return;

    if (this.previousInput && this.operation) {
      // E.g., 200 + 10% = 200 + 20
      const prev = parseFloat(this.previousInput);
      const percentVal = (prev * current) / 100;
      this.currentInput = this.formatNumber(percentVal);
    } else {
      this.currentInput = this.formatNumber(current / 100);
    }
  }

  chooseOperation(op) {
    if (this.currentInput === 'Error') return;

    if (this.operation && !this.shouldResetInput) {
      this.calculate(false);
    }

    this.operation = op;
    this.previousInput = this.currentInput;
    this.shouldResetInput = true;
    this.expressionDisplay.textContent = `${this.previousInput} ${this.operation}`;
  }

  calculate(isEqualsTriggered = true) {
    if (!this.operation || this.previousInput === '' || this.currentInput === 'Error') return;

    const prev = parseFloat(this.previousInput);
    const current = parseFloat(this.currentInput);
    if (isNaN(prev) || isNaN(current)) return;

    let result;
    const expressionText = `${prev} ${this.operation} ${current}`;

    switch (this.operation) {
      case '+':
        result = prev + current;
        break;
      case '−':
        result = prev - current;
        break;
      case '×':
        result = prev * current;
        break;
      case '÷':
        if (current === 0) {
          this.currentInput = 'Error';
          this.expressionDisplay.textContent = 'Cannot divide by 0';
          this.operation = null;
          this.previousInput = '';
          this.shouldResetInput = true;
          return;
        }
        result = prev / current;
        break;
      case '^':
        result = Math.pow(prev, current);
        break;
      default:
        return;
    }

    const formattedResult = this.formatNumber(result);

    if (isEqualsTriggered) {
      this.expressionDisplay.textContent = `${expressionText} =`;
      this.saveToHistory(expressionText, formattedResult);
      this.operation = null;
      this.previousInput = '';
    } else {
      this.previousInput = formattedResult;
    }

    this.currentInput = formattedResult;
    this.shouldResetInput = true;
  }

  /* -------------------------------------------------------------------------- */
  /*  Scientific Functions                                                      */
  /* -------------------------------------------------------------------------- */
  handleScientificAction(action) {
    if (this.currentInput === 'Error') return;
    const current = parseFloat(this.currentInput);
    this.playClickSound(680);

    let res;
    let exp;

    switch (action) {
      case 'sci-sin':
        res = Math.sin((current * Math.PI) / 180);
        exp = `sin(${current}°)`;
        break;
      case 'sci-cos':
        res = Math.cos((current * Math.PI) / 180);
        exp = `cos(${current}°)`;
        break;
      case 'sci-tan':
        if (Math.abs(current % 180) === 90) {
          this.currentInput = 'Error';
          return;
        }
        res = Math.tan((current * Math.PI) / 180);
        exp = `tan(${current}°)`;
        break;
      case 'sci-sqrt':
        if (current < 0) {
          this.currentInput = 'Error';
          return;
        }
        res = Math.sqrt(current);
        exp = `√(${current})`;
        break;
      case 'sci-pow2':
        res = Math.pow(current, 2);
        exp = `sqr(${current})`;
        break;
      case 'sci-pow':
        this.chooseOperation('^');
        return;
      case 'sci-pi':
        this.currentInput = this.formatNumber(Math.PI);
        this.shouldResetInput = true;
        this.updateDisplay();
        return;
      case 'sci-e':
        this.currentInput = this.formatNumber(Math.E);
        this.shouldResetInput = true;
        this.updateDisplay();
        return;
      case 'sci-reciprocal':
        if (current === 0) {
          this.currentInput = 'Error';
          return;
        }
        res = 1 / current;
        exp = `1/(${current})`;
        break;
      case 'sci-log':
        if (current <= 0) {
          this.currentInput = 'Error';
          return;
        }
        res = Math.log(current);
        exp = `ln(${current})`;
        break;
      case 'sci-paren-open':
      case 'sci-paren-close':
        // Display indicator for parentheses in expression
        return;
      default:
        return;
    }

    if (res !== undefined) {
      const formatted = this.formatNumber(res);
      this.expressionDisplay.textContent = `${exp} =`;
      this.saveToHistory(exp, formatted);
      this.currentInput = formatted;
      this.shouldResetInput = true;
      this.updateDisplay();
    }
  }

  clearAll() {
    this.currentInput = '0';
    this.previousInput = '';
    this.operation = null;
    this.shouldResetInput = false;
    this.expressionDisplay.innerHTML = '&nbsp;';
    this.updateDisplay();
    this.highlightActiveOperator();
  }

  /* -------------------------------------------------------------------------- */
  /*  Number Formatting & Display                                               */
  /* -------------------------------------------------------------------------- */
  formatNumber(num) {
    if (isNaN(num)) return 'Error';
    if (!isFinite(num)) return 'Error';

    // Fix floating point imprecisions e.g. 0.1 + 0.2
    const rounded = parseFloat(num.toFixed(10));
    
    // Convert to scientific notation if number is extraordinarily large or tiny
    if (Math.abs(rounded) > 1e12 || (Math.abs(rounded) < 1e-6 && rounded !== 0)) {
      return rounded.toExponential(5);
    }

    return rounded.toString();
  }

  updateDisplay() {
    this.resultDisplay.textContent = this.currentInput;

    // Dynamically adjust font size for longer outputs
    const len = this.currentInput.length;
    if (len > 12) {
      this.resultDisplay.style.fontSize = '1.6rem';
    } else if (len > 9) {
      this.resultDisplay.style.fontSize = '2rem';
    } else {
      this.resultDisplay.style.fontSize = '2.5rem';
    }
  }

  highlightActiveOperator() {
    const opButtons = this.keypad.querySelectorAll('.btn-op');
    opButtons.forEach((btn) => {
      if (this.operation && btn.dataset.op === this.operation && this.shouldResetInput) {
        btn.classList.add('active-op');
      } else {
        btn.classList.remove('active-op');
      }
    });
  }

  /* -------------------------------------------------------------------------- */
  /*  Keyboard Support                                                          */
  /* -------------------------------------------------------------------------- */
  handleKeyboard(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    let targetKey = e.key;

    // Normalize keys
    if (targetKey === 'Enter') targetKey = 'Enter';
    if (targetKey === '*') targetKey = '*';
    if (targetKey === '/') targetKey = '/';
    if (targetKey === '+') targetKey = '+';
    if (targetKey === '-') targetKey = '-';

    // Find corresponding button for visual click ripple
    const btn = Array.from(document.querySelectorAll('.btn')).find((b) => {
      return b.dataset.key === targetKey || (b.dataset.num && b.dataset.num === targetKey);
    });

    if (btn) {
      e.preventDefault();
      btn.classList.add('btn-pressed');
      setTimeout(() => btn.classList.remove('btn-pressed'), 120);
      btn.click();
    }
  }

  /* -------------------------------------------------------------------------- */
  /*  History Management                                                        */
  /* -------------------------------------------------------------------------- */
  loadHistory() {
    try {
      const saved = localStorage.getItem('auracalc_history');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveToHistory(expression, result) {
    const item = { expression, result, id: Date.now() };
    this.history.unshift(item);
    if (this.history.length > 30) this.history.pop();
    try {
      localStorage.setItem('auracalc_history', JSON.stringify(this.history));
    } catch (e) {}
    this.renderHistory();
  }

  renderHistory() {
    if (this.history.length === 0) {
      this.historyList.innerHTML = '<div class="empty-history">No calculations yet</div>';
      return;
    }

    this.historyList.innerHTML = this.history
      .map(
        (item) => `
        <div class="history-item" data-res="${item.result}">
          <div class="history-item-exp">${item.expression}</div>
          <div class="history-item-res">${item.result}</div>
        </div>
      `
      )
      .join('');

    // Attach click to reuse history result
    this.historyList.querySelectorAll('.history-item').forEach((item) => {
      item.addEventListener('click', () => {
        this.currentInput = item.dataset.res;
        this.shouldResetInput = true;
        this.updateDisplay();
        this.historyDrawer.classList.remove('open');
        this.playClickSound(650);
      });
    });
  }

  clearHistory() {
    this.history = [];
    localStorage.removeItem('auracalc_history');
    this.renderHistory();
    this.playClickSound(400);
    this.showToast('History cleared');
  }

  /* -------------------------------------------------------------------------- */
  /*  Copy to Clipboard & Toast                                                 */
  /* -------------------------------------------------------------------------- */
  copyToClipboard() {
    if (this.currentInput === 'Error') return;
    navigator.clipboard.writeText(this.currentInput).then(() => {
      this.showToast('Copied to clipboard!');
      this.playClickSound(800, 0.05);
    }).catch(() => {
      this.showToast('Unable to copy');
    });
  }

  showToast(message) {
    this.toast.textContent = message;
    this.toast.classList.add('show');
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.remove('show');
    }, 2200);
  }
}

// Instantiate on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.calculator = new Calculator();
});
