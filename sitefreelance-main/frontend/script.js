// ====== Test de chargement ======
console.log("Script chargé ✅");

document.addEventListener('DOMContentLoaded', () => {

  // ====== CONFIG BACKEND ======
  const BACKEND_URL = "https://sitefreelance.onrender.com/contact"; // Ton backend Render

  // ====== MENU MOBILE ======
  const menuBtn = document.getElementById('menuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks = document.getElementById("navLinks");

  if(menuBtn && mobileMenu){
    menuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
    });
  }

  if(menuBtn && navLinks){
    menuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });

    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        mobileMenu?.classList.remove("active");
      });
    });
  }

  // ====== SMOOTH SCROLL ======
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if(target){
        target.scrollIntoView({ behavior: 'smooth' });
        mobileMenu?.classList.remove('active');
      }
    });
  });

  // ====== ANNÉE FOOTER ======
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = new Date().getFullYear();

  // ====== FORMULAIRE CONTACT ======
  const contactForm = document.getElementById('contactForm');

  if(contactForm){
    contactForm.addEventListener('submit', async e => {
      e.preventDefault();

      const formData = {
        name: contactForm.name.value,
        email: contactForm.email.value,
        title: contactForm.title.value,
        message: contactForm.message.value
      };

      try {
        const response = await fetch(`${BACKEND_URL}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        const result = await response.json();

        if(result.success){
          console.log("Mail envoyé ✅");
          window.location.href = 'confirmation.html';
        } else {
          console.error("Erreur backend:", result.message);
          alert("Erreur lors de l'envoi, réessayez.");
        }
      } catch(err){
        console.error("Erreur réseau:", err);
        alert("Erreur lors de l'envoi, réessayez.");
      }
    });
  }

});
