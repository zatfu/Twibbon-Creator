(() => {
  const d = document;
  const box = d.getElementById('canvasBox');
  const canvas = d.getElementById('stage');
  const ctx = canvas.getContext('2d');
  const ph = d.getElementById('ph');
  const pickerFab = d.getElementById('pickerFab');
  const cameraFab = d.getElementById('cameraFab');
  const fileInput = d.getElementById('fileInput');
  const twibbonInput = d.getElementById('twibbonInput');
  const processBtn = d.getElementById('processBtn');
  const mask = d.getElementById('mask');
  const countNum = d.getElementById('countNum');
  const afterBar = d.getElementById('afterBar');
  const dlBtn = d.getElementById('dlBtn');
  const dlJpgBtn = d.getElementById('dlJpgBtn');
  const dlWebpBtn = d.getElementById('dlWebpBtn');
  const shareBtn = d.getElementById('shareBtn');
  const resetAllTop = d.getElementById('resetAllTop');

  const cameraModal = d.getElementById('cameraModal');
  const cameraPreview = d.getElementById('cameraPreview');
  const captureBtn = d.getElementById('captureBtn');
  const switchCameraBtn = d.getElementById('switchCameraBtn');
  const closeCameraBtn = d.getElementById('closeCameraBtn');

  const photoControls = d.getElementById('photoControls');
  const brightnessSlider = d.getElementById('brightnessSlider');
  const contrastSlider = d.getElementById('contrastSlider');
  const saturationSlider = d.getElementById('saturationSlider');
  const blurSlider = d.getElementById('blurSlider');

  const fitBtn = d.getElementById('fitBtn');
  const centerBtn = d.getElementById('centerBtn');
  const rotateLeftBtn = d.getElementById('rotateLeftBtn');
  const rotateRightBtn = d.getElementById('rotateRightBtn');
  const customTwibbonBtn = d.getElementById('customTwibbonBtn');

  const installBanner = d.getElementById('installBanner');
  const installBtn = d.getElementById('installBtn');
  const dismissInstall = d.getElementById('dismissInstall');
  const networkStatus = d.getElementById('networkStatus');

  let hasImage = false;
  let img = null;
  let gesturesEnabled = true;
  let cameraStream = null;
  let imageRotation = 0;
  let processing = false;
  let currentCamera = 'user'; // 'user' for front camera, 'environment' for back camera

  let scale = 1, minScale = 0.2, maxScale = 5;
  let tx = 0, ty = 0;

  let filters = {
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0
  };

  const pointers = new Map();
  let raf = null;
  let dirty = true;

  const TWIBBON_DEFAULT_URL = 'twibbon.png';
  let twibbon = null;

  let deferredPrompt = null;
  let isOnline = navigator.onLine;

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resizeCanvasToBox(){
    const rect = box.getBoundingClientRect();
    const w = Math.floor(rect.width);
    const h = Math.floor(rect.width);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width = Math.round(w * DPR);
    canvas.height = Math.round(h * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
    dirty = true; 
    scheduleDraw();
  }

  function clear(){
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, canvas.width/DPR, canvas.height/DPR);
  }

  function draw(){
    if (!dirty) return;
    dirty = false;
    clear();
    
    const W = canvas.width / DPR, H = canvas.height / DPR;
    
    if (hasImage && img){
      ctx.save();
      
      const filterStr = `brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturation}%) blur(${filters.blur}px)`;
      ctx.filter = filterStr;
      
      ctx.translate(W/2 + tx, H/2 + ty);
      ctx.scale(scale, scale);
      ctx.rotate((imageRotation * Math.PI) / 180);
      ctx.drawImage(img, -img.width/2, -img.height/2);
      
      ctx.restore();
    }
    
    if (hasImage && twibbon && twibbon.complete && twibbon.naturalWidth) {
      const r = Math.max(W / twibbon.width, H / twibbon.height);
      const twW = twibbon.width * r, twH = twibbon.height * r;
      ctx.drawImage(twibbon, (W - twW)/2, (H - twH)/2, twW, twH);
    }
    
    if (!hasImage) {
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.1)';
      const step = 32;
      for (let x = 0; x < W; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let y = 0; y < H; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
    }
  }

  function scheduleDraw(){ 
    if (!raf){ 
      raf = requestAnimationFrame(()=>{ 
        raf = null; 
        draw(); 
      }); 
    } 
    dirty = true; 
  }

  function showAlert(message, type = 'error') {
    const config = {
      text: message,
      confirmButtonText: 'OK',
      customClass: {
        popup: 'rounded-2xl',
        confirmButton: 'bg-blue-500 hover:bg-blue-600 rounded-xl'
      },
      backdrop: 'rgba(0,0,0,0.8)'
    };

    switch(type) {
      case 'success':
        Swal.fire({
          icon: 'success',
          title: 'Berhasil!',
          ...config
        });
        break;
      case 'error':
        Swal.fire({
          icon: 'error',
          title: 'Error!',
          ...config
        });
        break;
      case 'warning':
        Swal.fire({
          icon: 'warning',
          title: 'Peringatan!',
          ...config
        });
        break;
      default:
        Swal.fire({
          icon: 'info',
          title: 'Info',
          ...config
        });
    }
  }

  
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('SW registered:', registration);
        
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showAlert('Update tersedia! Refresh halaman untuk menggunakan versi terbaru.', 'info');
            }
          });
        });
      } catch (error) {
        console.log('SW registration failed:', error);
      }
    });
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (!localStorage.getItem('installDismissed')) {
      setTimeout(() => {
        installBanner.classList.add('translate-y-0');
        installBanner.classList.remove('-translate-y-full');
      }, 3000);
    }
  });

  function hideInstallBanner() {
    installBanner.classList.add('-translate-y-full');
    installBanner.classList.remove('translate-y-0');
  }

  function updateNetworkStatus() {
    const wasOnline = isOnline;
    isOnline = navigator.onLine;
    
    if (!isOnline && wasOnline) {
      networkStatus.classList.remove('hidden');
      showAlert('Anda sedang offline. Beberapa fitur mungkin terbatas.', 'warning');
    } else if (isOnline && !wasOnline) {
      networkStatus.classList.add('hidden');
      showAlert('Koneksi kembali normal!', 'success');
    }
  }

  function handleURLParams() {
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    
    switch (action) {
      case 'camera':
        setTimeout(() => startCamera(), 500);
        break;
      case 'new':
        resetAll();
        break;
    }
  }

  function addButtonAnimation(button) {
    button.addEventListener('click', function(e) {
      const ripple = document.createElement('span');
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;
      
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = x + 'px';
      ripple.style.top = y + 'px';
      ripple.classList.add('ripple');
      
      this.appendChild(ripple);
      
      setTimeout(() => {
        ripple.remove();
      }, 600);
    });
  }

  function manageFocus() {
    const focusableElements = d.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
    focusableElements.forEach((el, index) => {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          if (e.shiftKey && index === 0) {
            e.preventDefault();
            focusableElements[focusableElements.length - 1].focus();
          } else if (!e.shiftKey && index === focusableElements.length - 1) {
            e.preventDefault();
            focusableElements[0].focus();
          }
        }
      });
    });
  }

  async function startCamera() {
    try {
      cameraFab.disabled = true;
      cameraFab.innerHTML = '<span class="animate-spin">⏳</span> Membuka...';

      if (cameraStream) {
        stopCamera();
      }

      const constraints = {
        video: {
          width: { ideal: 1920, min: 640 },
          height: { ideal: 1080, min: 480 },
          facingMode: currentCamera,
          frameRate: { ideal: 30, min: 15 },
          aspectRatio: { ideal: 16/9 }
        },
        audio: false
      };

      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        cameraPreview.srcObject = stream;
        cameraStream = stream;
        cameraModal.classList.remove('hidden');
        cameraModal.classList.add('flex');
        
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        switchCameraBtn.style.display = videoDevices.length > 1 ? 'block' : 'none';
        
      } catch (err) {
        console.warn('Primary camera constraints failed, trying fallback:', err);
        
        const fallbackConstraints = {
          video: {
            facingMode: currentCamera,
            width: { min: 320, ideal: 1280, max: 1920 },
            height: { min: 240, ideal: 720, max: 1080 }
          },
          audio: false
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        cameraPreview.srcObject = stream;
        cameraStream = stream;
        cameraModal.classList.remove('hidden');
        cameraModal.classList.add('flex');
      }
      
    } catch (err) {
      console.error('Camera access error:', err);
      let errorMessage = 'Tidak dapat mengakses kamera. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Izin kamera ditolak. Silakan izinkan akses kamera di pengaturan browser.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'Kamera tidak ditemukan pada perangkat ini.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Kamera sedang digunakan aplikasi lain.';
      } else {
        errorMessage += err.message || 'Error tidak dikenal.';
      }
      
      showAlert(errorMessage, 'error');
    } finally {
      cameraFab.disabled = false;
      cameraFab.innerHTML = '<span class="flex items-center gap-2"><span class="text-lg">📸</span><span class="hidden sm:inline">Kamera</span></span>';
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        track.stop();
      });
      cameraStream = null;
    }
    cameraModal.classList.add('hidden');
    cameraModal.classList.remove('flex');
  }

  function switchCamera() {
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    startCamera();
  }

  function capturePhoto() {
    if (!cameraStream) {
      showAlert('Kamera tidak aktif', 'error');
      return;
    }

    const captureCanvas = d.createElement('canvas');
    const captureCtx = captureCanvas.getContext('2d');
    
    captureCanvas.width = cameraPreview.videoWidth || 1280;
    captureCanvas.height = cameraPreview.videoHeight || 720;
    
    captureCtx.drawImage(cameraPreview, 0, 0, captureCanvas.width, captureCanvas.height);
    
    captureCanvas.toBlob(blob => {
      if (blob) {
        loadUserImageFromBlob(blob);
        stopCamera();
        showAlert('Foto berhasil diambil!', 'success');
      } else {
        showAlert('Gagal mengambil foto', 'error');
      }
    }, 'image/jpeg', 0.95);
  }

  function loadUserImage(file){
    if (!file) return;
    const url = URL.createObjectURL(file);
    loadImageFromUrl(url, () => URL.revokeObjectURL(url));
  }

  function loadUserImageFromBlob(blob) {
    const url = URL.createObjectURL(blob);
    loadImageFromUrl(url, () => URL.revokeObjectURL(url));
  }

  function loadImageFromUrl(url, cleanup) {
    const _img = new Image();
    _img.onload = () => {
      img = _img;
      hasImage = true;
      ph.style.display = 'none';
      photoControls.classList.remove('hidden');
      
      filters = { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
      imageRotation = 0;
      updateFilterSliders();
      
      fitImageToCanvas();
      scheduleDraw();
      
      processBtn.disabled = false;
      processBtn.textContent = '✨ Buat Twibbon';
      processBtn.className = 'flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300';
      
      afterBar.classList.remove('show');
      
      if (cleanup) cleanup();
    };
    _img.onerror = () => {
      showAlert('Gagal memuat gambar', 'error');
      if (cleanup) cleanup();
    };
    _img.src = url;
  }

  function loadTwibbonImage(file){
    if (!file) return;
    const url = URL.createObjectURL(file);
    const _tw = new Image();
    _tw.onload = () => {
      const tempCanvas = d.createElement('canvas');
      tempCanvas.width = _tw.width;
      tempCanvas.height = _tw.height;
      const tctx = tempCanvas.getContext('2d');
      tctx.drawImage(_tw, 0, 0);
      const imgData = tctx.getImageData(0, 0, _tw.width, _tw.height).data;

      let hasTransparency = false;
      for (let i = 3; i < imgData.length; i += 4) {
        if (imgData[i] < 255) {
          hasTransparency = true;
          break;
        }
      }

      if (!hasTransparency) {
        showAlert('Twibbon harus memiliki area transparan untuk berfungsi dengan baik!', 'warning');
      }

      twibbon = _tw;
      scheduleDraw();
      URL.revokeObjectURL(url);
      showAlert('Twibbon custom berhasil dimuat!', 'success');
    };
    _tw.onerror = () => {
      showAlert('Gagal memuat twibbon', 'error');
      URL.revokeObjectURL(url);
    };
    _tw.src = url;
  }

  function fitImageToCanvas() {
    if (!hasImage || !img) return;
    const W = canvas.width / DPR, H = canvas.height / DPR;
    const sr = Math.min(W / img.width, H / img.height) * 0.9;
    scale = sr;
    tx = 0;
    ty = 0;
    scheduleDraw();
  }

  function centerImage() {
    tx = 0;
    ty = 0;
    scheduleDraw();
  }

  function rotateImage(degrees) {
    imageRotation = (imageRotation + degrees) % 360;
    scheduleDraw();
  }

  function updateFilterSliders() {
    brightnessSlider.value = filters.brightness;
    contrastSlider.value = filters.contrast;
    saturationSlider.value = filters.saturation;
    blurSlider.value = filters.blur;
  }

  function downloadImage(format = 'png', quality = 0.9) {
    const link = d.createElement('a');
    link.download = `twibbon.${format}`;
    
    if (format === 'png') {
      link.href = canvas.toDataURL('image/png');
    } else if (format === 'jpg') {
      link.href = canvas.toDataURL('image/jpeg', quality);
    } else if (format === 'webp') {
      link.href = canvas.toDataURL('image/webp', quality);
    }
    
    link.click();
  }

  canvas.style.touchAction = 'none';
  let last = {x:0, y:0};
  let pinch = null;

  function getCenter(){
    const pts = Array.from(pointers.values());
    const c = {x:0, y:0};
    for(const p of pts){ c.x += p.x; c.y += p.y; }
    c.x /= pts.length; c.y /= pts.length;
    return c;
  }

  function distance(a,b){ 
    const dx=a.x-b.x, dy=a.y-b.y; 
    return Math.hypot(dx,dy); 
  }


  cameraFab.addEventListener('click', startCamera);
  captureBtn.addEventListener('click', capturePhoto);
  switchCameraBtn.addEventListener('click', switchCamera);
  closeCameraBtn.addEventListener('click', stopCamera);

  brightnessSlider.addEventListener('input', (e) => {
    filters.brightness = e.target.value;
    scheduleDraw();
  });

  contrastSlider.addEventListener('input', (e) => {
    filters.contrast = e.target.value;
    scheduleDraw();
  });

  saturationSlider.addEventListener('input', (e) => {
    filters.saturation = e.target.value;
    scheduleDraw();
  });

  blurSlider.addEventListener('input', (e) => {
    filters.blur = e.target.value;
    scheduleDraw();
  });

  fitBtn.addEventListener('click', fitImageToCanvas);
  centerBtn.addEventListener('click', centerImage);
  rotateLeftBtn.addEventListener('click', () => rotateImage(-90));
  rotateRightBtn.addEventListener('click', () => rotateImage(90));

  pickerFab.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadUserImage(f);
    fileInput.value = '';
  });

  customTwibbonBtn.addEventListener('click', () => twibbonInput.click());
  
  twibbonInput.addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) loadTwibbonImage(f);
    twibbonInput.value = '';
  });

  dlBtn.addEventListener('click', () => downloadImage('png'));
  dlJpgBtn.addEventListener('click', () => downloadImage('jpg'));
  dlWebpBtn.addEventListener('click', () => downloadImage('webp'));

  shareBtn.addEventListener('click', () => {
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'twibbon.png', {type:'image/png'});
      if (navigator.canShare && navigator.canShare({ files:[file] }) && navigator.share){
        try{ 
          await navigator.share({ files:[file], title:'Twibbon', text:'Hasil twibbon saya' }); 
        } catch(e){
        }
      } else {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(()=>URL.revokeObjectURL(url), 15000);
      }
    });
  });

  d.querySelectorAll('.twibbonPreset').forEach(btn => {
    btn.addEventListener('click', () => {
      const twibbonUrl = btn.dataset.twibbon;
      const _tw = new Image();
      _tw.onload = () => {
        twibbon = _tw;
        scheduleDraw();
        showAlert('Twibbon default berhasil dimuat!', 'success');
      };
      _tw.onerror = () => {
        showAlert('Gagal memuat twibbon default', 'error');
      };
      _tw.src = twibbonUrl;
    });
  });



  (function preloadTwibbon(){
    const im = new Image();
    im.onload = ()=>{ 
      twibbon = im; 
      scheduleDraw(); 
    };
    im.src = TWIBBON_DEFAULT_URL;
  })();

  resizeCanvasToBox();
  scheduleDraw();

  handleURLParams();
  manageFocus();
  updateNetworkStatus();
  
  d.querySelectorAll('button').forEach(addButtonAnimation);
  
  [pickerFab, cameraFab, processBtn].forEach(btn => {
    btn.setAttribute('aria-label', btn.textContent);
  });

  
  processBtn.addEventListener('click', () => {
    if (!hasImage || processing) return;
    
    processing = true;
    processBtn.disabled = true;
    processBtn.textContent = 'Memproses...';
    gesturesEnabled = false;
    
    mask.classList.remove('hidden');
    mask.classList.add('flex');
    
    let sec = 3;
    countNum.textContent = sec;
    
    const countdown = setInterval(() => {
      sec--;
      if (sec <= 0) {
        clearInterval(countdown);
        countNum.textContent = '0';
        mask.classList.add('hidden');
        mask.classList.remove('flex');
        afterBar.classList.remove('hidden');
        afterBar.classList.add('show');

        processing = false;
        processBtn.textContent = 'Selesai ✓';
        processBtn.className = 'flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-semibold';
        processBtn.disabled = true;
        gesturesEnabled = true;

        Swal.fire({
          icon: 'success',
          title: 'Twibbon Selesai!',
          text: 'Twibbon Anda berhasil dibuat dan siap untuk diunduh.',
          confirmButtonText: 'OK'
        });
      } else {
        countNum.textContent = sec;
      }
    }, 1000);
  });

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          showAlert('Aplikasi berhasil diinstall!', 'success');
        }
        
        deferredPrompt = null;
        hideInstallBanner();
      } catch (error) {
        console.error('Install failed:', error);
        showAlert('Gagal menginstall aplikasi', 'error');
      }
    });
  }

  if (dismissInstall) {
    dismissInstall.addEventListener('click', () => {
      localStorage.setItem('installDismissed', 'true');
      hideInstallBanner();
    });
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);

  canvas.addEventListener('pointerdown', (e) => {
    if (!hasImage || !gesturesEnabled) return;
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY});
    
    if (pointers.size === 1) {
      const p = Array.from(pointers.values())[0];
      last = {x: p.x, y: p.y};
    } else if (pointers.size === 2) {
      pinch = {
        scale: scale,
        distance: distance(...Array.from(pointers.values())),
        center: getCenter()
      };
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!hasImage || !gesturesEnabled || !pointers.has(e.pointerId)) return;
    e.preventDefault();
    
    pointers.set(e.pointerId, {x: e.offsetX, y: e.offsetY});
    
    if (pointers.size === 1) {
      const p = Array.from(pointers.values())[0];
      tx += p.x - last.x;
      ty += p.y - last.y;
      last = {x: p.x, y: p.y};
      scheduleDraw();
    } else if (pointers.size === 2 && pinch) {
      const pts = Array.from(pointers.values());
      const currentDistance = distance(pts[0], pts[1]);
      const currentCenter = getCenter();
      
      const scaleChange = currentDistance / pinch.distance;
      const newScale = Math.max(minScale, Math.min(maxScale, pinch.scale * scaleChange));
      
      const centerChange = {
        x: currentCenter.x - pinch.center.x,
        y: currentCenter.y - pinch.center.y
      };
      
      scale = newScale;
      tx += centerChange.x;
      ty += centerChange.y;
      
      scheduleDraw();
    }
  });

  canvas.addEventListener('pointerup', (e) => {
    if (!pointers.has(e.pointerId)) return;
    e.preventDefault();
    canvas.releasePointerCapture(e.pointerId);
    pointers.delete(e.pointerId);
    
    if (pointers.size < 2) {
      pinch = null;
    }
    
    if (pointers.size === 1) {
      const p = Array.from(pointers.values())[0];
      last = {x: p.x, y: p.y};
    }
  });

  canvas.addEventListener('pointercancel', (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  });

  canvas.addEventListener('wheel', (e) => {
    if (!hasImage || !gesturesEnabled) return;
    e.preventDefault();
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * zoomFactor));
    
    if (newScale !== scale) {
      const scaleChange = newScale / scale;
      tx = mouseX - (mouseX - tx) * scaleChange;
      ty = mouseY - (mouseY - ty) * scaleChange;
      scale = newScale;
      scheduleDraw();
    }
  });

  function resetAll(){
    Swal.fire({
      title: 'Reset Semua?',
      text: 'Apakah Anda yakin ingin menghapus semua perubahan?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Reset',
      cancelButtonText: 'Batal',
      confirmButtonColor: '#ef4444'
    }).then((result) => {
      if (result.isConfirmed) {
        hasImage = false; 
        img = null;
        imageRotation = 0;
        filters = { brightness: 100, contrast: 100, saturation: 100, blur: 0 };
        
        const defaultTw = new Image();
        defaultTw.onload = () => { 
          twibbon = defaultTw; 
          scheduleDraw(); 
        };
        defaultTw.src = TWIBBON_DEFAULT_URL;
        
        ph.style.display = '';
        photoControls.classList.add('hidden');
        afterBar.classList.remove('show');
        afterBar.classList.add('hidden');
        
        processBtn.textContent = '✨ Buat Twibbon';
        processBtn.className = 'flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed';
        processBtn.disabled = true;
        
        scale = 1; 
        tx = 0; 
        ty = 0; 
        pointers.clear();
        gesturesEnabled = true;
        updateFilterSliders();

        Swal.fire({
          icon: 'success',
          title: 'Reset Berhasil!',
          text: 'Semua perubahan telah dihapus.',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  }

  resetAllTop.addEventListener('click', resetAll);
  window.addEventListener('resize', resizeCanvasToBox);


  resizeCanvasToBox();
  scheduleDraw();

  handleURLParams();
  manageFocus();
  updateNetworkStatus();
  
  d.querySelectorAll('button').forEach(addButtonAnimation);
  
  [pickerFab, cameraFab, processBtn].forEach(btn => {
    if (btn) btn.setAttribute('aria-label', btn.textContent || btn.innerHTML);
  });

})();

const style = document.createElement('style');
style.textContent = `
  button {
    position: relative;
    overflow: hidden;
  }
  
  .ripple {
    position: absolute;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.3);
    animation: rippleEffect 0.6s linear;
    pointer-events: none;
  }
  
  @keyframes rippleEffect {
    0% {
      transform: scale(0);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
  
  @media (prefers-reduced-motion: reduce) {
    * {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
document.head.appendChild(style);
