/**
 * ==============================================================================
 * CRYPTOLAB - Professional Virtual Cryptography Laboratory Logic
 * Experiment: Implementation of ECC-Based Digital Signature (ECDSA)
 * Powered strictly by Native Browser Web Cryptography API (NIST P-256 + SHA-256)
 * ==============================================================================
 */

// Application State
const state = {
  activeSection: 'aim',
  keyPair: null,
  privateKeyRawHex: '',
  publicKeyRawHex: '',
  publicKeyXHex: '',
  publicKeyYHex: '',
  isPrivateKeyMasked: true,
  originalMessage: 'Hello, this is a secure message!',
  currentMessage: 'Hello, this is a secure message!',
  originalHashHex: '',
  currentHashHex: '',
  signatureBuffer: null,
  signatureHex: '',
  sigRHex: '',
  sigSHex: '',
  currentStep: 1, // 1: Keygen, 2: Hash, 3: Sign, 4: Verify
  isTampered: false
};

// ==============================================================================
// Helper Utilities: Hex Encoding & Base64URL Decoding
// ==============================================================================

/**
 * Converts ArrayBuffer or Uint8Array to lowercase hexadecimal string
 */
function bufferToHex(buffer) {
  const byteArray = new Uint8Array(buffer);
  return Array.from(byteArray)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts Base64URL string (from JWK) to lowercase hexadecimal string
 */
function base64UrlToHex(b64url) {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) {
    b64 += '=';
  }
  const binary = atob(b64);
  let hex = '';
  for (let i = 0; i < binary.length; i++) {
    hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Truncates hex string with ellipsis for clean visual display
 */
function truncateHex(hex, head = 16, tail = 16) {
  if (!hex || hex.length <= head + tail) return hex;
  return `${hex.slice(0, head)} ... ${hex.slice(-tail)}`;
}

/**
 * Gets current timestamp in HH:MM:SS format
 */
function getTimestamp() {
  const d = new Date();
  return d.toTimeString().split(' ')[0];
}

/**
 * Custom Promise-based Delay
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ==============================================================================
// Terminal Audit Log Console
// ==============================================================================
function logTerminal(message, type = 'info') {
  const terminalBody = document.getElementById('terminal-body');
  if (!terminalBody) return;

  const line = document.createElement('div');
  line.className = `term-line ${type}`;

  const timeSpan = document.createElement('span');
  timeSpan.className = 'time';
  timeSpan.textContent = `[${getTimestamp()}]`;

  line.appendChild(timeSpan);
  line.appendChild(document.createTextNode(` ${message}`));

  terminalBody.appendChild(line);
  terminalBody.scrollTop = terminalBody.scrollHeight;
}

// ==============================================================================
// Toast Notification Engine
// ==============================================================================
function showToast(message, type = 'info', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '❌';

  toast.innerHTML = `<span>${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, duration);
}

/**
 * Copy Text to Clipboard with Visual Feedback
 */
async function copyToClipboard(text, description = 'Data') {
  if (!text || text === '--' || text.startsWith('Awaiting')) {
    showToast(`No ${description} available to copy yet!`, 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${description} copied to clipboard!`, 'success');
  } catch (err) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast(`${description} copied to clipboard!`, 'success');
  }
}

// ==============================================================================
// Continuous One-Page Navigation & ScrollSpy Controller
// ==============================================================================
const SECTION_ORDER = ['aim', 'theory', 'objective', 'procedure', 'simulation', 'conclusion', 'references'];

const SECTION_NAMES = {
  aim: 'Aim',
  theory: 'Theory',
  objective: 'Objective',
  procedure: 'Procedure',
  simulation: 'Simulation',
  conclusion: 'Conclusion',
  references: 'References'
};

/**
 * Smoothly scroll to a specific lab section
 */
function scrollToSection(sectionId) {
  const target = document.getElementById(`section-${sectionId}`);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    updateActiveNavLink(sectionId);
  }
  closeMobileSidebar();
}

/**
 * Update active state in sidebar nav and progress bar
 */
function updateActiveNavLink(sectionId) {
  state.activeSection = sectionId;

  // Highlight active link in sidebar
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(link => {
    if (link.getAttribute('data-section') === sectionId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Update sidebar progress tracker
  const index = SECTION_ORDER.indexOf(sectionId);
  if (index !== -1) {
    const pct = Math.round(((index + 1) / SECTION_ORDER.length) * 100);
    const progressText = document.getElementById('sim-state-percent');
    const progressBar = document.getElementById('sim-progress-bar');
    if (progressText) {
      progressText.textContent = `Sec 0${index + 1}/07: ${SECTION_NAMES[sectionId] || sectionId}`;
    }
    if (progressBar) {
      progressBar.style.width = `${pct}%`;
    }
  }
}

/**
 * Initialize ScrollSpy to automatically detect current section while scrolling up or down
 */
function initScrollSpy() {
  const sectionElements = SECTION_ORDER.map(id => ({
    id,
    el: document.getElementById(`section-${id}`)
  })).filter(item => item.el !== null);

  let isThrottled = false;
  function handleScroll() {
    if (isThrottled) return;
    isThrottled = true;
    requestAnimationFrame(() => {
      isThrottled = false;

      // Toggle floating back-to-top button visibility
      const floatingTopBtn = document.getElementById('floating-top-btn');
      if (floatingTopBtn) {
        if (window.scrollY > 350) {
          floatingTopBtn.classList.remove('hidden');
        } else {
          floatingTopBtn.classList.add('hidden');
        }
      }

      // Check if user is scrolled to near bottom of document
      if ((window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 80)) {
        updateActiveNavLink('references');
        return;
      }

      const scrollPos = window.scrollY + 130; // offset for sticky navigation header
      let currentSection = 'aim';

      for (const item of sectionElements) {
        const top = item.el.offsetTop;
        const height = item.el.offsetHeight;
        if (scrollPos >= top && scrollPos < top + height) {
          currentSection = item.id;
          break;
        }
      }

      if (state.activeSection !== currentSection) {
        updateActiveNavLink(currentSection);
      }
    });
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  // Initial check on page load
  handleScroll();

  // Floating back to top button click
  document.getElementById('floating-top-btn')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('open');
  document.getElementById('sidebar-backdrop')?.classList.add('open');
}

function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('sidebar-backdrop')?.classList.remove('open');
}

// ==============================================================================
// Stepper Progress & Bench Status Management
// ==============================================================================
function updateStepper(step) {
  state.currentStep = step;

  // 1. Update Horizontal In-Line Pipeline Ribbon (p-step-1 to p-step-5)
  for (let i = 1; i <= 5; i++) {
    const pStep = document.getElementById(`p-step-${i}`);
    if (!pStep) continue;
    if (i < step) {
      pStep.className = 'pipeline-step completed';
    } else if (i === step) {
      pStep.className = 'pipeline-step active';
    } else {
      pStep.className = 'pipeline-step';
    }
  }

  // 2. Dynamic Action Callout Guide: Tells student what to press next
  const guideText = document.getElementById('master-guide-text');
  if (guideText) {
    if (step === 1) {
      guideText.innerHTML = '<strong>Step 1 of 5:</strong> Press the blue <strong>"1. Generate Key Pair"</strong> button below to start.';
    } else if (step === 2) {
      guideText.innerHTML = '<strong>Step 2 of 5:</strong> Key pair ready! Press <strong>"2. Hash Message (SHA-256)"</strong> next.';
    } else if (step === 3) {
      guideText.innerHTML = '<strong>Step 3 of 5:</strong> Hash digest ready! Press <strong>"3. Sign Message"</strong> to generate ECDSA signature.';
    } else if (step === 4) {
      guideText.innerHTML = '<strong>Step 4 of 5:</strong> Signature created! Press <strong>"4. Verify Signature"</strong> to verify authenticity.';
    } else if (step === 5) {
      guideText.innerHTML = '<strong>Step 5 of 5:</strong> Signature verified authentic! Now press <strong>"5. Tamper Message"</strong> to test integrity rejection.';
    }
  }

  // 3. Highlight the Active In-Line Step Block
  const blockIds = ['sim-step1-card', 'sim-step2-card', 'sim-step3-card', 'sim-step4-card'];
  blockIds.forEach((id, idx) => {
    const block = document.getElementById(id);
    if (!block) return;
    const blockStep = idx === 3 ? 4 : idx + 1;
    if (step === blockStep || (step >= 4 && idx === 3)) {
      block.classList.add('active-focus');
    } else {
      block.classList.remove('active-focus');
    }
  });

  // 4. Pulse the Exact Button the Student Should Press Next
  const btnMap = {
    1: document.getElementById('gen-keys-btn'),
    2: document.getElementById('hash-msg-btn'),
    3: document.getElementById('sign-msg-btn'),
    4: document.getElementById('verify-btn'),
    5: document.getElementById('tamper-btn')
  };

  Object.keys(btnMap).forEach(key => {
    const btn = btnMap[key];
    if (btn) {
      if (parseInt(key) === step) {
        btn.classList.add('pulse-attention');
      } else {
        btn.classList.remove('pulse-attention');
      }
    }
  });
}

function updateBenchStatus(text, ledClass = 'ready') {
  const statusPill = document.getElementById('bench-status-pill');
  const led = statusPill?.querySelector('.indicator-led');
  const textEl = document.getElementById('bench-status-text');

  if (led) {
    led.className = `indicator-led ${ledClass}`;
  }
  if (textEl) {
    textEl.textContent = text;
  }
}

// ==============================================================================
// Animated Digit-by-Digit Hex Revealer
// ==============================================================================
async function animateHexReveal(element, hexString, chunkSize = 4, delay = 25) {
  element.textContent = '';
  element.classList.remove('masked');
  
  for (let i = 0; i < hexString.length; i += chunkSize) {
    element.textContent += hexString.slice(i, i + chunkSize);
    await sleep(delay);
  }
}

// ==============================================================================
// Visual Pipeline Step Light-Up Animation
// ==============================================================================
function lightUpPipelineStep(stepNumber) {
  // Reset all pipeline nodes
  for (let i = 1; i <= 7; i++) {
    const node = document.getElementById(`vp-${i}`);
    const seg = document.getElementById(`vp-seg-${i}`);
    if (node) node.classList.remove('vp-active', 'vp-completed');
    if (seg) seg.classList.remove('seg-active', 'seg-completed');
  }

  // Light up completed steps
  for (let i = 1; i < stepNumber; i++) {
    const node = document.getElementById(`vp-${i}`);
    const seg = document.getElementById(`vp-seg-${i}`);
    if (node) node.classList.add('vp-completed');
    if (seg) seg.classList.add('seg-completed');
  }

  // Light up current step
  const currentNode = document.getElementById(`vp-${stepNumber}`);
  if (currentNode) {
    currentNode.classList.add('vp-active');
  }

  // Light up the segment leading to current step
  if (stepNumber > 1) {
    const prevSeg = document.getElementById(`vp-seg-${stepNumber - 1}`);
    if (prevSeg) prevSeg.classList.add('seg-active');
  }
}

// ==============================================================================
// CORE CRYPTOGRAPHIC IMPLEMENTATION VIA NATIVE WEB CRYPTO API
// ==============================================================================

/**
 * STEP 1: Generate ECC Key Pair over NIST P-256 Curve
 */
async function generateKeyPair() {
  const genBtn = document.getElementById('gen-keys-btn');
  const animStage = document.getElementById('keygen-anim-stage');
  const spinnerWrap = document.getElementById('keygen-spinner-wrap');
  const progressStage = document.getElementById('keygen-progress-stage');
  const flowPrivBox = document.getElementById('flow-priv-box');
  const flowPubBox = document.getElementById('flow-pub-box');
  const privDisplay = document.getElementById('priv-key-hex');
  const pubDisplay = document.getElementById('pub-key-hex');
  const pubX = document.getElementById('pub-x-hex');
  const pubY = document.getElementById('pub-y-hex');
  const successNotices = document.getElementById('keygen-success-notices');
  const progTitle = document.getElementById('keygen-prog-title');
  const progBar = document.getElementById('keygen-prog-bar');
  const progSub = document.getElementById('keygen-prog-sub');

  try {
    genBtn.disabled = true;
    updateBenchStatus('Generating NIST P-256 Key Pair...', 'busy');
    logTerminal('Invoking window.crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" })...', 'info');

    // Show progress stage with animation
    progressStage.classList.remove('hidden');
    animStage.classList.add('hidden');
    spinnerWrap.classList.add('hidden');
    flowPrivBox.classList.remove('active-flow');
    flowPubBox.classList.remove('active-flow');
    successNotices.classList.add('hidden');

    // Animate progress bar
    progTitle.textContent = 'Invoking CSPRNG — collecting cryptographic entropy...';
    progSub.textContent = 'Selecting random scalar d ∈ [1, n-1]...';
    
    for (let i = 0; i <= 100; i += 10) {
      progBar.style.width = `${i}%`;
      await sleep(80);
    }

    // REAL WEB CRYPTO API CALL
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-256'
      },
      true, // extractable
      ['sign', 'verify']
    );

    state.keyPair = keyPair;

    // Export Private Key via JWK to extract exact 256-bit scalar d
    const jwkPrivate = await window.crypto.subtle.exportKey('jwk', keyPair.privateKey);
    state.privateKeyRawHex = base64UrlToHex(jwkPrivate.d);

    // Export Public Key via raw format (04 || X [32 bytes] || Y [32 bytes]) = 65 bytes
    const rawPublicKey = await window.crypto.subtle.exportKey('raw', keyPair.publicKey);
    state.publicKeyRawHex = bufferToHex(rawPublicKey);
    state.publicKeyXHex = state.publicKeyRawHex.slice(2, 66);
    state.publicKeyYHex = state.publicKeyRawHex.slice(66, 130);

    logTerminal(`Private Scalar (d) generated: [${truncateHex(state.privateKeyRawHex, 8, 8)}]`, 'success');
    logTerminal(`Computed Curve Point Q = d × G on NIST P-256: [${truncateHex(state.publicKeyRawHex, 8, 8)}]`, 'success');

    // Hide progress, show animation stage
    progressStage.classList.add('hidden');
    animStage.classList.remove('hidden');

    // 1. Highlight Private Key generation with gradual reveal
    await sleep(300);
    flowPrivBox.classList.add('active-flow');
    
    if (state.isPrivateKeyMasked) {
      privDisplay.textContent = '•'.repeat(64);
      privDisplay.classList.add('masked');
    } else {
      await animateHexReveal(privDisplay, state.privateKeyRawHex, 4, 20);
    }

    // 2. Animate scalar multiplication transition to Public Key
    await sleep(600);
    flowPubBox.classList.add('active-flow');
    await animateHexReveal(pubDisplay, state.publicKeyRawHex, 8, 25);

    // Populate Coordinate pills
    pubX.textContent = state.publicKeyXHex;
    pubY.textContent = state.publicKeyYHex;

    // Show success notices
    await sleep(300);
    successNotices.classList.remove('hidden');

    // Enable next stages
    document.getElementById('hash-msg-btn').disabled = false;
    document.getElementById('sign-msg-btn').disabled = false;

    // Light up visual pipeline step 1
    lightUpPipelineStep(1);

    updateStepper(2);
    updateBenchStatus('Key Pair Ready. Enter message and generate SHA-256 digest or sign.', 'ready');
    showToast('NIST P-256 ECC Key Pair generated successfully!', 'success');

  } catch (error) {
    console.error('Key Generation Error:', error);
    logTerminal(`Key Generation Failed: ${error.message}`, 'error');
    showToast(`Key Generation Error: ${error.message}`, 'error');
    updateBenchStatus('Key Generation Error', 'error');
  } finally {
    genBtn.disabled = false;
  }
}

/**
 * Toggle Private Key Masking (Eye icon)
 */
function togglePrivateKeyVisibility() {
  const privDisplay = document.getElementById('priv-key-hex');
  const eyeOpen = document.getElementById('eye-open-icon');
  const eyeClosed = document.getElementById('eye-closed-icon');

  if (!state.privateKeyRawHex) {
    showToast('Generate a keypair first!', 'info');
    return;
  }

  state.isPrivateKeyMasked = !state.isPrivateKeyMasked;

  if (state.isPrivateKeyMasked) {
    privDisplay.textContent = '•'.repeat(64);
    privDisplay.classList.add('masked');
    eyeOpen.style.display = 'none';
    eyeClosed.style.display = 'block';
  } else {
    privDisplay.textContent = state.privateKeyRawHex;
    privDisplay.classList.remove('masked');
    eyeOpen.style.display = 'block';
    eyeClosed.style.display = 'none';
  }
}

/**
 * STEP 2 & 3: Compute SHA-256 Digest of Message
 */
async function generateSha256Digest(isAutoFromSign = false) {
  const msgInput = document.getElementById('message-input');
  const animStage = document.getElementById('hash-anim-stage');
  const progressStage = document.getElementById('hash-progress-stage');
  const packetBlock = document.getElementById('anim-msg-packet');
  const packetText = document.getElementById('anim-packet-text');
  const hashDisplay = document.getElementById('hash-hex-display');
  const hashEngineBox = document.getElementById('hash-engine-box');
  const successNotice = document.getElementById('hash-success-notice');
  const progTitle = document.getElementById('hash-prog-title');
  const progBar = document.getElementById('hash-prog-bar');
  const progSub = document.getElementById('hash-prog-sub');

  const text = msgInput.value;
  state.currentMessage = text;
  if (!state.isTampered) {
    state.originalMessage = text;
  }

  try {
    updateBenchStatus('Computing SHA-256 Cryptographic Hash...', 'busy');
    logTerminal(`Encoding message "${text.slice(0, 32)}..." into UTF-8 byte stream...`, 'info');

    // Show progress stage
    progressStage.classList.remove('hidden');
    animStage.classList.add('hidden');
    successNotice.classList.add('hidden');
    
    packetText.textContent = `"${text.slice(0, 24)}${text.length > 24 ? '...' : ''}"`;

    // Animate progress
    progTitle.textContent = 'Generating SHA-256 Hash...';
    progSub.textContent = 'Encoding message to UTF-8 byte stream...';
    
    for (let i = 0; i <= 100; i += 15) {
      progBar.style.width = `${i}%`;
      await sleep(60);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);

    // REAL WEB CRYPTO API CALL
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashHex = bufferToHex(hashBuffer);

    state.currentHashHex = hashHex;
    if (!state.isTampered) {
      state.originalHashHex = hashHex;
    }

    logTerminal(`Computed SHA-256 Digest (e): ${hashHex}`, 'success');

    // Hide progress, show animation stage
    progressStage.classList.add('hidden');
    animStage.classList.remove('hidden');

    // Animate message moving into SHA-256 block
    packetBlock.style.transform = 'scale(1.05)';
    await sleep(300);
    packetBlock.style.transform = 'scale(1)';
    
    // Animate hash engine
    hashEngineBox.classList.add('engine-active');
    await sleep(400);
    hashEngineBox.classList.remove('engine-active');

    // Animated gradual reveal of hash
    await sleep(200);
    await animateHexReveal(hashDisplay, hashHex, 4, 20);

    // Show success notice
    await sleep(300);
    successNotice.classList.remove('hidden');

    updateBenchStatus('SHA-256 Hash Computed. Ready to Generate Signature.', 'ready');
    if (!isAutoFromSign) {
      showToast('SHA-256 Hash computed successfully!', 'success');
      updateStepper(3);
      // Light up visual pipeline step 3
      lightUpPipelineStep(3);
    }

    return hashHex;
  } catch (error) {
    console.error('SHA-256 Error:', error);
    logTerminal(`SHA-256 Digest Error: ${error.message}`, 'error');
    showToast(`Hash Error: ${error.message}`, 'error');
    updateBenchStatus('Hashing Error', 'error');
    throw error;
  }
}

/**
 * STEP 4: Generate ECDSA Digital Signature (r, s)
 */
async function signMessage() {
  const signBtn = document.getElementById('sign-msg-btn');
  const animStage = document.getElementById('signing-anim-stage');
  const progressStage = document.getElementById('sign-progress-stage');
  const fullSigDisplay = document.getElementById('full-sig-hex');
  const rDisplay = document.getElementById('sig-r-hex');
  const sDisplay = document.getElementById('sig-s-hex');
  const successNotice = document.getElementById('sign-success-notice');
  const progTitle = document.getElementById('sign-prog-title');
  const progBar = document.getElementById('sign-prog-bar');
  const progSub = document.getElementById('sign-prog-sub');
  const signingCoreBox = document.getElementById('signing-core-box');

  if (!state.keyPair) {
    showToast('Please generate an ECC key pair first!', 'error');
    return;
  }

  try {
    signBtn.disabled = true;
    updateBenchStatus('Executing ECDSA Signing Equation: s = k⁻¹(e + dr) mod n...', 'busy');

    // Ensure SHA-256 is generated
    await generateSha256Digest(true);

    // Show progress stage
    progressStage.classList.remove('hidden');
    animStage.classList.add('hidden');
    successNotice.classList.add('hidden');

    logTerminal('Invoking window.crypto.subtle.sign({ name: "ECDSA", hash: { name: "SHA-256" } }, privateKey, data)...', 'info');

    // Animate checklist items
    progTitle.textContent = 'Generating Digital Signature...';
    
    const checklistItems = ['sc-1', 'sc-2', 'sc-3', 'sc-4', 'sc-5'];
    const checklistTexts = [
      'Private Key ($d$) — loaded',
      'SHA-256 Hash ($e$) — loaded',
      'Ephemeral Scalar ($k$) — selected',
      'Computing $r = (k \times G)_x \bmod n$',
      'Computing $s = k^{-1}(e + dr) \bmod n$'
    ];
    
    for (let i = 0; i < checklistItems.length; i++) {
      const item = document.getElementById(checklistItems[i]);
      const icon = item.querySelector('.sc-icon');
      icon.classList.remove('sc-pending');
      icon.classList.add('sc-check');
      icon.textContent = '✓';
      progSub.textContent = checklistTexts[i];
      progBar.style.width = `${((i + 1) / checklistItems.length) * 100}%`;
      await sleep(400);
    }

    const encoder = new TextEncoder();
    const messageBytes = encoder.encode(state.currentMessage);

    // REAL WEB CRYPTO API CALL
    const signatureBuffer = await window.crypto.subtle.sign(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      state.keyPair.privateKey,
      messageBytes
    );

    state.signatureBuffer = signatureBuffer;

    // Web Crypto ECDSA produces IEEE P1363 format (32 bytes r + 32 bytes s)
    const sigArray = new Uint8Array(signatureBuffer);
    const rBytes = sigArray.slice(0, 32);
    const sBytes = sigArray.slice(32, 64);

    state.sigRHex = bufferToHex(rBytes);
    state.sigSHex = bufferToHex(sBytes);
    state.signatureHex = bufferToHex(sigArray);

    logTerminal(`Ephemeral Scalar k generated; computed r = (kG)_x mod n: [${truncateHex(state.sigRHex, 8, 8)}]`, 'success');
    logTerminal(`Computed s = k⁻¹(e + dr) mod n: [${truncateHex(state.sigSHex, 8, 8)}]`, 'success');
    logTerminal(`Digital Signature (r, s) created (64 bytes / 128 hex chars)`, 'success');

    // Hide progress, show animation stage
    progressStage.classList.add('hidden');
    animStage.classList.remove('hidden');

    // Animate signing engine
    signingCoreBox.classList.add('core-active');
    await sleep(500);
    signingCoreBox.classList.remove('core-active');

    // Sequential reveal animation
    await sleep(300);
    await animateHexReveal(fullSigDisplay, state.signatureHex, 8, 20);
    rDisplay.textContent = state.sigRHex;
    sDisplay.textContent = state.sigSHex;

    // Show success notice
    await sleep(300);
    successNotice.classList.remove('hidden');

    // Enable Verification & Tamper Buttons
    document.getElementById('verify-btn').disabled = false;
    document.getElementById('tamper-btn').disabled = false;

    // Light up visual pipeline step 4
    lightUpPipelineStep(4);

    updateStepper(4);
    updateBenchStatus('Digital Signature Generated! Ready to perform Verification or Tamper Test.', 'ready');
    showToast('ECDSA Digital Signature generated successfully!', 'success');

  } catch (error) {
    console.error('Signing Error:', error);
    logTerminal(`Signing Execution Error: ${error.message}`, 'error');
    showToast(`Signing Error: ${error.message}`, 'error');
    updateBenchStatus('Signing Error', 'error');
  } finally {
    signBtn.disabled = false;
  }
}

/**
 * STEP 5: Verify ECDSA Signature with Public Key
 */
async function verifySignature() {
  const verifyBtn = document.getElementById('verify-btn');
  const animStage = document.getElementById('verify-anim-stage');
  const progressStage = document.getElementById('verify-progress-stage');
  const resultContainer = document.getElementById('verification-result-box');
  const resultValid = document.getElementById('result-valid');
  const resultInvalid = document.getElementById('result-invalid');
  const msgTag = document.getElementById('v-msg-tag');
  const progTitle = document.getElementById('verify-prog-title');
  const progBar = document.getElementById('verify-prog-bar');
  const progSub = document.getElementById('verify-prog-sub');
  const verifyCalcBox = document.getElementById('verify-calc-box');

  if (!state.keyPair || !state.signatureBuffer) {
    showToast('Generate keys and signature first!', 'error');
    return;
  }

  try {
    verifyBtn.disabled = true;
    updateBenchStatus('Verifying ECDSA Signature against Public Key Q...', 'busy');

    // Show progress stage
    progressStage.classList.remove('hidden');
    animStage.classList.add('hidden');
    resultContainer.classList.add('hidden');
    
    msgTag.textContent = state.isTampered ? 'Tampered' : 'Original';
    msgTag.style.color = state.isTampered ? 'var(--danger-red)' : 'var(--success-green)';

    logTerminal('Invoking window.crypto.subtle.verify({ name: "ECDSA", hash: { name: "SHA-256" } }, publicKey, signature, data)...', 'info');

    // Animate verification checklist
    progTitle.textContent = 'Running Verification Engine...';
    
    const verifyItems = ['vc-1', 'vc-2', 'vc-3', 'vc-4', 'vc-5'];
    const verifyTexts = [
      'Message Received',
      'Generating SHA-256 Hash...',
      'Public Key Loaded',
      'Signature Loaded',
      'Validating Digital Signature...'
    ];
    
    for (let i = 0; i < verifyItems.length; i++) {
      const item = document.getElementById(verifyItems[i]);
      const icon = item.querySelector('.sc-icon');
      icon.classList.remove('sc-pending');
      icon.classList.add('sc-check');
      icon.textContent = '✓';
      progSub.textContent = verifyTexts[i];
      progBar.style.width = `${((i + 1) / verifyItems.length) * 100}%`;
      await sleep(500);
    }

    const encoder = new TextEncoder();
    const dataToVerify = encoder.encode(state.currentMessage);

    // REAL WEB CRYPTO API CALL
    const isValid = await window.crypto.subtle.verify(
      {
        name: 'ECDSA',
        hash: { name: 'SHA-256' }
      },
      state.keyPair.publicKey,
      state.signatureBuffer,
      dataToVerify
    );

    // Hide progress, show animation stage
    progressStage.classList.add('hidden');
    animStage.classList.remove('hidden');

    // Animate verification computation
    verifyCalcBox.classList.add('calc-active');
    await sleep(600);
    verifyCalcBox.classList.remove('calc-active');

    resultContainer.classList.remove('hidden');

    if (isValid) {
      resultValid.classList.remove('hidden');
      resultInvalid.classList.add('hidden');
      updateBenchStatus('Signature Verified: AUTHENTIC (Valid Math v = r)', 'success');
      logTerminal('Signature Verification Result: VALID (v == r verified)', 'success');
      showToast('Signature Verified: AUTHENTIC & VALID!', 'success');
      updateStepper(5); // Unlock and guide user to Step 5: Tamper Test
      // Light up visual pipeline step 6
      lightUpPipelineStep(6);
    } else {
      resultValid.classList.add('hidden');
      resultInvalid.classList.remove('hidden');
      updateBenchStatus('Signature Invalid: REJECTED (Hash mismatch / v ≠ r)', 'error');
      logTerminal('Signature Verification Result: INVALID (Integrity check failed)', 'error');
      showToast('Signature Invalid: Tampering Detected!', 'error');

      const guideText = document.getElementById('master-guide-text');
      if (guideText) {
        guideText.innerHTML = '<strong>⚠️ Tampering Detected:</strong> Signature rejected ($v \\ne r$)! Press <strong>"Revert to Original"</strong> to restore valid state.';
      }
      document.getElementById('revert-btn')?.classList.add('pulse-attention');
    }

  } catch (error) {
    console.error('Verification Error:', error);
    logTerminal(`Verification Failure: ${error.message}`, 'error');
    showToast(`Verification Error: ${error.message}`, 'error');
    updateBenchStatus('Verification Error', 'error');
  } finally {
    verifyBtn.disabled = false;
  }
}

/**
 * STEP 6: Tamper Test - Inject intentional modification into message
 */
async function tamperMessage() {
  const msgInput = document.getElementById('message-input');
  const tamperBtn = document.getElementById('tamper-btn');
  const revertBtn = document.getElementById('revert-btn');
  const diffPanel = document.getElementById('tamper-diff-panel');
  const origHashEl = document.getElementById('diff-orig-hash');
  const tampHashEl = document.getElementById('diff-tamp-hash');

  const tamperedText = 'Hello, this is a tampered message!';
  
  // Animate the tampering
  msgInput.value = tamperedText;
  msgInput.style.backgroundColor = 'var(--danger-bg)';
  await sleep(300);
  msgInput.style.backgroundColor = '';
  
  state.currentMessage = tamperedText;
  state.isTampered = true;

  updateMessageMeta();

  logTerminal('⚠️ INJECTING MESSAGE TAMPERING ATTACK...', 'warning');
  logTerminal(`Message altered: "${state.originalMessage}" -> "${tamperedText}"`, 'warning');

  // Compute new hash for the tampered message using Web Crypto API
  const encoder = new TextEncoder();
  const tamperedBuffer = await window.crypto.subtle.digest('SHA-256', encoder.encode(tamperedText));
  const tamperedHash = bufferToHex(tamperedBuffer);
  state.currentHashHex = tamperedHash;

  // Update Diff Panel
  origHashEl.textContent = state.originalHashHex || '464d6db81bf83505c21966a014902a2444390b1ec1895a04bb4954e3d36b7582';
  tampHashEl.textContent = tamperedHash;
  diffPanel.classList.remove('hidden');

  // Show Revert Button
  revertBtn.classList.remove('hidden');
  tamperBtn.disabled = true;

  showToast('Message altered! Notice the Avalanche Shift in SHA-256 digest.', 'error');

  // Light up visual pipeline step 5 (transmit tampered)
  lightUpPipelineStep(5);

  // Automatically trigger verification to illustrate instantaneous failure
  await sleep(500);
  await verifySignature();
  
  // Light up visual pipeline step 7 (rejected)
  lightUpPipelineStep(7);
}

/**
 * Revert Tampered Message back to Original
 */
async function revertMessage() {
  const msgInput = document.getElementById('message-input');
  const tamperBtn = document.getElementById('tamper-btn');
  const revertBtn = document.getElementById('revert-btn');
  const diffPanel = document.getElementById('tamper-diff-panel');

  msgInput.value = state.originalMessage;
  state.currentMessage = state.originalMessage;
  state.isTampered = false;

  updateMessageMeta();
  diffPanel.classList.add('hidden');
  revertBtn.classList.add('hidden');
  revertBtn.classList.remove('pulse-attention');
  tamperBtn.disabled = false;

  logTerminal(`Reverted message payload back to original: "${state.originalMessage}"`, 'info');
  showToast('Reverted to original authenticated message.', 'info');

  // Re-hash and re-verify
  await generateSha256Digest(true);
  await verifySignature();
  updateStepper(5);
}

/**
 * STEP 7: Reset All Simulation State
 */
function resetSimulation() {
  state.keyPair = null;
  state.privateKeyRawHex = '';
  state.publicKeyRawHex = '';
  state.publicKeyXHex = '';
  state.publicKeyYHex = '';
  state.isPrivateKeyMasked = true;
  state.originalMessage = 'Hello, this is a secure message!';
  state.currentMessage = 'Hello, this is a secure message!';
  state.originalHashHex = '';
  state.currentHashHex = '';
  state.signatureBuffer = null;
  state.signatureHex = '';
  state.sigRHex = '';
  state.sigSHex = '';
  state.currentStep = 1;
  state.isTampered = false;

  // Reset Input & Display Fields
  const msgInput = document.getElementById('message-input');
  if (msgInput) msgInput.value = state.originalMessage;
  updateMessageMeta();

  document.getElementById('priv-key-hex').textContent = 'Awaiting Key Generation... Click "Generate Key Pair"';
  document.getElementById('priv-key-hex').classList.remove('masked');
  document.getElementById('pub-key-hex').textContent = 'Awaiting Key Generation... Click "Generate Key Pair"';
  document.getElementById('pub-x-hex').textContent = '--';
  document.getElementById('pub-y-hex').textContent = '--';
  document.getElementById('hash-hex-display').textContent = 'Awaiting Hash Generation... Click "Hash Message" or "Sign Message"';
  document.getElementById('full-sig-hex').textContent = 'Awaiting Signature Generation... Click "Sign Message"';
  document.getElementById('sig-r-hex').textContent = '--';
  document.getElementById('sig-s-hex').textContent = '--';

  // Hide Animation Stages & Results
  document.getElementById('keygen-anim-stage')?.classList.add('hidden');
  document.getElementById('hash-anim-stage')?.classList.add('hidden');
  document.getElementById('signing-anim-stage')?.classList.add('hidden');
  document.getElementById('verify-anim-stage')?.classList.add('hidden');
  document.getElementById('verification-result-box')?.classList.add('hidden');
  document.getElementById('result-valid')?.classList.add('hidden');
  document.getElementById('result-invalid')?.classList.add('hidden');
  document.getElementById('tamper-diff-panel')?.classList.add('hidden');
  document.getElementById('revert-btn')?.classList.add('hidden');

  // Reset Buttons
  document.getElementById('gen-keys-btn').disabled = false;
  document.getElementById('hash-msg-btn').disabled = true;
  document.getElementById('sign-msg-btn').disabled = true;
  document.getElementById('verify-btn').disabled = true;
  document.getElementById('tamper-btn').disabled = true;

  // Reset Eye icons
  document.getElementById('eye-open-icon').style.display = 'none';
  document.getElementById('eye-closed-icon').style.display = 'block';

  updateStepper(1);
  updateBenchStatus('Ready to Begin: Generate ECC Key Pair', 'ready');
  logTerminal('Simulation reset to initial state. Cryptographic state cleared.', 'info');
  showToast('Experiment benchmark reset successfully.', 'info');
}

/**
 * Update Message character and byte count
 */
function updateMessageMeta() {
  const msgInput = document.getElementById('message-input');
  const metaSpan = document.getElementById('msg-meta-chars');
  if (!msgInput || !metaSpan) return;

  const val = msgInput.value;
  const bytes = new TextEncoder().encode(val).length;
  metaSpan.textContent = `${val.length} characters | ${bytes} bytes`;
}

// ==============================================================================
// Self-Assessment Quiz Handler (Section 6)
// ==============================================================================
function checkQuizAnswers() {
  const quizItems = document.querySelectorAll('.quiz-item');
  let score = 0;
  const total = quizItems.length;

  quizItems.forEach(item => {
    const correct = item.getAttribute('data-correct');
    const checked = item.querySelector('input[type="radio"]:checked');
    const feedback = item.querySelector('.quiz-feedback');

    if (!feedback) return;
    feedback.classList.remove('hidden', 'correct', 'incorrect');

    if (!checked) {
      feedback.classList.add('incorrect');
      feedback.textContent = 'Please select an option.';
      return;
    }

    if (checked.value === correct) {
      score++;
      feedback.classList.add('correct');
      feedback.innerHTML = '<strong>Correct!</strong> Great job analyzing this cryptographic property.';
    } else {
      feedback.classList.add('incorrect');
      feedback.innerHTML = `<strong>Incorrect.</strong> The correct answer is <strong>(${correct.toUpperCase()})</strong>.`;
    }
  });

  showToast(`Quiz completed! Score: ${score}/${total}`, score === total ? 'success' : 'info');
}

// ==============================================================================
// Theme Toggle Engine (Dark / Light)
// ==============================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('cryptolab_theme') || 'light';
  document.body.setAttribute('data-theme', savedTheme);

  const toggleBtn = document.getElementById('theme-toggle');
  toggleBtn?.addEventListener('click', () => {
    const currentTheme = document.body.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('cryptolab_theme', newTheme);
    showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} mode`, 'info', 2000);
  });
}

// ==============================================================================
// Event Listeners & Initialization
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme
  initTheme();

  // Sidebar Navigation Links (Smooth scrolling across one continuous page)
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.getAttribute('data-section');
      scrollToSection(target);
    });
  });

  // Launch Simulation Button in Header
  document.getElementById('launch-sim-btn')?.addEventListener('click', () => {
    scrollToSection('simulation');
  });

  // Inter-Section Next/Previous navigation buttons
  document.querySelectorAll('.sec-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      if (target) scrollToSection(target);
    });
  });

  // Mobile Sidebar Toggle
  document.getElementById('sidebar-toggle')?.addEventListener('click', openMobileSidebar);
  document.getElementById('sidebar-backdrop')?.addEventListener('click', closeMobileSidebar);

  // Theory Sub-tabs
  document.querySelectorAll('.theory-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theory-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.theory-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(btn.getAttribute('data-theory-target'));
      targetPane?.classList.add('active');

      if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise();
      }
    });
  });

  // Message Textarea input listener
  const msgInput = document.getElementById('message-input');
  msgInput?.addEventListener('input', () => {
    state.currentMessage = msgInput.value;
    updateMessageMeta();
  });

  // Sample Preset Buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.getAttribute('data-preset');
      if (msgInput) {
        msgInput.value = preset;
        state.currentMessage = preset;
        state.originalMessage = preset;
        state.isTampered = false;
        updateMessageMeta();
        showToast('Sample message loaded', 'info', 1500);
      }
    });
  });

  // Cryptographic Action Buttons
  document.getElementById('gen-keys-btn')?.addEventListener('click', generateKeyPair);
  document.getElementById('toggle-priv-vis')?.addEventListener('click', togglePrivateKeyVisibility);
  document.getElementById('hash-msg-btn')?.addEventListener('click', () => generateSha256Digest(false));
  document.getElementById('sign-msg-btn')?.addEventListener('click', signMessage);
  document.getElementById('verify-btn')?.addEventListener('click', verifySignature);
  document.getElementById('tamper-btn')?.addEventListener('click', tamperMessage);
  document.getElementById('revert-btn')?.addEventListener('click', revertMessage);
  document.getElementById('reset-sim-btn')?.addEventListener('click', resetSimulation);

  // Copy Buttons
  document.getElementById('copy-priv-btn')?.addEventListener('click', () => {
    copyToClipboard(state.privateKeyRawHex, 'Private Key Scalar (d)');
  });
  document.getElementById('copy-pub-btn')?.addEventListener('click', () => {
    copyToClipboard(state.publicKeyRawHex, 'Public Key Point (Q)');
  });
  document.getElementById('copy-hash-btn')?.addEventListener('click', () => {
    copyToClipboard(state.currentHashHex, 'SHA-256 Digest (e)');
  });
  document.getElementById('copy-full-sig-btn')?.addEventListener('click', () => {
    copyToClipboard(state.signatureHex, 'Full Signature Hex');
  });
  document.getElementById('copy-r-btn')?.addEventListener('click', () => {
    copyToClipboard(state.sigRHex, 'Signature Component r');
  });
  document.getElementById('copy-s-btn')?.addEventListener('click', () => {
    copyToClipboard(state.sigSHex, 'Signature Component s');
  });

  // Clear Terminal Button
  document.getElementById('clear-term-btn')?.addEventListener('click', () => {
    const termBody = document.getElementById('terminal-body');
    if (termBody) termBody.innerHTML = '';
    logTerminal('Audit log cleared.', 'info');
  });

  // Quiz Submit Button
  document.getElementById('check-quiz-btn')?.addEventListener('click', checkQuizAnswers);

  // Initial Meta and Stepper setup
  updateMessageMeta();
  updateStepper(1);

  // Initialize Continuous ScrollSpy
  initScrollSpy();

  // Check Web Cryptography API availability
  if (!window.crypto || !window.crypto.subtle) {
    showToast('Warning: Web Cryptography API is not supported in this browser.', 'error');
    logTerminal('CRITICAL ERROR: window.crypto.subtle not found!', 'error');
  } else {
    logTerminal('Browser environment verified: window.crypto.subtle active with hardware acceleration.', 'info');
  }
});
