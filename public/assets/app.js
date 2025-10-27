const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

const topbar = document.querySelector('.topbar');
if (topbar) {
  const toggleClass = () => {
    if (window.scrollY > 16) {
      topbar.classList.add('topbar--condensed');
    } else {
      topbar.classList.remove('topbar--condensed');
    }
  };

  toggleClass();
  window.addEventListener('scroll', toggleClass);
}

const menuLinks = document.querySelectorAll('a[href^="#"]');
menuLinks.forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('href');
    if (!targetId || targetId === '#') return;
    const target = document.querySelector(targetId);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  });
});

const contactForm = document.getElementById('contact-form');
const contactStatus = document.getElementById('contact-status');

function setContactStatus(message, variant = '') {
  if (!contactStatus) return;
  contactStatus.textContent = message;
  if (variant) {
    contactStatus.dataset.variant = variant;
  } else {
    delete contactStatus.dataset.variant;
  }
}

if (contactForm) {
  contactForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    const formData = new FormData(contactForm);
    const payload = {
      sender: formData.get('sender')?.toString().trim() || '',
      email: formData.get('email')?.toString().trim() || '',
      body: formData.get('body')?.toString().trim() || ''
    };

    setContactStatus('Sending message...', 'info');

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      contactForm.reset();
      setContactStatus('Message sent! We will respond soon.', 'success');
    } catch (error) {
      console.error(error);
      setContactStatus('Unable to send your message. Please try again.', 'error');
    }
  });

  contactForm.addEventListener('input', () => {
    setContactStatus('');
  });
}
