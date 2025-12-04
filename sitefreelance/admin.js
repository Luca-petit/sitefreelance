const BACKEND = "https://sitefreelance.onrender.com";

function adminLogin() {
  const password = document.getElementById("adminPassword").value;

  fetch(`${BACKEND}/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem("admin_token", data.token);
        loadDashboard();
      } else {
        document.getElementById("loginError").innerText = "Mot de passe incorrect";
      }
    });
}

function loadDashboard() {
  const token = localStorage.getItem("admin_token");
  if (!token) return;

  document.getElementById("loginPanel").classList.add("hidden");
  document.getElementById("dashboard").classList.remove("hidden");

  fetch(`${BACKEND}/admin/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token })
  })
    .then(res => res.json())
    .then(data => {
      const table = document.getElementById("reviewsTable");
      table.innerHTML = "";

      let sum = 0;

      data.reviews.forEach(r => {
        sum += r.rating;

        table.innerHTML += `
          <tr>
            <td>${r.name}</td>
            <td>${"★".repeat(r.rating)}</td>
            <td>${r.message}</td>
            <td>${new Date(r.date).toLocaleDateString()}</td>
            <td><button onclick="deleteReview(${r.id})">Supprimer</button></td>
          </tr>
        `;
      });

      document.getElementById("avgRatingAdmin").innerText =
        "Note moyenne : " + (sum / data.reviews.length || 0).toFixed(1) + " ★";
    });
}

function deleteReview(id) {
  const token = localStorage.getItem("admin_token");

  fetch(`${BACKEND}/admin/review/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, token })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) loadDashboard();
    });
}

function logout() {
  localStorage.removeItem("admin_token");
  window.location.reload();
}

// Auto-login si token
if (localStorage.getItem("admin_token")) loadDashboard();
