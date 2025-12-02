// ====== Config ======
const BACKEND_URL = "http://localhost:3000"; // Remplace par l'URL de ton backend Render en prod

// ====== Menu mobile ======
const menuBtn = document.getElementById("menuBtn");
const mobileMenu = document.getElementById("mobileMenu");
const navLinks = document.getElementById("navLinks");

if(menuBtn && mobileMenu){
  menuBtn.addEventListener("click", () => {
    mobileMenu.classList.toggle("active");
    navLinks.classList.toggle("active");
  });
}

// Ferme le menu quand on clique sur un lien
if(navLinks){
  navLinks.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("active");
      if(mobileMenu) mobileMenu.classList.remove("active");
    });
  });
}

// ====== Smooth scroll ======
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if(target){
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// ====== Année du footer ======
const yearEl = document.getElementById('year');
if(yearEl) yearEl.textContent = new Date().getFullYear();

// ====== Formulaire contact ======
const contactForm = document.getElementById('contactForm');

if(contactForm){
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const formData = {
      name: contactForm.name.value,
      email: contactForm.email.value,
      title: contactForm.title.value,
      message: contactForm.message.value
    };

    try {
      const response = await fetch(`${BACKEND_URL}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    } catch (err) {
      console.error("Erreur réseau:", err);
      alert("Erreur lors de l'envoi, réessayez.");
    }
  });
}

