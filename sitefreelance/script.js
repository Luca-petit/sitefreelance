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
  // ====================== AVIS ===========================
  // ======================================================

  const BACKEND = "https://sitefreelance.onrender.com";

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
      e.target.reset();
      selectedRating = 0;

      document.querySelectorAll("#starSelector i").forEach(s => s.classList.remove("active"));

      loadReviews();
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


