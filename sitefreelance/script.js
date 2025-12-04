console.log("Script chargé ✅");

document.addEventListener('DOMContentLoaded', () => {

  // ---------------- MENU HAMBURGER ----------------
  const menuBtn = document.getElementById('menuBtn');
  const navLinks = document.getElementById("navLinks");

  if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
      navLinks.classList.toggle("active");
    });

    navLinks.querySelectorAll("a").forEach(link => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("active");
      });
    });
  }

  // ---------------- SMOOTH SCROLL ----------------
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

  // ---------------- FOOTER YEAR ----------------
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ======================================================
// =============== FORMULAIRE CONTACT ===================
// ======================================================

const BACKEND = "https://sitefreelance.onrender.com";

const contactForm = document.getElementById("contactForm");

if (contactForm) {
  contactForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      name: e.target.name.value,
      email: e.target.email.value,
      title: e.target.title.value,
      message: e.target.message.value,
      website: e.target.website.value // honeypot
    };

    console.log("⏳ Envoi du message…");

    try {
      const response = await fetch(`${BACKEND}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });

      const res = await response.json();

      if (res.success) {
        console.log("✔️ Message envoyé !");
        window.location.href = "confirmation.html";
      } else {
        alert("Erreur lors de l’envoi. Réessaie !");
        console.error(res);
      }

    } catch (err) {
      console.error("Erreur réseau :", err);
      alert("Impossible d’envoyer le message.");
    }
  });
}



  // ======================================================
  // ====================== AVIS ===========================
  // ======================================================

  // ⭐ Sélection d'étoiles
  let selectedRating = 0;
  document.querySelectorAll("#starSelector i").forEach(star => {
    star.addEventListener("click", () => {
      selectedRating = star.dataset.star;

      document.querySelectorAll("#starSelector i").forEach(s =>
        s.classList.toggle("active", s.dataset.star <= selectedRating)
      );
    });
  });

  // 📩 Envoi avis
  document.getElementById("reviewForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    if (selectedRating == 0) return alert("Choisis une note ⭐");

    const data = {
      name: e.target.name.value,
      message: e.target.message.value,
      rating: selectedRating
    };

    const r = await fetch(`${BACKEND}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const res = await r.json();

    if (res.success) {
  localStorage.setItem("delete_token_" + res.id, res.delete_token);
  window.location.href = "review-confirmation.html";
}

  });

  // 📥 Charger avis
  async function loadReviews() {
    const req = await fetch(`${BACKEND}/reviews`);
    const reviews = await req.json();   // <-- TON BACKEND RENVOIE UN TABLEAU

    if (!Array.isArray(reviews)) {
      console.error("Réponse avis invalide :", reviews);
      return;
    }

    // ---- Calcul moyenne ----
    if (reviews.length > 0) {
      const avg = (reviews.reduce((a, b) => a + b.rating, 0) / reviews.length).toFixed(1);
      document.getElementById("avgRating").innerText = avg;
    } else {
      document.getElementById("avgRating").innerText = "0.0";
    }

    // ---- Remplir carrousel ----
    const track = document.getElementById("carouselTrack");
    track.innerHTML = "";

    reviews.forEach(r => {
      const token = localStorage.getItem("delete_token_" + r.id);

      track.innerHTML += `
        <div class="review-card">
          <div class="review-header">
            <strong>${r.name}</strong>
            <span class="review-stars">${"★".repeat(r.rating)}</span>
          </div>
          <p>${r.message}</p>

          ${token ? `<button onclick="deleteReview(${r.id})" class="review-delete">Supprimer</button>` : ""}
                      <button onclick="adminDeleteReview(${r.id})" class="review-delete admin-btn">🛑 Modération</button>

        </div>
      `;
    });
  }

  // ❌ Supprimer avis
  window.deleteReview = async function (id) {
    const token = localStorage.getItem("delete_token_" + id);

    const r = await fetch(`${BACKEND}/reviews/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, delete_token: token })
    });

    const res = await r.json();
    if (res.success) {
      localStorage.removeItem("delete_token_" + id);
      loadReviews();
    }
  };

  window.adminDeleteReview = async function (id) {
  const password = prompt("Mot de passe admin :");

  if (!password) return;

  const r = await fetch(`${BACKEND}/admin/reviews/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, password })
  });

  const res = await r.json();

  if (res.success) {
    alert("Avis supprimé ✔️");
    loadReviews();
  } else if (res.error === "wrong_password") {
    alert("❌ Mot de passe incorrect");
  } else {
    alert("⚠️ Erreur lors de la suppression");
  }
};


  // ---------------- CAROUSEL ----------------
  document.getElementById("nextReview").addEventListener("click", () => {
    document.getElementById("carouselTrack").scrollBy({ left: 320, behavior: "smooth" });
  });

  document.getElementById("prevReview").addEventListener("click", () => {
    document.getElementById("carouselTrack").scrollBy({ left: -320, behavior: "smooth" });
  });

  // Charge au démarrage
  loadReviews();

});




