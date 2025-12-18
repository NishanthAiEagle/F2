/* script.js - Optimized for High-Speed Switching */

const IMAGE_COUNTS = {
  gold_earrings: 5, gold_necklaces: 5,
  diamond_earrings: 5, diamond_necklaces: 6
};

/* DOM Elements */
const videoElement = document.getElementById('webcam');
const canvasElement = document.getElementById('overlay');
const canvasCtx = canvasElement.getContext('2d');
const indicatorDot = document.getElementById('indicator-dot');
const indicatorText = document.getElementById('indicator-text');
const indicatorBox = document.getElementById('gesture-indicator');

/* App State */
let earringImg = null, necklaceImg = null, currentType = '';
let lastGestureTime = 0;
const GESTURE_COOLDOWN = 600; // Reduced from 1000ms for faster response
let isProcessingHand = false;
let isProcessingFace = false;

/* --- NEW: Asset Preloading Cache --- */
const preloadedAssets = {};

async function preloadCategory(type) {
  if (preloadedAssets[type]) return; // Already loaded
  preloadedAssets[type] = [];
  const count = IMAGE_COUNTS[type];
  
  for(let i=1; i<=count; i++) {
    const src = `${type}/${i}.png`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    preloadedAssets[type].push(img);
  }
}

/* --- UI Indicator Helpers --- */
function updateHandIndicator(detected) {
  if (detected) {
    indicatorDot.style.background = "#00ff88"; 
    indicatorText.textContent = "Gesture Active";
  } else {
    indicatorDot.style.background = "#555"; 
    indicatorText.textContent = "Hand Not Detected";
  }
}

function flashIndicator(color) {
    indicatorDot.style.background = color;
    setTimeout(() => { indicatorDot.style.background = "#00ff88"; }, 300);
}

/* ---------- HAND DETECTION ---------- */
const hands = new Hands({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

hands.setOptions({
  maxNumHands: 1,
  modelComplexity: 0, 
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

hands.onResults((results) => {
  isProcessingHand = false; 
  const hasHand = results.multiHandLandmarks && results.multiHandLandmarks.length > 0;
  updateHandIndicator(hasHand);

  if (!hasHand) return;

  const now = Date.now();
  if (now - lastGestureTime < GESTURE_COOLDOWN) return;

  const landmarks = results.multiHandLandmarks[0];
  const indexTip = landmarks[8];
  const indexKnuckle = landmarks[5]; 

  const horizontalDiff = indexTip.x - indexKnuckle.x;

  if (horizontalDiff > 0.12) { // Next
    navigateJewelry(1);
    lastGestureTime = now;
    flashIndicator("#d4af37");
  } 
  else if (horizontalDiff < -0.12) { // Previous
    navigateJewelry(-1);
    lastGestureTime = now;
    flashIndicator("#d4af37");
  }
});

/* ---------- FACE MESH ---------- */
const faceMesh = new FaceMesh({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
});

faceMesh.setOptions({ refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });

faceMesh.onResults((results) => {
  isProcessingFace = false;
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
  
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiFaceLandmarks && results.multiFaceLandmarks[0]) {
    const lm = results.multiFaceLandmarks[0];
    const leftEar = { x: lm[132].x * canvasElement.width, y: lm[132].y * canvasElement.height };
    const rightEar = { x: lm[361].x * canvasElement.width, y: lm[361].y * canvasElement.height };
    const neck = { x: lm[152].x * canvasElement.width, y: lm[152].y * canvasElement.height };
    const earDist = Math.hypot(rightEar.x - leftEar.x, rightEar.y - leftEar.y);

    if (earringImg && earringImg.complete) {
      let ew = earDist * 0.25;
      let eh = (earringImg.height/earringImg.width) * ew;
      canvasCtx.drawImage(earringImg, leftEar.x - ew/2, leftEar.y, ew, eh);
      canvasCtx.drawImage(earringImg, rightEar.x - ew/2, rightEar.y, ew, eh);
    }
    if (necklaceImg && necklaceImg.complete) {
      let nw = earDist * 1.2;
      let nh = (necklaceImg.height/necklaceImg.width) * nw;
      canvasCtx.drawImage(necklaceImg, neck.x - nw/2, neck.y + (earDist*0.2), nw, nh);
    }
  }
  canvasCtx.restore();
});

/* ---------- CAMERA & APP INIT ---------- */
async function init() {
  const camera = new Camera(videoElement, {
    onFrame: async () => {
      if (!isProcessingFace) { isProcessingFace = true; await faceMesh.send({image: videoElement}); }
      if (!isProcessingHand) { isProcessingHand = true; await hands.send({image: videoElement}); }
    },
    width: 1280, height: 720
  });
  camera.start();
}

/* ---------- HELPERS (INSTANT SWITCH) ---------- */
function navigateJewelry(dir) {
  if (!currentType || !preloadedAssets[currentType]) return;
  
  const list = preloadedAssets[currentType];
  let currentImg = currentType.includes('earrings') ? earringImg : necklaceImg;
  
  let idx = list.indexOf(currentImg);
  let nextIdx = (idx + dir + list.length) % list.length;
  
  if (currentType.includes('earrings')) earringImg = list[nextIdx];
  else necklaceImg = list[nextIdx];
}

function selectJewelryType(type) {
  currentType = type;
  preloadCategory(type); // Start preloading immediately
  
  const container = document.getElementById('jewelry-options');
  container.innerHTML = '';
  container.style.display = 'flex';
  
  for(let i=1; i<=IMAGE_COUNTS[type]; i++) {
    const btnImg = new Image();
    btnImg.src = `${type}/${i}.png`;
    btnImg.style.width = "60px";
    btnImg.style.cursor = "pointer";
    btnImg.onclick = () => {
        const fullImg = preloadedAssets[type][i-1];
        if (type.includes('earrings')) earringImg = fullImg;
        else necklaceImg = fullImg;
    };
    container.appendChild(btnImg);
  }
}

function toggleCategory(cat) {
  document.getElementById('subcategory-buttons').style.display = 'flex';
  const subs = document.querySelectorAll('.subpill');
  subs.forEach(b => b.style.display = b.innerText.toLowerCase().includes(cat) ? 'inline-block' : 'none');
}

window.onload = init;
window.toggleCategory = toggleCategory;
window.selectJewelryType = selectJewelryType;