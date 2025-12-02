console.log("Script chargé ✅");

document.addEventListener("DOMContentLoaded", () => {

  const BACKEND_URL = "https://sitefreelance.onrender.com";

  let deleteToken = null;
  let deleteId = null;
  let reviewsData = [];
  let reviewsShown = 5;

  // ----------------------------------------
  // ⭐ Sélection étoiles
  // ----------------------------------------
  const stars = document.querySelectorAll(".star");
  const ratingInput = document.getElementById("rating");

  stars.forEach(star => {
    star.addEventListener("click", () => {
      const v = star.dataset.value;
      ratingInput.value = v;
      stars.forEach(s => s.classList.toggle("selected", s.dataset.value <= v));
    });
    star.addEventListener("mouseover", () => {
      const v = star.dataset.value;
      stars.forEach(s => s.classList.toggle("hover", s.dataset.value <= v));
    });
    star.addEventListener("mouseout", () => {
      stars.forEach(s => s.classList.remove("hover"));
    });
  });

  // ----------------------------------------
  // 📤 Envoyer AVIS
  // ----------------------------------------
  const form = document.getElementById("reviewForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      name: form.name.value,
      rating: form.rating.value,
      message: form.message.value
    };

    const res = await fetch(`${BACKEND_URL}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      deleteToken = result.delete_token;
      deleteId = result.id;

      alert("Merci pour votre avis !");
      form.reset();

      stars.forEach(s => s.classList.remove("selected"));
      ratingInput.value = "";

      loadReviews(true);
    }
  });

  // ----------------------------------------
  // 📥 Charger AVIS
  // ----------------------------------------
  async function loadReviews(scroll = false) {
    const res = await fetch(`${BACKEND_URL}/reviews`);
    reviewsData = await res.json();

    updateAverage();
    renderReviews();

    if (scroll) window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  }

  // ----------------------------------------
  // ⭐ Calcul NOTE MOYENNE
  // ----------------------------------------
  function updateAverage() {
    if (reviewsData.length === 0) return;

    const avg =
      reviewsData.reduce((acc, r) => acc + Number(r.rating), 0)
      / reviewsData.length;

    document.getElementById("averageNote").innerText =
      avg.toFixed(1) + " ⭐ (" + reviewsData.length + " avis)";
  }

  // ----------------------------------------
  // 🔽 Bouton voir plus
  // ----------------------------------------
  document.getElementById("loadMoreBtn").addEventListener("click", () => {
    reviewsShown += 5;
    renderReviews();
  });

  // ----------------------------------------
  // 🖨 Afficher AVIS
  // ----------------------------------------
  function renderReviews() {
    const container = document.getElementById("reviewsList");
    container.innerHTML = "";

    reviewsData.slice(0, reviewsShown).forEach(r => {
      const stars = "⭐".repeat(r.rating);

      const delButton =
        deleteToken && deleteId === r.id
          ? `<button class="delete-btn" data-id="${r.id}">Supprimer</button>`
          : "";

      const html = `
        <div class="review-card">
          <div class="review-header">
            <strong>${r.name}</strong>
            <span>${stars}</span>
          </div>
          <p>${r.message}</p>
          <small>${new Date(r.date).toLocaleDateString()}</small>
          ${delButton}
        </div>`;
      container.innerHTML += html;
    });

    document.querySelectorAll(".delete-btn").forEach(btn => {
      btn.addEventListener("click", deleteReview);
    });

    if (reviewsShown < reviewsData.length)
      loadMoreBtn.style.display = "block";
    else
      loadMoreBtn.style.display = "none";
  }

  // ----------------------------------------
  // ❌ Supprimer AVIS
  // ----------------------------------------
  async function deleteReview(e) {
    const id = e.target.dataset.id;

    const res = await fetch(`${BACKEND_URL}/reviews/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, delete_token: deleteToken })
    });

    const r = await res.json();

    if (r.success) {
      alert("Avis supprimé !");
      deleteToken = null;
      deleteId = null;
      loadReviews();
    }
  }

  loadReviews();
});

