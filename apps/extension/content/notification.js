/**
 * Content Script - Shows in-browser notifications for LinkMine
 */

// Create and show notification toast
function showNotification(message, type = 'success', duration = 3000) {
  // Remove any existing notifications
  const existing = document.querySelector('.linkmine-notification')
  if (existing) existing.remove()

  // Create notification element
  const notification = document.createElement('div')
  notification.className = `linkmine-notification linkmine-notification--${type}`
  notification.innerHTML = `
    <div class="linkmine-notification__content">
      <span class="linkmine-notification__icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
      <span class="linkmine-notification__message">${message}</span>
    </div>
  `

  // Add styles inline to avoid conflicts
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 2147483647;
    background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 14px;
    font-weight: 500;
    min-width: 280px;
    max-width: 400px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    pointer-events: auto;
    cursor: pointer;
  `

  notification.querySelector('.linkmine-notification__content').style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
  `

  notification.querySelector('.linkmine-notification__icon').style.cssText = `
    flex-shrink: 0;
    font-weight: bold;
  `

  // Add to page
  document.body.appendChild(notification)

  // Animate in
  setTimeout(() => {
    notification.style.transform = 'translateX(0)'
  }, 10)

  // Auto dismiss
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.transform = 'translateX(100%)'
      setTimeout(() => {
        if (notification.parentNode) notification.remove()
      }, 300)
    }
  }, duration)

  // Click to dismiss
  notification.addEventListener('click', () => {
    notification.style.transform = 'translateX(100%)'
    setTimeout(() => {
      if (notification.parentNode) notification.remove()
    }, 300)
  })
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SHOW_NOTIFICATION') {
    showNotification(message.message, message.variant, message.duration)
    sendResponse({ success: true })
  }
})