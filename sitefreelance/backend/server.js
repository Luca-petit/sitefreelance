require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Initialisation Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Route GET test
app.get("/", (req, res) => {
  res.send("Backend opérationnel avec Resend 👍");
});

// Route contact
app.post('/contact', async (req, res) => {
  const { name, email, title, message } = req.body;

  if(!name || !email || !title || !message){
    return res.status(400).json({ success: false, message: "Champs manquants" });
  }

  try {
    await resend.emails.send({
      from: "Formulaire Site <onboarding@resend.dev>",
      to: process.env.EMAIL_TO,
      subject: title,
      text: `Nom: ${name}\nEmail: ${email}\nMessage:\n${message}`
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Erreur Resend:", err);
    res.status(500).json({ success: false });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Serveur backend démarré 🚀");
});

