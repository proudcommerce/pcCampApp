// Set page title when translations are loaded
window.addEventListener('translationsLoaded', () => {
  if (window.setPageTitle) {
    window.setPageTitle('pageTitle.floorplan');
  }
});

// Floorplan Zoom-Funktionalität
function toggleZoom() {
  const img = document.getElementById('floorplanImage');
  img.classList.toggle('zoomed');
  
  // Position zurücksetzen wenn ausgezoomt wird
  if (!img.classList.contains('zoomed')) {
    img.style.transform = '';
  }
}

// Touch-Events für bessere mobile Erfahrung
document.addEventListener('DOMContentLoaded', function() {
  const img = document.getElementById('floorplanImage');
  let startDistance = 0;
  let currentScale = 1;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let translateX = 0;
  let translateY = 0;
  
  // Klick zum Zoomen
  img.addEventListener('click', function(e) {
    e.preventDefault();
    toggleZoom();
  });

  // Doppeltippen zum Zoomen
  img.addEventListener('dblclick', function(e) {
    e.preventDefault();
    toggleZoom();
  });
  
  // Mouse/Touch Drag Events
  img.addEventListener('mousedown', function(e) {
    if (img.classList.contains('zoomed')) {
      isDragging = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      img.classList.add('dragging');
      e.preventDefault();
    }
  });
  
  img.addEventListener('mousemove', function(e) {
    if (isDragging) {
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      img.style.transform = `scale(3) translate(${translateX/3}px, ${translateY/3}px)`;
    }
  });
  
  img.addEventListener('mouseup', function() {
    if (isDragging) {
      isDragging = false;
      img.classList.remove('dragging');
    }
  });
  
  img.addEventListener('mouseleave', function() {
    if (isDragging) {
      isDragging = false;
      img.classList.remove('dragging');
    }
  });
  
  // Touch Events für Mobile
  img.addEventListener('touchstart', function(e) {
    if (e.touches.length === 1 && img.classList.contains('zoomed')) {
      isDragging = true;
      startX = e.touches[0].clientX - translateX;
      startY = e.touches[0].clientY - translateY;
      img.classList.add('dragging');
    } else if (e.touches.length === 2) {
      startDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  });
  
  img.addEventListener('touchmove', function(e) {
    if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      translateX = e.touches[0].clientX - startX;
      translateY = e.touches[0].clientY - startY;
      img.style.transform = `scale(3) translate(${translateX/3}px, ${translateY/3}px)`;
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      const scale = currentDistance / startDistance;
      if (scale > 1.2) {
        img.classList.add('zoomed');
      } else if (scale < 0.8) {
        img.classList.remove('zoomed');
        translateX = 0;
        translateY = 0;
        img.style.transform = '';
      }
    }
  });
  
  img.addEventListener('touchend', function() {
    if (isDragging) {
      isDragging = false;
      img.classList.remove('dragging');
    }
  });
});
